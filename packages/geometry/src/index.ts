export { createDecimal } from "./decimal.js";
export type { Decimal } from "./decimal.js";
export {
  GEOMETRIC_EPSILON,
  isGeometricallyEqual,
  isGreaterThanOrEqualWithinTolerance,
  isLessThanOrEqualWithinTolerance,
} from "./geometric-comparison.js";
export {
  doesPolygonOverlapRectWithPositiveArea,
  doPolygonsOverlapWithPositiveArea,
  getPolygonArea,
  getPolygonSignedDoubleArea,
  hasPolygonSelfIntersection,
  isPolygonContainedInPolygon,
  locatePointInPolygon,
} from "./polygon-2d.js";
export type { PointPolygonLocation } from "./polygon-2d.js";
export { arePointsExactlyEqual, arePointsGeometricallyEqual } from "./point-2d.js";
export type { Point2D } from "./point-2d.js";
export { arePoints3DExactlyEqual, arePoints3DGeometricallyEqual } from "./point-3d.js";
export type { Point3D } from "./point-3d.js";
export type { HorizontalPolygonSurface3D } from "./horizontal-polygon-surface-3d.js";
export type { RectangularPrism3D } from "./rectangular-prism-3d.js";
export { getVerticalRangeHeight } from "./vertical-range.js";
export type { VerticalRange } from "./vertical-range.js";
export {
  doRectsIntersect,
  doRectsOverlapWithPositiveArea,
  getRectBottomEdge,
  getRectCenterX,
  getRectCenterY,
  getRectRightEdge,
  getRectVertices,
  isPointInRect,
  isRectContainedInRect,
} from "./rect-2d.js";
export type { Rect2D } from "./rect-2d.js";
export {
  doSegmentsProperlyIntersect,
  getOrientation,
  getSegmentIntersectionType,
  isPointOnSegment,
} from "./segment-2d.js";
export type { SegmentIntersectionType } from "./segment-2d.js";
