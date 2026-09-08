const COLORS = [
  "#ffd400",
  "#ff5252",
  "#33d17a",
  "#3da5ff",
  "#ff7ac6",
  "#ffffff",
  "#ff9f1c",
];

/** Lightweight CSS-only confetti blast (no libraries, no canvas). */
export default function Confetti({ count = 70 }: { count?: number }) {
  const pieces = Array.from({ length: count }, (_, i) => {
    const left = (i * 97) % 100;
    const delay = ((i * 37) % 100) / 100;
    const duration = 2.2 + (((i * 53) % 100) / 100) * 1.6;
    const size = 7 + ((i * 13) % 8);
    return { i, left, delay, duration, size, color: COLORS[i % COLORS.length]! };
  });

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.i}
          className="animate-confetti absolute top-[-10%] block rounded-[2px]"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 1.6,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
