/**
 * Geometry of the CPU / Kafka day chart (`CpuDayChart.astro`). Shared by the
 * build-time render (component front matter) and the client script that
 * re-renders on zoom, so both produce the same SVG from the same data.
 *
 * Time is in seconds since 00:00 of the charted day (the day is in the pods'
 * own zone, so no time zone conversion anywhere). The viewBox is `W` wide;
 * every panel is `PANEL_H` tall and the Kafka produce ticks hang below it.
 */

import raw from '@/data/troubleshooting-bun-kafkajs-cpu-spin/cpu-day.json';

export interface CpuDayData {
  /** Minutes in the day (1440). */
  minutes: number;
  /** Pod names in panel order (`A`, `B`, `C`). */
  pods: string[];
  /** Per pod, per minute: CPU in cores; `null` when the minute has no sample. */
  cpu: (number | null)[][];
  /** Kafka produces as `[pod, seconds since 00:00]`, sorted by time. */
  sends: [string, number][];
}

/** Visible time range in seconds since 00:00. */
export interface View {
  t0: number;
  t1: number;
}

export interface Tick {
  t: number;
  label: string;
}

/** The charted day: 2026-08-24 (UTC+8), three pods, anonymised as A / B / C. */
export const cpuDay: CpuDayData = raw as CpuDayData;

export const DAY = 86400;
/** Broker `connections.max.idle.ms` default: a connection lives this long after its last request. */
export const WINDOW = 600;
/** Narrowest zoom, in seconds. */
export const MIN_RANGE = 600;

export const W = 880;
export const PAD_L = 48;
/** Right padding leaves room for the centred `24:00` label. */
export const PAD_R = 28;
export const PAD_T = 22;
export const PANEL_H = 96;
export const GAP = 40;
export const PLOT_W = W - PAD_L - PAD_R;
/** Top of the y scale in cores: leaves a little air above 1.0. */
export const Y_MAX = 1.04;
/** Produce ticks: gap below the baseline and tick height. */
export const TICK_GAP = 6;
export const TICK_H = 8;
/** Space under the last panel for the ticks and the hour labels. */
export const AXIS_H = 34;

export const FULL_VIEW: View = { t0: 0, t1: DAY };

export function panelTop(index: number): number {
  return PAD_T + index * (PANEL_H + GAP);
}

export function panelBottom(index: number): number {
  return panelTop(index) + PANEL_H;
}

export function chartHeight(panels: number): number {
  return panelBottom(panels - 1) + AXIS_H;
}

export function xOf(t: number, view: View): number {
  return PAD_L + ((t - view.t0) / (view.t1 - view.t0)) * PLOT_W;
}

export function tOf(x: number, view: View): number {
  return view.t0 + ((x - PAD_L) / PLOT_W) * (view.t1 - view.t0);
}

export function yOf(value: number, top: number): number {
  return top + PANEL_H - (Math.min(value, Y_MAX) / Y_MAX) * PANEL_H;
}

/** One decimal, no trailing `.0`: keeps the path strings short. */
function num(n: number): string {
  return String(Math.round(n * 10) / 10);
}

/**
 * SVG path of one pod's series inside `view`. Starts and ends on the baseline
 * so that the same path can be filled (the implicit close runs along the
 * baseline) and stroked (via `<use>`). Points where the series is `null` split
 * the path; interior points on a flat run are dropped. One extra minute on
 * each side of the view keeps the line continuous under the clip.
 */
export function seriesPath(values: (number | null)[], view: View, top: number): string {
  const base = num(top + PANEL_H);
  const first = Math.max(0, Math.floor(view.t0 / 60) - 1);
  const last = Math.min(values.length - 1, Math.ceil(view.t1 / 60) + 1);
  const parts: string[] = [];
  let run: [string, string][] = [];
  const flush = () => {
    if (run.length === 0) return;
    const [x0] = run[0]!;
    const [xn] = run[run.length - 1]!;
    const inner = run.map(([x, y]) => `L${x},${y}`).join('');
    parts.push(`M${x0},${base}${inner}L${xn},${base}`);
    run = [];
  };
  for (let m = first; m <= last; m++) {
    const v = values[m];
    if (v === null || v === undefined) {
      flush();
      continue;
    }
    const x = num(xOf(m * 60, view));
    const y = num(yOf(v, top));
    const n = run.length;
    if (n >= 2 && run[n - 1]![1] === y && run[n - 2]![1] === y) {
      // Same height as the previous two points: extend the flat run instead.
      run[n - 1] = [x, y];
    } else {
      run.push([x, y]);
    }
  }
  flush();
  return parts.join('');
}

/** Hour/minute ticks for the visible range: 3 h for the full day, finer when zoomed. */
export function timeTicks(view: View): Tick[] {
  const range = view.t1 - view.t0;
  const step =
    range > 6 * 3600
      ? 3 * 3600
      : range > 3 * 3600
        ? 3600
        : range > 90 * 60
          ? 30 * 60
          : range > 30 * 60
            ? 10 * 60
            : 5 * 60;
  const ticks: Tick[] = [];
  for (let t = Math.ceil(view.t0 / step) * step; t <= view.t1; t += step) {
    ticks.push({ t, label: formatTime(t) });
  }
  return ticks;
}

/** `HH:MM`; `24:00` for the end of the day. */
export function formatTime(t: number): string {
  const total = Math.max(0, Math.round(t));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Start of the minute that contains `t`, clamped to the day. */
export function snapMinute(t: number): number {
  return Math.min(DAY - 60, Math.max(0, Math.floor(t / 60) * 60));
}

/** CPU of one pod at time `t` (the sample of that minute), or `null` when missing. */
export function valueAt(values: (number | null)[], t: number): number | null {
  return values[Math.floor(t / 60)] ?? null;
}

/** Time of the last produce of `pod` at or before `t`, or `undefined`. */
export function lastSendBefore(
  sends: readonly (readonly [string, number])[],
  pod: string,
  t: number,
): number | undefined {
  for (let i = sends.length - 1; i >= 0; i--) {
    const [p, st] = sends[i]!;
    if (p === pod && st <= t) return st;
  }
  return undefined;
}

/** Clamp a requested range to the day and to `MIN_RANGE`, keeping its centre. */
export function clampView(a: number, b: number): View {
  let t0 = Math.max(0, Math.min(a, b));
  let t1 = Math.min(DAY, Math.max(a, b));
  if (t1 - t0 < MIN_RANGE) {
    const mid = (t0 + t1) / 2;
    t0 = mid - MIN_RANGE / 2;
    t1 = mid + MIN_RANGE / 2;
    if (t0 < 0) {
      t1 -= t0;
      t0 = 0;
    }
    if (t1 > DAY) {
      t0 -= t1 - DAY;
      t1 = DAY;
    }
  }
  return { t0, t1 };
}

export function isFullView(view: View): boolean {
  return view.t0 <= 0 && view.t1 >= DAY;
}
