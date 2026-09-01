declare module "tzdata" {
  interface TimeZoneData {
    readonly zones: Readonly<Record<string, unknown>>;
    readonly rules: Readonly<Record<string, unknown>>;
    readonly version: string;
  }

  const timeZoneData: TimeZoneData;

  export default timeZoneData;
}
