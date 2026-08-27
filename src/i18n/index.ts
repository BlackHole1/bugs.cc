import { en } from './en';
import { DEFAULT_LANG, isLang, LANGS, type Lang, type UIStrings } from './types';
import { zh } from './zh';

export { DEFAULT_LANG, isLang, LANGS };
export type { Lang, UIStrings };

const strings: Record<Lang, UIStrings> = { en, zh };

/** Typed UI strings for a language. */
export function useTranslations(lang: Lang): UIStrings {
  return strings[lang];
}

/** The other language of the pair. */
export function otherLang(lang: Lang): Lang {
  return lang === 'en' ? 'zh' : 'en';
}

/** Language of a site path (`/zh/...` -> zh, everything else -> en). */
export function langFromPath(pathname: string): Lang {
  const seg = pathname.split('/')[1] ?? '';
  return isLang(seg) ? seg : DEFAULT_LANG;
}
