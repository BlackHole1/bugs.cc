/**
 * Expressive Code plugin: Shiki-style notation comments for text markers, the
 * syntax antfu.me uses (Shiki's `transformerNotation*` with "v3" matching).
 *
 * ```js
 * const a = 1 // [!code highlight]   -> this line is marked
 * const b = 2 // [!code ++]          -> this line is inserted (green, "+")
 * const c = 3 // [!code --]          -> this line is deleted (red, "-")
 * // [!code highlight:2]             -> the next 2 lines; a notation alone on
 *                                       its line applies from the next line on
 *                                       and the line itself is removed
 * // [!code word:foo]                -> every `foo` in the block is marked
 * ```
 *
 * `:N` after `highlight` / `++` / `--` extends the marker to N lines. The
 * comment prefix may be `//`, `#`, `--`, `/* ... *\/`, `<!-- ... -->`, `%%`,
 * `;;`, `"` or `'` (as in Shiki). The notation is removed from the code before
 * syntax highlighting; a line that held nothing else is deleted.
 *
 * The markers are handed to Expressive Code's own text-markers plugin through
 * `codeBlock.props` (`mark` / `ins` / `del`), so they render exactly like the
 * fence meta syntax (`{1,3-5}`, `"term"`, `ins={7}`, ...), which keeps working
 * and can be combined with the notation (meta line numbers count the lines of
 * the fence, notation-only lines included). Notations this plugin does not
 * implement (`focus`, `error`, `warning`) are left in the code untouched.
 *
 * Only `import type` here: ec.config.mjs is loaded by Node itself (type
 * stripping), not by Vite.
 */
import type {
  ExpressiveCodeBlock,
  ExpressiveCodePlugin,
  MarkerDefinition,
} from 'astro-expressive-code';

type MarkerType = 'mark' | 'ins' | 'del';

interface Notation {
  /** Index of the line carrying the notation. */
  lineIndex: number;
  /** Column where the notation (including the whitespace before it) starts. */
  column: number;
  /** The line holds nothing but the notation and is deleted. */
  alone: boolean;
}

const NOTATION =
  /\s*(?:\/\/|\/\*|<!--|#|--|%%|;;|"|')\s+\[!code (highlight|\+\+|--|word:[^\]:]+)(?::(\d+))?\]\s*(?:\*\/|-->)?\s*$/;

const LINE_MARKERS: Record<string, MarkerType> = { highlight: 'mark', '++': 'ins', '--': 'del' };

/** Notations found in `preprocessLanguage`, removed from the code in `preprocessCode`. */
const notationsByBlock = new WeakMap<ExpressiveCodeBlock, Notation[]>();

function addDefinition(
  codeBlock: ExpressiveCodeBlock,
  type: MarkerType,
  definition: MarkerDefinition,
): void {
  const current = codeBlock.props[type];
  const list = current === undefined ? [] : Array.isArray(current) ? current : [current];
  list.push(definition);
  codeBlock.props[type] = list;
}

export function notationMarkers(): ExpressiveCodePlugin {
  return {
    name: 'NotationMarkers',
    hooks: {
      // The text-markers plugin reads `props` in `preprocessMetadata`, which
      // runs after every plugin's `preprocessLanguage`. Code is read-only here.
      preprocessLanguage: ({ codeBlock }) => {
        const notations: Notation[] = [];
        codeBlock.getLines().forEach((line, lineIndex) => {
          const match = NOTATION.exec(line.text);
          if (!match) return;
          const kind = match[1] ?? '';
          const column = match.index;
          const alone = line.text.slice(0, column).trim() === '';
          notations.push({ lineIndex, column, alone });
          if (kind.startsWith('word:')) {
            addDefinition(codeBlock, 'mark', kind.slice('word:'.length));
            return;
          }
          const type = LINE_MARKERS[kind];
          if (!type) return;
          const count = match[2] === undefined ? 1 : Math.max(1, Number(match[2]));
          // 1-based line numbers, as the text-markers plugin expects. It
          // resolves them to line objects before `preprocessCode` deletes the
          // notation-only lines, so the numbering of the fence is what counts.
          const first = lineIndex + 1 + (alone ? 1 : 0);
          addDefinition(codeBlock, type, { range: `${first}-${first + count - 1}` });
        });
        if (notations.length > 0) notationsByBlock.set(codeBlock, notations);
      },
      // Code is editable now: strip the notations, drop the lines left empty.
      preprocessCode: ({ codeBlock }) => {
        const notations = notationsByBlock.get(codeBlock);
        if (!notations) return;
        notationsByBlock.delete(codeBlock);
        const toDelete: number[] = [];
        for (const { lineIndex, column, alone } of notations) {
          if (alone) toDelete.push(lineIndex);
          else codeBlock.getLine(lineIndex)?.editText(column, undefined, '');
        }
        if (toDelete.length > 0) codeBlock.deleteLines(toDelete);
      },
    },
  };
}
