/** Contract: contracts/app/rules.md */
/**
 * SmartPunctuation — InputRule-based extension for auto-correcting typed
 * ASCII sequences into proper typographic characters (#269).
 *
 * Handles: em dash, en dash, ellipsis, curly quotes, apostrophes.
 */
import { Extension, textInputRule } from '@tiptap/core';

export const SmartPunctuation = Extension.create({
  name: 'smartPunctuation',

  addInputRules() {
    return [
      // Em dash: --- → —
      textInputRule({ find: /---$/, replace: '—' }),
      // En dash: -- → –
      textInputRule({ find: /--$/, replace: '–' }),
      // Ellipsis: ... → …
      textInputRule({ find: /\.\.\.$/, replace: '…' }),
      // Closing double quote: word + " → "
      textInputRule({ find: /(\w)"$/, replace: '$1\u201D' }),
      // Closing single quote / apostrophe: word + ' → '
      textInputRule({ find: /(\w)'$/, replace: '$1\u2019' }),
    ];
  },
});
