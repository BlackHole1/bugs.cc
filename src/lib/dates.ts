/**
 * Date formatting in the site's home time zone. Post dates carry an explicit
 * `+08:00` offset; displaying them must use `Asia/Shanghai`, never
 * `toISOString().slice(0, 10)` (which would shift late-evening dates).
 */

export const SITE_TIME_ZONE = 'Asia/Shanghai';

interface Parts {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
}

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: SITE_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function zonedParts(date: Date): Parts {
  const out: Partial<Parts> = {};
  for (const { type, value } of partsFormatter.formatToParts(date)) {
    if (type === 'year' || type === 'month' || type === 'day') out[type] = value;
    if (type === 'hour' || type === 'minute' || type === 'second') out[type] = value;
  }
  return out as Parts;
}

/** Offset of `SITE_TIME_ZONE` at `date`, as `+08:00`. */
export function zoneOffset(date: Date): string {
  const p = zonedParts(date);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  const diffMin = Math.round((asUtc - date.getTime()) / 60000);
  const sign = diffMin >= 0 ? '+' : '-';
  const abs = Math.abs(diffMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${sign}${hh}:${mm}`;
}

/** `YYYY-MM-DD` in the site time zone (display format). */
export function formatDate(date: Date): string {
  const p = zonedParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Full RFC 3339 string with the site offset, for `<time datetime>`. */
export function toIsoWithOffset(date: Date): string {
  const p = zonedParts(date);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${zoneOffset(date)}`;
}

/** Newest first. */
export function byDateDesc<T extends { data: { date: Date } }>(a: T, b: T): number {
  return b.data.date.valueOf() - a.data.date.valueOf();
}
