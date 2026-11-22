import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { followScroll, progressAt, selfPlayEase } from '@/components/site/hero-sequence';

const seq = JSON.parse(readFileSync('public/assets/img/hero-film/seq.json', 'utf8')) as { stages: number[]; timeline: number[][] };

describe('the hero film plays its sketch, then follows the scroll', () => {
  it('self-play runs from start to end, never backwards, starting and stopping gently', () => {
    expect(selfPlayEase(0)).toBe(0);
    expect(selfPlayEase(1)).toBeCloseTo(1, 10);
    expect(selfPlayEase(2)).toBeCloseTo(1, 10);
    const steps = Array.from({ length: 1000 }, (_, i) => selfPlayEase((i + 1) / 1000) - selfPlayEase(i / 1000));
    expect(Math.min(...steps)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...steps) * 1000).toBeLessThan(1.35); // never much faster than its average
    expect(steps[0]).toBeLessThan(0.0001);
    expect(steps[999]).toBeLessThan(0.0001);
  });

  it('the scroll takes over without a jump, from wherever the film is, and still reaches the end', () => {
    for (const base of [0, 0.05, 0.1657, 0.3]) {
      expect(followScroll(base, 0)).toBe(base);
      expect(followScroll(base, 1)).toBeCloseTo(1, 10);
      for (let i = 0; i < 100; i++) expect(followScroll(base, (i + 1) / 100)).toBeGreaterThan(followScroll(base, i / 100));
    }
  });

  it('the resting picture is inside the first chapter, so no words change while it plays by itself', () => {
    const rest = progressAt(65 / 403, seq.timeline);
    expect(rest).toBeGreaterThan(0.1);
    expect(rest).toBeLessThan(seq.stages[0]);
    // the inverse of the pacing: film time at the opening hold's end, and at the end
    expect(progressAt(0.0001, seq.timeline)).toBeCloseTo(0.02, 2);
    expect(progressAt(1, seq.timeline)).toBeCloseTo(0.97, 10);
    expect(progressAt(0.5)).toBe(0.5);
  });
});
