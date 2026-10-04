// Enforces transaction boundaries and strict dispatch eligibility

import { db, DbDispatch, DbReceipt } from '../db/index.js';
import { AuthenticatedUser } from '../middleware/auth.js';
import { logAudit } from './audit.js';

export interface DispatchKitInput {
  requestId: number;
  kitId: number;
  transportCaseId?: string;
  notes?: string;
  allowPartial?: boolean;
}

export interface ConfirmReceiptInput {
  dispatchId: number;
  packagingIntact?: boolean;
  indicatorColorVerified?: boolean;
  conditionNotes?: string;
}

export class DispatchService {
  /**
   * Execute atomic dispatch of an eligible sterile kit to fulfill a clinical request.
   */
  static async dispatchKit(input: DispatchKitInput, actor: AuthenticatedUser): Promise<DbDispatch> {
    if (actor.role !== 'QUALITY_COORDINATOR') {
      throw new Error('Forbidden: Only Sterile Quality Coordinators can authorize and dispatch sterile kits.');
    }

    return await db.transaction(async () => {
      // 1. Fetch & lock kit
      const kit = db.store.kits.find(k => k.id === input.kitId);
      if (!kit) {
        throw new Error(`Kit with ID ${input.kitId} not found.`);
      }

      // 2. Fetch & lock request
      const request = db.store.requests.find(r => r.id === input.requestId);
      if (!request) {
        throw new Error(`Requisition with ID ${input.requestId} not found.`);
      }

      if (request.status !== 'PENDING') {
        throw new Error(`Requisition ${request.request_code} is already in status "${request.status}". Only PENDING requests can be fulfilled.`);
      }
      if (request.quantity > 1 && !input.allowPartial) throw new Error('Select every required kit and dispatch the request together.');

      // Validate every selected kit before committing the dispatch.

      // Rule A: Current status must be AVAILABLE (not Quarantined, not Returned, not Processing)
      if (kit.current_status !== 'AVAILABLE') {
        const isQuarantined = kit.current_status === 'QUARANTINED';
        throw new Error(
          `Dispatch Ineligible: Kit ${kit.kit_code} has status "${kit.current_status}". ${isQuarantined ? 'Kit is currently under Quarantine and cannot be dispatched.' : 'Only kits with status "AVAILABLE" may be dispatched.'}`
        );
      }

      // Rule C: Kit type must match request requirement
      if (kit.kit_type_id !== request.kit_type_id) {
        const reqKitType = db.store.kit_types.find(kt => kt.id === request.kit_type_id);
        const actualKitType = db.store.kit_types.find(kt => kt.id === kit.kit_type_id);
        throw new Error(
          `Dispatch Ineligible: Requested kit type is "${reqKitType?.name || request.kit_type_id}", but selected kit ${kit.kit_code} is type "${actualKitType?.name || kit.kit_type_id}".`
        );
      }

      // Rule D: Expiration Date check
      if (kit.expiration_date) {
        const todayStr = new Date().toISOString().split('T')[0];
        if (kit.expiration_date < todayStr) {
          throw new Error(
            `Dispatch Ineligible: Kit ${kit.kit_code} expired on ${kit.expiration_date}. Expired kits cannot be dispatched and must be reprocessed.`
          );
        }
      }

      // Rule E: QC Approval must exist for latest attempt
      const latestAttempt = db.store.processing_attempts
        .filter(pa => pa.kit_id === kit.id && pa.attempt_number === kit.processing_attempt_number)
        .sort((a, b) => b.id - a.id)[0];

      if (!latestAttempt || latestAttempt.qc_status !== 'APPROVED') {
        throw new Error(
          `Dispatch Ineligible: Kit ${kit.kit_code} does not have an approved Quality Control signoff for processing attempt #${kit.processing_attempt_number}.`
        );
      }

      // Rule F: Check for any existing active dispatch
      const activeDispatch = db.store.dispatches.find(
        d => d.kit_id === kit.id && d.status === 'DISPATCHED'
      );
      if (activeDispatch) {
        throw new Error(`Dispatch Ineligible: Kit ${kit.kit_code} is already issued under active dispatch ${activeDispatch.dispatch_code}.`);
      }

      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const dispatchCount = db.store.dispatches.length + 1;
      const dispatchCode = `DSP-${new Date().getFullYear()}-${String(dispatchCount).padStart(4, '0')}`;

      // Update Kit
      const prevStatus = kit.current_status;
      kit.current_status = 'DISPATCHED';
      kit.current_location = `In Transit to Dept ID ${request.department_id}`;
      kit.updated_at = now;

      // Update Request
      const issuedCount = db.store.dispatches.filter(d => d.request_id === request.id && d.status !== 'CANCELLED').length + 1;
      if (issuedCount > request.quantity) throw new Error('This request is already fully supplied.');
      if (issuedCount === request.quantity) {
        request.status = 'FULFILLED';
        request.completed_at = now;
      }

      // Create Dispatch
      const dispatch: DbDispatch = {
        id: db.store.getNextId('dispatches'),
        dispatch_code: dispatchCode,
        request_id: request.id,
        kit_id: kit.id,
        dispatched_by_user_id: actor.id,
        recipient_department_id: request.department_id,
        status: 'DISPATCHED',
        transport_case_id: input.transportCaseId || 'TRANS-CASE-STD',
        dispatch_notes: input.notes || `Dispatched against requisition ${request.request_code}`,
        dispatched_at: now,
      };

      db.store.dispatches.push(dispatch);

      // Audit Log
      logAudit({
        actor,
        entityType: 'DISPATCH',
        entityId: dispatch.dispatch_code,
        action: 'KIT_DISPATCHED',
        previousState: prevStatus,
        newState: 'DISPATCHED',
        metadata: {
          kitCode: kit.kit_code,
          requestCode: request.request_code,
          recipientDeptId: request.department_id,
          priority: request.priority,
        },
      });

      return dispatch;
    });
  }

