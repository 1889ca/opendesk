/** Contract: contracts/sheets-formula/rules.md */
import { describe, it, expect } from 'vitest';
import { type CellGrid, type FormulaError, evaluateFormula, FormulaErrorType } from '../index.ts';

function grid(data: Record<string, number | string | boolean | null>): CellGrid {
  return new Map(Object.entries(data));
}

describe('PMT', () => {
  it('calculates monthly payment for a 30-year mortgage', () => {
    // $200,000 loan at 6% annual (0.5% monthly) for 360 months
    const r = evaluateFormula('=PMT(0.005, 360, 200000)', grid({}), 'A1') as number;
    expect(r).toBeCloseTo(-1199.10, 1);
  });

  it('returns 0 rate payment', () => {
    expect(evaluateFormula('=PMT(0, 12, 1200)', grid({}), 'A1')).toBeCloseTo(-100);
  });

  it('with future value', () => {
    const r = evaluateFormula('=PMT(0.01, 12, 0, -10000)', grid({}), 'A1') as number;
    expect(r).toBeCloseTo(788.49, 1);
  });
});

describe('FV', () => {
  it('future value of regular savings', () => {
    // $100/month at 5% annual (0.4167%/mo) for 120 months
    const r = evaluateFormula('=FV(0.004167, 120, -100)', grid({}), 'A1') as number;
    expect(r).toBeGreaterThan(15000);
  });

  it('zero rate', () => {
    expect(evaluateFormula('=FV(0, 12, -100)', grid({}), 'A1')).toBeCloseTo(1200);
  });
});

describe('PV', () => {
  it('present value of annuity', () => {
    // $500/month for 60 months at 0.5%/month
    const r = evaluateFormula('=PV(0.005, 60, -500)', grid({}), 'A1') as number;
    expect(r).toBeGreaterThan(25000);
    expect(r).toBeLessThan(30000);
  });
});

describe('NPER', () => {
  it('calculates number of periods', () => {
    // How many months to pay off $10,000 at 1%/month with $200/month payment?
    const r = evaluateFormula('=NPER(0.01, -200, 10000)', grid({}), 'A1') as number;
    expect(r).toBeGreaterThan(50);
    expect(r).toBeLessThan(100);
  });
});

describe('NPV', () => {
  it('calculates net present value', () => {
    const g = grid({ A1: -10000, A2: 3000, A3: 4200, A4: 6800 });
    const r = evaluateFormula('=NPV(0.1, A1:A4)', g, 'B1') as number;
    expect(r).toBeCloseTo(1188.44, 0);
  });
});

describe('IRR', () => {
  it('calculates internal rate of return', () => {
    const g = grid({ A1: -10000, A2: 3000, A3: 4200, A4: 6800 });
    const r = evaluateFormula('=IRR(A1:A4)', g, 'B1') as number;
    expect(r).toBeCloseTo(0.1661, 2);
  });

  it('requires both positive and negative flows', () => {
    const g = grid({ A1: 100, A2: 200 });
    const r = evaluateFormula('=IRR(A1:A2)', g, 'B1') as FormulaError;
    expect(r.error).toBe(FormulaErrorType.NUM);
  });
});

describe('RATE', () => {
  it('finds interest rate', () => {
    // 360 months, -1199.10/month payment, $200,000 loan ≈ 0.5%/month
    const r = evaluateFormula('=RATE(360, -1199.10, 200000)', grid({}), 'A1') as number;
    expect(r).toBeCloseTo(0.005, 3);
  });
});
