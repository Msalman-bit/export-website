import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { FILM_END, followScroll, partsDone, progressAt, scrollAt, scrollForStage, SELF_PLAY, selfPlayEase, stepStages } from '@/components/site/hero-sequence';

const seq = JSON.parse(readFileSync('public/assets/img/hero-film/seq.json', 'utf8')) as { stages: number[]; timeline: number[][] };

describe('the hero film plays its sketch once, then follows the scroll', () => {
  it('self-play runs from start to end, never backwards, starting and stopping gently, in under five seconds', () => {
    expect(selfPlayEase(0)).toBe(0);
    expect(selfPlayEase(1)).toBeCloseTo(1, 10);
    expect(selfPlayEase(2)).toBeCloseTo(1, 10);
    const steps = Array.from({ length: 1000 }, (_, i) => selfPlayEase((i + 1) / 1000) - selfPlayEase(i / 1000));
    expect(Math.min(...steps)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...steps) * 1000).toBeLessThan(1.35); // never much faster than its average
    expect(steps[0]).toBeLessThan(0.0001);
    expect(steps[999]).toBeLessThan(0.0001);
    expect(SELF_PLAY.seconds).toBeLessThan(5); // longer would need a pause button
  });

  it('the top of the page is the finished sketch, and the scroll goes on from there to the end', () => {
    const base = progressAt(SELF_PLAY.until, seq.timeline);
    expect(followScroll(base, 0)).toBe(base);
    expect(followScroll(base, 1)).toBeCloseTo(1, 10);
    for (let i = 0; i < 100; i++) expect(followScroll(base, (i + 1) / 100)).toBeGreaterThan(followScroll(base, i / 100));
  });

  it('every place in the film has its place in the scroll, and the other way round', () => {
    const base = progressAt(SELF_PLAY.until, seq.timeline);
    for (const p of [base, 0.2, 0.3, 0.5, 0.76, FILM_END]) expect(followScroll(base, scrollAt(base, p))).toBeCloseTo(p, 10);
    expect(scrollAt(base, base)).toBe(0);
    // the film ends with the hero still on the whole screen
    expect(scrollAt(base, FILM_END)).toBeGreaterThan(0.9);
    expect(scrollAt(base, FILM_END)).toBeLessThan(0.99);
  });

  it('each part of the line takes the page into that part of the film', () => {
    for (const base of [0, progressAt(SELF_PLAY.until, seq.timeline)]) {
      expect(scrollForStage(0, seq.stages, base)).toBe(0);
      for (const stage of [1, 2, 3]) {
        const p = followScroll(base, scrollForStage(stage, seq.stages, base));
        expect(p).toBeGreaterThan(seq.stages[stage - 1] + 0.008);
        expect(p).toBeLessThan(seq.stages[stage] ?? 1);
      }
    }
  });

  it('the line’s four parts fill one after the other, and all are full where the film ends', () => {
    expect(partsDone(0, seq.stages)).toEqual([0, 0, 0, 0]);
    expect(partsDone(seq.stages[0], seq.stages)).toEqual([1, 0, 0, 0]);
    const mid = partsDone((seq.stages[1] + seq.stages[2]) / 2, seq.stages);
    expect(mid[1]).toBe(1);
    expect(mid[2]).toBeCloseTo(0.5, 5);
    expect(mid[3]).toBe(0);
    expect(partsDone(FILM_END, seq.stages)).toEqual([1, 1, 1, 1]);
  });

  it('three steps: your design and your brand are the sketch, and the scroll is we make it', () => {
    const three = stepStages([25 / 403, SELF_PLAY.until], seq.timeline);
    const base = progressAt(SELF_PLAY.until, seq.timeline);
    expect(three[0]).toBeLessThan(three[1]);
    expect(three[1]).toBeCloseTo(base, 10);
    // at the top of the page the sketch is finished: the first two parts are full and the third is empty
    expect(partsDone(base, three)).toEqual([1, 1, 0]);
    expect(partsDone(followScroll(base, 0.5), three)[2]).toBeGreaterThan(0.4);
    expect(partsDone(FILM_END, three)).toEqual([1, 1, 1]);
    // the line's third part takes the page just into we make it
    expect(followScroll(base, scrollForStage(2, three, base))).toBeGreaterThan(three[1] + 0.008);
  });

  it('the sketch is finished before the film reaches the bladder (the first stage in seq.json)', () => {
    const rest = progressAt(65 / 403, seq.timeline);
    expect(rest).toBeGreaterThan(0.1);
    expect(rest).toBeLessThan(seq.stages[0]);
    // the inverse of the pacing: film time at the opening hold's end, and at the end
    expect(progressAt(0.0001, seq.timeline)).toBeCloseTo(0.02, 2);
    expect(progressAt(1, seq.timeline)).toBeCloseTo(0.97, 10);
    expect(progressAt(0.5)).toBe(0.5);
  });
});
