export interface CivilTime {
  readonly year: number;
  /** One-based calendar day within the year. */
  readonly day: number;
  /** Minutes after civil midnight, from 0 through 1439. */
  readonly minute: number;
}
export type CivilResolution =
  | { readonly status: "exact" | "repeated"; readonly instant: number }
  | { readonly status: "missing" };
const DAY = 86400000;
export function daysInYear(year: number): number {
  if (!Number.isInteger(year) || year < 100 || year > 9999)
    throw new RangeError("Civil year must be an integer from 100 through 9999.");
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 366 : 365;
}
function civilStamp(value: CivilTime): number {
  if (
    !Number.isInteger(value.day) ||
    value.day < 1 ||
    value.day > daysInYear(value.year) ||
    !Number.isInteger(value.minute) ||
    value.minute < 0 ||
    value.minute > 1439
  )
    throw new RangeError("Invalid civil day or minute.");
  return Date.UTC(value.year, 0, value.day, 0, value.minute);
}
export function formatCivilTime(value: CivilTime): { date: string; time: string } {
  const iso = new Date(civilStamp(value)).toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}
/**
 * Uses only explicitly zoned Intl and UTC arithmetic. Missing zones mean UTC.
 * Gaps are rejected; repeated minutes choose the earlier occurrence and report it.
 * Invalid/unsupported IANA zones throw rather than falling back to machine time.
 */
export function createCivilClock(timeZone = "UTC"): {
  readonly timeZone: string;
  at(instant: number): CivilTime;
  resolve(value: CivilTime): CivilResolution;
} {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    calendar: "gregory",
    numberingSystem: "latn",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const at = (instant: number): CivilTime => {
    const parts = formatter.formatToParts(instant);
    const part = (type: Intl.DateTimeFormatPartTypes): number => {
      const value = parts.find((item) => item.type === type)?.value;
      if (value === undefined) throw new RangeError(`Missing civil ${type}.`);
      return Number(value);
    };
    const year = part("year");
    return {
      year,
      day: (Date.UTC(year, part("month") - 1, part("day")) - Date.UTC(year, 0, 1)) / DAY + 1,
      minute: part("hour") * 60 + part("minute"),
    };
  };
  return {
    timeZone,
    at,
    resolve(value) {
      const stamp = civilStamp(value);
      // Sample the offsets on both sides of civil transitions, including non-hour
      // shifts and date-line skips. This is a current-session calendar, not a historical clock.
      const offsets = new Set<number>();
      for (let hours = -36; hours <= 36; hours += 6) {
        const probe = stamp + hours * 3600000;
        offsets.add(civilStamp(at(probe)) - probe);
      }
      const candidates = [...offsets]
        .map((offset) => stamp - offset)
        .filter((instant) => civilStamp(at(instant)) === stamp)
        .sort((a, b) => a - b);
      const instant = candidates[0];
      return instant === undefined
        ? { status: "missing" }
        : {
            status: candidates.length > 1 ? "repeated" : "exact",
            instant,
          };
    },
  };
}
