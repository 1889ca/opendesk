/** Contract: contracts/app/rules.md */
import * as Y from 'yjs';

// --- Rule Types ---

export type HighlightCondition = 'greater' | 'less' | 'equal' | 'between' | 'text-contains';

export type CondFormatRule =
  | { type: 'color-scale'; colIndex: number; minColor: string; maxColor: string }
  | { type: 'data-bar'; colIndex: number; color: string }
  | {
      type: 'highlight'; colIndex: number;
      condition: HighlightCondition;
      value: string; value2?: string;
      bgColor: string; textColor?: string;
    }
  | { type: 'icon-set'; colIndex: number; icons: 'arrows' | 'circles' | 'flags' };

export type CondFormatResult = {
  backgroundColor?: string;
  textColor?: string;
  dataBarWidth?: number;
  icon?: string;
};

// --- Yjs Storage ---

const COND_FORMAT_KEY = 'cond-format-rules';

function getRulesArray(ydoc: Y.Doc): Y.Array<string> {
  return ydoc.getArray<string>(COND_FORMAT_KEY);
}

export function serializeRule(rule: CondFormatRule): string {
  return JSON.stringify(rule);
}

export function deserializeRule(record: string): CondFormatRule {
  return JSON.parse(record) as CondFormatRule;
}

/** Get all conditional format rules from the Yjs document. */
export function getRules(ydoc: Y.Doc): CondFormatRule[] {
  const arr = getRulesArray(ydoc);
  const rules: CondFormatRule[] = [];
  for (let i = 0; i < arr.length; i++) {
    try {
      rules.push(deserializeRule(arr.get(i)));
    } catch { /* skip corrupt entries */ }
  }
  return rules;
}

/** Add a conditional format rule. */
export function addRule(ydoc: Y.Doc, rule: CondFormatRule): void {
  const arr = getRulesArray(ydoc);
  ydoc.transact(() => {
    arr.insert(arr.length, [serializeRule(rule)]);
  });
}

/** Remove a conditional format rule by index. */
export function removeRule(ydoc: Y.Doc, index: number): void {
  const arr = getRulesArray(ydoc);
  if (index < 0 || index >= arr.length) return;
  ydoc.transact(() => {
    arr.delete(index, 1);
  });
}

/** Observe changes to the conditional format rules array. */
export function observeRules(ydoc: Y.Doc, callback: () => void): void {
  getRulesArray(ydoc).observe(callback);
}
