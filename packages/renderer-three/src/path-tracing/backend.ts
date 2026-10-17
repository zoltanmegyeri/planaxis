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
  Texture,
  UnsignedByteType,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import type { PerspectiveCamera, ToneMapping, Vector3, Color } from "three/webgpu";
import { prepareTracingMaterials } from "./materials.js";
import type { TracingMaterials } from "./materials.js";
import type { TracingBvh } from "./scene.js";
import { outputFragment, tracingFragment, tracingVertex } from "./shaders.js";
import { cameraNearClipDepth } from "./projection.js";
import type { TracingLights } from "./luminaires.js";
import { MAX_GGX_COSINE_WEIGHT, TRACING_TRANSPORT_HEADROOM } from "./bsdf.js";
import { reflectedSunRoughness } from "./sun-guide.js";

export interface PathTracingStatus {
  readonly available: boolean;
  readonly reason?: string;
  readonly samples: number;
  readonly paused: boolean;
  readonly active: boolean;
  readonly error?: string;
}
export type RenderingView = "interactive" | "path-tracing";

/** Internal engineering controls; never exposed by the application or persisted. */
export interface TracingPathLimits {
  readonly opaque: number;
  readonly total: number;
  readonly roulette: boolean;
  /** Historic baseline only: old intersection and terminal-estimator behavior. */
  readonly legacyTransport?: boolean;
  readonly sunGuiding?: boolean;
}

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
  private materialAtlas: WebGLRenderTarget | undefined;
  private lightTexture: DataTexture | undefined;
  private disposed = false;
  private retainedSamples = 0;
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
        materials: { value: null },
        materialImages: { value: null },
        imageRecords: { value: null },
        nodeCount: { value: 0 },
        lights: { value: null },
        lightCount: { value: 0 },
        previousImage: { value: null },
        sampleIndex: { value: 0 },
        resolution: { value: new Vector2(1, 1) },
        cameraWorld: { value: null },
        inverseProjection: { value: null },
        nearClipDepth: { value: -1 },
        sunDirection: { value: null },
        sunIrradiance: { value: null },
        zenith: { value: null },
        horizon: { value: null },
        upperSkyOnly: { value: false },
        opaqueLimit: { value: 16 },
        interactionLimit: { value: 96 },
        rouletteEnabled: { value: true },
        legacyTransport: { value: false },
        sunGuiding: { value: true },
        sunGuideRoughness: { value: -1 },
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

  private uploadRecords(records: Float32Array, label: string): DataTexture {
    const limit = this.renderer.capabilities.maxTextureSize;
    if (records.some((value) => !Number.isFinite(value)))
      throw new Error(`${label} exceeds path tracing numeric capacity.`);
    const texels = Math.max(1, records.length / 4);
    const width = Math.min(limit, 1024, texels);
    const height = Math.ceil(texels / width);
    if (height > limit) throw new Error(`${label} exceeds path tracing texture capacity.`);
    const padded = new Float32Array(width * height * 4);
    padded.set(records);
    const texture = new DataTexture(padded, width, height, RGBAFormat, FloatType);
    try {
      texture.colorSpace = NoColorSpace;
      texture.minFilter = texture.magFilter = NearestFilter;
      texture.generateMipmaps = false;
      texture.needsUpdate = true;
      this.renderer.initTexture(texture);
      const gl = this.renderer.getContext();
      if (gl.getError() !== gl.NO_ERROR) throw new Error(`${label} texture upload failed.`);
      return texture;
    } catch (error) {
      texture.dispose();
      throw error;
    }
  }

  setLuminaires(lights: TracingLights): void {
    const replacement = this.uploadRecords(lights.records, "Luminaires");
    this.lightTexture?.dispose();
    this.lightTexture = replacement;
    this.tracing.uniforms.lights!.value = replacement;
    this.tracing.uniforms.lightCount!.value = lights.lights.length;
  }

  /** Copy decoded source pixels through this context; never mutate/dispose borrowed maps/images.
   * Raw nearest lookup preserves hidden RGB in opaque alpha and data channels. Filtering and
   * sRGB decoding occur per role in the tracer, before interpolation, not during this copy.
   */
  private uploadImages(input: TracingMaterials): WebGLRenderTarget {
    // Browser-decoded PNG/JPEG/WebP sources are byte textures. Float storage adds no image
    // precision and quadruples their allocation. Retain float storage for non-byte runtime maps.
    const type = input.images.every((image) => image.texture.type === UnsignedByteType)
      ? UnsignedByteType
      : FloatType;
    const bytes = input.width * input.height * (type === UnsignedByteType ? 4 : 16);
    const target = new WebGLRenderTarget(input.width, input.height, {
      type,
      format: RGBAFormat,
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      depthBuffer: false,
      stencilBuffer: false,
    });
    const copy = new ShaderMaterial({
      vertexShader: tracingVertex,
      fragmentShader: `
      uniform sampler2D sourceImage;
      uniform vec2 imageOrigin;
      uniform vec2 imageSize;
      void main() { gl_FragColor = texture2D(sourceImage, (gl_FragCoord.xy-imageOrigin)/imageSize); }
    `,
      toneMapped: false,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        sourceImage: { value: null },
        imageOrigin: { value: new Vector2() },
        imageSize: { value: new Vector2() },
      },
    });
    let source: Texture | undefined;
    try {
      this.renderer.setRenderTarget(target);
      const gl = this.renderer.getContext();
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      const error = gl.getError();
      if (status !== gl.FRAMEBUFFER_COMPLETE || error !== gl.NO_ERROR) {
        const cause =
          error === gl.OUT_OF_MEMORY
            ? "GPU reported out of memory."
            : `Framebuffer status 0x${status.toString(16)}, WebGL error 0x${error.toString(16)}.`;
        throw new Error(
          `Path tracing could not allocate material image storage (${input.images.length} images, ` +
            `${input.width} × ${input.height}, ${Math.ceil(bytes / 2 ** 20)} MiB). ${cause} ` +
            "Use smaller/fewer material images or free GPU memory; Interactive remains available.",
        );
      }
      this.renderer.clear();
      this.renderer.setScissorTest(true);
      this.quad.material = copy;
      for (const image of input.images) {
        const borrowed = image.texture;
        // clone/copy both mutate shared Source readiness. Construct an independent texture instead.
        source =
          borrowed instanceof DataTexture
            ? new DataTexture(borrowed.image.data, borrowed.image.width, borrowed.image.height)
            : new Texture(borrowed.image);
        source.flipY = borrowed.flipY;
        source.format = borrowed.format;
        source.type = borrowed.type;
        source.unpackAlignment = borrowed.unpackAlignment;
        source.colorSpace = NoColorSpace;
        source.minFilter = source.magFilter = NearestFilter;
        source.generateMipmaps = false;
        source.premultiplyAlpha = false;
        source.needsUpdate = true;
        this.renderer.initTexture(source);
        copy.uniforms.sourceImage!.value = source;
        copy.uniforms.imageOrigin!.value.set(image.x, image.y);
        copy.uniforms.imageSize!.value.set(image.width, image.height);
        this.renderer.setViewport(image.x, image.y, image.width, image.height);
        this.renderer.setScissor(image.x, image.y, image.width, image.height);
        this.renderer.render(this.scene, this.camera);
        if (gl.getError() !== gl.NO_ERROR) throw new Error("Material image upload failed.");
        source.dispose();
        source = undefined;
      }
      return target;
    } catch (error) {
      target.dispose();
      throw error;
    } finally {
      source?.dispose();
      copy.dispose();
      this.quad.material = this.tracing;
      this.renderer.setScissorTest(false);
      this.renderer.setRenderTarget(null);
      this.renderer.setViewport(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  setScene(bvh: TracingBvh): void {
    const replacement: DataTexture[] = [];
    let atlas: WebGLRenderTarget | undefined;
    try {
      const input = prepareTracingMaterials(
        bvh.materials,
        this.renderer.capabilities.maxTextureSize,
      );
      for (const records of [bvh.triangles, bvh.nodes, input.records, input.imageRecords])
        replacement.push(this.uploadRecords(records, "Architecture/materials"));
      atlas = this.uploadImages(input);
    } catch (error) {
      for (const texture of replacement) texture.dispose();
      atlas?.dispose();
      throw error;
    }
    for (const texture of this.textures) texture.dispose();
    this.materialAtlas?.dispose();
    this.textures = replacement;
    this.materialAtlas = atlas;
    this.tracing.uniforms.triangles!.value = replacement[0];
    this.tracing.uniforms.nodes!.value = replacement[1];
    this.tracing.uniforms.materials!.value = replacement[2];
    this.tracing.uniforms.imageRecords!.value = replacement[3];
    this.tracing.uniforms.materialImages!.value = atlas.texture;
    this.tracing.uniforms.nodeCount!.value = bvh.nodeCount;
    this.tracing.uniforms.sunGuideRoughness!.value = reflectedSunRoughness(bvh);
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
    this.retainedSamples = 0;
    this.renderer.setSize(w, h, false);
    for (const target of this.targets) target.setSize(w, h);
    this.tracing.uniforms.resolution!.value.set(w, h);
    this.output.uniforms.resolution!.value.set(w, h);
  }

  setDaylight(
    direction: Vector3,
    irradiance: Color,
    zenith: Color,
    horizon: Color,
    // Historical black-lower-hemisphere control, used only by the evaluation harness.
    upperSkyOnly = false,
  ): void {
    const values = [
      ...direction.toArray(),
      ...irradiance.toArray(),
      ...zenith.toArray(),
      ...horizon.toArray(),
    ];
    if (
      values.some((value) => !Number.isFinite(Math.fround(value))) ||
      [...irradiance.toArray(), ...zenith.toArray(), ...horizon.toArray()].some(
        (value) =>
          value < 0 ||
          value > 3.4028234663852886e38 / (TRACING_TRANSPORT_HEADROOM * MAX_GGX_COSINE_WEIGHT),
      ) ||
      Math.abs(direction.lengthSq() - 1) > 1e-6 ||
      typeof upperSkyOnly !== "boolean"
    )
      throw new RangeError(
        "Daylight exceeds path tracing numeric capacity or has an invalid direction.",
      );
    this.tracing.uniforms.sunDirection!.value = direction;
    this.tracing.uniforms.sunIrradiance!.value = irradiance;
    this.tracing.uniforms.zenith!.value = zenith;
    this.tracing.uniforms.horizon!.value = horizon;
    this.tracing.uniforms.upperSkyOnly!.value = upperSkyOnly;
  }

  setPathLimits(limits: TracingPathLimits): void {
    if (
      !Number.isInteger(limits.opaque) ||
      limits.opaque < 1 ||
      limits.opaque > 32 ||
      !Number.isInteger(limits.total) ||
      limits.total < limits.opaque ||
      limits.total > 96 ||
      typeof limits.roulette !== "boolean" ||
      (limits.legacyTransport !== undefined && typeof limits.legacyTransport !== "boolean") ||
      (limits.sunGuiding !== undefined && typeof limits.sunGuiding !== "boolean")
    )
      throw new RangeError(
        "Tracing path limits require 1–32 opaque and up to 96 total interactions.",
      );
    this.tracing.uniforms.opaqueLimit!.value = limits.opaque;
    this.tracing.uniforms.interactionLimit!.value = limits.total;
    this.tracing.uniforms.rouletteEnabled!.value = limits.roulette;
    this.tracing.uniforms.legacyTransport!.value = limits.legacyTransport ?? false;
    this.tracing.uniforms.sunGuiding!.value = limits.sunGuiding ?? true;
  }

  /** Opt-in linear HDR readback, before any presentation conversion. Bottom-left origin. */
  readLinearImage(samples: number): Float32Array {
    if (
      this.disposed ||
      !Number.isInteger(samples) ||
      samples < 1 ||
      samples !== this.retainedSamples
    )
      throw new RangeError("Linear readback requires retained tracing samples.");
    const target = this.targets[(samples - 1) % 2]!;
    const pixels = new Float32Array(target.width * target.height * 4);
    this.renderer.readRenderTargetPixels(target, 0, 0, target.width, target.height, pixels);
    const gl = this.renderer.getContext();
    if (gl.getError() !== gl.NO_ERROR) throw new Error("Path tracing linear readback failed.");
    if (pixels.some((value) => !Number.isFinite(value)))
      throw new Error("Path tracing linear readback contains nonfinite values.");
    return pixels;
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
    this.retainedSamples = sample + 1;
    this.output.uniforms.image!.value = next.texture;
    this.display();
  }

  clear(): void {
    this.retainedSamples = 0;
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
    this.lightTexture?.dispose();
    this.materialAtlas?.dispose();
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
