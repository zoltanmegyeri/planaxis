import { RenderPipeline } from "three/webgpu";
import type { Camera, Scene, WebGPURenderer } from "three/webgpu";
import { pass } from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import {
  DEFAULT_POST_PROCESSING_SETTINGS,
  isRendererPostProcessingSettings,
} from "./post-processing.js";
import type { RendererPostProcessingSettings } from "./post-processing.js";

/** Owns the HDR scene pass, effect targets and final output material together. */
export class ApartmentRenderPipeline {
  private readonly scenePass;
  private readonly sceneColor;
  private readonly bloomNode;
  private readonly bloomOutput;
  private readonly pipeline;
  private bloomEnabled = DEFAULT_POST_PROCESSING_SETTINGS.bloomEnabled;

  constructor(renderer: WebGPURenderer, scene: Scene, camera: Camera) {
    // PassNode uses a half-float target and inherits the renderer's MSAA samples.
    // Both it and BloomNode read drawing-buffer dimensions at each rendered frame.
    this.scenePass = pass(scene, camera);
    this.sceneColor = this.scenePass.getTextureNode("output");
    const defaults = DEFAULT_POST_PROCESSING_SETTINGS;
    this.bloomNode = bloom(
      this.sceneColor,
      defaults.bloomStrength,
      defaults.bloomRadius,
      defaults.bloomThreshold,
    );
    this.bloomOutput = this.sceneColor.add(this.bloomNode);
    this.pipeline = new RenderPipeline(renderer, this.bloomOutput);
    // The pipeline applies renderer tone mapping/exposure and color conversion
    // once, after the HDR composition, on both supported backends.
    this.pipeline.outputColorTransform = true;
  }

  setSettings(settings: RendererPostProcessingSettings): void {
    if (!isRendererPostProcessingSettings(settings)) {
      throw new Error("Invalid renderer post-processing settings.");
    }
    this.bloomNode.strength.value = settings.bloomStrength;
    this.bloomNode.radius.value = settings.bloomRadius;
    this.bloomNode.threshold.value = settings.bloomThreshold;
    if (settings.bloomEnabled !== this.bloomEnabled) {
      this.bloomEnabled = settings.bloomEnabled;
      // Removing the node from the graph bypasses its extraction/blur passes.
      this.pipeline.outputNode = this.bloomEnabled ? this.bloomOutput : this.sceneColor;
      this.pipeline.needsUpdate = true;
    }
  }

  render(): void {
    this.pipeline.render();
  }

  dispose(): void {
    // RenderPipeline.dispose only releases its own output material.
    this.pipeline.dispose();
    this.bloomNode.dispose();
    this.scenePass.dispose();
  }
}
