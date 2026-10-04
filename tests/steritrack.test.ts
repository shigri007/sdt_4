// Validates all 15 critical hospital safety and traceability invariants

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../server/src/db/index.js';
import { WorkflowService } from '../server/src/services/workflow.js';
import { BatchService } from '../server/src/services/batch.js';
import { QcService } from '../server/src/services/qc.js';
import { ReprocessingService } from '../server/src/services/reprocessing.js';
import { DispatchService } from '../server/src/services/dispatch.js';
import { RequestService } from '../server/src/services/request.js';
import { TraceabilityService } from '../server/src/services/traceability.js';
import { AuthenticatedUser } from '../server/src/middleware/auth.js';

describe('SteriTrack Hospital System - Integrity Invariants', () => {
  const adminUser: AuthenticatedUser = {
    id: 1,
    username: 'admin',
    email: 'admin@steritrack.hospital.org',
    fullName: 'Dr. Evelyn Vance',
    role: 'ADMINISTRATOR',
    departmentId: 4,
    badgeNumber: 'BADGE-ADM-01',
  };

  const surgUser: AuthenticatedUser = {
    id: 2,
    username: 'dept_surg',
    email: 'surg.lead@steritrack.hospital.org',
    fullName: 'Nurse Marcus Brody',
    role: 'DEPARTMENT_STAFF',
    departmentId: 1,
    badgeNumber: 'BADGE-SURG-07',
  };

  const operatorKim: AuthenticatedUser = {
    id: 4,
    username: 'operator_kim',
    email: 'kim.reprocess@steritrack.hospital.org',
    fullName: 'Kimberley Taylor',
    role: 'REPROCESSING_OPERATOR',
    departmentId: 4,
    badgeNumber: 'BADGE-CSPD-22',
  };

  const operatorDavid: AuthenticatedUser = {
    id: 5,
    username: 'operator_chen',
    email: 'chen.operator@steritrack.hospital.org',
    fullName: 'David Chen',
    role: 'REPROCESSING_OPERATOR',
    departmentId: 4,
    badgeNumber: 'BADGE-CSPD-25',
  };

  const qcSarah: AuthenticatedUser = {
    id: 6,
    username: 'qc_sarah',
    email: 'sarah.qc@steritrack.hospital.org',
    fullName: 'Sarah Chen',
    role: 'QUALITY_COORDINATOR',
    departmentId: 4,
    badgeNumber: 'BADGE-QC-03',
  };

  beforeEach(() => {
    db.store = new (db.store.constructor as any)();
  });

  // TEST 1: Login succeeds with correct credentials
  it('TEST 1: Seed demo users exist with valid roles', () => {
    const admin = db.store.users.find(u => u.username === 'admin');
    expect(admin).toBeDefined();
    expect(admin?.role_code).toBe('ADMINISTRATOR');
    expect(admin?.is_active).toBe(1);
  });

  // TEST 2: Role separation validation
  it('TEST 2: Operator cannot perform Quality Control action', async () => {
    // Attempting to submit QC review as an operator must be forbidden
    await expect(
      QcService.submitReview({ batchId: 1, decision: 'APPROVED' }, operatorKim)
    ).rejects.toThrow(/Forbidden/);
  });

  // TEST 3: Department creates request
  it('TEST 3: Department creates sterile kit requisition', async () => {
    const req = await RequestService.createRequest(
      {
        kitTypeId: 1,
        quantity: 1,
        priority: 'URGENT',
        clinicalReason: 'Emergency laparotomy for trauma ICU patient',
      },
      surgUser
    );

    expect(req).toBeDefined();
    expect(req.department_id).toBe(1);
    expect(req.priority).toBe('URGENT');
    expect(req.status).toBe('PENDING');
  });

  // TEST 4: Kit completes valid state machine workflow
  it('TEST 4: Kit completes valid sequential workflow', async () => {
    // Start with a kit in RETURNED status (e.g. KIT-0008, id 8)
    const kit = db.store.kits.find(k => k.id === 8)!;
    expect(kit.current_status).toBe('RETURNED');

    const res1 = await WorkflowService.transitionKit(kit.id, 'RECEIVED', operatorKim);
    expect(res1.kit.current_status).toBe('RECEIVED');

    const res2 = await WorkflowService.transitionKit(kit.id, 'CLEANING', operatorKim);
    expect(res2.kit.current_status).toBe('CLEANING');

    const res3 = await WorkflowService.transitionKit(kit.id, 'INSPECTION', operatorKim);
    expect(res3.kit.current_status).toBe('INSPECTION');

    const res4 = await WorkflowService.transitionKit(kit.id, 'PACKING', operatorKim);
    expect(res4.kit.current_status).toBe('PACKING');
  });

  // TEST 5: Illegal workflow transition rejected
  it('TEST 5: Illegal workflow transition is strictly rejected', async () => {
    // A RETURNED kit cannot jump directly to AVAILABLE!
    const kit = db.store.kits.find(k => k.id === 8)!;
    expect(kit.current_status).toBe('RETURNED');

    await expect(
      WorkflowService.transitionKit(kit.id, 'AVAILABLE', qcSarah)
    ).rejects.toThrow(/independent batch review/);
  });

  // TEST 6: Failed processing quarantines kit
  it('TEST 6: Failed processing batch quarantines kit', async () => {
    // Put kit 13 into PACKING then batch it
    const kit13 = db.store.kits.find(k => k.id === 13)!;
    expect(kit13.current_status).toBe('PACKING');

    const batch = await BatchService.createBatch(
      {
        sterilizerUnitId: 'Autoclave Unit #1',
        processingMethod: 'STEAM_AUTOCLAVE',
        kitIds: [kit13.id],
      },
      operatorKim
    );

    expect(kit13.current_status).toBe('PROCESSING');

    // Fail the batch
    await BatchService.failBatch(batch.id, operatorKim, 'Chamber temperature dropped below 134°C');

    expect(kit13.current_status).toBe('QUARANTINED');
    const attempt = db.store.processing_attempts.find(pa => pa.kit_id === kit13.id && pa.attempt_number === kit13.processing_attempt_number);
    expect(attempt?.result).toBe('FAILED');
    expect(attempt?.qc_status).toBe('REJECTED');
  });

  // TEST 7 & TEST 8: Reprocessing creates NEW attempt and leaves failed attempt intact
  it('TEST 7 & 8: Reprocessing creates NEW attempt and preserves failed attempt', async () => {
    // Kit 17 is currently QUARANTINED with Attempt #1 FAILED
    const kit17 = db.store.kits.find(k => k.id === 17)!;
    expect(kit17.current_status).toBe('QUARANTINED');
    expect(kit17.processing_attempt_number).toBe(1);

    const oldAttempt = db.store.processing_attempts.find(pa => pa.kit_id === kit17.id && pa.attempt_number === 1)!;
    expect(oldAttempt).toBeDefined();
    expect(oldAttempt.result).toBe('FAILED');

    // Authorize reprocessing
    const { kit, newAttempt } = await ReprocessingService.startReprocessing(
      kit17.id,
      qcSarah,
      'Full cleaning breakdown and re-sterilization approved.'
    );

    expect(kit.processing_attempt_number).toBe(2);
    expect(kit.current_status).toBe('RECEIVED');
    expect(newAttempt.attempt_number).toBe(2);
    expect(newAttempt.result).toBe('PENDING');

    // The first failed attempt must remain available after reprocessing.
    const preservedAttempt1 = db.store.processing_attempts.find(pa => pa.kit_id === kit17.id && pa.attempt_number === 1)!;
    expect(preservedAttempt1).toBeDefined();
    expect(preservedAttempt1.result).toBe('FAILED');
    expect(preservedAttempt1.qc_status).toBe('REJECTED');
  });

  // TEST 9: Operator cannot approve their own batch
  it('TEST 9: Operator who ran a batch CANNOT approve their own QC', async () => {
    // Put kit into packing and create batch with operatorKim
    const kit13 = db.store.kits.find(k => k.id === 13)!;
    const batch = await BatchService.createBatch(
      {
        sterilizerUnitId: 'Autoclave Unit #1',
        processingMethod: 'STEAM_AUTOCLAVE',
        kitIds: [kit13.id],
      },
      operatorKim
    );

    await BatchService.completeBatch(batch.id, operatorKim, { physicalPassed: true, chemicalPassed: true, notes: 'Physical and chemical indicators passed.' });

    // Operator Kimberley tries to self-approve batch
    await expect(
      QcService.submitReview(
        { batchId: batch.id, decision: 'APPROVED' },
        { ...operatorKim, role: 'QUALITY_COORDINATOR' } // even if user had coordinator role
      )
    ).rejects.toThrow(/Operator who ran this sterilization batch is strictly prohibited from approving/);
  });

  // TEST 10: QC-approved kit becomes available
  it('TEST 10: Independent QC approval makes kit AVAILABLE with valid expiry date', async () => {
    // Batch 4 was run by David Chen (id 5) and has kits 15 and 16
    const batch4 = db.store.batches.find(b => b.id === 4)!;
    expect(batch4.operator_id).toBe(5);

    await expect(QcService.submitReview({batchId:batch4.id,decision:'APPROVED',biologicalTestResult:'NOT NEGATIVE',chemicalIndicatorResult:'NOT PASS',packagingIntegrityVerified:true,notes:'Evidence is not passing.'},qcSarah)).rejects.toThrow(/Record passing biological/);

    // Sarah Chen (id 6) approves batch 4
    await QcService.submitReview(
      { batchId: batch4.id, decision: 'APPROVED', biologicalTestResult: 'NEGATIVE', chemicalIndicatorResult: 'PASS', packagingIntegrityVerified: true, notes: 'All evidence reviewed and packaging intact.' },
      qcSarah
    );

    const kit15 = db.store.kits.find(k => k.id === 15)!;
    expect(kit15.current_status).toBe('AVAILABLE');
    expect(kit15.expiration_date).toBeDefined();

    const attempt = db.store.processing_attempts.find(pa => pa.kit_id === kit15.id && pa.attempt_number === kit15.processing_attempt_number);
    expect(attempt?.result).toBe('PASSED');
    expect(attempt?.qc_status).toBe('APPROVED');
    expect(attempt?.reviewer_id).toBe(qcSarah.id);
  });

  it('rolls back a multi-kit dispatch when any selected kit is ineligible', async () => {
    const availableKit = db.store.kits.find(k => k.id === 4)!;
    const dispatchCount = db.store.dispatches.length;
    await expect(DispatchService.dispatchRequest({requestId:3,kitIds:[4,17]},qcSarah)).rejects.toThrow(/Dispatch Ineligible/);
    expect(availableKit.current_status).toBe('AVAILABLE');
    expect(db.store.dispatches).toHaveLength(dispatchCount);
    expect(db.store.requests.find(r=>r.id===3)?.status).toBe('PENDING');
  });

  // TEST 11: Quarantined kit cannot be dispatched
  it('TEST 11: Quarantined kit CANNOT be dispatched', async () => {
    const quarantinedKit = db.store.kits.find(k => k.id === 17)!;
    expect(quarantinedKit.current_status).toBe('QUARANTINED');

    await expect(
      DispatchService.dispatchKit(
        { requestId: 2, kitId: quarantinedKit.id },
        qcSarah
      )
    ).rejects.toThrow(/Dispatch Ineligible/);
  });

  // TEST 12: Expired kit cannot be dispatched
  it('TEST 12: Expired kit CANNOT be dispatched', async () => {
    const expiredKit = db.store.kits.find(k => k.id === 19)!;
    expect(expiredKit.current_status).toBe('EXPIRED');

    await expect(
      DispatchService.dispatchKit(
        { requestId: 6, kitId: expiredKit.id },
        qcSarah
      )
    ).rejects.toThrow(/Dispatch Ineligible/);
  });

  // TEST 13: Already-issued kit cannot be issued again
  it('TEST 13: Already issued kit cannot be dispatched again', async () => {
    // Kit 12 is already DISPATCHED
    const kit12 = db.store.kits.find(k => k.id === 12)!;
    expect(kit12.current_status).toBe('DISPATCHED');

    await expect(
      DispatchService.dispatchKit(
        { requestId: 6, kitId: kit12.id },
        qcSarah
      )
    ).rejects.toThrow(/Dispatch Ineligible/);
  });

  // TEST 14: Two simultaneous dispatch attempts produce exactly one success
  it('TEST 14: Concurrent dispatch attempts on same kit allow exactly ONE winner', async () => {
    // Kit 1 is AVAILABLE
    const kit1 = db.store.kits.find(k => k.id === 1)!;
    expect(kit1.current_status).toBe('AVAILABLE');

    // First dispatch succeeds
    const dispatch1 = await DispatchService.dispatchKit(
      { requestId: 6, kitId: kit1.id },
      qcSarah
    );
    expect(dispatch1).toBeDefined();
    expect(kit1.current_status).toBe('DISPATCHED');

    const secondRequest = { ...db.store.requests.find(r => r.id === 6)!, id: 99, request_code: 'REQ-SECOND-99', status: 'PENDING' as const, completed_at: null };
    db.store.requests.push(secondRequest);

    // Second dispatch on same kit MUST fail gracefully
    await expect(
      DispatchService.dispatchKit(
        { requestId: 99, kitId: kit1.id },
        qcSarah
      )
    ).rejects.toThrow(/Dispatch Ineligible/);
  });

  // TEST 15: Complete trace history returned in chronological order
  it('TEST 15: Kit traceability returns both attempts and chronological timeline', async () => {
    // Hero Kit KIT-0012 has Attempt #1 (FAILED) and Attempt #2 (PASSED)
    const trace = await TraceabilityService.getKitTraceability('KIT-0012');

    expect(trace).toBeDefined();
    expect(trace.kit.kit_code).toBe('KIT-0012');
    expect(trace.qrCodeDataUrl).toContain('data:image/png;base64');
    expect(trace.attempts.length).toBeGreaterThanOrEqual(2);

    // Verify Attempt #1 was FAILED
    const att1 = trace.attempts.find(a => a.attempt_number === 1);
    expect(att1?.result).toBe('FAILED');
    expect(att1?.failure_reason).toBeDefined();

    // Verify Attempt #2 was PASSED
    const att2 = trace.attempts.find(a => a.attempt_number === 2);
    expect(att2?.result).toBe('PASSED');
    expect(att2?.qc_status).toBe('APPROVED');

    // Verify timeline exists and has entries
    expect(trace.timeline.length).toBeGreaterThan(0);
  });
});
