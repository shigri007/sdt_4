
import { KIT_STATUS, KitStatusCode, VALID_WORKFLOW_TRANSITIONS } from '../config/index.js';
import { db, DbKit } from '../db/index.js';
import { AuthenticatedUser } from '../middleware/auth.js';
import { logAudit } from './audit.js';

export interface TransitionResult {
  success: boolean;
  kit: DbKit;
  message: string;
}

export class WorkflowService {
  /**
   * Validate whether a transition from currentState to targetState is legal.
   */
  static isValidTransition(currentState: KitStatusCode, targetState: KitStatusCode): boolean {
    const allowedNext = VALID_WORKFLOW_TRANSITIONS[currentState] || [];
    return allowedNext.includes(targetState);
  }

  /**
   * Execute state transition on a kit
   */
  static async transitionKit(
    kitId: number,
    targetStatus: KitStatusCode,
    actor: AuthenticatedUser,
    options: {
      notes?: string;
      location?: string;
      defectsFound?: boolean;
      failureReason?: string;
    } = {}
  ): Promise<TransitionResult> {
    const kit = db.store.kits.find(k => k.id === kitId);
    if (!kit) {
      throw new Error(`Kit with ID ${kitId} was not found in the registry.`);
    }

    const currentStatus = kit.current_status as KitStatusCode;

    if (currentStatus === targetStatus) {
      return { success: true, kit, message: `Kit is already in state ${targetStatus}` };
    }

    // Role-based state transition restrictions:
    if (['RECEIVED', 'CLEANING', 'INSPECTION', 'PACKING'].includes(targetStatus)) {
      if (actor.role !== 'REPROCESSING_OPERATOR') {
        throw new Error(`Forbidden: Only Reprocessing Operators can transition kits through decontamination and assembly (${targetStatus}).`);
      }
    }

    if (targetStatus === 'RETURNED') {
      if (actor.role !== 'DEPARTMENT_STAFF') {
        throw new Error('Forbidden: Only clinical department staff can mark a kit as returned.');
      }
      const latestDispatch = db.store.dispatches.filter(d => d.kit_id === kitId).sort((a,b) => b.id - a.id)[0];
      if (!latestDispatch || latestDispatch.recipient_department_id !== actor.departmentId || latestDispatch.status !== 'RECEIVED') {
        throw new Error('Forbidden: This kit has not been received by your department.');
      }
    }

    if (targetStatus === 'AVAILABLE') {
      throw new Error('Quality release must be recorded through an independent batch review.');
    }
    if (targetStatus === 'QUARANTINED') {
      if (actor.role !== 'REPROCESSING_OPERATOR' || currentStatus !== 'INSPECTION') {
        throw new Error('Only an operator may quarantine a kit during inspection.');
      }
    }

    if (!this.isValidTransition(currentStatus, targetStatus)) {
      const allowed = (VALID_WORKFLOW_TRANSITIONS[currentStatus] || []).join(', ') || 'None (Terminal)';
      throw new Error(
        `Illegal workflow transition: Cannot move kit from state "${currentStatus}" to "${targetStatus}". Permitted next states from "${currentStatus}" are: [${allowed}].`
      );
    }

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const previousStatus = kit.current_status;

    // Find current active processing attempt (latest attempt for this kit)
    let currentAttempt = db.store.processing_attempts
      .filter(pa => pa.kit_id === kit.id && pa.attempt_number === kit.processing_attempt_number)
      .sort((a, b) => b.id - a.id)[0];

    // If starting a new cycle and no attempt exists, create one
    if (!currentAttempt && ['RETURNED', 'RECEIVED'].includes(targetStatus)) {
      currentAttempt = {
        id: db.store.getNextId('processing_attempts'),
        kit_id: kit.id,
        attempt_number: kit.processing_attempt_number,
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
        notes: options.notes || 'Decontamination check-in',
        created_at: now,
      };
      db.store.processing_attempts.push(currentAttempt);
    }

    // Update timestamps on processing attempt based on state
    if (currentAttempt) {
      if (targetStatus === 'RECEIVED') {
        currentAttempt.received_at = now;
        currentAttempt.operator_id = actor.id;
      } else if (targetStatus === 'CLEANING') {
        currentAttempt.cleaned_at = null; // in progress
      } else if (targetStatus === 'INSPECTION') {
        currentAttempt.cleaned_at = now;
      } else if (targetStatus === 'PACKING') {
        currentAttempt.inspected_at = now;
      } else if (targetStatus === 'QUARANTINED') {
        currentAttempt.result = 'FAILED';
        currentAttempt.qc_status = 'REJECTED';
        currentAttempt.failure_reason = options.failureReason || 'Failed visual or biological inspection';
      }
    }

    kit.current_status = targetStatus;
    kit.updated_at = now;

    if (options.location) {
      kit.current_location = options.location;
    } else {
      // Default location updates
      switch (targetStatus) {
        case 'RECEIVED':
          kit.current_location = 'Decontamination Sorting Station #1';
          break;
        case 'CLEANING':
          kit.current_location = 'Automated Ultrasonic Washer Bay';
          break;
        case 'INSPECTION':
          kit.current_location = 'Clean Assembly Station #2';
          break;
        case 'PACKING':
          kit.current_location = 'Clean Packaging Station #1';
          break;
        case 'QUARANTINED':
          kit.current_location = 'Quarantine Hold Vault Q-01';
          break;
        case 'RETURNED':
          kit.current_location = 'Decontamination Receiving Dock B1';
          break;
      }
    }

    if (options.notes) {
      kit.notes = options.notes;
    }

    logAudit({
      actor,
      entityType: 'KIT',
      entityId: kit.kit_code,
      action: `KIT_TRANSITION_${targetStatus}`,
      previousState: previousStatus,
      newState: targetStatus,
      metadata: {
        attemptNumber: kit.processing_attempt_number,
        location: kit.current_location,
        notes: options.notes,
      },
    });

    return {
      success: true,
      kit,
      message: `Kit ${kit.kit_code} successfully transitioned from ${previousStatus} to ${targetStatus}.`,
    };
  }
}
