// Client-side Meta Pixel helper. Safe no-op when fbq isn't loaded.
// For events that also need server-side CAPI dedup, pass an eventId and
// the caller should also invoke the trackMetaEvent server fn with the
// same event_id.

type FbqParams = Record<string, unknown>;

export function fbqTrack(eventName: string, params: FbqParams = {}, eventId?: string) {
  if (typeof window === "undefined") return;
  const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
  if (!fbq) return;
  try {
    if (eventId) fbq("track", eventName, params, { eventID: eventId });
    else fbq("track", eventName, params);
  } catch { /* pixel errors must never break UX */ }
}
