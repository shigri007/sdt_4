
export type RoleCode = 'ADMINISTRATOR' | 'DEPARTMENT_STAFF' | 'REPROCESSING_OPERATOR' | 'QUALITY_COORDINATOR';

export type KitStatusCode =
  | 'RETURNED'
  | 'RECEIVED'
  | 'CLEANING'
  | 'INSPECTION'
  | 'PACKING'
  | 'PROCESSING'
  | 'AWAITING_QC'
  | 'QC_APPROVED'
  | 'AVAILABLE'
  | 'RESERVED'
  | 'DISPATCHED'
  | 'RECEIVED_BY_DEPT'
  | 'QUARANTINED'
  | 'EXPIRED';

export type PriorityCode = 'ROUTINE' | 'HIGH' | 'URGENT';

export interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: RoleCode;
  departmentId: number | null;
  departmentName?: string;
  badgeNumber: string | null;
  isActive?: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
}

export interface Department {
  id: number;
  code: string;
  name: string;
  building: string;
  floor: string;
  phone: string | null;
  is_active: number;
}

export interface KitType {
  id: number;
  code: string;
  name: string;
  category: string;
  standard_sterilization_method: string;
  cycle_duration_minutes: number;
  shelf_life_days: number;
  instrument_count: number;
  instructions: string | null;
}

export interface Kit {
  id: number;
  kit_code: string;
  kit_name: string;
  kit_type_id: number;
  typeName?: string;
  typeCategory?: string;
  department_owner_id: number;
  ownerDepartmentName?: string;
  ownerDepartmentCode?: string;
  current_status: KitStatusCode;
  current_location: string;
  processing_attempt_number: number;
  expiration_date: string | null;
  last_processed_at: string | null;
  total_cycles_count: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcessingAttempt {
  id: number;
  kit_id: number;
  attempt_number: number;
  batch_id: number | null;
  batchCode?: string;
  received_at: string | null;
  cleaned_at: string | null;
  inspected_at: string | null;
  packed_at: string | null;
  result: 'PENDING' | 'PASSED' | 'FAILED';
  qc_status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  operator_id: number;
  operatorName?: string;
  reviewer_id: number | null;
  reviewerName?: string;
  failure_reason: string | null;
  notes: string | null;
  created_at: string;
}

export interface Batch {
  id: number;
  batch_code: string;
  operator_id: number;
  operatorName?: string;
  sterilizer_unit_id: string;
  processing_method: string;
  target_temperature_c: number;
  target_pressure_psi: number;
  exposure_time_minutes: number;
  started_at: string;
  completed_at: string | null;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  physical_indicators_passed: number | null;
  chemical_indicators_passed: number | null;
  biological_indicators_passed: number | null;
  processing_notes: string | null;
  qcDecision?: string;
  qcReviewerName?: string | null;
  kitCount?: number;
  kits?: any[];
  qcReview?: any;
  created_at: string;
}

export interface QcReview {
  id: number;
  batch_id: number;
  reviewer_id: number;
  decision: 'APPROVED' | 'REJECTED';
  biological_test_result: string;
  chemical_indicator_result: string;
  packaging_integrity_verified: number;
  notes: string | null;
  reviewed_at: string;
}

export interface KitRequest {
  id: number;
  request_code: string;
  department_id: number;
  departmentName?: string;
  departmentCode?: string;
  requested_by_user_id: number;
  requestedByName?: string;
  kit_type_id: number;
  kitTypeName?: string;
  quantity: number;
  priority: PriorityCode;
  clinical_reason: string;
  status: 'PENDING' | 'FULFILLED' | 'CANCELLED';
  required_by_date: string | null;
  created_at: string;
  approved_at: string | null;
  completed_at: string | null;
  priorityChangeCount?: number;
}

export interface DispatchRecord {
  id: number;
  dispatch_code: string;
  request_id: number;
  requestCode?: string;
  kit_id: number;
  kitCode?: string;
  kitName?: string;
  dispatched_by_user_id: number;
  dispatchedByName?: string;
  recipient_department_id: number;
  recipientDepartmentName?: string;
  status: 'DISPATCHED' | 'RECEIVED' | 'CANCELLED';
  transport_case_id: string | null;
  dispatch_notes: string | null;
  dispatched_at: string;
  isReceived?: boolean;
  receivedAt?: string | null;
}

export interface ReceiptRecord {
  id: number;
  dispatch_id: number;
  kit_id: number;
  received_by_user_id: number;
  recipient_department_id: number;
  packaging_intact: number;
  indicator_color_verified: number;
  condition_notes: string | null;
  received_at: string;
}

export interface QuarantineRecord {
  id: number;
  kit_id: number;
  kitCode?: string;
  kitName?: string;
  currentStatus?: string;
  batch_id: number | null;
  batchCode?: string;
  attempt_number: number;
  quarantined_by_user_id: number;
  quarantinedByName?: string;
  quarantine_reason: string;
  status: 'ACTIVE_QUARANTINE' | 'SENT_FOR_REPROCESSING' | 'DECOMMISSIONED';
  quarantined_at: string;
  resolved_at: string | null;
  resolved_by_user_id: number | null;
  resolvedByName?: string | null;
  resolution_notes: string | null;
}

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
  isFailure?: boolean;
}

export interface KitTraceabilityData {
  kit: Kit;
  qrCodeDataUrl: string;
  attempts: ProcessingAttempt[];
  timeline: TimelineEvent[];
  latestBatch?: Batch | null;
  latestQc?: QcReview | null;
}

export interface SystemAlert {
  id: string;
  type: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  message: string;
  count: number;
  actionUrl: string;
  actionText: string;
}

export interface AuditEvent {
  id: number;
  actor_user_id: number | null;
  actor_name: string;
  actor_role: string;
  entity_type: string;
  entity_id: string;
  action: string;
  previous_state: string | null;
  new_state: string | null;
  metadata_json: string | null;
  created_at: string;
}
