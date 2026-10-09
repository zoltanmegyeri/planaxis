import { FloatType, HalfFloatType, Layers, RenderPipeline, RenderTarget } from "three/webgpu";
import type { Box3, Camera, Scene, WebGPURenderer } from "three/webgpu";
import {
  builtinGIContext,
  float,
  mrt,
  normalView,
  packNormalToRGB,
  pass,
  sample,
  screenUV,
  unpackRGBToNormal,
  velocity,
} from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { vxgi } from "three/addons/lighting/vxgi/VXGINode.js";
import { traa } from "three/addons/tsl/display/TRAANode.js";
import type { VxgiConfiguration } from "./global-illumination.js";
import {
  beginGiFrame,
  provisionVxgiLightBudget,
  VXGI_CONFIGURATION,
} from "./global-illumination.js";
import {
  DEFAULT_POST_PROCESSING_SETTINGS,
  isRendererPostProcessingSettings,
} from "./post-processing.js";
import type { RendererPostProcessingSettings } from "./post-processing.js";

/** Owns one final pipeline, including the optional native-WebGPU GI graph. */
export class ApartmentRenderPipeline {
  private readonly scenePass;
  private readonly sceneColor;
  private readonly bloomNode;
  private readonly bloomOutput;
  private readonly pipeline;
  private readonly shadowPreparationTarget = new RenderTarget(1, 1, {
    type: HalfFloatType,
    depthBuffer: false,
  });
  private prepareShadows = false;
  private settings = DEFAULT_POST_PROCESSING_SETTINGS;
  private gi:
    | {
        prePass: ReturnType<typeof pass>;
        node: ReturnType<typeof vxgi>;
        temporal: ReturnType<typeof traa>;
        bloomNode: ReturnType<typeof bloom>;
      }
    | undefined;

  constructor(
    private readonly renderer: WebGPURenderer,
    scene: Scene,
    private readonly camera: Camera,
    private readonly configuration: VxgiConfiguration = VXGI_CONFIGURATION,
  ) {
    this.scenePass = pass(scene, camera);
    this.sceneColor = this.scenePass.getTextureNode("output");
    this.bloomNode = this.createBloom(this.sceneColor);
    this.bloomOutput = this.sceneColor.add(this.bloomNode);
    this.pipeline = new RenderPipeline(renderer, this.bloomOutput);
    this.pipeline.outputColorTransform = true;
  }

  get giEnabled(): boolean {
    return this.gi !== undefined;
  }

  setGiEnabled(enabled: boolean, collector: Scene, bounds: Box3): void {
    if (enabled === this.giEnabled) return;
    if (enabled) {
      const prePass = pass(this.scenePass.scene, this.camera, { samples: 0 });
      prePass.name = "GI depth / normal / velocity";
      prePass.transparent = false;
      prePass.setLayers(new Layers());
      prePass.getTexture("depth").type = FloatType;
      prePass.setMRT(mrt({ output: packNormalToRGB(normalView), velocity }));
      let node: ReturnType<typeof vxgi> | undefined;
      let temporal: ReturnType<typeof traa> | undefined;
      try {
        const normals = sample((uv) => unpackRGBToNormal(prePass.getTextureNode().sample(uv)));
        node = vxgi(
          prePass.getTextureNode("depth"),
          normals,
          collector,
          this.camera,
          this.configuration.resolution,
        );
        node.volume.bounds.copy(bounds);
        provisionVxgiLightBudget(node.volume, this.configuration.lightBudget);
        node.directionalRadiance = this.configuration.directionalRadiance;
        node.bounces = this.configuration.bounces;
        node.coneCount.value = this.configuration.coneCount;
        node.coneAngle.value = this.configuration.coneAngle;
        node.volume.bounceConeAngle.value = this.configuration.bounceConeAngle;
        node.giIntensity.value = this.configuration.giIntensity;
        node.normalOffset.value = this.configuration.normalOffset;
        node.volume.stepScale.value = this.configuration.stepScale;
        node.volume.maxDistance.value = this.configuration.maxDistance;
        node.useTemporalFiltering = true;
        // Keep material AO; voxel geometric AO is neutral until visual acceptance.
        this.scenePass.contextNode = builtinGIContext(
          float(1),
          node.getGINode().sample(screenUV).rgb,
        );
        this.scenePass.needsUpdate = true;
        temporal = traa(
          this.sceneColor,
          prePass.getTextureNode("depth"),
          prePass.getTextureNode("velocity"),
          this.camera,
        );
        this.gi = { prePass, node, temporal, bloomNode: this.createBloom(temporal) };
        this.prepareShadows = true;
        this.scenePass.renderTarget.samples = 0;
        this.scenePass.options.samples = 0;
        this.scenePass.renderTarget.dispose();
      } catch (error) {
        this.scenePass.contextNode = null;
        this.scenePass.needsUpdate = true;
        temporal?.dispose();
        node?.dispose();
        prePass.dispose();
        this.gi = undefined;
        this.prepareShadows = false;
        throw error;
      }
    } else {
      this.scenePass.contextNode = null;
      this.scenePass.needsUpdate = true;
      this.releaseGi();
      this.scenePass.options.samples = undefined;
      this.scenePass.renderTarget.samples = this.renderer.samples;
      this.scenePass.renderTarget.dispose();
    }
    this.updateOutput();
  }

