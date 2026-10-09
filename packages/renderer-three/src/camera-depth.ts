import { PerspectiveCamera } from "three/webgpu";
import {
  cameraFar,
  cameraNear,
  positionView,
  renderGroup,
  uniform,
  viewZToPerspectiveDepth,
  viewZToReversedPerspectiveDepth,
  viewZToReversedOrthographicDepth,
  viewZToOrthographicDepth,
} from "three/tsl";

// Three r186 can reuse a mapped material's shadow shader between orthographic
// Sun and perspective local-light cameras. Choose the depth curve per render,
// rather than baking the first camera's projection into the shared shader.
export const perspectiveDepth = uniform(false)
  .setGroup(renderGroup)
  .onRenderUpdate(({ camera }) => camera instanceof PerspectiveCamera);

// VXGI injection expects conventional/reversed shadow depths, not logarithmic
// local-light maps. Reversed depth preserves native-WebGPU viewing precision;
// Three's WebGL2 backend can fall back to forward depth without EXT_clip_control.
export const reversedDepth = uniform(false)
  .setGroup(renderGroup)
  .onRenderUpdate(({ renderer }) => renderer?.reversedDepthBuffer === true);

export const cameraDepth = perspectiveDepth.select(
  reversedDepth.select(
    viewZToReversedPerspectiveDepth(positionView.z, cameraNear, cameraFar),
    viewZToPerspectiveDepth(positionView.z, cameraNear, cameraFar),
  ),
  reversedDepth.select(
    viewZToReversedOrthographicDepth(positionView.z, cameraNear, cameraFar),
    viewZToOrthographicDepth(positionView.z, cameraNear, cameraFar),
  ),
);
