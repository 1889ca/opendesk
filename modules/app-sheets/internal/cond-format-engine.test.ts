/** Contract: contracts/app-sheets/rules.md */
import { describe, it, expect } from 'vitest';
import { interpolateColor, evaluateCondFormat } from './cond-format-engine.ts';
import type { CondFormatRule } from './cond-format-rules.ts';

describe('interpolateColor', () => {
  it('returns first color at t=0', () => {
    expect(interpolateColor('#ff0000', '#0000ff', 0)).toBe('#ff0000');
  });

  it('returns second color at t=1', () => {
    expect(interpolateColor('#ff0000', '#0000ff', 1)).toBe('#0000ff');
  });

  it('returns midpoint at t=0.5', () => {
    const result = interpolateColor('#000000', '#ffffff', 0.5);
    expect(result).toBe('#808080');
  });

  it('clamps t below 0', () => {
    expect(interpolateColor('#000000', '#ffffff', -1)).toBe('#000000');
  });

  it('clamps t above 1', () => {
    expect(interpolateColor('#000000', '#ffffff', 2)).toBe('#ffffff');
  });
});

describe('evaluateCondFormat', () => {
  it('returns null when no rules match the column', () => {
    const rules: CondFormatRule[] = [
      { type: 'color-scale', colIndex: 5, minColor: '#000', maxColor: '#fff' },
    ];
    const result = evaluateCondFormat(rules, 0, 0, '10', ['10', '20']);
    expect(result).toBeNull();
  });

  it('evaluates color-scale rule for numeric cells', () => {
    const rules: CondFormatRule[] = [
      { type: 'color-scale', colIndex: 0, minColor: '#ff0000', maxColor: '#00ff00' },
    ];
    const columnValues = ['0', '50', '100'];
    const result = evaluateCondFormat(rules, 0, 0, '0', columnValues);
    expect(result).not.toBeNull();
    expect(result!.backgroundColor).toBe('#ff0000');
  });

  it('color-scale returns null for non-numeric cell', () => {
    const rules: CondFormatRule[] = [
      { type: 'color-scale', colIndex: 0, minColor: '#000', maxColor: '#fff' },
    ];
    const result = evaluateCondFormat(rules, 0, 0, 'abc', ['abc', '10']);
    expect(result).toBeNull();
  });

  it('evaluates highlight greater condition', () => {
    const rules: CondFormatRule[] = [
      {
        type: 'highlight', colIndex: 0,
        condition: 'greater', value: '50',
        bgColor: '#ff0000',
      },
    ];
    expect(evaluateCondFormat(rules, 0, 0, '75', ['75'])).not.toBeNull();
    expect(evaluateCondFormat(rules, 0, 0, '25', ['25'])).toBeNull();
  });

  it('evaluates highlight less condition', () => {
    const rules: CondFormatRule[] = [
      {
        type: 'highlight', colIndex: 0,
        condition: 'less', value: '50',
        bgColor: '#0000ff',
      },
    ];
    expect(evaluateCondFormat(rules, 0, 0, '25', ['25'])).not.toBeNull();
    expect(evaluateCondFormat(rules, 0, 0, '75', ['75'])).toBeNull();
  });

  it('evaluates highlight equal condition', () => {
    const rules: CondFormatRule[] = [
      {
        type: 'highlight', colIndex: 0,
        condition: 'equal', value: 'yes',
        bgColor: '#00ff00',
      },
    ];
    expect(evaluateCondFormat(rules, 0, 0, 'yes', ['yes'])).not.toBeNull();
    expect(evaluateCondFormat(rules, 0, 0, 'no', ['no'])).toBeNull();
  });

  it('evaluates highlight between condition', () => {
    const rules: CondFormatRule[] = [
      {
        type: 'highlight', colIndex: 0,
        condition: 'between', value: '10', value2: '20',
        bgColor: '#aaa',
      },
    ];
    expect(evaluateCondFormat(rules, 0, 0, '15', ['15'])).not.toBeNull();
    expect(evaluateCondFormat(rules, 0, 0, '5', ['5'])).toBeNull();
    expect(evaluateCondFormat(rules, 0, 0, '25', ['25'])).toBeNull();
  });

  it('evaluates highlight text-contains condition', () => {
    const rules: CondFormatRule[] = [
      {
        type: 'highlight', colIndex: 0,
        condition: 'text-contains', value: 'error',
        bgColor: '#f00',
      },
    ];
    expect(evaluateCondFormat(rules, 0, 0, 'has error here', ['has error here'])).not.toBeNull();
    expect(evaluateCondFormat(rules, 0, 0, 'all good', ['all good'])).toBeNull();
  });

  it('evaluates data-bar rule', () => {
    const rules: CondFormatRule[] = [
      { type: 'data-bar', colIndex: 0, color: '#3366ff' },
    ];
    const result = evaluateCondFormat(rules, 0, 0, '50', ['0', '50', '100']);
    expect(result).not.toBeNull();
    expect(result!.dataBarWidth).toBeGreaterThan(0);
    expect(result!.dataBarWidth).toBeLessThanOrEqual(100);
  });

  it('evaluates icon-set rule', () => {
    const rules: CondFormatRule[] = [
      { type: 'icon-set', colIndex: 0, icons: 'arrows' },
    ];
    const columnValues = ['10', '50', '90'];

    const high = evaluateCondFormat(rules, 0, 0, '90', columnValues);
    expect(high!.icon).toBe('\u25B2'); // ▲

    const low = evaluateCondFormat(rules, 0, 0, '10', columnValues);
    expect(low!.icon).toBe('\u25BC'); // ▼
  });

  it('returns first matching rule when multiple rules exist', () => {
    const rules: CondFormatRule[] = [
      {
        type: 'highlight', colIndex: 0,
        condition: 'greater', value: '50',
        bgColor: '#first',
      },
      {
        type: 'highlight', colIndex: 0,
        condition: 'greater', value: '10',
        bgColor: '#second',
      },
    ];
    const result = evaluateCondFormat(rules, 0, 0, '75', ['75']);
    expect(result!.backgroundColor).toBe('#first');
  });
});