  invalidateGeometry(bounds: Box3): void {
    if (!this.gi) return;
    this.prepareShadows = true;
    this.gi.node.volume.bounds.copy(bounds);
    this.gi.node.needsUpdate = true;
    this.gi.node.lightingNeedsUpdate = true;
    this.resetHistory();
  }

  invalidateLighting(): void {
    if (!this.gi) return;
    this.prepareShadows = true;
    this.gi.node.lightingNeedsUpdate = true;
    this.resetHistory();
  }

  resetHistory(): void {
    if (!this.gi) return;
    // r186 has no reset method. Its public resize path reseeds history from
    // current HDR color when dimensions change. Keep the effect/shader identities.
    const temporal = this.gi.temporal as ReturnType<typeof traa> & {
      setSize(width: number, height: number): void;
    };
    temporal.setSize(1, 1);
  }

  setSettings(settings: RendererPostProcessingSettings): void {
    if (!isRendererPostProcessingSettings(settings))
      throw new Error("Invalid renderer post-processing settings.");
    const toggle = settings.bloomEnabled !== this.settings.bloomEnabled;
    this.settings = { ...settings };
    for (const node of [this.bloomNode, this.gi?.bloomNode]) {
      if (!node) continue;
      node.strength.value = settings.bloomStrength;
      node.radius.value = settings.bloomRadius;
      node.threshold.value = settings.bloomThreshold;
    }
    if (toggle) this.updateOutput();
  }

  render(): void {
    if (this.gi && this.prepareShadows) {
      // r186 allocates a shadow map while building the HDR lighting context,
      // then renders it after VXGI's first injection. Warm that exact context
      // offscreen, then inject from completed maps before the visible frame.
      const target = this.renderer.getRenderTarget();
      try {
        this.renderer.setRenderTarget(this.shadowPreparationTarget);
        beginGiFrame(this.renderer);
        this.pipeline.render();
      } finally {
        this.renderer.setRenderTarget(target);
      }
      this.prepareShadows = false;
      this.gi.node.lightingNeedsUpdate = true;
      this.resetHistory();
    }
    if (this.gi) beginGiFrame(this.renderer);
    this.pipeline.render();
  }

  dispose(): void {
    this.pipeline.dispose();
    this.shadowPreparationTarget.dispose();
    this.releaseGi();
    this.bloomNode.dispose();
    this.scenePass.dispose();
  }

  private createBloom(input: Parameters<typeof bloom>[0]): ReturnType<typeof bloom> {
    return bloom(
      input,
      this.settings.bloomStrength,
      this.settings.bloomRadius,
      this.settings.bloomThreshold,
    );
  }

  private updateOutput(): void {
    const color = this.gi?.temporal ?? this.sceneColor;
    const output = this.settings.bloomEnabled
      ? this.gi
        ? color.add(this.gi.bloomNode)
        : this.bloomOutput
      : color;
    this.pipeline.outputNode = output;
    this.pipeline.needsUpdate = true;
  }

  private releaseGi(): void {
    this.gi?.bloomNode.dispose();
    this.gi?.temporal.dispose();
    this.gi?.node.dispose();
    this.gi?.prePass.dispose();
    this.gi = undefined;
    this.prepareShadows = false;
  }
}
