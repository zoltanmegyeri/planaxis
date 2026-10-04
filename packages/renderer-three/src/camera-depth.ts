import { PerspectiveCamera } from "three/webgpu";
import {
  cameraFar,
  cameraNear,
  positionView,
  renderGroup,
  uniform,
  viewZToLogarithmicDepth,
  viewZToOrthographicDepth,
} from "three/tsl";

// Three r186 can reuse a mapped material's shadow shader between orthographic
// Sun and perspective local-light cameras. Choose the depth curve per render,
// rather than baking the first camera's projection into the shared shader.
export const perspectiveDepth = uniform(false)
  .setGroup(renderGroup)
  .onRenderUpdate(({ camera }) => camera instanceof PerspectiveCamera);

export const cameraDepth = perspectiveDepth.select(
  viewZToLogarithmicDepth(positionView.z, cameraNear, cameraFar),
  viewZToOrthographicDepth(positionView.z, cameraNear, cameraFar),
);
