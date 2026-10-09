import { describe, expect, it } from 'vitest';
import { canAccessTab, ROLE_TABS, TAB_PATHS } from '../src/access.js';
import { qcReviewSchema } from '../src/schemas/qcReviewSchema.js';

describe('Quality Review form schema', () => {
  const validReview = {
    decision: 'APPROVED',
    biologicalTestResult: '',
    chemicalIndicatorResult: '',
    packagingIntegrityVerified: false,
    notes: 'Cycle chart checked',
  };

  it('accepts a review with valid values and optional indicator selections', () => {
    expect(qcReviewSchema.safeParse(validReview).success).toBe(true);
  });

  it('accepts a rejected review and recognized indicator readings', () => {
    const result = qcReviewSchema.safeParse({
      ...validReview,
      decision: 'REJECTED',
      biologicalTestResult: 'POSITIVE',
      chemicalIndicatorResult: 'FAIL',
    });

    expect(result.success).toBe(true);
  });

  it('rejects notes shorter than five characters after trimming', () => {
    const result = qcReviewSchema.safeParse({ ...validReview, notes: '   ab  ' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === 'notes')).toBe(true);
    }
  });

  it('trims notes before returning validated form data', () => {
    const result = qcReviewSchema.safeParse({ ...validReview, notes: '  Verified cycle  ' });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.notes).toBe('Verified cycle');
  });

  it('rejects unknown decision and indicator values', () => {
    expect(qcReviewSchema.safeParse({ ...validReview, decision: 'PENDING' }).success).toBe(false);
    expect(qcReviewSchema.safeParse({ ...validReview, biologicalTestResult: 'PASS' }).success).toBe(false);
    expect(qcReviewSchema.safeParse({ ...validReview, chemicalIndicatorResult: 'NEGATIVE' }).success).toBe(false);
  });
});

describe('Role-aware route access map', () => {
  it('gives every role access to the dashboard route', () => {
    for (const role of Object.keys(ROLE_TABS) as Array<keyof typeof ROLE_TABS>) {
      expect(canAccessTab(role, 'dashboard')).toBe(true);
    }
    expect(TAB_PATHS.dashboard).toBe('/dashboard');
  });

  it('limits administrator tabs to administration and governance screens', () => {
    expect(canAccessTab('ADMINISTRATOR', 'admin')).toBe(true);
    expect(canAccessTab('ADMINISTRATOR', 'reports')).toBe(true);
    expect(canAccessTab('ADMINISTRATOR', 'processing')).toBe(false);
    expect(canAccessTab('ADMINISTRATOR', 'qc')).toBe(false);
  });

  it('keeps role-specific workflows mapped to their expected URLs', () => {
    expect(canAccessTab('REPROCESSING_OPERATOR', 'processing')).toBe(true);
    expect(canAccessTab('REPROCESSING_OPERATOR', 'qc')).toBe(false);
    expect(canAccessTab('QUALITY_COORDINATOR', 'qc')).toBe(true);
    expect(canAccessTab('DEPARTMENT_STAFF', 'receipts')).toBe(true);
    expect(TAB_PATHS.kits).toBe('/registry');
    expect(TAB_PATHS.qc).toBe('/quality-control');
  });
});
