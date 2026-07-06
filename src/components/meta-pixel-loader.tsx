import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getPublicMetaPixelId } from "@/lib/meta-pixel.functions";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

/** Loads the Meta Pixel base script when a pixel_id is configured and fires
 * PageView on every client-side route change. */
export function MetaPixelLoader() {
  const getId = useServerFn(getPublicMetaPixelId);
  const { data } = useQuery({
    queryKey: ["public-meta-pixel-id"],
    queryFn: () => getId(),
    staleTime: 5 * 60 * 1000,
  });
  const pixelId = data?.pixel_id ?? null;
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Inject base script once when we have a pixel id.
  useEffect(() => {
    if (!pixelId || typeof window === "undefined") return;
    if (window.fbq) return;
    // Standard Facebook Pixel bootstrap.
    /* eslint-disable */
    (function (f: any, b: Document, e: string, v: string) {
      let n: any, t: HTMLScriptElement, s: HTMLScriptElement | null;
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
      t = b.createElement(e) as HTMLScriptElement; t.async = true; t.src = v;
      s = b.getElementsByTagName(e)[0] as HTMLScriptElement;
      s?.parentNode?.insertBefore(t, s);
    })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    /* eslint-enable */
    (window.fbq as any)("init", pixelId);
    (window.fbq as any)("track", "PageView");

  }, [pixelId]);

  // Fire PageView on subsequent route changes.
  useEffect(() => {
    if (!pixelId || typeof window === "undefined" || !window.fbq) return;
    window.fbq("track", "PageView");
  }, [pathname, pixelId]);

  return null;
}
