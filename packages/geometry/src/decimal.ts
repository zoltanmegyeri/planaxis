import { Decimal as DecimalImplementation } from "decimal.js";

const DECIMAL_CALCULATION_PRECISION = 1_000_000_000;

// Keep authoritative calculations isolated from mutable configuration on the
// package's shared Decimal constructor and avoid its 20-digit default limit.
const AuthoritativeDecimal = DecimalImplementation.clone({
  precision: DECIMAL_CALCULATION_PRECISION,
});

export type Decimal = InstanceType<typeof AuthoritativeDecimal>;

export function createDecimal(value: string): Decimal {
  return new AuthoritativeDecimal(value);
}
