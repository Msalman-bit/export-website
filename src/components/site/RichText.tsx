import React from 'react';

/* Renders the CMS's small text format as elements (never as raw HTML, so page text cannot inject
   markup): "## " headings, blank-line paragraphs, "- " lists, [label](/path) links and one
   "[[cta:Label|/path]]" button line. Internal paths get the locale prefix. */

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

export function RichText({ body, locale, headingLevel = 2 }: { body: string; locale: string; headingLevel?: 2 | 3 }) {
  const blocks = body.replace(/\r/g, '').split(/\n{2,}/);
  const H = headingLevel === 2 ? 'h2' : 'h3';
  const out: React.ReactNode[] = [];
  blocks.forEach((block, bi) => {
    const lines = block.split('\n').filter((l) => l.trim());
    let para: string[] = [];
    let list: string[] = [];
    const flush = () => {
      if (para.length) { out.push(<p key={`p${bi}-${out.length}`}>{inline(para.join(' '), locale, `p${bi}`)}</p>); para = []; }
      if (list.length) {
        out.push(<ul key={`u${bi}-${out.length}`}>{list.map((li, i) => <li key={i}>{inline(li, locale, `l${bi}${i}`)}</li>)}</ul>);
        list = [];
      }
    };
    for (const line of lines) {
      const cta = line.match(/^\[\[cta:([^|\]]+)\|([^\]]+)\]\]$/);
      if (line.startsWith('## ')) { flush(); out.push(<H key={`h${bi}-${out.length}`}>{line.slice(3)}</H>); }
      else if (cta) {
        flush();
        const url = cta[2].startsWith('/') ? `/${locale}${cta[2]}` : cta[2];
        out.push(<div className="btn-row" key={`c${bi}`}><a className="btn btn--primary" href={url}>{cta[1]}</a></div>);
      } else if (line.startsWith('- ')) { if (para.length) flush(); list.push(line.slice(2)); }
      else { if (list.length) flush(); para.push(line); }
    }
    flush();
  });
  return <div className="prose">{out}</div>;
}
