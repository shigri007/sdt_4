
import { PRIORITY, PriorityCode } from '../config/index.js';
import { db, DbRequest, DbRequestPriorityHistory } from '../db/index.js';
import { AuthenticatedUser } from '../middleware/auth.js';
import { logAudit } from './audit.js';

export interface CreateRequestInput {
  departmentId?: number;
  kitTypeId: number;
  quantity?: number;
  priority?: PriorityCode;
  clinicalReason: string;
  requiredByDate?: string;
}

export interface UpdatePriorityInput {
  requestId: number;
  newPriority: PriorityCode;
  justification: string;
}

export class RequestService {
  static async createRequest(input: CreateRequestInput, actor: AuthenticatedUser): Promise<DbRequest> {
    if (!['DEPARTMENT_STAFF','QUALITY_COORDINATOR'].includes(actor.role)) throw new Error('Forbidden: This role cannot create requisitions.');
    const deptId = actor.role === 'DEPARTMENT_STAFF' ? (actor.departmentId || 1) : (input.departmentId || 1);

    if (!input.kitTypeId) {
      throw new Error('Requisition error: Target kit type must be specified.');
    }

    const kitType = db.store.kit_types.find(kt => kt.id === input.kitTypeId);
    if (!kitType) {
      throw new Error(`Kit type ID ${input.kitTypeId} not found in catalog.`);
    }
    if (!db.store.departments.some(dept => dept.id === deptId && dept.is_active === 1)) throw new Error('A valid active department is required.');
    if (!Number.isInteger(input.quantity ?? 1) || (input.quantity ?? 1) < 1 || (input.quantity ?? 1) > 10) throw new Error('Quantity must be a whole number from 1 to 10.');
    if (input.priority && !Object.values(PRIORITY).includes(input.priority)) throw new Error('Invalid requisition priority.');

    if (!input.clinicalReason || input.clinicalReason.trim().length < 5) {
      throw new Error('Requisition error: A meaningful clinical reason or procedure name is required.');
    }

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const count = db.store.requests.length + 1;
    const requestCode = `REQ-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;

    const request: DbRequest = {
      id: db.store.getNextId('requests'),
      request_code: requestCode,
      department_id: deptId,
      requested_by_user_id: actor.id,
      kit_type_id: input.kitTypeId,
      quantity: input.quantity || 1,
      priority: input.priority || 'ROUTINE',
      clinical_reason: input.clinicalReason.trim(),
      status: 'PENDING',
      required_by_date: input.requiredByDate || null,
      created_at: now,
      approved_at: null,
      completed_at: null,
    };

    db.store.requests.unshift(request);

    logAudit({
      actor,
      entityType: 'REQUEST',
      entityId: request.request_code,
      action: 'REQUEST_CREATED',
      newState: 'PENDING',
      metadata: {
        kitTypeName: kitType.name,
        priority: request.priority,
        departmentId: deptId,
      },
    });

    return request;
  }

  static async updatePriority(input: UpdatePriorityInput, actor: AuthenticatedUser): Promise<DbRequest> {
    if (actor.role !== 'QUALITY_COORDINATOR') throw new Error('Forbidden: Only quality coordinators may reprioritize requests.');
    const request = db.store.requests.find(r => r.id === input.requestId);
    if (!request) throw new Error(`Requisition ID ${input.requestId} not found.`);
    if (request.status !== 'PENDING') throw new Error('Only pending requests may be reprioritized.');
    if (!Object.values(PRIORITY).includes(input.newPriority)) throw new Error('Invalid requisition priority.');

    if (!input.justification || input.justification.trim().length < 5) {
      throw new Error('Clinical governance rule: Changing requisition priority requires a documented clinical justification.');
    }

    const previousPriority = request.priority;
    const newPriority = input.newPriority;

    if (previousPriority === newPriority) {
      return request;
    }

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    // Record Priority History (Permanent record)
    const historyEntry: DbRequestPriorityHistory = {
      id: db.store.getNextId('request_priority_history'),
      request_id: request.id,
      changed_by_user_id: actor.id,
      previous_priority: previousPriority,
      new_priority: newPriority,
      justification: input.justification.trim(),
      created_at: now,
    };

    db.store.request_priority_history.unshift(historyEntry);

    request.priority = newPriority;

    logAudit({
      actor,
      entityType: 'REQUEST',
      entityId: request.request_code,
      action: 'PRIORITY_ESCALATED',
      previousState: previousPriority,
      newState: newPriority,
      metadata: {
        justification: input.justification.trim(),
        changedByName: actor.fullName,
      },
    });

    return request;
  }
}
