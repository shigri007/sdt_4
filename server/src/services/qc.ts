// Enforces mandatory segregation of duties between operator & QC

import { db, DbQcReview } from '../db/index.js';
import { AuthenticatedUser } from '../middleware/auth.js';
import { logAudit } from './audit.js';

export interface SubmitQcReviewInput {
  batchId: number;
  decision: 'APPROVED' | 'REJECTED';
  biologicalTestResult?: string;
  chemicalIndicatorResult?: string;
  packagingIntegrityVerified?: boolean;
  notes?: string;
}

export class QcService {
  static async submitReview(input: SubmitQcReviewInput, actor: AuthenticatedUser): Promise<DbQcReview> {
    if (actor.role !== 'QUALITY_COORDINATOR') {
      throw new Error('Forbidden: Only Quality Coordinators may perform official Quality Control signoffs.');
    }

    const batch = db.store.batches.find(b => b.id === input.batchId);
    if (!batch) {
      throw new Error(`Sterilization batch with ID ${input.batchId} not found.`);
    }

    // The batch operator cannot approve their own quality review.
    if (batch.operator_id === actor.id) {
      throw new Error(
        'Compliance & Safety Violation: Operator who ran this sterilization batch is strictly prohibited from approving their own Quality Control review. Independent verification by a secondary Sterile Quality Coordinator is mandatory.'
      );
    }

    // Check if batch is completed
    if (batch.status !== 'COMPLETED') {
      throw new Error(`Batch ${batch.batch_code} is in status "${batch.status}" and cannot be reviewed.`);
    }
    if (input.decision === 'APPROVED') {
      if (batch.physical_indicators_passed !== 1 || batch.chemical_indicators_passed !== 1) throw new Error('Completed batch evidence must pass before release.');
      if (input.biologicalTestResult?.trim().toUpperCase() !== 'NEGATIVE' || input.chemicalIndicatorResult?.trim().toUpperCase() !== 'PASS' || input.packagingIntegrityVerified !== true) throw new Error('Record passing biological and chemical evidence and confirm intact packaging before release.');
    }
    if (!input.notes || input.notes.trim().length < 5) throw new Error('Record a review note of at least five characters.');

    // Check if review already exists
    const existingReview = db.store.qc_reviews.find(q => q.batch_id === batch.id);
    if (existingReview) {
      throw new Error(`Batch ${batch.batch_code} has already received a QC review decision (${existingReview.decision}).`);
    }

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const review: DbQcReview = {
      id: db.store.getNextId('qc_reviews'),
      batch_id: batch.id,
      reviewer_id: actor.id,
      decision: input.decision,
      biological_test_result: input.biologicalTestResult?.trim() || 'Not recorded',
      chemical_indicator_result: input.chemicalIndicatorResult?.trim() || 'Not recorded',
      packaging_integrity_verified: input.packagingIntegrityVerified === true ? 1 : 0,
      notes: input.notes.trim(),
      reviewed_at: now,
    };

    db.store.qc_reviews.push(review);

    // Get all kits in this batch
    const linkedKitIds = db.store.batch_kits.filter(bk => bk.batch_id === batch.id).map(bk => bk.kit_id);
    const kits = db.store.kits.filter(k => linkedKitIds.includes(k.id));

    if (input.decision === 'APPROVED') {
      // Approve kits and make AVAILABLE
      for (const kit of kits) {
        const kitType = db.store.kit_types.find(kt => kt.id === kit.kit_type_id);
        const shelfDays = kitType ? kitType.shelf_life_days : 30;
        
        // Calculate expiration date
        const expDate = new Date();
        expDate.setDate(expDate.getDate() + shelfDays);
        const expString = expDate.toISOString().split('T')[0];

        kit.current_status = 'AVAILABLE';
        kit.current_location = 'Sterile Storage Bay A';
        kit.expiration_date = expString;
        kit.last_processed_at = now;
        kit.total_cycles_count = (kit.total_cycles_count || 0) + 1;
        kit.updated_at = now;

        // Update processing attempt
        const attempt = db.store.processing_attempts
          .filter(pa => pa.kit_id === kit.id && pa.attempt_number === kit.processing_attempt_number)
          .sort((a, b) => b.id - a.id)[0];
        if (attempt) {
          attempt.result = 'PASSED';
          attempt.qc_status = 'APPROVED';
          attempt.reviewer_id = actor.id;
        }

        logAudit({
          actor,
          entityType: 'KIT',
          entityId: kit.kit_code,
          action: 'QC_APPROVED',
          previousState: 'AWAITING_QC',
          newState: 'AVAILABLE',
          metadata: {
            batchCode: batch.batch_code,
            attemptNumber: kit.processing_attempt_number,
            expirationDate: expString,
          },
        });
      }

      logAudit({
        actor,
        entityType: 'QC_REVIEW',
        entityId: `QC-${review.id}`,
        action: 'QC_APPROVED',
        newState: 'APPROVED',
        metadata: {
          batchCode: batch.batch_code,
          kitsApprovedCount: kits.length,
          biological: review.biological_test_result,
        },
      });
    } else {
      // REJECTED -> Quarantined
      batch.status = 'FAILED';
      for (const kit of kits) {
        kit.current_status = 'QUARANTINED';
        kit.current_location = 'Quarantine Hold Vault Q-01';
        kit.updated_at = now;

        // Update attempt (Immutable failure record)
        const attempt = db.store.processing_attempts
          .filter(pa => pa.kit_id === kit.id && pa.attempt_number === kit.processing_attempt_number)
          .sort((a, b) => b.id - a.id)[0];
        if (attempt) {
          attempt.result = 'FAILED';
          attempt.qc_status = 'REJECTED';
          attempt.reviewer_id = actor.id;
          attempt.failure_reason = input.notes || 'Batch failed independent quality control review';
        }

        // Add quarantine record
        db.store.quarantine_records.push({
          id: db.store.getNextId('quarantine_records'),
          kit_id: kit.id,
          batch_id: batch.id,
          attempt_number: kit.processing_attempt_number,
          quarantined_by_user_id: actor.id,
          quarantine_reason: `Batch ${batch.batch_code} rejected by Quality Coordinator: ${input.notes || 'Unsatisfactory sterilization indicators'}`,
          status: 'ACTIVE_QUARANTINE',
          quarantined_at: now,
          resolved_at: null,
          resolved_by_user_id: null,
          resolution_notes: null,
        });

        logAudit({
          actor,
          entityType: 'KIT',
          entityId: kit.kit_code,
          action: 'KIT_QUARANTINED',
          previousState: 'AWAITING_QC',
          newState: 'QUARANTINED',
          metadata: {
            batchCode: batch.batch_code,
            attemptNumber: kit.processing_attempt_number,
            reason: input.notes,
          },
        });
      }

      logAudit({
        actor,
        entityType: 'QC_REVIEW',
        entityId: `QC-${review.id}`,
        action: 'QC_REJECTED',
        newState: 'REJECTED',
        metadata: {
          batchCode: batch.batch_code,
          kitsQuarantinedCount: kits.length,
          reason: input.notes,
        },
      });
    }

    return review;
  }
}