  static async dispatchRequest(input: {requestId:number;kitIds:number[];transportCaseId?:string;notes?:string}, actor: AuthenticatedUser): Promise<DbDispatch[]> {
    const request = db.store.requests.find(item => item.id === input.requestId);
    if (!request || request.status !== 'PENDING') throw new Error('An open request is required.');
    if (!Array.isArray(input.kitIds) || input.kitIds.length !== request.quantity || input.kitIds.some(id => !Number.isInteger(id)) || new Set(input.kitIds).size !== input.kitIds.length) throw new Error(`Select exactly ${request.quantity} distinct eligible kits.`);
    if (db.store.dispatches.some(item => item.request_id === request.id && item.status !== 'CANCELLED')) throw new Error('This request already has a dispatch record.');
    return db.transaction(async () => {
      const records: DbDispatch[] = [];
      for (const kitId of input.kitIds) records.push(await this.dispatchKit({requestId:input.requestId,kitId,transportCaseId:input.transportCaseId,notes:input.notes,allowPartial:true},actor));
      return records;
    });
  }

  /**
   * Confirm clinical receipt of a dispatched kit at the requesting department.
   */
  static async confirmReceipt(input: ConfirmReceiptInput, actor: AuthenticatedUser): Promise<DbReceipt> {
    const dispatch = db.store.dispatches.find(d => d.id === input.dispatchId);
    if (!dispatch) throw new Error(`Dispatch record ID ${input.dispatchId} not found.`);

    if (dispatch.status !== 'DISPATCHED') {
      throw new Error(`Dispatch ${dispatch.dispatch_code} is already marked as ${dispatch.status}.`);
    }

    if (actor.role !== 'DEPARTMENT_STAFF' || actor.departmentId !== dispatch.recipient_department_id) {
      throw new Error('Forbidden: Only clinical staff belonging to the receiving department may sign for kit delivery.');
    }

    const kit = db.store.kits.find(k => k.id === dispatch.kit_id);
    if (!kit) throw new Error(`Kit ID ${dispatch.kit_id} not found.`);

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    // Update Dispatch
    dispatch.status = 'RECEIVED';

    // Update Kit
    const prevStatus = kit.current_status;
    kit.current_status = 'RECEIVED_BY_DEPT';
    kit.current_location = `Clinical Dept (Dept ID: ${dispatch.recipient_department_id})`;
    kit.updated_at = now;

    // Create Receipt
    const receipt: DbReceipt = {
      id: db.store.getNextId('receipts'),
      dispatch_id: dispatch.id,
      kit_id: kit.id,
      received_by_user_id: actor.id,
      recipient_department_id: dispatch.recipient_department_id,
      packaging_intact: input.packagingIntact === false ? 0 : 1,
      indicator_color_verified: input.indicatorColorVerified === false ? 0 : 1,
      condition_notes: input.conditionNotes || 'Package integrity verified upon receipt at department.',
      received_at: now,
    };

    db.store.receipts.push(receipt);

    // Audit Log
    logAudit({
      actor,
      entityType: 'RECEIPT',
      entityId: `RCPT-${receipt.id}`,
      action: 'KIT_RECEIVED_BY_DEPT',
      previousState: prevStatus,
      newState: 'RECEIVED_BY_DEPT',
      metadata: {
        kitCode: kit.kit_code,
        dispatchCode: dispatch.dispatch_code,
        packagingIntact: receipt.packaging_intact,
      },
    });

    return receipt;
  }
}
