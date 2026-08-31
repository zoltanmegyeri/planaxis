import type { Decimal } from "./decimal.js";
import { createDecimal } from "./decimal.js";

const TWO = createDecimal("2");

export interface Rect2D {
  readonly x: Decimal;
  readonly y: Decimal;
  readonly width: Decimal;
  readonly height: Decimal;
}

export function getRectRightEdge(rect: Rect2D): Decimal {
  return rect.x.plus(rect.width);
}

export function getRectBottomEdge(rect: Rect2D): Decimal {
  return rect.y.plus(rect.height);
}

export function getRectCenterX(rect: Rect2D): Decimal {
  return rect.x.plus(rect.width.dividedBy(TWO));
}

export function getRectCenterY(rect: Rect2D): Decimal {
  return rect.y.plus(rect.height.dividedBy(TWO));
}
