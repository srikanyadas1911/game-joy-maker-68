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

const KEY_DIFF = "jcb_difficulty";
const KEY_MUTED = "jcb_muted";

export function loadDifficulty(): "easy" | "medium" | "hard" {
  if (typeof window === "undefined") return "medium";
  const v = window.localStorage.getItem(KEY_DIFF);
  return v === "easy" || v === "hard" ? v : "medium";
}

export function saveDifficulty(v: string) {
  if (typeof window !== "undefined") window.localStorage.setItem(KEY_DIFF, v);
}

export function loadMuted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(KEY_MUTED) === "1";
}

export function saveMuted(v: boolean) {
  if (typeof window !== "undefined") window.localStorage.setItem(KEY_MUTED, v ? "1" : "0");
}

const KEY_MUSIC = "jcb_music";

export function loadMusic(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(KEY_MUSIC) !== "0";
}

export function saveMusic(v: boolean) {
  if (typeof window !== "undefined") window.localStorage.setItem(KEY_MUSIC, v ? "1" : "0");
}
