import { useMemo, useState } from "react";
import type { ReactElement } from "react";
import { createCivilClock, daysInYear, formatCivilTime } from "@planaxis/simulation";
import type { CivilTime, PhysicalSimulation } from "@planaxis/simulation";

export function DaylightControls({
  simulation,
  sessionInstant,
  timeZone,
  ready,
  onChange,
}: {
  simulation: PhysicalSimulation;
  sessionInstant: number;
  timeZone: string | undefined;
  ready: boolean;
  onChange: (next: PhysicalSimulation) => void;
}): ReactElement {
  const basis = useMemo(() => {
    try {
      return { clock: createCivilClock(timeZone) };
    } catch {
      return { error: `The declared time zone ${timeZone} is unavailable in this browser.` };
    }
  }, [timeZone]);
  const [notice, setNotice] = useState("");
  const clock = basis.clock;
  const current = clock?.at(simulation.instant);
  const year = clock?.at(sessionInstant).year;
  const labels = current ? formatCivilTime(current) : undefined;
  const edit = (update: Partial<CivilTime>): void => {
    if (!clock || !current || year === undefined) return;
    const result = clock.resolve({ ...current, year, ...update });
    if (result.status === "missing") {
      setNotice(
        "That civil time does not exist because the clocks move forward. Choose another time; the simulation is unchanged.",
      );
      return;
    }
    setNotice(
      result.status === "repeated" ? "Repeated civil time: using the earlier occurrence." : "",
    );
    onChange({ ...simulation, instant: result.instant });
  };
  return (
    <fieldset className="daylight-controls" disabled={!ready}>
      <legend>Daylight</legend>
      <p>Time zone: {timeZone ?? "UTC (no time zone declared)"}</p>
      {current && year !== undefined && (
        <>
          <label className="presentation-slider">
            Date: <output>{labels?.date}</output>
            <input
              aria-label="Physical date"
              type="range"
              min={1}
              max={daysInYear(year)}
              step={1}
              value={current.day}
              onChange={(event) => edit({ day: Number(event.target.value) })}
            />
          </label>
          <label className="presentation-slider">
            Time: <output>{labels?.time}</output>
            <input
              aria-label="Physical time"
              type="range"
              min={0}
              max={1439}
              step={1}
              value={current.minute}
              onChange={(event) => edit({ minute: Number(event.target.value) })}
            />
          </label>
          <p>Skipped clock times are unavailable; repeated times use the earlier occurrence.</p>
        </>
      )}
      {basis.error && <p role="status">{basis.error}</p>}
      {notice && <p role="status">{notice}</p>}
      <label>
        Weather{" "}
        <select
          aria-label="Physical weather"
          value={simulation.weather}
          onChange={(event) => {
            const weather = event.target.value;
            if (weather === "sunny" || weather === "overcast") onChange({ ...simulation, weather });
          }}
        >
          <option value="sunny">Sunny</option>
          <option value="overcast">Overcast</option>
        </select>
      </label>
      <p>
        Visible sky does not yet provide diffuse indoor lighting. Interiors may remain dark. Shadows
        stay enabled.
      </p>
    </fieldset>
  );
}
