// ==========================================================
// SteriTrack: Batch Processing Management Service
// ==========================================================

import { db, DbBatch, DbBatchKit } from '../db/index.js';
import { AuthenticatedUser } from '../middleware/auth.js';
import { logAudit } from './audit.js';

export interface CreateBatchInput {
  sterilizerUnitId: string;
  processingMethod: 'STEAM_AUTOCLAVE' | 'ETHYLENE_OXIDE' | 'VAPORIZED_HYDROGEN_PEROXIDE' | 'DRY_HEAT';
  targetTemperatureC?: number;
  targetPressurePsi?: number;
  exposureTimeMinutes?: number;
  kitIds: number[];
  notes?: string;
}

export class BatchService {
  static async createBatch(input: CreateBatchInput, actor: AuthenticatedUser): Promise<DbBatch> {
    if (actor.role !== 'REPROCESSING_OPERATOR') {
      throw new Error('Forbidden: Only Reprocessing Operators can initiate sterilization batches.');
    }

    if (!input.kitIds || input.kitIds.length === 0) {
      throw new Error('Batch creation error: You must select at least one kit to process in a batch.');
    }
    if (!Array.isArray(input.kitIds) || input.kitIds.some(id => !Number.isInteger(id)) || new Set(input.kitIds).size !== input.kitIds.length) throw new Error('Select unique valid kit IDs.');
    if (!['STEAM_AUTOCLAVE','ETHYLENE_OXIDE','VAPORIZED_HYDROGEN_PEROXIDE','DRY_HEAT'].includes(input.processingMethod)) throw new Error('Select a supported processing method.');
    if (![input.targetTemperatureC,input.targetPressurePsi,input.exposureTimeMinutes].every(value => value === undefined || (Number.isFinite(value) && value! > 0))) throw new Error('Cycle values must be positive numbers.');

    // Verify all kits are in PACKING state
    const kitsToBatch = db.store.kits.filter(k => input.kitIds.includes(k.id));
    if (kitsToBatch.length !== input.kitIds.length) {
      throw new Error('One or more selected kits could not be found.');
    }

    for (const kit of kitsToBatch) {
      if (kit.current_status !== 'PACKING') {
        throw new Error(
          `Kit ${kit.kit_code} cannot be added to batch: current status is "${kit.current_status}". Only kits in "PACKING" status may be loaded into a sterilization batch.`
        );
      }
    }

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const count = db.store.batches.length + 1;
    const batchCode = `BAT-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;

    const batch: DbBatch = {
      id: db.store.getNextId('batches'),
      batch_code: batchCode,
      operator_id: actor.id,
      sterilizer_unit_id: input.sterilizerUnitId || 'Autoclave Unit #1 (Steris AMSCO)',
      processing_method: input.processingMethod || 'STEAM_AUTOCLAVE',
      target_temperature_c: input.targetTemperatureC || 134.0,
      target_pressure_psi: input.targetPressurePsi || 30.5,
      exposure_time_minutes: input.exposureTimeMinutes || 18,
      started_at: now,
      completed_at: null,
      status: 'IN_PROGRESS',
      physical_indicators_passed: null,
      chemical_indicators_passed: null,
      biological_indicators_passed: null,
      processing_notes: input.notes || 'Batch initiated in sterilizer chamber.',
      created_at: now,
    };

    db.store.batches.push(batch);

    // Link kits and transition to PROCESSING
    for (const kit of kitsToBatch) {
      const batchKit: DbBatchKit = {
        id: db.store.getNextId('batch_kits'),
        batch_id: batch.id,
        kit_id: kit.id,
        attempt_number: kit.processing_attempt_number,
        created_at: now,
      };
      db.store.batch_kits.push(batchKit);

      kit.current_status = 'PROCESSING';
      kit.current_location = `${batch.sterilizer_unit_id} [Bay]`;
      kit.updated_at = now;

      // Link batch to processing attempt or create if not yet recorded
      let attempt = db.store.processing_attempts
        .filter(pa => pa.kit_id === kit.id && pa.attempt_number === kit.processing_attempt_number)
        .sort((a, b) => b.id - a.id)[0];
      if (attempt) {
        attempt.batch_id = batch.id;
        attempt.packed_at = now;
      } else {
        attempt = {
          id: db.store.getNextId('processing_attempts'),
          kit_id: kit.id,
          attempt_number: kit.processing_attempt_number,
          batch_id: batch.id,
          received_at: now,
          cleaned_at: now,
          inspected_at: now,
          packed_at: now,
          result: 'PENDING',
          qc_status: 'PENDING_REVIEW',
          operator_id: actor.id,
          reviewer_id: null,
          failure_reason: null,
          notes: 'Added to batch ' + batch.batch_code,
          created_at: now,
        };
        db.store.processing_attempts.push(attempt);
      }
    }

    logAudit({
      actor,
      entityType: 'BATCH',
      entityId: batch.batch_code,
      action: 'BATCH_CREATED',
      newState: 'IN_PROGRESS',
      metadata: {
        kitCodes: kitsToBatch.map(k => k.kit_code),
        sterilizer: batch.sterilizer_unit_id,
        method: batch.processing_method,
      },
    });

    return batch;
  }

  static async completeBatch(
    batchId: number,
    actor: AuthenticatedUser,
    options: {
      physicalPassed: boolean;
      chemicalPassed: boolean;
      notes?: string;
    }
  ): Promise<DbBatch> {
    if (actor.role !== 'REPROCESSING_OPERATOR') throw new Error('Forbidden: An operator must complete the batch.');
    const batch = db.store.batches.find(b => b.id === batchId);
    if (!batch) throw new Error(`Batch ID ${batchId} not found.`);
    if (batch.operator_id !== actor.id) throw new Error('Only the batch operator may complete this run.');

    if (batch.status !== 'IN_PROGRESS') {
      throw new Error(`Batch ${batch.batch_code} is already marked as ${batch.status}.`);
    }
    if (options.physicalPassed !== true || options.chemicalPassed !== true || !options.notes || options.notes.trim().length < 5) throw new Error('Confirm both observed indicators and record notes, or fail the batch.');

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    batch.completed_at = now;
    batch.status = 'COMPLETED';
    batch.physical_indicators_passed = options.physicalPassed ? 1 : 0;
    batch.chemical_indicators_passed = options.chemicalPassed ? 1 : 0;
    if (options.notes) {
      batch.processing_notes = (batch.processing_notes ? batch.processing_notes + ' | ' : '') + options.notes;
    }

    // Move associated kits to AWAITING_QC
    const linkedKitIds = db.store.batch_kits.filter(bk => bk.batch_id === batch.id).map(bk => bk.kit_id);
    const kits = db.store.kits.filter(k => linkedKitIds.includes(k.id));

    for (const kit of kits) {
      kit.current_status = 'AWAITING_QC';
      kit.current_location = 'Sterilizer Cool-Down Staging Area';
      kit.updated_at = now;
    }

    logAudit({
      actor,
      entityType: 'BATCH',
      entityId: batch.batch_code,
      action: 'BATCH_COMPLETED',
      previousState: 'IN_PROGRESS',
      newState: 'COMPLETED',
      metadata: {
        physicalPassed: options.physicalPassed,
        chemicalPassed: options.chemicalPassed,
        kitsCount: kits.length,
      },
    });

    return batch;
  }

  static async failBatch(batchId: number, actor: AuthenticatedUser, reason: string): Promise<DbBatch> {
    if (actor.role !== 'REPROCESSING_OPERATOR') throw new Error('Forbidden: An operator must record batch failure.');
    const batch = db.store.batches.find(b => b.id === batchId);
    if (!batch) throw new Error(`Batch ID ${batchId} not found.`);
    if (batch.operator_id !== actor.id) throw new Error('Only the batch operator may fail this run.');
    if (batch.status !== 'IN_PROGRESS') throw new Error('Only an active batch may be marked failed.');
    if (!reason || reason.trim().length < 5) throw new Error('Record a failure reason.');

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    batch.completed_at = now;
    batch.status = 'FAILED';
    batch.biological_indicators_passed = 0;
    batch.processing_notes = (batch.processing_notes ? batch.processing_notes + ' | ' : '') + `FAILED: ${reason}`;

    // Quarantine all kits in this batch
    const linkedKitIds = db.store.batch_kits.filter(bk => bk.batch_id === batch.id).map(bk => bk.kit_id);
    const kits = db.store.kits.filter(k => linkedKitIds.includes(k.id));

    for (const kit of kits) {
      kit.current_status = 'QUARANTINED';
      kit.current_location = 'Quarantine Hold Vault Q-02';
      kit.updated_at = now;

      // Update attempt to FAILED (IMMUTABLE RECORD)
      const attempt = db.store.processing_attempts
        .filter(pa => pa.kit_id === kit.id && pa.attempt_number === kit.processing_attempt_number)
        .sort((a, b) => b.id - a.id)[0];
      if (attempt) {
        attempt.result = 'FAILED';
        attempt.qc_status = 'REJECTED';
        attempt.failure_reason = reason;
      }

      // Add quarantine record
      db.store.quarantine_records.push({
        id: db.store.getNextId('quarantine_records'),
        kit_id: kit.id,
        batch_id: batch.id,
        attempt_number: kit.processing_attempt_number,
        quarantined_by_user_id: actor.id,
        quarantine_reason: `Batch ${batch.batch_code} failed sterilization parameters: ${reason}`,
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
        previousState: 'PROCESSING',
        newState: 'QUARANTINED',
        metadata: {
          batchCode: batch.batch_code,
          reason,
          attemptNumber: kit.processing_attempt_number,
        },
      });
    }

    logAudit({
      actor,
      entityType: 'BATCH',
      entityId: batch.batch_code,
      action: 'BATCH_FAILED',
      previousState: batch.status,
      newState: 'FAILED',
      metadata: { reason, quarantinedKits: kits.map(k => k.kit_code) },
    });

    return batch;
  }
}
