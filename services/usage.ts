import { monitorEventLoopDelay } from "node:perf_hooks";

// Aggregated process counters only: no player identities, URLs or credentials.
export const usage = {
  metadataRequests: 0, metadataFailures: 0, staticImageRequests: 0,
  mapLoadsReported: 0, panoramaLoadsReported: 0, roundsSelected: 0,
};
export function startUsageReporting(snapshot: () => { rooms: number; connections: number }) {
  const delay = monitorEventLoopDelay({ resolution: 20 });
  delay.enable();
  let previousCpu = process.cpuUsage();
  const timer = setInterval(() => {
    const cpu = process.cpuUsage(previousCpu);
    previousCpu = process.cpuUsage();
    console.info(JSON.stringify({ event: "usage_summary", ...usage, ...snapshot(),
      rssMb: Math.round(process.memoryUsage().rss / 1048576),
      cpuMs: Math.round((cpu.user + cpu.system) / 1000),
      eventLoopP95Ms: Math.round(delay.percentile(95) / 1e6),
    }));
    delay.reset();
  }, 60000);
  timer.unref();
  return () => { clearInterval(timer); delay.disable(); };
}
