import { cn } from "@/lib/utils";

/** Premium dual-ring spinner. Uses `currentColor` so it inherits from the
 * parent's text color — works on any button variant or backdrop. */
export function Spinner({ className, size = 20 }: { className?: string; size?: number }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn("relative inline-block shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <span className="absolute inset-0 rounded-full border-2 border-current opacity-20" />
      <span
        className="absolute inset-0 rounded-full border-2 border-transparent animate-spin"
        style={{ borderTopColor: "currentColor", borderRightColor: "currentColor" }}
      />
    </span>
  );
}

/** Full-screen page loader with frosted backdrop, orbiting rings, and a
 * pulsing core — reads as a polished Lottie-style loading moment. */
export function PageLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/60 backdrop-blur-md animate-fade-in"
    >
      <div className="relative h-24 w-24">
        {/* Outer slow ring */}
        <span
          className="absolute inset-0 rounded-full border-2 border-primary/20 border-t-primary animate-spin"
          style={{ animationDuration: "1.6s" }}
        />
        {/* Middle reverse ring */}
        <span
          className="absolute inset-2 rounded-full border-2 border-accent/20 border-b-accent animate-spin"
          style={{ animationDuration: "1.1s", animationDirection: "reverse" }}
        />
        {/* Inner fast ring */}
        <span
          className="absolute inset-5 rounded-full border-2 border-primary/30 border-l-primary animate-spin"
          style={{ animationDuration: "0.8s" }}
        />
        {/* Pulsing core */}
        <span className="absolute inset-[38%] rounded-full bg-gradient-to-br from-primary to-accent animate-pulse shadow-[0_0_24px_theme(colors.primary/50%)]" />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
