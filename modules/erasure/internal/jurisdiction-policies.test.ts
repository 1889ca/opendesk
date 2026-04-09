/** Contract: contracts/erasure/rules.md */
import { describe, it, expect } from 'vitest';
import { getPolicy } from './jurisdiction-policies.ts';

describe('getPolicy', () => {
  it('returns GDPR Art 17 with 30-day deadline', () => {
    const policy = getPolicy('EU', 'GDPR_ART_17');
    expect(policy.jurisdiction).toBe('EU');
    expect(policy.legalBasis).toBe('GDPR_ART_17');
    expect(policy.erasureDeadlineDays).toBe(30);
  });

  it('returns PIPEDA Principle 9 with 30-day deadline', () => {
    const policy = getPolicy('CA', 'PIPEDA_PRINCIPLE_9');
    expect(policy.jurisdiction).toBe('CA');
    expect(policy.erasureDeadlineDays).toBe(30);
  });

  it('returns HIPAA with 6-year retention', () => {
    const policy = getPolicy('US_HIPAA', 'HIPAA_RETENTION');
    expect(policy.jurisdiction).toBe('US_HIPAA');
    expect(policy.erasureDeadlineDays).toBe(2190);
  });

  it('returns court order with 7-day deadline for EU', () => {
    const policy = getPolicy('EU', 'COURT_ORDER');
    expect(policy.erasureDeadlineDays).toBe(7);
  });

  it('returns court order with 7-day deadline for CA', () => {
    const policy = getPolicy('CA', 'COURT_ORDER');
    expect(policy.erasureDeadlineDays).toBe(7);
  });

  it('HIPAA overrides GDPR for US_HIPAA jurisdiction', () => {
    const policy = getPolicy('US_HIPAA', 'GDPR_ART_17');
    expect(policy.erasureDeadlineDays).toBe(2190);
  });

  it('returns internal policy with 90-day default for EU', () => {
    const policy = getPolicy('EU', 'INTERNAL_POLICY');
    expect(policy.erasureDeadlineDays).toBe(90);
  });

  it('all jurisdiction+basis combinations have a policy', () => {
    const jurisdictions = ['EU', 'CA', 'US_HIPAA'] as const;
    const bases = [
      'GDPR_ART_17',
      'PIPEDA_PRINCIPLE_9',
      'HIPAA_RETENTION',
      'COURT_ORDER',
      'INTERNAL_POLICY',
    ] as const;

    for (const j of jurisdictions) {
      for (const b of bases) {
        expect(() => getPolicy(j, b)).not.toThrow();
        const p = getPolicy(j, b);
        expect(p.erasureDeadlineDays).toBeGreaterThan(0);
        expect(p.description).toBeTruthy();
      }
    }
  });
});
