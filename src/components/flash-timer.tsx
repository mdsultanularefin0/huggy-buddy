import { useEffect, useState } from "react";

function nextWindow(resetISO: string | null) {
  const start = resetISO ? new Date(resetISO).getTime() : Date.now();
  const week = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const elapsed = Math.max(0, now - start);
  const cycles = Math.floor(elapsed / week);
  const end = start + (cycles + 1) * week;
  return end - now;
}

export function FlashTimer({ resetDate }: { resetDate: string | null }) {
  const [remaining, setRemaining] = useState(() => nextWindow(resetDate));

  useEffect(() => {
    const t = setInterval(() => setRemaining(nextWindow(resetDate)), 1000);
    return () => clearInterval(t);
  }, [resetDate]);

  const d = Math.floor(remaining / (24 * 3600 * 1000));
  const h = Math.floor((remaining % (24 * 3600 * 1000)) / (3600 * 1000));
  const m = Math.floor((remaining % (3600 * 1000)) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);

  const cells: [string, number][] = [
    ["Days", d], ["Hours", h], ["Minutes", m], ["Seconds", s],
  ];

  return (
    <div className="rounded-2xl overflow-hidden shadow-luxe bg-white w-full max-w-md">
      <div className="bg-gradient-to-r from-amber-300 to-amber-400 px-6 py-3 text-center">
        <p className="text-xl md:text-2xl font-bold tracking-tight text-primary">
          Flash Sale! Up to 200<span className="text-base">tk</span> Off!
        </p>
      </div>
      <div className="flex items-center justify-around px-4 py-4">
        {cells.map(([label, val]) => (
          <div key={label} className="text-center">
            <div className="text-3xl md:text-4xl font-bold tabular-nums text-primary leading-none">
              {String(val).padStart(2, "0")}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
