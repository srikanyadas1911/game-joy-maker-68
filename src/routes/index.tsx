import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import GameCanvas from "@/components/game/GameCanvas";
import { loadBestTime, loadRaces, saveResult } from "@/game/storage";
import { sfx, setMuted } from "@/game/audio";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "JCB Roller Rush — Cartoon Road Roller Racing Game" },
      {
        name: "description",
        content:
          "Race a chunky cartoon road roller around a construction track. Steer with arrow keys, hit space for nitro and beat your best time.",
      },
      { property: "og:title", content: "JCB Roller Rush — Cartoon Road Roller Racing Game" },
      {
        property: "og:description",
        content: "A funny, colourful kids racing game. Drive, boost and beat your best lap time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Game,
});

type Screen = "start" | "racing" | "result";

function Game() {
  const [screen, setScreen] = useState<Screen>("start");
  const [best, setBest] = useState<number | null>(null);
  const [races, setRaces] = useState(0);
  const [lastTime, setLastTime] = useState(0);
  const [isBest, setIsBest] = useState(false);
  const [muted, setMutedState] = useState(false);

  useEffect(() => {
    setBest(loadBestTime());
    setRaces(loadRaces());
  }, []);

  const handleFinish = useCallback(
    (time: number) => {
      const beat = best === null || time < best;
      saveResult(time, best);
      setLastTime(time);
      setIsBest(beat);
      if (beat) setBest(time);
      setRaces((r) => r + 1);
      setScreen("result");
    },
    [best],
  );

  const go = (s: Screen) => {
    sfx.click();
    setScreen(s);
  };

  const toggleSound = () => {
    const next = !muted;
    setMutedState(next);
    setMuted(next);
    if (!next) sfx.click();
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky via-sky/60 to-grass/60 px-4 py-8 font-sans">
      <div className="mx-auto w-full max-w-5xl">
        {screen === "start" && (
          <StartScreen
            best={best}
            races={races}
            muted={muted}
            onToggleSound={toggleSound}
            onStart={() => go("racing")}
          />
        )}

        {screen === "racing" && <GameCanvas key={lastTime + races} onFinish={handleFinish} />}

        {screen === "result" && (
          <ResultScreen
            time={lastTime}
            best={best}
            isBest={isBest}
            onAgain={() => go("racing")}
            onHome={() => go("start")}
          />
        )}
      </div>
    </main>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[2.5rem] border-4 border-construction/60 bg-panel/95 p-8 text-center shadow-toy sm:p-12">
      {children}
    </div>
  );
}

function BigButton({
  children,
  onClick,
  tone = "primary",
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: "primary" | "soft";
}) {
  const styles =
    tone === "primary"
      ? "bg-construction text-construction-foreground border-construction-foreground/20"
      : "bg-secondary text-secondary-foreground border-border";
  return (
    <button
      onClick={onClick}
      className={`font-display rounded-2xl border-4 px-8 py-4 text-2xl shadow-toy transition-all duration-150 hover:-translate-y-1 hover:shadow-glow active:translate-y-1 active:shadow-none ${styles}`}
    >
      {children}
    </button>
  );
}

function Roller() {
  return (
    <div className="animate-bob mx-auto my-6 select-none text-[7rem] leading-none drop-shadow-[0_18px_18px_rgba(0,0,0,0.25)] sm:text-[9rem]">
      🚧🚜
    </div>
  );
}

function StartScreen({
  best,
  races,
  muted,
  onToggleSound,
  onStart,
}: {
  best: number | null;
  races: number;
  muted: boolean;
  onToggleSound: () => void;
  onStart: () => void;
}) {
  return (
    <Card>
      <h1 className="font-display text-5xl tracking-tight text-foreground sm:text-7xl">
        JCB ROLLER RUSH
      </h1>
      <p className="font-display mt-2 text-2xl text-construction-foreground/70">
        Ready, Set, RUMBLE!
      </p>
      <Roller />
      <BigButton onClick={onStart}>▶ START RACE</BigButton>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={onToggleSound}
          className="rounded-full border-2 border-border bg-secondary px-5 py-2 text-sm font-black uppercase tracking-widest text-secondary-foreground transition hover:-translate-y-0.5"
        >
          {muted ? "🔇 Sound Off" : "🔊 Sound On"}
        </button>
        <span className="rounded-full bg-construction px-5 py-2 text-sm font-black uppercase tracking-widest text-construction-foreground">
          Best: {best === null ? "—" : `${best.toFixed(1)}s`}
        </span>
        <span className="rounded-full bg-muted px-5 py-2 text-sm font-black uppercase tracking-widest text-muted-foreground">
          Races: {races}
        </span>
      </div>
      <p className="mt-6 text-sm font-bold text-muted-foreground">
        ↑ drive · ↓ brake · ← → steer · SPACE = nitro
      </p>
    </Card>
  );
}

function ResultScreen({
  time,
  best,
  isBest,
  onAgain,
  onHome,
}: {
  time: number;
  best: number | null;
  isBest: boolean;
  onAgain: () => void;
  onHome: () => void;
}) {
  return (
    <Card>
      <h1 className="font-display text-4xl text-foreground sm:text-6xl">🏁 RACE COMPLETE!</h1>
      <p className="font-display mt-6 text-3xl text-foreground sm:text-5xl">
        Your Time: {time.toFixed(1)}s
      </p>
      {isBest ? (
        <p className="font-display mt-3 animate-bounce text-2xl text-nitro">🎉 NEW BEST TIME!</p>
      ) : (
        <p className="mt-3 text-lg font-bold text-muted-foreground">
          Best: {best === null ? "—" : `${best.toFixed(1)}s`}
        </p>
      )}
      <Roller />
      <div className="flex flex-wrap items-center justify-center gap-4">
        <BigButton onClick={onAgain}>▶ PLAY AGAIN</BigButton>
        <BigButton tone="soft" onClick={onHome}>
          ⌂ HOME
        </BigButton>
      </div>
    </Card>
  );
}
