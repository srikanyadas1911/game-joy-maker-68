import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import GameCanvas from "@/components/game/GameCanvas";
import {
  loadBestTime,
  loadDifficulty,
  loadMuted,
  loadRaces,
  saveDifficulty,
  saveMuted,
  saveResult,
} from "@/game/storage";
import { sfx, setMuted } from "@/game/audio";
import type { Difficulty } from "@/game/track";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "JCB Roller Rush — Cartoon Road Roller Racing Game" },
      {
        name: "description",
        content:
          "Race a chunky cartoon road roller against a rival on a construction track. Steer with arrows or WASD, hit space for nitro and beat your best time.",
      },
      { property: "og:title", content: "JCB Roller Rush — Cartoon Road Roller Racing Game" },
      {
        property: "og:description",
        content: "A funny, colourful kids racing game. Drive, boost and beat the rival roller.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Game,
});

type Screen = "start" | "racing" | "result";

const LEVELS: { id: Difficulty; label: string; note: string }[] = [
  { id: "easy", label: "Easy", note: "Slow rival" },
  { id: "medium", label: "Medium", note: "Fair race" },
  { id: "hard", label: "Hard", note: "Fast rival" },
];

function Game() {
  const [screen, setScreen] = useState<Screen>("start");
  const [best, setBest] = useState<number | null>(null);
  const [races, setRaces] = useState(0);
  const [lastTime, setLastTime] = useState(0);
  const [isBest, setIsBest] = useState(false);
  const [won, setWon] = useState(true);
  const [muted, setMutedState] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [showOptions, setShowOptions] = useState(false);

  useEffect(() => {
    setBest(loadBestTime());
    setRaces(loadRaces());
    setDifficulty(loadDifficulty());
    const m = loadMuted();
    setMutedState(m);
    setMuted(m);
  }, []);

  const handleFinish = useCallback(
    (time: number, didWin: boolean) => {
      const beat = didWin && (best === null || time < best);
      if (didWin) saveResult(time, best);
      setLastTime(time);
      setIsBest(beat);
      setWon(didWin);
      if (beat) setBest(time);
      if (didWin) setRaces((r) => r + 1);
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
    saveMuted(next);
    if (!next) sfx.click();
  };

  const pickLevel = (id: Difficulty) => {
    setDifficulty(id);
    saveDifficulty(id);
    sfx.click();
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky via-sky/60 to-grass/60 px-4 py-8 font-sans">
      <div className="mx-auto w-full max-w-5xl">
        {screen === "start" && (
          <StartScreen
            best={best}
            races={races}
            muted={muted}
            difficulty={difficulty}
            onOpenOptions={() => {
              sfx.click();
              setShowOptions(true);
            }}
            onStart={() => go("racing")}
          />
        )}

        {screen === "racing" && (
          <GameCanvas
            key={`${lastTime}-${races}-${difficulty}`}
            difficulty={difficulty}
            onFinish={handleFinish}
          />
        )}

        {screen === "result" && (
          <ResultScreen
            time={lastTime}
            best={best}
            isBest={isBest}
            won={won}
            onAgain={() => go("racing")}
            onHome={() => go("start")}
          />
        )}
      </div>

      {showOptions && (
        <OptionsDialog
          muted={muted}
          difficulty={difficulty}
          onToggleSound={toggleSound}
          onPickLevel={pickLevel}
          onClose={() => {
            sfx.click();
            setShowOptions(false);
          }}
        />
      )}
    </main>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative rounded-[2.5rem] border-4 border-construction/60 bg-panel/95 p-8 text-center shadow-toy sm:p-12">
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
  difficulty,
  onOpenOptions,
  onStart,
}: {
  best: number | null;
  races: number;
  muted: boolean;
  difficulty: Difficulty;
  onOpenOptions: () => void;
  onStart: () => void;
}) {
  return (
    <Card>
      <button
        onClick={onOpenOptions}
        className="font-display absolute right-5 top-5 rounded-2xl border-4 border-border bg-secondary px-5 py-2 text-lg text-secondary-foreground shadow-toy transition hover:-translate-y-0.5 active:translate-y-1 active:shadow-none"
      >
        ⚙ OPTIONS
      </button>
      <h1 className="font-display text-5xl tracking-tight text-foreground sm:text-7xl">
        JCB ROLLER RUSH
      </h1>
      <p className="font-display mt-2 text-2xl text-construction-foreground/70">
        Ready, Set, RUMBLE!
      </p>
      <Roller />
      <BigButton onClick={onStart}>▶ PLAY NOW</BigButton>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <span className="rounded-full bg-secondary px-5 py-2 text-sm font-black uppercase tracking-widest text-secondary-foreground">
          Level: {difficulty}
        </span>
        <span className="rounded-full bg-muted px-5 py-2 text-sm font-black uppercase tracking-widest text-muted-foreground">
          {muted ? "🔇 Sound Off" : "🔊 Sound On"}
        </span>
        <span className="rounded-full bg-construction px-5 py-2 text-sm font-black uppercase tracking-widest text-construction-foreground">
          Best: {best === null ? "—" : `${best.toFixed(1)}s`}
        </span>
        <span className="rounded-full bg-muted px-5 py-2 text-sm font-black uppercase tracking-widest text-muted-foreground">
          Races: {races}
        </span>
      </div>
      <p className="mt-6 text-sm font-bold text-muted-foreground">
        W / ↑ drive · S / ↓ brake · A D or ← → steer · SPACE = nitro
      </p>
    </Card>
  );
}

function OptionsDialog({
  muted,
  difficulty,
  onToggleSound,
  onPickLevel,
  onClose,
}: {
  muted: boolean;
  difficulty: Difficulty;
  onToggleSound: () => void;
  onPickLevel: (id: Difficulty) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4">
      <div className="w-full max-w-lg rounded-[2rem] border-4 border-construction/60 bg-panel p-8 shadow-toy">
        <h2 className="font-display text-3xl text-foreground">⚙ OPTIONS</h2>

        <p className="mt-6 text-xs font-black uppercase tracking-widest text-muted-foreground">
          Difficulty
        </p>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {LEVELS.map((l) => (
            <button
              key={l.id}
              onClick={() => onPickLevel(l.id)}
              className={`font-display rounded-2xl border-4 px-3 py-3 text-lg shadow-toy transition hover:-translate-y-0.5 ${
                difficulty === l.id
                  ? "border-construction-foreground/20 bg-construction text-construction-foreground"
                  : "border-border bg-secondary text-secondary-foreground"
              }`}
            >
              {l.label}
              <span className="mt-1 block text-[0.65rem] font-black uppercase tracking-widest opacity-70">
                {l.note}
              </span>
            </button>
          ))}
        </div>

        <p className="mt-6 text-xs font-black uppercase tracking-widest text-muted-foreground">
          Sound
        </p>
        <button
          onClick={onToggleSound}
          className="font-display mt-3 w-full rounded-2xl border-4 border-border bg-secondary px-4 py-3 text-xl text-secondary-foreground shadow-toy transition hover:-translate-y-0.5"
        >
          {muted ? "🔇 Sound OFF" : "🔊 Sound ON"}
        </button>

        <p className="mt-6 text-xs font-black uppercase tracking-widest text-muted-foreground">
          Controls
        </p>
        <ul className="mt-3 space-y-1 text-left text-sm font-bold text-foreground">
          <li>W or ↑ — drive forward</li>
          <li>S or ↓ — brake / reverse</li>
          <li>A D or ← → — steer left and right</li>
          <li>SPACE or 🔥 button — nitro boost</li>
          <li>On phone — use the arrow buttons below the track</li>
        </ul>

        <div className="mt-8 text-center">
          <BigButton onClick={onClose}>✔ DONE</BigButton>
        </div>
      </div>
    </div>
  );
}

function ResultScreen({
  time,
  best,
  isBest,
  won,
  onAgain,
  onHome,
}: {
  time: number;
  best: number | null;
  isBest: boolean;
  won: boolean;
  onAgain: () => void;
  onHome: () => void;
}) {
  return (
    <Card>
      <h1 className="font-display text-4xl text-foreground sm:text-6xl">
        {won ? "🏁 YOU WIN!" : "🚧 RIVAL WON!"}
      </h1>
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
