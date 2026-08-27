import { describe, expect, it } from 'vitest';
import { byDateDesc, formatDate, toIsoWithOffset, zoneOffset } from '@/lib/dates';

describe('dates', () => {
  it('formats in Asia/Shanghai, not UTC', () => {
    // 2019-05-22 02:10 Shanghai time is still 2019-05-21 in UTC: the naive
    // `toISOString().slice(0, 10)` would print the wrong day.
    const d = new Date('2019-05-22T02:10:00+08:00');
    expect(d.toISOString().slice(0, 10)).toBe('2019-05-21');
    expect(formatDate(d)).toBe('2019-05-22');
    // 23:30 Shanghai time is still the same day even though UTC is 15:30
    const late = new Date('2016-05-30T23:30:00+08:00');
    expect(formatDate(late)).toBe('2016-05-30');
    // 01:00 Shanghai time is the NEXT day compared to UTC
    const early = new Date('2016-05-30T17:00:00Z');
    expect(formatDate(early)).toBe('2016-05-31');
  });

  it('emits the full ISO string with the +08:00 offset', () => {
    const d = new Date('2019-05-21T22:10:00+08:00');
    expect(toIsoWithOffset(d)).toBe('2019-05-21T22:10:00+08:00');
    expect(zoneOffset(d)).toBe('+08:00');
  });

  it('sorts newest first', () => {
    const a = { data: { date: new Date('2020-01-01') } };
    const b = { data: { date: new Date('2021-01-01') } };
    expect([a, b].toSorted(byDateDesc)).toEqual([b, a]);
  });
});
