import React from 'react';
import { QuoteIcon } from './QuoteIcon';
import type { Tx } from '@/lib/i18n/tx';

/* Renders the CMS's small text format as elements (never as raw HTML, so page text cannot inject
   markup): "## " headings, blank-line paragraphs, "- " lists, [label](/path) links and one
   "[[cta:Label|/path]]" button line. Internal paths get the locale prefix.

   With tx, each block (the text between two blank lines) is shown in the page's language when it has a translation;
   a block without one stays English and its elements say so (lang="en"), so a page can be part translated. */

function inline(text: string, locale: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const url = m[2];
    const safe = /^(https:\/\/|mailto:)/.test(url) ? url : url.startsWith('/') ? `/${locale}${url === '/' ? '' : url}` : null;
    out.push(safe ? <a key={`${key}-${i++}`} href={safe}>{m[1]}</a> : m[1]);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function RichText({ body, locale, headingLevel = 2, tx }: { body: string; locale: string; headingLevel?: 2 | 3; tx?: Tx }) {
  const blocks = body.replace(/\r/g, '').split(/\n{2,}/);
  const H = headingLevel === 2 ? 'h2' : 'h3';
  const out: React.ReactNode[] = [];
  blocks.forEach((source, bi) => {
    const block = tx ? tx(source) : source;
    const lang = tx?.lang(source);
    const lines = block.split('\n').filter((l) => l.trim());
    let para: string[] = [];
    let list: string[] = [];
    const flush = () => {
      if (para.length) { out.push(<p key={`p${bi}-${out.length}`} lang={lang}>{inline(para.join(' '), locale, `p${bi}`)}</p>); para = []; }
      if (list.length) {
        // a list item shaped "term: explanation" sets its term in bold, so a list of definitions scans
        out.push(<ul key={`u${bi}-${out.length}`} lang={lang}>{list.map((li, i) => {
          const term = li.match(/^([^:[\]]{2,60}):\s+(.+)$/);
          return <li key={i}>{term ? <><strong>{term[1]}</strong>: {inline(term[2], locale, `l${bi}${i}`)}</> : inline(li, locale, `l${bi}${i}`)}</li>;
        })}</ul>);
        list = [];
      }
    };
    for (const line of lines) {
      const cta = line.match(/^\[\[cta:([^|\]]+)\|([^\]]+)\]\]$/);
      if (line.startsWith('## ')) { flush(); out.push(<H key={`h${bi}-${out.length}`} lang={lang}>{line.slice(3)}</H>); }
      else if (cta) {
        flush();
        const url = cta[2].startsWith('/') ? `/${locale}${cta[2]}` : cta[2];
        out.push(<div className="btn-row" key={`c${bi}`}><a className="btn btn--primary" href={url} lang={lang}>{cta[1]}{cta[2] === '/inquiry' ? <QuoteIcon /> : null}</a></div>);
      } else if (line.startsWith('- ')) { if (para.length) flush(); list.push(line.slice(2)); }
      else { if (list.length) flush(); para.push(line); }
    }
    flush();
  });
  return <div className="prose">{out}</div>;
}
