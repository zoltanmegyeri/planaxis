import {
  DataTexture,
  FloatType,
  Mesh,
  NearestFilter,
  NoColorSpace,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import type { PerspectiveCamera, ToneMapping, Vector3, Color } from "three/webgpu";
import type { TracingBvh } from "./scene.js";
import { outputFragment, tracingFragment, tracingVertex } from "./shaders.js";
import { cameraNearClipDepth } from "./projection.js";

export interface PathTracingStatus {
  readonly available: boolean;
  readonly reason?: string;
  readonly samples: number;
  readonly paused: boolean;
  readonly active: boolean;
  readonly error?: string;
}
export type RenderingView = "interactive" | "path-tracing";

/** Conventional WebGL2/GLSL backend; never render node materials through it.
 * Three core math/camera types are shared by the classic and webgpu entrypoints.
 */
export class PathTracingBackend {
  readonly canvas: HTMLCanvasElement;
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly geometry = new PlaneGeometry(2, 2);
  private readonly tracing: ShaderMaterial;
  private readonly output: ShaderMaterial;
  private readonly quad: Mesh;
  private readonly targets: [WebGLRenderTarget, WebGLRenderTarget];
  private textures: DataTexture[] = [];
  private disposed = false;
  private readonly contextLost: (event: Event) => void;

  constructor(inputCanvas: HTMLCanvasElement, fail: (error: unknown) => void) {
    this.canvas = inputCanvas.ownerDocument.createElement("canvas");
    this.canvas.setAttribute("aria-hidden", "true");
    this.canvas.style.pointerEvents = "none";
    this.canvas.style.display = "none";
    this.contextLost = () =>
      fail(new Error("Path tracing WebGL2 context was lost. Return to Interactive rendering."));
    const context = this.canvas.getContext("webgl2", { antialias: false, alpha: false });
    if (!context || !context.getExtension("EXT_color_buffer_float")) {
      this.geometry.dispose();
      context?.getExtension("WEBGL_lose_context")?.loseContext();
      throw new Error("Path tracing requires WebGL2 with floating-point color attachments.");
    }
    try {
      this.renderer = new WebGLRenderer({ canvas: this.canvas, context, antialias: false });
    } catch (error) {
      this.geometry.dispose();
      context.getExtension("WEBGL_lose_context")?.loseContext();
      throw error;
    }
    this.renderer.debug.onShaderError = (_gl, _program, vertex, fragment) => {
      throw new Error(
        `Path tracing shader failed: ${context.getShaderInfoLog(vertex) ?? ""} ${context.getShaderInfoLog(fragment) ?? ""}`,
      );
    };
    const target = (): WebGLRenderTarget =>
      new WebGLRenderTarget(1, 1, {
        type: FloatType,
        format: RGBAFormat,
        minFilter: NearestFilter,
        magFilter: NearestFilter,
        depthBuffer: false,
        stencilBuffer: false,
      });
    this.targets = [target(), target()];
    this.tracing = new ShaderMaterial({
      vertexShader: tracingVertex,
      fragmentShader: tracingFragment,
      toneMapped: false,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        triangles: { value: null },
        nodes: { value: null },
        nodeCount: { value: 0 },
        previousImage: { value: null },
        sampleIndex: { value: 0 },
        resolution: { value: new Vector2(1, 1) },
        cameraWorld: { value: null },
        inverseProjection: { value: null },
        nearClipDepth: { value: -1 },
        sunDirection: { value: null },
        sunRadiance: { value: null },
        zenith: { value: null },
        horizon: { value: null },
      },
    });
    this.output = new ShaderMaterial({
      vertexShader: tracingVertex,
      fragmentShader: outputFragment,
      toneMapped: true,
      depthTest: false,
      depthWrite: false,
      uniforms: { image: { value: null }, resolution: { value: new Vector2(1, 1) } },
    });
    this.quad = new Mesh(this.geometry, this.tracing);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    try {
      // Probe an actual RGBA32F framebuffer rather than only trusting an extension.
      this.renderer.setRenderTarget(this.targets[0]);
      if (context.checkFramebufferStatus(context.FRAMEBUFFER) !== context.FRAMEBUFFER_COMPLETE)
        throw new Error("Path tracing floating-point framebuffer is unavailable.");
      this.renderer.setRenderTarget(null);
      this.canvas.addEventListener("webglcontextlost", this.contextLost);
      inputCanvas.parentElement?.append(this.canvas);
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  setScene(bvh: TracingBvh): void {
    const replacement: DataTexture[] = [];
    try {
      for (const records of [bvh.triangles, bvh.nodes]) {
        const limit = this.renderer.capabilities.maxTextureSize;
        const width = Math.min(limit, Math.max(1, Math.min(1024, records.length / 4)));
        const height = Math.ceil(records.length / 4 / width);
        if (height > limit) throw new Error("Architecture exceeds path tracing texture capacity.");
        const padded = new Float32Array(width * height * 4);
        padded.set(records);
        const texture = new DataTexture(padded, width, height, RGBAFormat, FloatType);
        texture.colorSpace = NoColorSpace;
        texture.minFilter = texture.magFilter = NearestFilter;
        texture.generateMipmaps = false;
        texture.needsUpdate = true;
        replacement.push(texture);
      }
    } catch (error) {
      for (const texture of replacement) texture.dispose();
      throw error;
    }
    for (const texture of this.textures) texture.dispose();
    this.textures = replacement;
    this.tracing.uniforms.triangles!.value = replacement[0];
    this.tracing.uniforms.nodes!.value = replacement[1];
    this.tracing.uniforms.nodeCount!.value = bvh.nodeCount;
  }

  resize(width: number, height: number, inputCanvas: HTMLCanvasElement): void {
    this.canvas.style.width = inputCanvas.style.width;
    this.canvas.style.height = inputCanvas.style.height;
    this.canvas.style.left = inputCanvas.style.left;
    this.canvas.style.top = inputCanvas.style.top;
    const w = Math.max(1, Math.floor(width)),
      h = Math.max(1, Math.floor(height));
    if (
      w > this.renderer.capabilities.maxTextureSize ||
      h > this.renderer.capabilities.maxTextureSize
    )
      throw new Error("Viewport exceeds path tracing floating-point texture capacity.");
    if (this.canvas.width === w && this.canvas.height === h) return;
    this.renderer.setSize(w, h, false);
    for (const target of this.targets) target.setSize(w, h);
    this.tracing.uniforms.resolution!.value.set(w, h);
    this.output.uniforms.resolution!.value.set(w, h);
  }

  setDaylight(direction: Vector3, radiance: Color, zenith: Color, horizon: Color): void {
    this.tracing.uniforms.sunDirection!.value = direction;
    this.tracing.uniforms.sunRadiance!.value = radiance;
    this.tracing.uniforms.zenith!.value = zenith;
    this.tracing.uniforms.horizon!.value = horizon;
  }

  setPresentation(toneMapping: ToneMapping, exposure: number): void {
    if (this.renderer.toneMapping !== toneMapping) this.output.needsUpdate = true;
    this.renderer.toneMapping = toneMapping;
    this.renderer.toneMappingExposure = exposure;
  }

  trace(camera: PerspectiveCamera, sample: number): void {
    camera.updateMatrixWorld(true);
    this.tracing.uniforms.cameraWorld!.value = camera.matrixWorld;
    this.tracing.uniforms.inverseProjection!.value = camera.projectionMatrixInverse;
    this.tracing.uniforms.nearClipDepth!.value = cameraNearClipDepth(camera);
    this.tracing.uniforms.sampleIndex!.value = sample;
    const next = this.targets[sample % 2]!;
    const previous = this.targets[(sample + 1) % 2]!;
    this.tracing.uniforms.previousImage!.value = previous.texture;
    this.quad.material = this.tracing;
    this.renderer.setRenderTarget(next);
    this.renderer.render(this.scene, this.camera);
    this.output.uniforms.image!.value = next.texture;
    this.display();
  }

  clear(): void {
    for (const target of this.targets) {
      this.renderer.setRenderTarget(target);
      const gl = this.renderer.getContext();
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
        throw new Error("Path tracing framebuffer allocation failed for this viewport.");
      this.renderer.clear();
    }
    this.output.uniforms.image!.value = this.targets[0].texture;
    this.display();
  }

  display(): void {
    if (!this.output.uniforms.image!.value) return;
    this.quad.material = this.output;
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.canvas.removeEventListener("webglcontextlost", this.contextLost);
    for (const texture of this.textures) texture.dispose();
    for (const target of this.targets) target.dispose();
    this.geometry.dispose();
    this.tracing.dispose();
    this.output.dispose();
    this.scene.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}
