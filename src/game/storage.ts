const KEY_BEST = "jcb_best_time";
const KEY_RACES = "jcb_completed_races";

export function loadBestTime(): number | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(KEY_BEST);
  return v ? Number(v) : null;
}

export function loadRaces(): number {
  if (typeof window === "undefined") return 0;
  return Number(window.localStorage.getItem(KEY_RACES) ?? 0);
}

export function saveResult(time: number, bestTime: number | null) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY_RACES, String(loadRaces() + 1));
  if (bestTime === null || time < bestTime) {
    window.localStorage.setItem(KEY_BEST, String(time));
  }
}
