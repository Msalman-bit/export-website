/** One English text in the five other languages: [de, fr, es, it, nl]. */
export type Draft = readonly [de: string, fr: string, es: string, it: string, nl: string];
export type Drafts = Record<string, Draft>;
/** A part of the site, as Admin > Translations lists it. */
export type Section = { id: string; name: string; drafts: Drafts };
