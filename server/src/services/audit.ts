// ==========================================================
// SteriTrack: Audit Trail Service (Append-Only)
// ==========================================================

import { db, DbAuditEvent } from '../db/index.js';
import { AuthenticatedUser } from '../middleware/auth.js';

export interface AuditLogParams {
  actor?: AuthenticatedUser | null;
  actorName?: string;
  actorRole?: string;
  actorUserId?: number | null;
  entityType: 'SYSTEM' | 'KIT' | 'BATCH' | 'QC_REVIEW' | 'REQUEST' | 'DISPATCH' | 'RECEIPT' | 'USER' | 'QUARANTINE';
  entityId: string;
  action: string;
  previousState?: string | null;
  newState?: string | null;
  metadata?: Record<string, any>;
}

export function logAudit(params: AuditLogParams): DbAuditEvent {
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  
  const actorUserId = params.actor ? params.actor.id : (params.actorUserId ?? null);
  const actorName = params.actor ? params.actor.fullName : (params.actorName || 'System Service');
  const actorRole = params.actor ? params.actor.role : (params.actorRole || 'SYSTEM');

  const auditEvent: DbAuditEvent = {
    id: db.store.getNextId('audit_events'),
    actor_user_id: actorUserId,
    actor_name: actorName,
    actor_role: actorRole,
    entity_type: params.entityType,
    entity_id: params.entityId,
    action: params.action,
    previous_state: params.previousState || null,
    new_state: params.newState || null,
    metadata_json: params.metadata ? JSON.stringify(params.metadata) : null,
    created_at: now,
  };

  db.store.audit_events.unshift(auditEvent);
  return auditEvent;
}
