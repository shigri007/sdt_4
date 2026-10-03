// ==========================================================
// SteriTrack: Configuration and Constants
// ==========================================================

export const CONFIG = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  DATABASE_PATH: process.env.DATABASE_PATH || '.data/steritrack.sqlite',
};

export const ROLES = {
  ADMINISTRATOR: 'ADMINISTRATOR',
  DEPARTMENT_STAFF: 'DEPARTMENT_STAFF',
  REPROCESSING_OPERATOR: 'REPROCESSING_OPERATOR',
  QUALITY_COORDINATOR: 'QUALITY_COORDINATOR',
} as const;

export type RoleCode = keyof typeof ROLES;

export const KIT_STATUS = {
  RETURNED: 'RETURNED',
  RECEIVED: 'RECEIVED',
  CLEANING: 'CLEANING',
  INSPECTION: 'INSPECTION',
  PACKING: 'PACKING',
  PROCESSING: 'PROCESSING',
  AWAITING_QC: 'AWAITING_QC',
  QC_APPROVED: 'QC_APPROVED',
  AVAILABLE: 'AVAILABLE',
  RESERVED: 'RESERVED',
  DISPATCHED: 'DISPATCHED',
  RECEIVED_BY_DEPT: 'RECEIVED_BY_DEPT',
  QUARANTINED: 'QUARANTINED',
  EXPIRED: 'EXPIRED',
} as const;

export type KitStatusCode = keyof typeof KIT_STATUS;

export const PRIORITY = {
  ROUTINE: 'ROUTINE',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;

export type PriorityCode = keyof typeof PRIORITY;

export const STERILIZATION_METHODS = [
  'STEAM_AUTOCLAVE',
  'ETHYLENE_OXIDE',
  'VAPORIZED_HYDROGEN_PEROXIDE',
  'DRY_HEAT',
] as const;

export type SterilizationMethod = typeof STERILIZATION_METHODS[number];

// Workflow Valid Next States Map
export const VALID_WORKFLOW_TRANSITIONS: Record<KitStatusCode, KitStatusCode[]> = {
  RETURNED: ['RECEIVED'],
  RECEIVED: ['CLEANING'],
  CLEANING: ['INSPECTION'],
  INSPECTION: ['PACKING', 'QUARANTINED', 'CLEANING'],
  PACKING: ['PROCESSING'],
  PROCESSING: ['AWAITING_QC', 'QUARANTINED'],
  AWAITING_QC: ['AVAILABLE', 'QUARANTINED'],
  QC_APPROVED: ['AVAILABLE'],
  AVAILABLE: ['RESERVED', 'DISPATCHED', 'EXPIRED'],
  RESERVED: ['AVAILABLE', 'DISPATCHED'],
  DISPATCHED: ['RECEIVED_BY_DEPT', 'AVAILABLE'], // AVAILABLE if cancelled
  RECEIVED_BY_DEPT: ['RETURNED'],
  QUARANTINED: ['RECEIVED'], // Only through authorized reprocessing!
  EXPIRED: ['RECEIVED'], // Reprocessing needed
};
