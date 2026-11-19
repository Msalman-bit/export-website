import { pic } from '@/lib/media';

/* One picture, from a "gen:" concept, an uploaded /media file or a path. Lazy by default; the hero's
   picture passes eager. data-source says where it came from (the checker and the report read it). */
export function Img({
  url, alt, sizes = '(max-width: 639px) 100vw, 50vw', prefer = 960, eager = false, className, style, decorative = false,
}: {
  url: string | null | undefined; alt: string; sizes?: string; prefer?: number; eager?: boolean;
  className?: string; style?: React.CSSProperties; decorative?: boolean;
}) {
  const p = pic(url, prefer);
  if (!p) return null;
  return (
    <img
      className={className}
      src={p.src}
      srcSet={p.srcSet}
      sizes={p.srcSet ? sizes : undefined}
      width={p.width}
      height={p.height}
      alt={decorative ? '' : alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding={eager ? 'sync' : 'async'}
      fetchPriority={eager ? 'high' : undefined}
      data-source={p.generated ? 'stand-in' : 'client'}
      data-subject={alt.slice(0, 80)}
      style={style}
    />
  );
}
