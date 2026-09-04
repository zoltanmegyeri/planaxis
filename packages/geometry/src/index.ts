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
  locatePointInPolygon,
} from "./polygon-2d.js";
export type { PointPolygonLocation } from "./polygon-2d.js";
export { arePointsExactlyEqual, arePointsGeometricallyEqual } from "./point-2d.js";
export type { Point2D } from "./point-2d.js";
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
