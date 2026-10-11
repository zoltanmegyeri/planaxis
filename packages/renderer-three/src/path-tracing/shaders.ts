/** Bounded adaptation of erichlof's texture-BVH / progressive daylight workflow.
 * CC0-1.0, upstream a930973667faf4502b427a01dd338a19522c8f6c.
 * See UPSTREAM.md and LICENSE-CC0.txt for provenance and substantive changes.
 */
export const tracingVertex = /* glsl */ `
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export const tracingFragment = /* glsl */ `
precision highp float;
precision highp int;
precision highp sampler2D;
uniform sampler2D triangles;
uniform sampler2D nodes;
uniform sampler2D previousImage;
uniform int nodeCount;
uniform int sampleIndex;
uniform vec2 resolution;
uniform mat4 cameraWorld;
uniform mat4 inverseProjection;
uniform float nearClipDepth;
uniform vec3 sunDirection;
uniform vec3 sunRadiance;
uniform vec3 zenith;
uniform vec3 horizon;
const float PI = 3.141592653589793;
const float FAR = 1e30;
// 0.01 mm in renderer meters, independent of the domain's geometric EPSILON.
const float RAY_OFFSET = 0.00001;
uint seed;
float randomValue() {
  seed = seed * 747796405u + 2891336453u;
  uint word = ((seed >> ((seed >> 28u) + 4u)) ^ seed) * 277803737u;
  return float((word >> 22u) ^ word) / 4294967296.0;
}
vec4 record(sampler2D source, int index) {
  int width = textureSize(source, 0).x;
  return texelFetch(source, ivec2(index % width, index / width), 0);
}
bool boxHit(vec3 origin, vec3 direction, vec3 low, vec3 high, float closest) {
  float nearT = 0.0, farT = closest;
  for (int axis = 0; axis < 3; axis++) {
    // Handle parallel rays explicitly, including zero-thickness floor/ceiling bounds.
    if (abs(direction[axis]) < 1e-10) {
      if (origin[axis] < low[axis] || origin[axis] > high[axis]) return false;
    } else {
      float a = (low[axis] - origin[axis]) / direction[axis];
      float b = (high[axis] - origin[axis]) / direction[axis];
      nearT = max(nearT, min(a, b));
      farT = min(farT, max(a, b));
      if (nearT > farT) return false;
    }
  }
  return true;
}
float triangleHit(vec3 origin, vec3 direction, int index, out vec3 normal) {
  vec3 a = record(triangles, index * 4).xyz;
  vec3 e1 = record(triangles, index * 4 + 1).xyz - a;
  vec3 e2 = record(triangles, index * 4 + 2).xyz - a;
  vec3 p = cross(direction, e2);
  float determinant = dot(e1, p);
  if (abs(determinant) < 1e-10) return FAR;
  vec3 t = origin - a;
  float u = dot(t, p) / determinant;
  vec3 q = cross(t, e1);
  float v = dot(direction, q) / determinant;
  float distance = dot(e2, q) / determinant;
  if (u < 0.0 || v < 0.0 || u + v > 1.0 || distance < RAY_OFFSET * 0.25) return FAR;
  normal = normalize(cross(e1, e2));
  if (dot(normal, direction) > 0.0) normal = -normal;
  return distance;
}
float intersectScene(vec3 origin, vec3 direction, out vec3 normal, out vec4 finish) {
  float closest = FAR;
  int node = 0;
  while (node < nodeCount) {
    vec4 low = record(nodes, node * 2);
    vec4 high = record(nodes, node * 2 + 1);
    if (!boxHit(origin, direction, low.xyz, high.xyz, closest)) {
      node = int(low.w);
      continue;
    }
    if (high.w >= 0.0) {
      int index = int(high.w);
      vec3 candidateNormal;
      float distance = triangleHit(origin, direction, index, candidateNormal);
      if (distance < closest) {
        closest = distance;
        normal = candidateNormal;
        finish = record(triangles, index * 4 + 3);
      }
    }
    node++;
  }
  return closest;
}
float glassReflection(vec3 normal, vec3 direction) {
  // IOR 1.5 qualitative clear-glass default. Straight-through thin sheet;
  // no solid-volume refraction, extinction, caustics, or fabricated thickness.
  return 0.04 + 0.96 * pow(1.0 - abs(dot(normal, direction)), 5.0);
}
float sunVisibility(vec3 origin, vec3 direction) {
  float transmission = 1.0;
  for (int pane = 0; pane < 32; pane++) {
    vec3 normal; vec4 finish;
    float distance = intersectScene(origin, direction, normal, finish);
    if (distance == FAR) return transmission;
    if (finish.w < 0.5) return 0.0;
    transmission *= 1.0 - glassReflection(normal, direction);
    origin += direction * (distance + RAY_OFFSET);
  }
  // Bounded traversal exhaustion must occlude, never create a light leak.
  return 0.0;
}
vec3 cosineDirection(vec3 normal) {
  float angle = 2.0 * PI * randomValue();
  float radius = sqrt(randomValue());
  vec3 tangent = normalize(cross(abs(normal.y) < 0.9 ? vec3(0,1,0) : vec3(1,0,0), normal));
  return normalize(tangent * radius * cos(angle) + cross(normal, tangent) * radius * sin(angle)
    + normal * sqrt(1.0 - radius * radius));
}
vec3 radiance(vec3 origin, vec3 direction) {
  vec3 throughput = vec3(1.0), result = vec3(0.0);
  int diffuseBounces = 0;
  // Enough room for eight diffuse interactions plus thin sheets. No denoising
  // or fill hides occlusion; roulette only after the third diffuse bounce.
  for (int bounce = 0; bounce < 24; bounce++) {
    vec3 normal; vec4 finish;
    float distance = intersectScene(origin, direction, normal, finish);
    if (distance == FAR) {
      // Match the existing procedural background's horizon continuation below
      // the horizon, without inserting the upstream demo's fabricated ground box.
      result += throughput * mix(horizon, zenith, smoothstep(0.0, 0.8, direction.y));
      break;
    }
    vec3 point = origin + direction * distance;
    if (finish.w > 0.5) {
      if (randomValue() < glassReflection(normal, direction)) {
        direction = reflect(direction, normal);
        origin = point + normal * RAY_OFFSET;
      } else {
        origin = point - normal * RAY_OFFSET;
      }
      continue;
    }
    throughput *= finish.rgb;
    origin = point + normal * RAY_OFFSET;
    float cosine = max(0.0, dot(normal, sunDirection));
    if (cosine > 0.0)
      result += throughput * sunRadiance * (cosine / PI) * sunVisibility(origin, sunDirection);
    diffuseBounces++;
    if (diffuseBounces >= 8) break;
    direction = cosineDirection(normal);
    if (diffuseBounces >= 3) {
      float survive = clamp(max(throughput.r, max(throughput.g, throughput.b)), 0.1, 0.95);
      if (randomValue() >= survive) break;
      throughput /= survive;
    }
  }
  return result;
}
void main() {
  ivec2 pixel = ivec2(gl_FragCoord.xy);
  seed = uint(pixel.x) * 1973u + uint(pixel.y) * 9277u + uint(sampleIndex) * 26699u + 1u;
  vec2 jitter = vec2(randomValue(), randomValue());
  vec2 ndc = (vec2(pixel) + jitter) / resolution * 2.0 - 1.0;
  vec4 view = inverseProjection * vec4(ndc, nearClipDepth, 1.0);
  vec3 direction = normalize(mat3(cameraWorld) * (view.xyz / view.w));
  vec3 current = radiance(cameraWorld[3].xyz, direction);
  vec3 previous = sampleIndex == 0 ? vec3(0.0) : texelFetch(previousImage, pixel, 0).rgb;
  gl_FragColor = vec4(mix(previous, current, 1.0 / (float(sampleIndex) + 1.0)), 1.0);
}
`;

export const outputFragment = /* glsl */ `
uniform sampler2D image;
uniform vec2 resolution;
void main() {
  gl_FragColor = vec4(texture2D(image, gl_FragCoord.xy / resolution).rgb, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
