// Output timestamps are optional and have used different scales in WebKit.
// Reject stale, non-finite or implausibly distant readings before driving visuals.
export function playbackTime(context, wallTime = performance.now()) {
  if (!context) return 0;
  const current = context.currentTime;
  try {
    const stamp = context.getOutputTimestamp?.();
    if (stamp && Number.isFinite(stamp.contextTime) && Number.isFinite(stamp.performanceTime)) {
      const age = (wallTime - stamp.performanceTime) / 1000;
      const estimate = stamp.contextTime + Math.max(0, age);
      if (stamp.contextTime > 0 && age >= -.05 && age < .25 && estimate <= current + .02 && current - estimate < .5)
        return Math.max(0, Math.min(current, estimate));
    }
  } catch { /* Interrupted devices can reject timestamp queries. */ }
  const latency = Math.min(.25, Math.max(0, Number(context.outputLatency) || Number(context.baseLatency) || 0));
  return Math.max(0, current - latency);
}
