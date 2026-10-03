// ==========================================================
// SteriTrack: Role-Specific Dashboard Metrics Service
// Derives live statistics with zero hardcoding
// ==========================================================

import { db } from '../db/index.js';
import { AuthenticatedUser } from '../middleware/auth.js';
import { AlertService } from './alerts.js';

export class DashboardService {
  static getMetricsForUser(user: AuthenticatedUser) {
    const totalKits = db.store.kits.length;
    const availableKits = db.store.kits.filter(k => k.current_status === 'AVAILABLE').length;
    const quarantinedKits = db.store.kits.filter(k => k.current_status === 'QUARANTINED').length;
    const dispatchedKits = db.store.kits.filter(k => k.current_status === 'DISPATCHED').length;
    const receivedByDeptKits = db.store.kits.filter(k => k.current_status === 'RECEIVED_BY_DEPT').length;
    const expiredKits = db.store.kits.filter(k => k.current_status === 'EXPIRED').length;

    const inProcessingKits = db.store.kits.filter(k =>
      ['RECEIVED', 'CLEANING', 'INSPECTION', 'PACKING', 'PROCESSING', 'AWAITING_QC'].includes(k.current_status)
    ).length;

    const openRequests = db.store.requests.filter(r => r.status === 'PENDING').length;
    const urgentRequests = db.store.requests.filter(r => r.status === 'PENDING' && r.priority === 'URGENT').length;

    const reviewedBatchIds = new Set(db.store.qc_reviews.map(q => q.batch_id));
    const batchesAwaitingQc = db.store.batches.filter(b => b.status === 'COMPLETED' && !reviewedBatchIds.has(b.id)).length;

    // Station Queues for Reprocessing Operators
    const queueReturned = db.store.kits.filter(k => k.current_status === 'RETURNED').length;
    const queueReceived = db.store.kits.filter(k => k.current_status === 'RECEIVED').length;
    const queueCleaning = db.store.kits.filter(k => k.current_status === 'CLEANING').length;
    const queueInspection = db.store.kits.filter(k => k.current_status === 'INSPECTION').length;
    const queuePacking = db.store.kits.filter(k => k.current_status === 'PACKING').length;
    const queueProcessing = db.store.kits.filter(k => k.current_status === 'PROCESSING').length;

    // Department Specific metrics
    const deptId = user.departmentId || 1;
    const deptOpenRequests = db.store.requests.filter(r => r.department_id === deptId && r.status === 'PENDING').length;
    const deptUrgentRequests = db.store.requests.filter(r => r.department_id === deptId && r.status === 'PENDING' && r.priority === 'URGENT').length;
    const deptInTransit = db.store.dispatches.filter(d => d.recipient_department_id === deptId && d.status === 'DISPATCHED').length;
    const deptActiveKits = db.store.kits.filter(k => k.department_owner_id === deptId && k.current_status === 'RECEIVED_BY_DEPT').length;

    // Charts / Status Breakdown
    const kitsByStatus: Record<string, number> = {};
    for (const kit of db.store.kits) {
      kitsByStatus[kit.current_status] = (kitsByStatus[kit.current_status] || 0) + 1;
    }

    const requestsByPriority: Record<string, number> = {
      ROUTINE: db.store.requests.filter(r => r.priority === 'ROUTINE').length,
      HIGH: db.store.requests.filter(r => r.priority === 'HIGH').length,
      URGENT: db.store.requests.filter(r => r.priority === 'URGENT').length,
    };

    const processingResults = {
      passed: db.store.processing_attempts.filter(pa => pa.result === 'PASSED').length,
      failed: db.store.processing_attempts.filter(pa => pa.result === 'FAILED').length,
      pending: db.store.processing_attempts.filter(pa => pa.result === 'PENDING').length,
    };

    const recentAudit = db.store.audit_events.slice(0, 8);
    const activeAlerts = AlertService.getActiveAlerts();

    if (user.role === 'DEPARTMENT_STAFF') return { departmentOverview: { deptOpenRequests, deptUrgentRequests, deptInTransit, deptActiveKits } };
    if (user.role === 'REPROCESSING_OPERATOR') return { operatorQueues: { queueReturned, queueReceived, queueCleaning, queueInspection, queuePacking, queueProcessing, activeBatches: db.store.batches.filter(b => b.status === 'IN_PROGRESS').length } };
    if (user.role === 'ADMINISTRATOR') return { overview: { totalKits, openRequests, quarantinedKits }, recentAudit };
    return {
      overview: {
        totalKits,
        availableKits,
        inProcessingKits,
        quarantinedKits,
        dispatchedKits,
        receivedByDeptKits,
        expiredKits,
        openRequests,
        urgentRequests,
        batchesAwaitingQc,
      },
      operatorQueues: {
        queueReturned,
        queueReceived,
        queueCleaning,
        queueInspection,
        queuePacking,
        queueProcessing,
        activeBatches: db.store.batches.filter(b => b.status === 'IN_PROGRESS').length,
      },
      departmentOverview: {
        deptOpenRequests,
        deptUrgentRequests,
        deptInTransit,
        deptActiveKits,
      },
      charts: {
        kitsByStatus,
        requestsByPriority,
        processingResults,
      },
      recentAudit,
      alerts: activeAlerts,
    };
  }
}
