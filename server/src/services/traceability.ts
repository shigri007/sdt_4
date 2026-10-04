// Provides immutable vertical timeline and attempt history

import QRCode from 'qrcode';
import { db, DbKit, DbProcessingAttempt } from '../db/index.js';

export interface TimelineEvent {
  id: string;
  timestamp: string;
  actor: string;
  actorRole: string;
  event: string;
  previousState?: string | null;
  newState?: string | null;
  reference?: string | null;
  notes?: string | null;
  stageBadge?: string;
  isFailure?: boolean;
}

export interface KitTraceabilityData {
  kit: DbKit & {
    typeName?: string;
    ownerDepartmentName?: string;
    ownerDepartmentCode?: string;
  };
  qrCodeDataUrl: string;
  attempts: Array<
    DbProcessingAttempt & {
      operatorName?: string;
      reviewerName?: string;
      batchCode?: string;
    }
  >;
  timeline: TimelineEvent[];
  latestBatch?: any;
  latestQc?: any;
}

export class TraceabilityService {
  static async getKitTraceability(kitCodeOrId: string | number): Promise<KitTraceabilityData> {
    const kit = db.store.kits.find(
      k => k.id === Number(kitCodeOrId) || k.kit_code.toLowerCase() === String(kitCodeOrId).toLowerCase()
    );

    if (!kit) {
      throw new Error(`Kit "${kitCodeOrId}" was not found in the registry.`);
    }

    const kitType = db.store.kit_types.find(kt => kt.id === kit.kit_type_id);
    const department = db.store.departments.find(d => d.id === kit.department_owner_id);

    // 1. Generate safe QR Code URL
    const qrTargetUrl = `/kits/${kit.kit_code}`;
    const qrCodeDataUrl = await QRCode.toDataURL(qrTargetUrl, {
      margin: 1,
      width: 240,
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
    });

    // 2. Fetch all processing attempts for this kit (ordered by attempt number)
    const attempts = db.store.processing_attempts
      .filter(pa => pa.kit_id === kit.id)
      .sort((a, b) => a.attempt_number - b.attempt_number)
      .map(att => {
        const operator = db.store.users.find(u => u.id === att.operator_id);
        const reviewer = att.reviewer_id ? db.store.users.find(u => u.id === att.reviewer_id) : null;
        const batch = att.batch_id ? db.store.batches.find(b => b.id === att.batch_id) : null;
        return {
          ...att,
          operatorName: operator ? operator.full_name : 'Staff Tech',
          reviewerName: reviewer ? reviewer.full_name : 'Pending Review',
          batchCode: batch ? batch.batch_code : undefined,
        };
      });

    // 3. Compile full chronological vertical timeline
    const timeline: TimelineEvent[] = [];

    // Add Audit Events relating to this kit
    const auditLogs = db.store.audit_events.filter(
      ae => ae.entity_type === 'KIT' && ae.entity_id === kit.kit_code
    );

    for (const log of auditLogs) {
      const isFail = log.action.includes('FAILED') || log.action.includes('QUARANTINED') || log.new_state === 'QUARANTINED';
      timeline.push({
        id: `audit-${log.id}`,
        timestamp: log.created_at,
        actor: log.actor_name,
        actorRole: log.actor_role,
        event: log.action.replace(/_/g, ' '),
        previousState: log.previous_state,
        newState: log.new_state,
        reference: log.entity_id,
        notes: log.metadata_json ? JSON.parse(log.metadata_json).reason || JSON.parse(log.metadata_json).justification : null,
        isFailure: isFail,
      });
    }

    // Add Dispatches
    const dispatches = db.store.dispatches.filter(d => d.kit_id === kit.id);
    for (const d of dispatches) {
      const actor = db.store.users.find(u => u.id === d.dispatched_by_user_id);
      const dept = db.store.departments.find(dep => dep.id === d.recipient_department_id);
      const req = db.store.requests.find(r => r.id === d.request_id);

      timeline.push({
        id: `disp-${d.id}`,
        timestamp: d.dispatched_at,
        actor: actor ? actor.full_name : 'Sterile Coordinator',
        actorRole: 'QUALITY_COORDINATOR',
        event: 'Dispatched to Department',
        previousState: 'AVAILABLE',
        newState: 'DISPATCHED',
        reference: `${d.dispatch_code} (${req ? req.request_code : ''})`,
        notes: `Issued to ${dept ? dept.name : 'Clinical Dept'}. ${d.dispatch_notes || ''}`,
        isFailure: false,
      });

      // Receipt for this dispatch
      const receipt = db.store.receipts.find(r => r.dispatch_id === d.id);
      if (receipt) {
        const rcptUser = db.store.users.find(u => u.id === receipt.received_by_user_id);
        timeline.push({
          id: `rcpt-${receipt.id}`,
          timestamp: receipt.received_at,
          actor: rcptUser ? rcptUser.full_name : 'Department Staff',
          actorRole: 'DEPARTMENT_STAFF',
          event: 'Clinical Receipt Verified',
          previousState: 'DISPATCHED',
          newState: 'RECEIVED_BY_DEPT',
          reference: `Receipt #${receipt.id}`,
          notes: receipt.condition_notes,
          isFailure: false,
        });
      }
    }

    // Sort timeline chronologically (latest first for display or chronological)
    timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Latest Batch & QC
    const latestAttempt = attempts[attempts.length - 1];
    const latestBatch = latestAttempt && latestAttempt.batch_id
      ? db.store.batches.find(b => b.id === latestAttempt.batch_id)
      : null;
    const latestQc = latestBatch
      ? db.store.qc_reviews.find(q => q.batch_id === latestBatch.id)
      : null;

    return {
      kit: {
        ...kit,
        typeName: kitType?.name,
        ownerDepartmentName: department?.name,
        ownerDepartmentCode: department?.code,
      },
      qrCodeDataUrl,
      attempts,
      timeline,
      latestBatch,
      latestQc,
    };
  }
}
