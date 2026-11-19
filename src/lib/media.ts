import index from './media.generated.json';

/* Pictures are stored as one of:
   - "gen:<id>": a generated concept in public/assets/img/gen, in the widths process-media.py made;
   - "/media/<attachment id>": a file a staff member uploaded (served by src/app/media/[id]);
   - any other absolute path or https URL. */

type Entry = { w: number; h: number; widths: number[] };
const IDX = index as Record<string, Entry>;

export type Pic = { src: string; srcSet?: string; width: number; height: number; generated: boolean };

export function pic(url: string | undefined | null, preferWidth = 960): Pic | null {
  if (!url) return null;
  if (url.startsWith('gen:')) {
    const id = url.slice(4);
    const e = IDX[id];
    if (!e) return null;
    const best = e.widths.find((w) => w >= preferWidth) ?? e.widths[e.widths.length - 1];
    return {
      src: `/assets/img/gen/${id}-${best}.webp`,
      srcSet: e.widths.map((w) => `/assets/img/gen/${id}-${w}.webp ${w}w`).join(', '),
      width: best,
      height: Math.round((e.h * best) / e.w),
      generated: true,
    };
  }
  return { src: url, width: 1200, height: 1200, generated: false };
}

export function hasPic(url: string | undefined | null): boolean {
  return !!pic(url);
}
