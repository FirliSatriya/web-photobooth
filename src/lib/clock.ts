/**
 * Clock synchronisation.
 *
 * Each guest measures its offset against the host with a PING/PONG exchange
 * over the WebRTC data channel. The offset from the sample with the lowest
 * round-trip time is used, because a low RTT means the one-way delay is small
 * and roughly symmetric — that keeps the shutter release within a few tens of
 * milliseconds across devices.
 */

export interface ClockSample {
  offset: number;
  rtt: number;
  at: number;
}

export interface ClockState {
  offset: number;
  rtt: number;
  samples: number;
  syncedAt: number;
}

export const EMPTY_CLOCK: ClockState = { offset: 0, rtt: 0, samples: 0, syncedAt: 0 };

export function applySample(previous: ClockState, sample: ClockSample): ClockState {
  const better = previous.samples === 0 || sample.rtt <= previous.rtt * 1.1;
  if (!better) {
    return { ...previous, samples: previous.samples + 1, syncedAt: Date.now() };
  }
  return {
    offset: sample.offset,
    rtt: sample.rtt,
    samples: previous.samples + 1,
    syncedAt: Date.now(),
  };
}

/** Host clock -> local clock. */
export function hostToLocal(hostTs: number, clock: ClockState): number {
  return hostTs - clock.offset;
}

/** Local clock -> host clock. */
export function localToHost(localTs: number, clock: ClockState): number {
  return localTs + clock.offset;
}

export interface PendingPing {
  id: string;
  sentAt: number;
}

export function createPing(fn: (id: string, sentAt: number, localTs: number) => void) {
  const id = Math.random().toString(36).slice(2, 10);
  const sentAt = Date.now();
  fn(id, sentAt, sentAt);
  return { id, sentAt } satisfies PendingPing;
}

export function resolvePong(pending: PendingPing[], id: string, hostReceivedAt: number): ClockSample | null {
  const entry = pending.find((item) => item.id === id);
  if (!entry) return null;
  const localNow = Date.now();
  const rtt = localNow - entry.sentAt;
  // guest send time (local) -> host receive time (host clock)
  const offset = hostReceivedAt - (entry.sentAt + rtt / 2);
  return { offset, rtt, at: localNow };
}
