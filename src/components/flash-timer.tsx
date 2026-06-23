import { useEffect, useState } from "react";
import { Flame } from "lucide-react";

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
    ["Days", d], ["Hours", h], ["Mins", m], ["Secs", s],
  ];

  return (
    <div className="rounded-3xl bg-gradient-luxe text-primary-foreground shadow-luxe px-6 py-6 md:py-7 flex flex-col md:flex-row items-center justify-between gap-5">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center">
          <Flame className="w-5 h-5" />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] opacity-80">Flash sale</p>
          <p className="text-lg md:text-xl font-semibold tracking-tight">Ends soon — don't miss out</p>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {cells.map(([label, val]) => (
          <div key={label} className="min-w-[64px] text-center rounded-xl bg-white/10 backdrop-blur px-3 py-2">
            <div className="text-2xl font-semibold tabular-nums">{String(val).padStart(2, "0")}</div>
            <div className="text-[10px] uppercase tracking-widest opacity-80">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
