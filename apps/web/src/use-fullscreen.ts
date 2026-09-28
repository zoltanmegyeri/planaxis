import { useEffect, useState } from "react";
import type { RefObject } from "react";

export function useFullscreen(area: RefObject<HTMLDivElement | null>) {
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const changed = (): void => {
      const next = document.fullscreenElement === area.current;
      setActive(next);
      if (next) setError("");
    };
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, [area]);
  async function enter(): Promise<void> {
    if (!area.current?.requestFullscreen || document.fullscreenEnabled === false) {
      setError("Full screen is unavailable in this browser.");
      return;
    }
    try {
      await area.current.requestFullscreen();
    } catch {
      setError("Unable to enter full screen. You can continue using the viewport.");
    }
  }
  async function exit(): Promise<void> {
    try {
      await document.exitFullscreen();
    } catch {
      setError("Unable to exit full screen. Use the browser's Escape key.");
    }
  }
  return { active, error, enter, exit };
}
