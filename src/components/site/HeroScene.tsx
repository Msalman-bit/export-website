'use client';
import { useEffect, useRef, useState } from 'react';

/* The hero's scroll film host (the film draws its sketch by itself once, then follows the scroll: hero-sequence.ts). It mounts only when the page head marked the browser for it
   (html.hero-seq: motion allowed); otherwise the hero stays the still photograph on one screen.
   The player loads after the page is interactive, so it never delays the first paint; the head has
   already asked for the first frame.

   It also leads the hero's chapters of words (.hero-chapter, rendered by the page): as the film reaches a stage,
   that chapter is "on", the ones before it "past" and the ones after it "future", so scrolling down a chapter's
   words leave upward and the next arrive from below, and scrolling up the reverse. The motion itself is CSS
   transitions (site.css, "the hero's chapters"), so a fast scroll across two chapters retargets rather than queues. */

const STEPS = ['Idea', 'Made', 'Brand', 'Range'];

export function HeroScene() {
  const host = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLSpanElement>(null);
  const [stage, setStage] = useState(0);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (!root.classList.contains('hero-seq') || !host.current) return;
    const section = host.current.closest('section') as HTMLElement | null;
    const media = host.current.closest('.hero__media') as HTMLElement | null;
    if (!section) return;
    const chapters = [...section.querySelectorAll<HTMLElement>('.hero-chapter')];
    const show = (i: number) => {
      chapters.forEach((c, k) => { c.dataset.state = k < i ? 'past' : k === i ? 'on' : 'future'; });
      setStage(i);
    };
    let dispose = () => {};
    let cancelled = false;
    const fail = () => { root.classList.remove('hero-seq'); media?.removeAttribute('data-seq'); setLive(false); show(0); };
    import('./hero-sequence')
      .then(({ mountHeroSequence }) => {
        if (cancelled || !host.current) return;
        dispose = mountHeroSequence({
          host: host.current, section,
          onStage: show,
          // the line under the steps follows the film itself: a transform on the line, no re-render
          onProgress: (p) => { if (fill.current) fill.current.style.transform = `scaleX(${p.toFixed(4)})`; },
          onReady: () => { media?.setAttribute('data-seq', 'ready'); setLive(true); },
          onFail: fail,
        });
      })
      .catch(fail);
    return () => { cancelled = true; dispose(); };
  }, []);

  return (
    <>
      <div ref={host} className="hero-scene" aria-hidden="true" />
      {/* where the film is: its four chapters and a line that fills with it (the words say the same) */}
      <div className="hero-steps" aria-hidden="true" data-live={live || undefined}>
        <ol>
          {STEPS.map((s, i) => (
            <li key={s} data-state={i < stage ? 'past' : i === stage ? 'on' : undefined}>{s}</li>
          ))}
        </ol>
        <span className="hero-steps__track"><span ref={fill} className="hero-steps__fill" /></span>
      </div>
    </>
  );
}
