// Track geometry + shared game constants for JCB Roller Rush.

export const TRACK = {
  a: 520, // ellipse radius x (centerline)
  b: 320, // ellipse radius y (centerline)
  w: 92, // half road width
  laps: 2,
};

export const CAR = {
  accel: 300,
  reverseAccel: 180,
  maxSpeed: 265,
  maxReverse: 90,
  nitroMultiplier: 1.85,
  drag: 0.85,
  brake: 420,
  steer: 2.5,
};

export const NITRO = {
  duration: 1.4,
  cooldown: 2.2,
};

export type Vec = { x: number; y: number };

export function onTrack(x: number, y: number) {
  const { a, b, w } = TRACK;
  const outer = Math.hypot(x / (a + w), y / (b + w));
  const inner = Math.hypot(x / (a - w), y / (b - w));
  return outer <= 1 && inner >= 1;
}

/** Angle around the ellipse in [-PI, PI]. */
export function trackAngle(x: number, y: number) {
  return Math.atan2(y / TRACK.b, x / TRACK.a);
}

/** Nearest point on the centerline, used to shove the roller back on the road. */
export function centerlinePoint(x: number, y: number): Vec {
  const t = trackAngle(x, y);
  return { x: Math.cos(t) * TRACK.a, y: Math.sin(t) * TRACK.b };
}

export const START_ANGLE = -0.34;

export const CONES: Vec[] = Array.from({ length: 26 }, (_, i) => {
  const t = (i / 26) * Math.PI * 2;
  const side = i % 2 === 0 ? 1 : -1;
  const k = 1 + (side * (TRACK.w - 16)) / ((TRACK.a + TRACK.b) / 2);
  return { x: Math.cos(t) * TRACK.a * k, y: Math.sin(t) * TRACK.b * k };
});

export const DECOR = [
  { x: 0, y: 0, kind: "sign" },
  { x: -180, y: -70, kind: "cone" },
  { x: 200, y: 60, kind: "barrel" },
  { x: 0, y: -TRACK.b - 260, kind: "barrel" },
  { x: -TRACK.a - 260, y: 40, kind: "sign" },
  { x: TRACK.a + 250, y: -60, kind: "cone" },
  { x: 120, y: TRACK.b + 250, kind: "sign" },
] as const;

export type Difficulty = "easy" | "medium" | "hard";

/** Bot roller pace, in pixels per second along the centerline. */
export const BOT_SPEED: Record<Difficulty, number> = {
  easy: 140,
  medium: 195,
  hard: 245,
};
