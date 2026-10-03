// ==========================================================
// SteriTrack: Quarantine & Reprocessing Service
// Ensures failed attempts remain immutable in historical ledger
// ==========================================================

import { db, DbKit, DbProcessingAttempt, DbQuarantineRecord } from '../db/index.js';
import { AuthenticatedUser } from '../middleware/auth.js';
import { logAudit } from './audit.js';

export class ReprocessingService {
  /**
   * Release a kit from Quarantine and initiate a fresh reprocessing attempt cycle.
   */
  static async startReprocessing(
    kitId: number,
    actor: AuthenticatedUser,
    justification: string
  ): Promise<{ kit: DbKit; newAttempt: DbProcessingAttempt; quarantineRecord: DbQuarantineRecord }> {
    if (actor.role !== 'QUALITY_COORDINATOR') {
      throw new Error('Forbidden: Only Quality Coordinators can authorize releasing quarantined kits for reprocessing.');
    }

    const kit = db.store.kits.find(k => k.id === kitId);
    if (!kit) throw new Error(`Kit ID ${kitId} not found.`);

    if (kit.current_status !== 'QUARANTINED') {
      throw new Error(`Cannot reprocess Kit ${kit.kit_code}: status is "${kit.current_status}". Only "QUARANTINED" kits can be authorized for reprocessing.`);
    }

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    // 1. Resolve active quarantine record
    const quarantineRecord = db.store.quarantine_records
      .filter(qr => qr.kit_id === kit.id && qr.status === 'ACTIVE_QUARANTINE')
      .sort((a, b) => b.id - a.id)[0];

    if (quarantineRecord) {
      quarantineRecord.status = 'SENT_FOR_REPROCESSING';
      quarantineRecord.resolved_at = now;
      quarantineRecord.resolved_by_user_id = actor.id;
      quarantineRecord.resolution_notes = justification || 'Authorized for full reprocessing cycle.';
    }

    // 2. Increment kit attempt number
    const previousAttemptNumber = kit.processing_attempt_number;
    const nextAttemptNumber = previousAttemptNumber + 1;
    kit.processing_attempt_number = nextAttemptNumber;
    kit.current_status = 'RECEIVED';
    kit.current_location = 'Decontamination Sorting Dock (Reprocessing Intake)';
    kit.updated_at = now;

    // 3. Create NEW Processing Attempt record (Previous failed attempts remain strictly untouched!)
    const newAttempt: DbProcessingAttempt = {
      id: db.store.getNextId('processing_attempts'),
      kit_id: kit.id,
      attempt_number: nextAttemptNumber,
      batch_id: null,
      received_at: now,
      cleaned_at: null,
      inspected_at: null,
      packed_at: null,
      result: 'PENDING',
      qc_status: 'PENDING_REVIEW',
      operator_id: actor.id,
      reviewer_id: null,
      failure_reason: null,
      notes: `Reprocessing Attempt #${nextAttemptNumber} initiated following quarantine release. Authorization: ${justification}`,
      created_at: now,
    };

    db.store.processing_attempts.push(newAttempt);

    // 4. Record Audit Event
    logAudit({
      actor,
      entityType: 'KIT',
      entityId: kit.kit_code,
      action: 'REPROCESSING_AUTHORIZED',
      previousState: 'QUARANTINED',
      newState: 'RECEIVED',
      metadata: {
        previousAttemptNumber,
        nextAttemptNumber,
        justification,
      },
    });

    return { kit, newAttempt, quarantineRecord };
  }
}
