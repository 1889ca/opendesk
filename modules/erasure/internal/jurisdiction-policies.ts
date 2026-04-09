/** Contract: contracts/erasure/rules.md */

import type { Jurisdiction, LegalBasis, JurisdictionPolicy } from '../contract.ts';

/**
 * Stateless jurisdiction policy lookup.
 * No database storage -- policies are defined in code as they derive from law.
 */

type PolicyKey = `${Jurisdiction}:${LegalBasis}`;

const POLICIES: Record<PolicyKey, JurisdictionPolicy> = {
  // GDPR (EU)
  'EU:GDPR_ART_17': {
    jurisdiction: 'EU',
    legalBasis: 'GDPR_ART_17',
    erasureDeadlineDays: 30,
    description: 'GDPR Article 17 Right to Erasure: must erase within 30 days of valid request.',
  },
  'EU:COURT_ORDER': {
    jurisdiction: 'EU',
    legalBasis: 'COURT_ORDER',
    erasureDeadlineDays: 7,
    description: 'EU court-ordered erasure: comply within 7 days unless otherwise specified.',
  },
  'EU:INTERNAL_POLICY': {
    jurisdiction: 'EU',
    legalBasis: 'INTERNAL_POLICY',
    erasureDeadlineDays: 90,
    description: 'Internal retention policy under EU jurisdiction: 90-day default.',
  },
  'EU:PIPEDA_PRINCIPLE_9': {
    jurisdiction: 'EU',
    legalBasis: 'PIPEDA_PRINCIPLE_9',
    erasureDeadlineDays: 30,
    description: 'PIPEDA not applicable in EU; falls back to GDPR-equivalent 30-day deadline.',
  },
  'EU:HIPAA_RETENTION': {
    jurisdiction: 'EU',
    legalBasis: 'HIPAA_RETENTION',
    erasureDeadlineDays: 30,
    description: 'HIPAA not applicable in EU; falls back to GDPR-equivalent 30-day deadline.',
  },

  // PIPEDA (Canada)
  'CA:PIPEDA_PRINCIPLE_9': {
    jurisdiction: 'CA',
    legalBasis: 'PIPEDA_PRINCIPLE_9',
    erasureDeadlineDays: 30,
    description: 'PIPEDA Principle 9: destroy personal info once purpose fulfilled. 30-day guideline.',
  },
  'CA:GDPR_ART_17': {
    jurisdiction: 'CA',
    legalBasis: 'GDPR_ART_17',
    erasureDeadlineDays: 30,
    description: 'GDPR request processed under Canadian operations: 30-day courtesy compliance.',
  },
  'CA:COURT_ORDER': {
    jurisdiction: 'CA',
    legalBasis: 'COURT_ORDER',
    erasureDeadlineDays: 7,
    description: 'Canadian court-ordered erasure: comply within 7 days.',
  },
  'CA:INTERNAL_POLICY': {
    jurisdiction: 'CA',
    legalBasis: 'INTERNAL_POLICY',
    erasureDeadlineDays: 90,
    description: 'Internal retention policy under Canadian jurisdiction: 90-day default.',
  },
  'CA:HIPAA_RETENTION': {
    jurisdiction: 'CA',
    legalBasis: 'HIPAA_RETENTION',
    erasureDeadlineDays: 30,
    description: 'HIPAA not applicable in CA; falls back to PIPEDA-equivalent 30-day deadline.',
  },

  // HIPAA (US health records)
  'US_HIPAA:HIPAA_RETENTION': {
    jurisdiction: 'US_HIPAA',
    legalBasis: 'HIPAA_RETENTION',
    erasureDeadlineDays: 2190, // 6 years
    description: 'HIPAA: retain records for 6 years from date of creation or last effective date.',
  },
  'US_HIPAA:GDPR_ART_17': {
    jurisdiction: 'US_HIPAA',
    legalBasis: 'GDPR_ART_17',
    erasureDeadlineDays: 2190,
    description: 'GDPR request for HIPAA-covered data: HIPAA retention overrides (6 years).',
  },
  'US_HIPAA:COURT_ORDER': {
    jurisdiction: 'US_HIPAA',
    legalBasis: 'COURT_ORDER',
    erasureDeadlineDays: 30,
    description: 'Court-ordered erasure for HIPAA data: 30-day compliance window.',
  },
  'US_HIPAA:INTERNAL_POLICY': {
    jurisdiction: 'US_HIPAA',
    legalBasis: 'INTERNAL_POLICY',
    erasureDeadlineDays: 2190,
    description: 'Internal policy for HIPAA data: default to 6-year HIPAA minimum.',
  },
  'US_HIPAA:PIPEDA_PRINCIPLE_9': {
    jurisdiction: 'US_HIPAA',
    legalBasis: 'PIPEDA_PRINCIPLE_9',
    erasureDeadlineDays: 2190,
    description: 'PIPEDA not applicable under US HIPAA; HIPAA retention overrides (6 years).',
  },
};

/** Look up the erasure policy for a jurisdiction + legal basis combination. */
export function getPolicy(jurisdiction: Jurisdiction, legalBasis: LegalBasis): JurisdictionPolicy {
  const key: PolicyKey = `${jurisdiction}:${legalBasis}`;
  const policy = POLICIES[key];
  if (!policy) {
    throw new Error(`No erasure policy defined for ${key}`);
  }
  return policy;
}
