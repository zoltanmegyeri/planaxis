import { MIN_GGX_ALPHA } from "./bsdf.js";

/** Renderer-only GGX / Smith / Schlick model and native-pixel repeating map lookup. */
export const materialShader = /* glsl */ `
uniform sampler2D materials;
uniform sampler2D imageRecords;
uniform sampler2D materialImages;
struct Surface { vec3 color; float roughness; float metalness; float ao; vec3 normal; };
vec3 linearColor(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}
vec3 imageTexel(vec4 region, ivec2 pixel, bool color) {
  ivec2 size = ivec2(region.zw);
  ivec2 wrapped = ivec2((pixel.x % size.x + size.x) % size.x, (pixel.y % size.y + size.y) % size.y);
  vec3 value = texelFetch(materialImages, ivec2(region.xy) + wrapped, 0).rgb;
  return color ? linearColor(value) : value;
}
vec3 mapSample(float index, vec2 uv, bool color, vec3 fallback) {
  if (index < 0.0) return fallback;
  vec4 region = record(imageRecords, int(index));
  vec2 pixel = fract(uv) * region.zw - 0.5;
  ivec2 low = ivec2(floor(pixel));
  vec2 f = fract(pixel);
  return mix(mix(imageTexel(region, low, color), imageTexel(region, low + ivec2(1,0), color), f.x),
    mix(imageTexel(region, low + ivec2(0,1), color), imageTexel(region, low + ivec2(1,1), color), f.x), f.y);
}
Surface surfaceAt(vec4 hit, vec3 geometric, vec3 view) {
  int triangle = int(hit.x), offset = triangle * 7;
  vec4 a = record(materials, int(record(triangles, offset).w) * 3);
  vec4 b = record(materials, int(record(triangles, offset).w) * 3 + 1);
  vec4 c = record(materials, int(record(triangles, offset).w) * 3 + 2);
  vec4 uvAB = record(triangles, offset + 3);
  vec2 uvC = record(triangles, offset + 4).xy;
  vec2 uv = uvAB.xy * (1.0 - hit.y - hit.z) + uvAB.zw * hit.y + uvC * hit.z;
  Surface s;
  s.color = a.rgb * mapSample(b.z, uv, true, vec3(1.0));
  s.roughness = a.w * mapSample(b.w, uv, false, vec3(1.0)).g;
  s.metalness = b.x * mapSample(c.x, uv, false, vec3(1.0)).b;
  s.ao = 1.0 - b.y * (1.0 - mapSample(c.z, uv, false, vec3(1.0)).r);
  s.normal = geometric;
  if (c.y >= 0.0) {
    vec3 local = mapSample(c.y, uv, false, vec3(0.5,0.5,1.0)) * 2.0 - 1.0;
    vec3 tangent = record(triangles, offset + 5).xyz;
    vec3 bitangent = record(triangles, offset + 6).xyz;
    vec3 edge1 = record(triangles, offset + 1).xyz - record(triangles, offset).xyz;
    vec3 edge2 = record(triangles, offset + 2).xyz - record(triangles, offset).xyz;
    float facing = dot(cross(edge1, edge2), geometric) < 0.0 ? -1.0 : 1.0;
    // Decode in the physical outward frame, then flip the complete perturbation on back hits.
    vec3 mapped = facing * (tangent * local.x + bitangent * local.y) + geometric * local.z;
    if (dot(mapped, mapped) > 1e-16) {
      mapped = normalize(mapped);
      // Keep shading on the outward geometric hemisphere and visible to the view.
      // Origins and permitted directions always use the geometric boundary separately.
      if (dot(mapped, geometric) > 1e-4 && dot(mapped, view) > 1e-4) s.normal = mapped;
    }
  }
  return s;
}
vec3 fresnel(vec3 f0, float cosine) { return f0 + (1.0 - f0) * pow(1.0 - clamp(cosine,0.0,1.0), 5.0); }
float alpha(Surface s) { return max(${MIN_GGX_ALPHA}, s.roughness * s.roughness); }
float smithRatio(float cosine, float a) {
  // G1/cosine in cancelled form avoids 0/0 at grazing float32 directions.
  return 2.0 / (cosine + sqrt(a*a + (1.0-a*a)*cosine*cosine));
}
float specularProbability(Surface s) {
  vec3 f0 = mix(vec3(0.04), s.color, s.metalness);
  float specular = dot(f0, vec3(0.2126,0.7152,0.0722));
  float diffuse = dot(s.color, vec3(0.2126,0.7152,0.0722)) * (1.0-s.metalness);
  return diffuse == 0.0 ? 1.0 : clamp(specular / (specular + diffuse), 0.1, 0.9);
}
vec3 evaluateBsdf(Surface s, vec3 view, vec3 light, vec3 geometric, out float pdf) {
  pdf = 0.0;
  float nv = dot(s.normal, view), nl = dot(s.normal, light);
  if (nv <= 0.0 || nl <= 0.0 || dot(geometric, light) <= 0.0) return vec3(0.0);
  vec3 sum = view + light;
  float halfScale = max(abs(sum.x), max(abs(sum.y), abs(sum.z)));
  vec3 halfVector = normalize(sum / max(halfScale, 1e-30));
  float nh = max(0.0, dot(s.normal, halfVector));
  float a = alpha(s);
  // Cross product avoids cancellation at the polished endpoint in float32.
  vec3 crossNH = cross(s.normal, halfVector);
  float denominator = dot(crossNH, crossNH) + a*a*nh*nh;
  float distribution = a*a / (PI * denominator * denominator);
  vec3 f0 = mix(vec3(0.04), s.color, s.metalness);
  vec3 f = fresnel(f0, dot(view, halfVector));
  float g1Ratio = smithRatio(nv,a), g2Ratio = smithRatio(nl,a);
  float probability = specularProbability(s);
  pdf = (1.0-probability)*nl/PI + probability*distribution*g1Ratio/4.0;
  // Reciprocal entry/exit attenuation keeps grazing specular reflection from adding full diffuse energy.
  vec3 diffuseTransmission = (1.0-fresnel(f0,nv))*(1.0-fresnel(f0,nl));
  return diffuseTransmission*s.color*(1.0-s.metalness)/PI + f*distribution*g1Ratio*g2Ratio/4.0;
}
mat3 shadingFrame(vec3 normal) {
  vec3 tangent = normalize(cross(abs(normal.y) < 0.9 ? vec3(0,1,0) : vec3(1,0,0), normal));
  return mat3(tangent, cross(normal,tangent), normal);
}
vec3 sampleGgx(vec3 normal, vec3 view, float a, float u, float v) {
  mat3 frame = shadingFrame(normal);
  // Isotropic visible-GGX sampling, Heitz 2018 §§3–4 (see UPSTREAM.md).
  vec3 localView = transpose(frame) * view;
  vec3 stretched = normalize(vec3(a*localView.xy, localView.z));
  float horizontal = dot(stretched.xy, stretched.xy);
  vec3 side = horizontal > 0.0 ? vec3(-stretched.y, stretched.x, 0.0)/sqrt(horizontal) : vec3(1,0,0);
  vec3 up = cross(stretched,side);
  float r = sqrt(u), angle = 2.0*PI*v;
  float x = r*cos(angle), y = r*sin(angle), blend = 0.5*(1.0+stretched.z);
  y = (1.0-blend)*sqrt(max(0.0,1.0-x*x)) + blend*y;
  vec3 hemisphere = side*x + up*y + stretched*sqrt(max(0.0,1.0-x*x-y*y));
  vec3 halfVector = frame * normalize(vec3(a*hemisphere.xy, max(0.0,hemisphere.z)));
  return reflect(-view, halfVector);
}
vec3 sampleBsdf(Surface s, vec3 view) {
  float u = randomValue(), v = randomValue();
  if (randomValue() >= specularProbability(s)) {
    float r = sqrt(u), angle = 2.0*PI*v;
    return shadingFrame(s.normal) * vec3(r*cos(angle), r*sin(angle), sqrt(1.0-u));
  }
  return sampleGgx(s.normal, view, alpha(s), u, v);
}
float sunGuideProbability(Surface s) {
  bool eligible = sunGuiding && !legacyTransport && sunGuideRoughness >= 0.0 && sunDirection.y > 0.0
    && max(sunIrradiance.r,max(sunIrradiance.g,sunIrradiance.b)) > 0.0
    && s.metalness < 0.5 && s.roughness > 0.2;
  // The receiver cosine predicts whether the main reflected lobe is useful here.
  vec3 reflected = vec3(sunDirection.x,-sunDirection.y,sunDirection.z);
  return eligible ? 0.5*clamp(dot(s.normal,reflected),0.0,1.0) : 0.0;
}
float continuationPdf(Surface s, vec3 direction, float bsdfPdf) {
  float probability = sunGuideProbability(s);
  if (probability == 0.0) return bsdfPdf;
  Surface reflector;
  reflector.color=vec3(1.0); reflector.normal=vec3(0,1,0);
  reflector.roughness=sunGuideRoughness; reflector.metalness=1.0; reflector.ao=1.0;
  float guidePdf;
  evaluateBsdf(reflector,sunDirection,-direction,reflector.normal,guidePdf);
  return (1.0-probability)*bsdfPdf+probability*guidePdf;
}
vec3 sampleContinuation(Surface s, vec3 view) {
  float probability = sunGuideProbability(s);
  if (probability > 0.0 && randomValue() < probability) {
    vec3 direction = -sampleGgx(vec3(0,1,0),sunDirection,
      max(${MIN_GGX_ALPHA},sunGuideRoughness*sunGuideRoughness),randomValue(),randomValue());
    return direction.y < 0.0 ? direction : vec3(0.0);
  }
  return sampleBsdf(s,view);
}
float misWeight(float ownPdf, float otherPdf) {
  // Ratio form avoids squaring large polished-lobe densities.
  float ratio = otherPdf / max(ownPdf, 1e-30);
  return 1.0 / (1.0 + ratio*ratio);
}
`;
