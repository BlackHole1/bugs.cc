/** Minimal typings for `subset-font` (harfbuzz subsetter), used by scripts/subset-font.ts. */
declare module 'subset-font' {
  interface SubsetFontOptions {
    targetFormat?: 'sfnt' | 'woff' | 'woff2' | 'truetype';
    preserveNameIds?: number[];
    /** Pin an axis to a value (instancing) or restrict its range. */
    variationAxes?: Record<string, number | { min: number; max: number; default?: number }>;
  }
  export default function subsetFont(
    buffer: Buffer,
    text: string,
    options?: SubsetFontOptions,
  ): Promise<Buffer>;
}
