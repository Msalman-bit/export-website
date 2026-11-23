import { SITE } from './site';
import { HOME } from './home';
import { CATALOGUE_TEXT } from './catalogue';
import { FORM } from './form';
import { PAGES_TEXT } from './pages';
import type { Section } from './types';

export type { Draft, Drafts, Section } from './types';

/* Every part of the site with translated page text, in the order Admin > Translations lists them. */
export const SECTIONS: Section[] = [HOME, SITE, CATALOGUE_TEXT, FORM, PAGES_TEXT];
