'use client';
import { useEffect, useRef, useState } from 'react';

/* The hero's scroll film host (the film draws its sketch once, then moves only with the scroll: hero-sequence.ts). It mounts only when the page head marked the browser for it (html.hero-seq: motion allowed); otherwise the hero stays the still photograph on one screen.
   The player loads after the page is interactive, so it never delays the first paint; the head has
   already asked for the first frame.

   It also leads the hero's chapters of words (.hero-chapter, rendered by the page): as the film reaches a stage,
   that chapter is "on", the ones before it "past" and the ones after it "future", so scrolling down a chapter's
   words leave upward and the next arrive from below, and scrolling up the reverse. The motion itself is CSS
   transitions (site.css, "the hero's chapters"), so a fast scroll across two chapters retargets rather than queues. */

/* who does what at each stage of the film: one line that changes with it, over a line in four parts. The page hands
   over the four lines in its language ("You send the design", "We make it", "We add your branding", "We cover your full
   range") and the group's name. */
export function HeroScene({ parts: PARTS, label, lang }: { parts: string[]; label: string; lang?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const fills = useRef<(HTMLSpanElement | null)[]>([]);
  const [stage, setStage] = useState(0);
  const [live, setLive] = useState(false);
  const toStage = useRef<((stage: number) => void) | null>(null);

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
          onControl: (go) => { toStage.current = go; },
          // the line follows the film itself: a transform on each of its parts, no re-render
          onProgress: (_, parts) => parts.forEach((v, i) => { const f = fills.current[i]; if (f) f.style.transform = `scaleX(${v.toFixed(4)})`; }),
          onReady: () => { media?.setAttribute('data-seq', 'ready'); setLive(true); },
          onFail: fail,
        });
      })
      .catch(fail);
    return () => { cancelled = true; toStage.current = null; dispose(); };
  }, []);

  return (
    <>
      <div ref={host} className="hero-scene" aria-hidden="true" />
      {/* where the film is and who does that part: a line of words that changes with it (the chapters' words say more, so
          it is for the eye), over a line in four parts, each a button that takes the page to its part */}
      <div className="hero-steps" role="group" aria-label={label} lang={lang} data-live={live || undefined}>
        <p className="hero-steps__line" aria-hidden="true"><span key={stage}>{PARTS[stage]}</span></p>
        <div className="hero-steps__parts">
          {PARTS.map((label, i) => (
            <button key={label} type="button" className="hero-steps__part" aria-label={label} title={label}
              aria-current={stage === i ? 'step' : undefined} onClick={() => toStage.current?.(i)}>
              <span className="hero-steps__track"><span ref={(el) => { fills.current[i] = el; }} className="hero-steps__fill" /></span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
