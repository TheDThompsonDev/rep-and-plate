import { useEffect, useState } from "react";
import { today } from "./domain";

export function millisecondsUntilNextLocalDay(now = new Date()): number {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.max(1, midnight.getTime() - now.getTime());
}

/** Timer plus wake events cover midnight, suspended tabs, clock changes, and BFCache. */
export function subscribeLocalDay(onChange: (day: string) => void): () => void {
  if (typeof window === "undefined" || typeof document === "undefined")
    return () => {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  const refresh = () => {
    if (timer !== undefined) clearTimeout(timer);
    onChange(today());
    timer = setTimeout(refresh, millisecondsUntilNextLocalDay());
  };
  const onVisibility = () => {
    if (document.visibilityState === "visible") refresh();
  };
  window.addEventListener("focus", refresh);
  window.addEventListener("pageshow", refresh);
  document.addEventListener("visibilitychange", onVisibility);
  refresh();
  return () => {
    if (timer !== undefined) clearTimeout(timer);
    window.removeEventListener("focus", refresh);
    window.removeEventListener("pageshow", refresh);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}

export function useLocalDay(): string {
  const [day, setDay] = useState(today);
  useEffect(() => subscribeLocalDay(setDay), []);
  return day;
}
