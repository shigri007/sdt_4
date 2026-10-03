import type { RoleCode } from './types/index.js';

/** Navigation is a usability layer. The API enforces its own matching policy. */
export const ROLE_TABS: Record<RoleCode, readonly string[]> = {
  ADMINISTRATOR: ['dashboard', 'audit', 'reports', 'admin'],
  DEPARTMENT_STAFF: ['dashboard', 'kits', 'requests', 'inventory', 'receipts', 'traceability'],
  REPROCESSING_OPERATOR: ['dashboard', 'kits', 'processing', 'batches', 'quarantine', 'traceability'],
  QUALITY_COORDINATOR: ['dashboard', 'kits', 'requests', 'batches', 'qc', 'quarantine', 'inventory', 'dispatch', 'traceability', 'audit', 'reports'],
};

export const canAccessTab = (role: RoleCode, tab: string): boolean => ROLE_TABS[role].includes(tab);
