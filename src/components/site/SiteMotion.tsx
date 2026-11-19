'use client';
import { useEffect } from 'react';

/* The site's type and hover motion that needs the page's own words (the design kit's motion layer does the
   rest: buttons, links, cards, photos, the nav):
   - section headings rise word by word out of their own masks as they come into view, once;
   - the quality band's brand line (data-type-moment="letters") assembles letter by letter, once;
   - primary links roll their label on hover (fine pointer only);
   - the homepage range index slides one marker to the row being pointed at.
   It runs only with motion allowed. A heading already on screen when the page loads is left as it is, so
   nothing that has been seen disappears; without script, before it runs or under reduced motion every word is
   simply there. Only server-rendered markup is touched (no React-managed node). */
export function SiteMotion() {
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
    const off: (() => void)[] = [revealType()];
    if (fine) { rollLabels(); off.push(rangeMarker()); }
    return () => off.forEach((f) => f());
  }, []);
  return null;
}

/* ---------- headings ---------- */
const HEADINGS = 'main > section:not(.hero):not([data-moment]) h2:not([data-type-moment]), footer.closing h2';

function textNodes(el: Element) {
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const out: Text[] = [];
  while (w.nextNode()) out.push(w.currentNode as Text);
  return out;
}

/* every word in its own mask (inner elements such as a muted span keep their place and colour) */
function splitWords(el: HTMLElement) {
  let i = 0;
  for (const n of textNodes(el)) {
    const frag = document.createDocumentFragment();
    for (const part of n.data.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) { frag.append(part); continue; }
      const mask = document.createElement('span'); mask.className = 'tw';
      const word = document.createElement('span'); word.className = 'tw__in'; word.textContent = part;
      word.style.setProperty('--i', String(i++));
      mask.append(word); frag.append(mask);
    }
    n.replaceWith(frag);
  }
}

/* letters inside unbreakable words; the heading keeps its words as its accessible name */
function splitLetters(el: HTMLElement) {
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  el.setAttribute('aria-label', text);
  el.textContent = '';
  let i = 0;
  text.split(/(\s+)/).forEach((part) => {
    if (!part) return;
    if (/^\s+$/.test(part)) { el.append(' '); return; }
    const word = document.createElement('span'); word.className = 'tl'; word.setAttribute('aria-hidden', 'true');
    for (const ch of part) {
      const c = document.createElement('span'); c.className = 'tl__c'; c.textContent = ch;
      c.style.setProperty('--i', String(i++));
      word.append(c);
    }
    el.append(word);
  });
}

function revealType() {
  const fold = window.innerHeight * 0.9;
  const below = (el: Element) => el.getBoundingClientRect().top > fold;
  const waiting: HTMLElement[] = [];
  document.querySelectorAll<HTMLElement>(HEADINGS).forEach((el) => {
    if (!below(el) || el.closest('[data-moment]')) return;
    splitWords(el); el.classList.add('tw-wait'); waiting.push(el);
  });
  document.querySelectorAll<HTMLElement>('[data-type-moment="letters"]').forEach((el) => {
    if (!below(el)) return;
    splitLetters(el); el.classList.add('tl-wait'); waiting.push(el);
  });
  if (!waiting.length) return () => {};
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -12% 0px' });
  waiting.forEach((el) => io.observe(el));
  return () => io.disconnect();
}

/* ---------- primary links: the label rolls up and its copy rolls in from below ---------- */
function rollLabels() {
  document.querySelectorAll<HTMLAnchorElement>('a.btn--primary').forEach((a) => {
    if (a.querySelector('.roll')) return;
    const node = [...a.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim());
    if (!node) return;
    const label = node.textContent!.trim();
    const roll = document.createElement('span'); roll.className = 'roll'; roll.dataset.text = label;
    const inner = document.createElement('span'); inner.className = 'roll__in'; inner.textContent = label;
    roll.append(inner);
    node.replaceWith(roll);
  });
}

/* ---------- the range index: one marker slides to the row being pointed at ---------- */
function rangeMarker() {
  const list = document.querySelector<HTMLElement>('.range-index__list');
  if (!list) return () => {};
  // the index sits beside its picture from 1024px; narrower, the rows stack under it and take no marker.
  // Read at the moment of pointing, so a window widened after load still gets it (CSS hides it below too)
  const wide = matchMedia('(min-width: 1024px)');
  const mark = document.createElement('span');
  mark.className = 'range-mark'; mark.setAttribute('aria-hidden', 'true');
  list.append(mark); // appended last, so the rows keep their :nth-child numbers
  let on = false;
  const place = (li: HTMLElement) => {
    if (!wide.matches) return;
    if (!on) mark.classList.add('is-jump'); // first row: appear in place, do not travel from the last one
    mark.style.height = `${li.offsetHeight}px`;
    mark.style.transform = `translateY(${li.offsetTop}px)`;
    if (!on) { void mark.offsetWidth; mark.classList.remove('is-jump'); on = true; }
    mark.classList.add('is-on');
  };
  const hide = () => { mark.classList.remove('is-on'); on = false; };
  const rowOf = (t: EventTarget | null) => (t instanceof Element ? t.closest<HTMLElement>('li') : null);
  const over = (e: Event) => { const li = rowOf(e.target); if (li && list.contains(li)) place(li); };
  const out = (e: FocusEvent) => { if (!list.contains(e.relatedTarget as Node | null)) hide(); };
  list.addEventListener('pointerover', over);
  list.addEventListener('pointerleave', hide);
  list.addEventListener('focusin', over);
  list.addEventListener('focusout', out);
  return () => {
    list.removeEventListener('pointerover', over); list.removeEventListener('pointerleave', hide);
    list.removeEventListener('focusin', over); list.removeEventListener('focusout', out);
    mark.remove();
  };
}
