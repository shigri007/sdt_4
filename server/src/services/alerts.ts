// Derives real-time clinical safety and workflow alerts

import { db } from '../db/index.js';

export interface SystemAlert {
  id: string;
  type: 'URGENT_REQUEST' | 'QC_REQUIRED' | 'LOW_AVAILABILITY' | 'EXPIRY_WARNING' | 'QUARANTINE_ATTENTION';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  message: string;
  count: number;
  actionUrl: string;
  actionText: string;
}

export class AlertService {
  static getActiveAlerts(): SystemAlert[] {
    const alerts: SystemAlert[] = [];

    // 1. Urgent Requisitions
    const urgentRequests = db.store.requests.filter(
      r => r.status === 'PENDING' && r.priority === 'URGENT'
    );
    if (urgentRequests.length > 0) {
      alerts.push({
        id: 'alert-urgent-reqs',
        type: 'URGENT_REQUEST',
        severity: 'CRITICAL',
        title: 'Urgent Clinical Requisitions',
        message: `${urgentRequests.length} urgent requisition${urgentRequests.length > 1 ? 's require' : ' requires'} immediate dispatch attention.`,
        count: urgentRequests.length,
        actionUrl: '/requests?priority=URGENT',
        actionText: 'View Urgent Requests',
      });
    }

    // 2. Batches Awaiting QC Review
    const reviewedBatchIds = new Set(db.store.qc_reviews.map(q => q.batch_id));
    const pendingQcBatches = db.store.batches.filter(
      b => b.status === 'COMPLETED' && !reviewedBatchIds.has(b.id)
    );
    if (pendingQcBatches.length > 0) {
      alerts.push({
        id: 'alert-qc-pending',
        type: 'QC_REQUIRED',
        severity: 'WARNING',
        title: 'Batches Awaiting Quality Review',
        message: `${pendingQcBatches.length} completed sterilization cycle${pendingQcBatches.length > 1 ? 's require' : ' requires'} independent QC coordinator signoff.`,
        count: pendingQcBatches.length,
        actionUrl: '/qc',
        actionText: 'Review Batches',
      });
    }

    // 3. Quarantined Kits Requiring Reprocessing
    const quarantinedKits = db.store.kits.filter(k => k.current_status === 'QUARANTINED');
    if (quarantinedKits.length > 0) {
      alerts.push({
        id: 'alert-quarantine',
        type: 'QUARANTINE_ATTENTION',
        severity: 'CRITICAL',
        title: 'Quarantined Kits Sequestered',
        message: `${quarantinedKits.length} kit${quarantinedKits.length > 1 ? 's are' : ' is'} currently quarantined in hold vaults awaiting review or reprocessing authorization.`,
        count: quarantinedKits.length,
        actionUrl: '/quarantine',
        actionText: 'Manage Quarantine',
      });
    }

    // 4. Low Availability for Kit Types (<= 2 available)
    for (const kitType of db.store.kit_types) {
      const availableCount = db.store.kits.filter(
        k => k.kit_type_id === kitType.id && k.current_status === 'AVAILABLE'
      ).length;

      if (availableCount <= 1) {
        alerts.push({
          id: `alert-low-stock-${kitType.id}`,
          type: 'LOW_AVAILABILITY',
          severity: 'WARNING',
          title: `Low Stock: ${kitType.name}`,
          message: `Only ${availableCount} sterile kit remaining in central inventory.`,
          count: availableCount,
          actionUrl: '/inventory',
          actionText: 'Check Inventory',
        });
        break; // Show top low-stock alert
      }
    }

    // 5. Expiry Warnings (within 7 days)
    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(now.getDate() + 7);
    const nowStr = now.toISOString().split('T')[0];
    const nextWeekStr = nextWeek.toISOString().split('T')[0];

    const expiringKits = db.store.kits.filter(
      k => k.current_status === 'AVAILABLE' && k.expiration_date && k.expiration_date >= nowStr && k.expiration_date <= nextWeekStr
    );

    if (expiringKits.length > 0) {
      alerts.push({
        id: 'alert-expiring',
        type: 'EXPIRY_WARNING',
        severity: 'INFO',
        title: 'Sterility Expiration Warning',
        message: `${expiringKits.length} kit${expiringKits.length > 1 ? 's reach' : ' reaches'} maximum shelf life within the next 7 days.`,
        count: expiringKits.length,
        actionUrl: '/inventory?filter=expiring',
        actionText: 'View Expiring Stock',
      });
    }

    return alerts;
  }
}
