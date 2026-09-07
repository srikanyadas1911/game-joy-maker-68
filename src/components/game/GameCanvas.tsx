import { useEffect, useRef, useState } from "react";
import {
  BOT_SPEED,
  CAR,
  CONES,
  DECOR,
  NITRO,
  START_ANGLE,
  TRACK,
  centerlinePoint,
  onTrack,
  trackAngle,
  type Difficulty,
} from "@/game/track";
import { sfx, startEngine, stopEngine, updateEngine } from "@/game/audio";

type Props = {
  onFinish: (time: number, won: boolean) => void;
  difficulty: Difficulty;
};

type Hud = { time: number; lap: number; nitro: number; boosting: boolean; speed: number; ahead: boolean };

const PALETTE = {
  grass: "#5fbf52",
  grassDark: "#49a53f",
  asphalt: "#4b4f57",
  asphaltLight: "#5b6069",
  edge: "#f6c945",
  edgeAlt: "#2f3238",
  cone: "#ff7a2f",
  body: "#f8c81c",
  bodyDark: "#d9a406",
  drum: "#3d4148",
  cab: "#2b2f36",
  glass: "#bfe6ff",
  bot: "#ff5d5d",
  botDark: "#d63d3d",
};

export default function GameCanvas({ onFinish, difficulty }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const touch = useRef({ left: false, right: false, up: false, down: false, nitro: false });
  const [hud, setHud] = useState<Hud>({
    time: 0,
    lap: 1,
    nitro: 1,
    boosting: false,
    speed: 0,
    ahead: true,
  });
  const shakeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    wrapRef.current?.focus();
    startEngine();
    sfx.vroom();

    const keys = new Set<string>();
    const held = {
      up: () => keys.has("ArrowUp") || keys.has("KeyW") || touch.current.up,
      down: () => keys.has("ArrowDown") || keys.has("KeyS") || touch.current.down,
      left: () => keys.has("ArrowLeft") || keys.has("KeyA") || touch.current.left,
      right: () => keys.has("ArrowRight") || keys.has("KeyD") || touch.current.right,
      nitro: () => keys.has("Space") || touch.current.nitro,
    };
    const down = (e: KeyboardEvent) => {
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) ||
        e.code === "Space"
      )
        e.preventDefault();
      if (e.code === "KeyH" && !keys.has("KeyH")) sfx.horn();
      keys.add(e.code);
    };
    const up = (e: KeyboardEvent) => keys.delete(e.code);
    window.addEventListener("keydown", down, { passive: false });
    window.addEventListener("keyup", up);

    const start = centerlinePoint(Math.cos(START_ANGLE) * TRACK.a, Math.sin(START_ANGLE) * TRACK.b);
    const car = {
      x: start.x,
      y: start.y,
      heading: START_ANGLE + Math.PI / 2,
      speed: 0,
    };
    let progress = 0; // radians travelled
    let lastAngle = trackAngle(car.x, car.y);
    let time = 0;
    let nitroLeft = 0;
    let nitroCharge = 1;
    let finished = false;
    let raf = 0;
    let prev = performance.now();
    const smoke: { x: number; y: number; life: number }[] = [];

    // opponent roller
    const botLane = 0.82; // slightly inside the centerline
    let botProgress = 0;
    const avgR = (TRACK.a + TRACK.b) / 2;
    const botOmega = BOT_SPEED[difficulty] / avgR;

    const loop = (now: number) => {
      const dt = Math.min((now - prev) / 1000, 0.05);
      prev = now;
      if (!finished) time += dt;

      // --- input ---
      const boosting = nitroLeft > 0;
      if (held.nitro() && !boosting && nitroCharge >= 1) {
        nitroLeft = NITRO.duration;
        nitroCharge = 0;
        shakeRef.current = 1;
        sfx.nitro();
      }
      if (nitroLeft > 0) nitroLeft = Math.max(0, nitroLeft - dt);
      else nitroCharge = Math.min(1, nitroCharge + dt / NITRO.cooldown);

      const boost = nitroLeft > 0 ? CAR.nitroMultiplier : 1;
      const grip = onTrack(car.x, car.y) ? 1 : 0.45;

      if (held.up()) car.speed += CAR.accel * boost * grip * dt;
      else if (held.down()) {
        car.speed -= (car.speed > 0 ? CAR.brake : CAR.reverseAccel) * dt;
      } else {
        car.speed -= car.speed * CAR.drag * dt;
      }
      car.speed = Math.max(
        -CAR.maxReverse,
        Math.min(CAR.maxSpeed * boost * grip, car.speed),
      );

      const steerAmount = CAR.steer * Math.min(1, Math.abs(car.speed) / 90) * Math.sign(car.speed || 1);
      if (held.left()) car.heading -= steerAmount * dt;
      if (held.right()) car.heading += steerAmount * dt;

      const nx = car.x + Math.cos(car.heading) * car.speed * dt;
      const ny = car.y + Math.sin(car.heading) * car.speed * dt;
      if (onTrack(nx, ny)) {
        car.x = nx;
        car.y = ny;
      } else {
        // slide back toward the road and lose momentum
        const c = centerlinePoint(nx, ny);
        car.x = nx + (c.x - nx) * 0.14;
        car.y = ny + (c.y - ny) * 0.14;
        car.speed *= 0.9;
      }

      // --- lap progress ---
      const ang = trackAngle(car.x, car.y);
      let d = ang - lastAngle;
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      progress += d;
      lastAngle = ang;
      const lap = Math.min(TRACK.laps, Math.floor(progress / (Math.PI * 2)) + 1);

      // --- bot ---
      if (!finished) botProgress += botOmega * dt;
      const botAng = START_ANGLE + botProgress;
      const botPos = {
        x: Math.cos(botAng) * (TRACK.a - TRACK.w * (1 - botLane) * 3),
        y: Math.sin(botAng) * (TRACK.b - TRACK.w * (1 - botLane) * 3),
      };
      const botNext = {
        x: Math.cos(botAng + 0.01) * TRACK.a,
        y: Math.sin(botAng + 0.01) * TRACK.b,
      };
      const botHeading = Math.atan2(botNext.y - botPos.y, botNext.x - botPos.x);

      const goal = Math.PI * 2 * TRACK.laps;
      if (!finished && (progress >= goal || botProgress >= goal)) {
        finished = true;
        stopEngine();
        sfx.finish();
        onFinish(time, progress >= goal);
      }

      // --- particles ---
      if (nitroLeft > 0 && Math.random() < 0.7) {
        smoke.push({
          x: car.x - Math.cos(car.heading) * 30,
          y: car.y - Math.sin(car.heading) * 30,
          life: 1,
        });
      }
      for (let i = smoke.length - 1; i >= 0; i--) {
        const p = smoke[i]!;
        p.life -= dt * 2;
        if (p.life <= 0) smoke.splice(i, 1);
      }

      shakeRef.current = Math.max(0, shakeRef.current - dt * 1.2);
      setHud({
        time,
        lap: Math.max(1, lap),
        nitro: nitroLeft > 0 ? nitroLeft / NITRO.duration : nitroCharge,
        boosting: nitroLeft > 0,
        speed: car.speed,
        ahead: progress >= botProgress,
      });

      draw(ctx, canvas, car, smoke, nitroLeft > 0, { ...botPos, heading: botHeading });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [onFinish, difficulty]);

  const press = (k: keyof typeof touch.current, v: boolean) => () => {
    touch.current[k] = v;
  };

  const padBtn =
    "select-none rounded-2xl border-4 border-border bg-panel/95 px-6 py-4 font-display text-2xl text-foreground shadow-toy active:translate-y-1 active:shadow-none";

  return (
    <div className="relative w-full">
      <div
        ref={wrapRef}
        tabIndex={-1}
        className="overflow-hidden rounded-[2rem] border-4 border-border/60 shadow-toy outline-none"
      >
        <canvas
          ref={canvasRef}
          width={1000}
          height={600}
          className={`block w-full ${hud.boosting ? "animate-shake" : ""}`}
        />
      </div>

      {/* HUD */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="rounded-2xl bg-panel/90 px-5 py-3 shadow-toy backdrop-blur">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Time</p>
            <p className="font-display text-3xl leading-none text-foreground">
              {hud.time.toFixed(1)}s
            </p>
          </div>
          <div className="rounded-2xl bg-panel/90 px-4 py-3 text-center shadow-toy backdrop-blur">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Rival</p>
            <p className="font-display text-xl leading-none text-foreground">
              {hud.ahead ? "🥇 You lead" : "🥈 Catch up!"}
            </p>
          </div>
          <div className="rounded-2xl bg-construction px-5 py-3 text-construction-foreground shadow-toy">
            <p className="text-xs font-black uppercase tracking-widest opacity-80">Lap</p>
            <p className="font-display text-3xl leading-none">
              {hud.lap}/{TRACK.laps}
            </p>
          </div>
        </div>

        <div className="flex items-end justify-end">
          <div
            className={`rounded-3xl bg-panel/90 px-6 py-4 text-center shadow-toy backdrop-blur transition-all ${
              hud.boosting ? "scale-105 shadow-glow" : ""
            }`}
          >
            <p className="font-display text-lg leading-none text-foreground">
              {hud.boosting ? "🔥 NITRO!" : "NITRO"}
            </p>
            <div className="mt-2 h-4 w-44 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-[width] duration-100 ${
                  hud.boosting ? "bg-nitro" : "bg-construction"
                }`}
                style={{ width: `${Math.round(hud.nitro * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
              Space = Boost
            </p>
          </div>
        </div>
      </div>

      {/* touch controls */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex gap-3">
          <button
            aria-label="Steer left"
            className={padBtn}
            onPointerDown={press("left", true)}
            onPointerUp={press("left", false)}
            onPointerLeave={press("left", false)}
            onPointerCancel={press("left", false)}
          >
            ◀
          </button>
          <button
            aria-label="Steer right"
            className={padBtn}
            onPointerDown={press("right", true)}
            onPointerUp={press("right", false)}
            onPointerLeave={press("right", false)}
            onPointerCancel={press("right", false)}
          >
            ▶
          </button>
        </div>
        <div className="flex gap-3">
          <button
            aria-label="Brake or reverse"
            className={padBtn}
            onPointerDown={press("down", true)}
            onPointerUp={press("down", false)}
            onPointerLeave={press("down", false)}
            onPointerCancel={press("down", false)}
          >
            ▼
          </button>
          <button
            aria-label="Drive forward"
            className={padBtn}
            onPointerDown={press("up", true)}
            onPointerUp={press("up", false)}
            onPointerLeave={press("up", false)}
            onPointerCancel={press("up", false)}
          >
            ▲
          </button>
          <button
            aria-label="Nitro boost"
            className={`${padBtn} bg-construction text-construction-foreground`}
            onPointerDown={press("nitro", true)}
            onPointerUp={press("nitro", false)}
            onPointerLeave={press("nitro", false)}
            onPointerCancel={press("nitro", false)}
          >
            🔥
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- rendering ---------------- */

function draw(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  car: { x: number; y: number; heading: number; speed: number },
  smoke: { x: number; y: number; life: number }[],
  boosting: boolean,
  bot: { x: number; y: number; heading: number },
) {
  const W = canvas.width;
  const H = canvas.height;
  const zoom = 0.72;

  ctx.save();
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(0, 0, W, H);

  ctx.translate(W / 2, H / 2);
  if (boosting) ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
  ctx.scale(zoom, zoom);
  ctx.translate(-car.x, -car.y);

  // grass stripes
  ctx.fillStyle = PALETTE.grassDark;
  for (let i = -12; i < 12; i++) {
    ctx.globalAlpha = 0.25;
    ctx.fillRect(-2000, i * 160, 4000, 80);
  }
  ctx.globalAlpha = 1;

  // track ring
  ctx.beginPath();
  ctx.ellipse(0, 0, TRACK.a + TRACK.w + 10, TRACK.b + TRACK.w + 10, 0, 0, Math.PI * 2);
  ctx.ellipse(0, 0, TRACK.a - TRACK.w - 10, TRACK.b - TRACK.w - 10, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#3a3d43";
  ctx.fill("evenodd");

  ctx.beginPath();
  ctx.ellipse(0, 0, TRACK.a + TRACK.w, TRACK.b + TRACK.w, 0, 0, Math.PI * 2);
  ctx.ellipse(0, 0, TRACK.a - TRACK.w, TRACK.b - TRACK.w, 0, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.asphalt;
  ctx.fill("evenodd");

  // center dashes
  ctx.strokeStyle = PALETTE.asphaltLight;
  ctx.lineWidth = 6;
  ctx.setLineDash([26, 34]);
  ctx.beginPath();
  ctx.ellipse(0, 0, TRACK.a, TRACK.b, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // kerbs
  drawKerb(ctx, TRACK.a + TRACK.w, TRACK.b + TRACK.w);
  drawKerb(ctx, TRACK.a - TRACK.w, TRACK.b - TRACK.w);

  // finish line
  ctx.save();
  ctx.translate(TRACK.a, 0);
  const rows = 10;
  const cell = (TRACK.w * 2) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < 3; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? "#ffffff" : "#1d1f24";
      ctx.fillRect(c * cell - cell * 1.5, -TRACK.w + r * cell, cell, cell);
    }
  }
  ctx.restore();

  // cones
  CONES.forEach((c) => drawCone(ctx, c.x, c.y));
  DECOR.forEach((d) => {
    if (d.kind === "cone") drawCone(ctx, d.x, d.y);
    else if (d.kind === "barrel") drawBarrel(ctx, d.x, d.y);
    else drawSign(ctx, d.x, d.y);
  });

  // nitro puffs
  smoke.forEach((p) => {
    ctx.globalAlpha = Math.max(0, p.life) * 0.7;
    ctx.fillStyle = p.life > 0.5 ? "#ffd24a" : "#ff7a2f";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 14 * (1.2 - p.life), 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  drawRoller(ctx, bot, false, PALETTE.bot, PALETTE.botDark);
  drawRoller(ctx, car, boosting, PALETTE.body, PALETTE.bodyDark);
  ctx.restore();

  // sky-ish vignette + clouds fixed to camera edges
  drawClouds(ctx, W);
}

function drawKerb(ctx: CanvasRenderingContext2D, a: number, b: number) {
  const steps = 90;
  ctx.lineWidth = 10;
  for (let i = 0; i < steps; i++) {
    const t0 = (i / steps) * Math.PI * 2;
    const t1 = ((i + 1) / steps) * Math.PI * 2;
    ctx.strokeStyle = i % 2 === 0 ? PALETTE.edge : PALETTE.edgeAlt;
    ctx.beginPath();
    ctx.ellipse(0, 0, a, b, 0, t0, t1);
    ctx.stroke();
  }
}

function drawCone(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(0, 6, 14, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.cone;
  ctx.beginPath();
  ctx.moveTo(0, -22);
  ctx.lineTo(11, 6);
  ctx.lineTo(-11, 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillRect(-8, -8, 16, 6);
  ctx.restore();
}

function drawBarrel(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(0, 10, 18, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ff8a3d";
  ctx.fillRect(-16, -22, 32, 32);
  ctx.fillStyle = "#fff";
  ctx.fillRect(-16, -14, 32, 7);
  ctx.fillRect(-16, 0, 32, 7);
  ctx.restore();
}

function drawSign(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#8a6a3a";
  ctx.fillRect(-3, 0, 6, 26);
  ctx.fillStyle = PALETTE.body;
  ctx.beginPath();
  ctx.moveTo(0, -34);
  ctx.lineTo(28, 0);
  ctx.lineTo(0, 34);
  ctx.lineTo(-28, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#2b2f36";
  ctx.fillRect(-4, -16, 8, 20);
  ctx.beginPath();
  ctx.arc(0, 14, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRoller(
  ctx: CanvasRenderingContext2D,
  car: { x: number; y: number; heading: number },
  boosting: boolean,
  bodyColor = PALETTE.body,
  bodyDarkColor = PALETTE.bodyDark,
) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.heading + Math.PI / 2);

  // flames
  if (boosting) {
    const s = 0.7 + Math.random() * 0.6;
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "#ff8a1f";
    ctx.beginPath();
    ctx.ellipse(0, 42, 16, 34 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffd93d";
    ctx.beginPath();
    ctx.ellipse(0, 38, 9, 22 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.ellipse(3, 6, 30, 42, 0, 0, Math.PI * 2);
  ctx.fill();

  // rear drum roller
  ctx.fillStyle = PALETTE.drum;
  roundRect(ctx, -30, 12, 60, 26, 10);
  ctx.fill();

  // body
  ctx.fillStyle = bodyDarkColor;
  roundRect(ctx, -24, -34, 48, 58, 12);
  ctx.fill();
  ctx.fillStyle = bodyColor;
  roundRect(ctx, -21, -36, 42, 54, 12);
  ctx.fill();

  // front drum
  ctx.fillStyle = PALETTE.drum;
  roundRect(ctx, -28, -50, 56, 22, 9);
  ctx.fill();
  ctx.fillStyle = "#61666f";
  roundRect(ctx, -28, -44, 56, 5, 3);
  ctx.fill();

  // cab
  ctx.fillStyle = PALETTE.cab;
  roundRect(ctx, -15, -16, 30, 26, 8);
  ctx.fill();
  ctx.fillStyle = PALETTE.glass;
  roundRect(ctx, -11, -12, 22, 13, 5);
  ctx.fill();

  // headlights
  ctx.fillStyle = "#fff6c9";
  ctx.beginPath();
  ctx.arc(-14, -52, 5, 0, Math.PI * 2);
  ctx.arc(14, -52, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawClouds(ctx: CanvasRenderingContext2D, W: number) {
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "#ffffff";
  const t = (performance.now() / 90) % (W + 300);
  [
    { x: t - 200, y: 46, s: 1 },
    { x: ((t + 420) % (W + 300)) - 200, y: 92, s: 0.7 },
  ].forEach((c) => {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(c.s, c.s);
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.arc(28, 6, 20, 0, Math.PI * 2);
    ctx.arc(-26, 8, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
  ctx.restore();
}
