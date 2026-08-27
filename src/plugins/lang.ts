import type { Lang } from '../i18n/types';

/**
 * Language of a document from its path (`/zh/` segment -> zh, everything else
 * en), shared by the HAST plugins that emit UI text (`ctx.fileURL`).
 */
export function langOfFile(fileURL: URL | undefined): Lang {
  return /\/zh\//.test(fileURL?.pathname ?? '') ? 'zh' : 'en';
}
