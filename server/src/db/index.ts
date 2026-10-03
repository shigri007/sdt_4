// ==========================================================
// SteriTrack: Database Abstraction Layer
// File-backed SQLite storage for a single local SteriTrack instance.
// ==========================================================

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';

export interface DbUser {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  full_name: string;
  role_code: string;
  department_id: number | null;
  badge_number: string | null;
  is_active: number;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbDepartment {
  id: number;
  code: string;
  name: string;
  building: string;
  floor: string;
  phone: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface DbKitType {
  id: number;
  code: string;
  name: string;
  category: string;
  standard_sterilization_method: string;
  cycle_duration_minutes: number;
  shelf_life_days: number;
  instrument_count: number;
  instructions: string | null;
  created_at: string;
}

export interface DbKit {
  id: number;
  kit_code: string;
  kit_name: string;
  kit_type_id: number;
  department_owner_id: number;
  current_status: string;
  current_location: string;
  processing_attempt_number: number;
  expiration_date: string | null;
  last_processed_at: string | null;
  total_cycles_count: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbBatch {
  id: number;
  batch_code: string;
  operator_id: number;
  sterilizer_unit_id: string;
  processing_method: string;
  target_temperature_c: number;
  target_pressure_psi: number;
  exposure_time_minutes: number;
  started_at: string;
  completed_at: string | null;
  status: string;
  physical_indicators_passed: number | null;
  chemical_indicators_passed: number | null;
  biological_indicators_passed: number | null;
  processing_notes: string | null;
  created_at: string;
}

export interface DbBatchKit {
  id: number;
  batch_id: number;
  kit_id: number;
  attempt_number: number;
  created_at: string;
}

export interface DbProcessingAttempt {
  id: number;
  kit_id: number;
  attempt_number: number;
  batch_id: number | null;
  received_at: string | null;
  cleaned_at: string | null;
  inspected_at: string | null;
  packed_at: string | null;
  result: 'PENDING' | 'PASSED' | 'FAILED';
  qc_status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  operator_id: number;
  reviewer_id: number | null;
  failure_reason: string | null;
  notes: string | null;
  created_at: string;
}

export interface DbQcReview {
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

export interface DbRequest {
  id: number;
  request_code: string;
  department_id: number;
  requested_by_user_id: number;
  kit_type_id: number;
  quantity: number;
  priority: 'ROUTINE' | 'HIGH' | 'URGENT';
  clinical_reason: string;
  status: 'PENDING' | 'FULFILLED' | 'CANCELLED';
  required_by_date: string | null;
  created_at: string;
  approved_at: string | null;
  completed_at: string | null;
}

export interface DbRequestPriorityHistory {
  id: number;
  request_id: number;
  changed_by_user_id: number;
  previous_priority: string;
  new_priority: string;
  justification: string;
  created_at: string;
}

export interface DbDispatch {
  id: number;
  dispatch_code: string;
  request_id: number;
  kit_id: number;
  dispatched_by_user_id: number;
  recipient_department_id: number;
  status: 'DISPATCHED' | 'RECEIVED' | 'CANCELLED';
  transport_case_id: string | null;
  dispatch_notes: string | null;
  dispatched_at: string;
}

export interface DbReceipt {
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

export interface DbQuarantineRecord {
  id: number;
  kit_id: number;
  batch_id: number | null;
  attempt_number: number;
  quarantined_by_user_id: number;
  quarantine_reason: string;
  status: 'ACTIVE_QUARANTINE' | 'SENT_FOR_REPROCESSING' | 'DECOMMISSIONED';
  quarantined_at: string;
  resolved_at: string | null;
  resolved_by_user_id: number | null;
  resolution_notes: string | null;
}

export interface DbAuditEvent {
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

// -------------------------------------------------------------
// Domain model held in memory while a request runs; SQLite is durable storage.
// -------------------------------------------------------------
class RelationalMemoryStore {
  departments: DbDepartment[] = [];
  roles: { id: number; code: string; name: string; description: string }[] = [];
  users: DbUser[] = [];
  kit_types: DbKitType[] = [];
  kits: DbKit[] = [];
  batches: DbBatch[] = [];
  batch_kits: DbBatchKit[] = [];
  processing_attempts: DbProcessingAttempt[] = [];
  qc_reviews: DbQcReview[] = [];
  requests: DbRequest[] = [];
  request_priority_history: DbRequestPriorityHistory[] = [];
  dispatches: DbDispatch[] = [];
  receipts: DbReceipt[] = [];
  quarantine_records: DbQuarantineRecord[] = [];
  audit_events: DbAuditEvent[] = [];

  private nextIds: Record<string, number> = {
    departments: 1,
    roles: 1,
    users: 1,
    kit_types: 1,
    kits: 1,
    batches: 1,
    batch_kits: 1,
    processing_attempts: 1,
    qc_reviews: 1,
    requests: 1,
    request_priority_history: 1,
    dispatches: 1,
    receipts: 1,
    quarantine_records: 1,
    audit_events: 1,
  };

  private isInitialized = false;

  snapshot() {
    const tables = Object.fromEntries(
      Object.keys(this.nextIds).map(name => [name, structuredClone((this as any)[name])])
    );
    return { tables, nextIds: { ...this.nextIds } };
  }

  restore(snapshot: ReturnType<RelationalMemoryStore['snapshot']>) {
    for (const [name, rows] of Object.entries(snapshot.tables)) (this as any)[name] = rows;
    this.nextIds = { ...snapshot.nextIds };
  }

  constructor() {
    this.seedDefaultData();
  }

  getNextId(table: string): number {
    const id = this.nextIds[table] || 1;
    this.nextIds[table] = id + 1;
    return id;
  }

  seedDefaultData() {
    if (this.isInitialized) return;

    // Roles
    this.roles = [
      { id: 1, code: 'ADMINISTRATOR', name: 'System Administrator', description: 'Full system management and audits' },
      { id: 2, code: 'DEPARTMENT_STAFF', name: 'Department Clinical Staff', description: 'Requisitions, receipt and kit return' },
      { id: 3, code: 'REPROCESSING_OPERATOR', name: 'CSPD Reprocessing Operator', description: 'Decontamination, inspection, packaging, and batch sterilization' },
      { id: 4, code: 'QUALITY_COORDINATOR', name: 'Sterile Quality Coordinator', description: 'Independent review, batch release, quarantine control and dispatch' },
    ];
    this.nextIds.roles = 5;

    // Departments
    this.departments = [
      { id: 1, code: 'SURG', name: 'Surgical Services & Operating Theatres', building: 'North Surgical Pavilion', floor: 'Level 3 - Suites A-H', phone: '+1 (555) 019-3341', is_active: 1, created_at: '2026-09-20 08:00:00', updated_at: '2026-09-20 08:00:00' },
      { id: 2, code: 'ER', name: 'Emergency & Trauma Department', building: 'East Ambulatory Wing', floor: 'Ground Level', phone: '+1 (555) 019-3382', is_active: 1, created_at: '2026-09-20 08:00:00', updated_at: '2026-09-20 08:00:00' },
      { id: 3, code: 'DENT', name: 'Dental & Maxillofacial Clinic', building: 'Specialty Health Clinic', floor: 'Level 1 - Suite 104', phone: '+1 (555) 019-3319', is_active: 1, created_at: '2026-09-20 08:00:00', updated_at: '2026-09-20 08:00:00' },
      { id: 4, code: 'CSPD', name: 'Central Sterile Processing Department', building: 'Logistics & Decontamination Center', floor: 'Basement Level B1', phone: '+1 (555) 019-3300', is_active: 1, created_at: '2026-09-20 08:00:00', updated_at: '2026-09-20 08:00:00' },
    ];
    this.nextIds.departments = 5;

    // All initial hashes are replaced with a fresh bcrypt hash on first database creation.
    const pwHash = '';
    this.users = [
      { id: 1, username: 'admin', email: 'admin@steritrack.hospital.org', password_hash: pwHash, full_name: 'Haider Abbas (Lead Systems Architect & Admin)', role_code: 'ADMINISTRATOR', department_id: 4, badge_number: 'BADGE-ADM-01', is_active: 1, last_login_at: '2026-10-01 08:00:00', created_at: '2026-09-20 08:00:00', updated_at: '2026-09-20 08:00:00' },
      { id: 2, username: 'lin_xia', email: 'lin.xia@steritrack.hospital.org', password_hash: pwHash, full_name: 'Lin Xia (Lín Xiá, 林霞 - OR Charge Nurse)', role_code: 'DEPARTMENT_STAFF', department_id: 1, badge_number: 'BADGE-SURG-07', is_active: 1, last_login_at: '2026-10-01 08:15:00', created_at: '2026-09-20 08:00:00', updated_at: '2026-09-20 08:00:00' },
      { id: 3, username: 'liu_yang', email: 'liu.yang@steritrack.hospital.org', password_hash: pwHash, full_name: 'Liu Yang (Liú Yáng, 刘洋 - Trauma Resus BSN)', role_code: 'DEPARTMENT_STAFF', department_id: 2, badge_number: 'BADGE-ER-12', is_active: 1, last_login_at: '2026-10-01 08:45:00', created_at: '2026-09-20 08:00:00', updated_at: '2026-09-20 08:00:00' },
      { id: 4, username: 'chen_wei', email: 'chen.wei@steritrack.hospital.org', password_hash: pwHash, full_name: 'Chen Wei (Chén Wěi, 陈伟 - Lead CSPD Operator)', role_code: 'REPROCESSING_OPERATOR', department_id: 4, badge_number: 'BADGE-CSPD-22', is_active: 1, last_login_at: '2026-10-01 06:00:00', created_at: '2026-09-20 08:00:00', updated_at: '2026-09-20 08:00:00' },
      { id: 5, username: 'li_ming', email: 'li.ming@steritrack.hospital.org', password_hash: pwHash, full_name: 'Li Ming (Lǐ Míng, 李明 - Reprocessing Tech)', role_code: 'REPROCESSING_OPERATOR', department_id: 4, badge_number: 'BADGE-CSPD-25', is_active: 1, last_login_at: '2026-10-01 07:00:00', created_at: '2026-09-20 08:00:00', updated_at: '2026-09-20 08:00:00' },
      { id: 6, username: 'zhang_lei', email: 'zhang.lei@steritrack.hospital.org', password_hash: pwHash, full_name: 'Zhang Lei (Zhāng Lěi, 张磊 - Sterile Quality Lead)', role_code: 'QUALITY_COORDINATOR', department_id: 4, badge_number: 'BADGE-QC-03', is_active: 1, last_login_at: '2026-10-01 08:30:00', created_at: '2026-09-20 08:00:00', updated_at: '2026-09-20 08:00:00' },
      { id: 7, username: 'wang_fang', email: 'wang.fang@steritrack.hospital.org', password_hash: pwHash, full_name: 'Wang Fang (Wáng Fāng, 王芳 - Clinical Coordinator)', role_code: 'QUALITY_COORDINATOR', department_id: 4, badge_number: 'BADGE-QC-08', is_active: 1, last_login_at: '2026-10-01 09:00:00', created_at: '2026-09-20 08:00:00', updated_at: '2026-09-20 08:00:00' },
      { id: 8, username: 'haider_abbas', email: 'haider.lead@steritrack.hospital.org', password_hash: pwHash, full_name: 'Haider Abbas (Chief Software Architect)', role_code: 'ADMINISTRATOR', department_id: 4, badge_number: 'BADGE-ARCH-01', is_active: 1, last_login_at: '2026-10-01 09:30:00', created_at: '2026-09-20 08:00:00', updated_at: '2026-09-20 08:00:00' },
    ];
    this.nextIds.users = 9;

    // Kit Types
    this.kit_types = [
      { id: 1, code: 'KT-GENSURG', name: 'Major General Laparotomy Kit', category: 'General Surgery', standard_sterilization_method: 'STEAM_AUTOCLAVE', cycle_duration_minutes: 45, shelf_life_days: 30, instrument_count: 48, instructions: 'Triple biological spore test. Wrap in double non-woven SMS wrap.', created_at: '2026-09-20 08:00:00' },
      { id: 2, code: 'KT-ORTHO-HIP', name: 'Total Hip Arthroplasty Implant Prep Set', category: 'Orthopedics', standard_sterilization_method: 'STEAM_AUTOCLAVE', cycle_duration_minutes: 60, shelf_life_days: 30, instrument_count: 36, instructions: 'Heavy tray. Ensure weight does not exceed 11.4kg (25 lbs).', created_at: '2026-09-20 08:00:00' },
      { id: 3, code: 'KT-TRAUMA-EMER', name: 'Emergency Trauma Cutdown / Thoracotomy Kit', category: 'Emergency', standard_sterilization_method: 'STEAM_AUTOCLAVE', cycle_duration_minutes: 45, shelf_life_days: 30, instrument_count: 24, instructions: 'High urgency rotation. Visual inspection of rib spreaders mandatory.', created_at: '2026-09-20 08:00:00' },
      { id: 4, code: 'KT-CARD-CATH', name: 'Cardiac Catheterization & Vascular Cutdown Tray', category: 'Cardiology', standard_sterilization_method: 'VAPORIZED_HYDROGEN_PEROXIDE', cycle_duration_minutes: 55, shelf_life_days: 60, instrument_count: 18, instructions: 'Low-temp hydrogen peroxide gas plasma only. Max 50°C.', created_at: '2026-09-20 08:00:00' },
      { id: 5, code: 'KT-DENT-MAX', name: 'Oral & Maxillofacial Surgical Extraction Set', category: 'Dental', standard_sterilization_method: 'STEAM_AUTOCLAVE', cycle_duration_minutes: 30, shelf_life_days: 30, instrument_count: 16, instructions: 'Inspect elevator tips and forceps hinges for bioburden and pitting.', created_at: '2026-09-20 08:00:00' },
      { id: 6, code: 'KT-NEURO-CRAN', name: 'Microsurgical Craniotomy Dissection Kit', category: 'Neurosurgery', standard_sterilization_method: 'STEAM_AUTOCLAVE', cycle_duration_minutes: 60, shelf_life_days: 30, instrument_count: 52, instructions: 'Microscopic fine tips. Require protective silicone tip guards.', created_at: '2026-09-20 08:00:00' },
    ];
    this.nextIds.kit_types = 7;

    // Kits
    this.kits = [
      { id: 1, kit_code: 'KIT-0001', kit_name: 'General Surgery Laparotomy Tray #1', kit_type_id: 1, department_owner_id: 1, current_status: 'AVAILABLE', current_location: 'Sterile Storage Bay A-01', processing_attempt_number: 1, expiration_date: '2026-11-20', last_processed_at: '2026-10-01 06:30:00', total_cycles_count: 14, notes: 'All instruments verified and intact.', created_at: '2026-09-20 08:00:00', updated_at: '2026-10-01 08:00:00' },
      { id: 2, kit_code: 'KIT-0002', kit_name: 'General Surgery Laparotomy Tray #2', kit_type_id: 1, department_owner_id: 1, current_status: 'AVAILABLE', current_location: 'Sterile Storage Bay A-02', processing_attempt_number: 1, expiration_date: '2026-11-22', last_processed_at: '2026-10-01 07:15:00', total_cycles_count: 12, notes: 'Pre-vacuum autoclave cycle passed.', created_at: '2026-09-20 08:00:00', updated_at: '2026-10-01 08:00:00' },
      { id: 3, kit_code: 'KIT-0003', kit_name: 'Emergency Trauma Resus Kit #1', kit_type_id: 3, department_owner_id: 2, current_status: 'AVAILABLE', current_location: 'Sterile Storage Bay E-01', processing_attempt_number: 1, expiration_date: '2026-11-15', last_processed_at: '2026-09-30 18:00:00', total_cycles_count: 21, notes: 'Designated rapid trauma stock.', created_at: '2026-09-20 08:00:00', updated_at: '2026-09-30 18:30:00' },
      { id: 4, kit_code: 'KIT-0004', kit_name: 'Total Hip Arthroplasty Prep Set #1', kit_type_id: 2, department_owner_id: 1, current_status: 'AVAILABLE', current_location: 'Sterile Storage Bay O-03', processing_attempt_number: 1, expiration_date: '2026-11-10', last_processed_at: '2026-09-28 14:00:00', total_cycles_count: 9, notes: 'Heavy orthopedic tray.', created_at: '2026-09-20 08:00:00', updated_at: '2026-09-28 14:30:00' },
      { id: 5, kit_code: 'KIT-0005', kit_name: 'Oral & Maxillofacial Kit #1', kit_type_id: 5, department_owner_id: 3, current_status: 'AVAILABLE', current_location: 'Sterile Storage Bay D-01', processing_attempt_number: 1, expiration_date: '2026-11-25', last_processed_at: '2026-10-01 08:00:00', total_cycles_count: 6, notes: 'Dental clinic routine set.', created_at: '2026-09-20 08:00:00', updated_at: '2026-10-01 08:30:00' },
      { id: 6, kit_code: 'KIT-0006', kit_name: 'Microsurgical Craniotomy Kit #1', kit_type_id: 6, department_owner_id: 1, current_status: 'AVAILABLE', current_location: 'Sterile Storage Bay N-01', processing_attempt_number: 1, expiration_date: '2026-11-05', last_processed_at: '2026-09-25 10:00:00', total_cycles_count: 8, notes: 'Micro-tips verified under magnification.', created_at: '2026-09-20 08:00:00', updated_at: '2026-09-25 10:30:00' },
      { id: 7, kit_code: 'KIT-0007', kit_name: 'Cardiac Catheterization Tray #1', kit_type_id: 4, department_owner_id: 1, current_status: 'AVAILABLE', current_location: 'Sterile Storage Low-Temp Bay', processing_attempt_number: 1, expiration_date: '2026-12-01', last_processed_at: '2026-09-29 11:30:00', total_cycles_count: 5, notes: 'VHP processed.', created_at: '2026-09-20 08:00:00', updated_at: '2026-09-29 12:00:00' },
      { id: 8, kit_code: 'KIT-0008', kit_name: 'Emergency Trauma Cutdown Tray #2', kit_type_id: 3, department_owner_id: 2, current_status: 'RETURNED', current_location: 'Decontamination Receiving Dock B1', processing_attempt_number: 1, expiration_date: null, last_processed_at: null, total_cycles_count: 18, notes: 'Returned contaminated from ER Trauma Bay 2 at 09:15.', created_at: '2026-09-20 08:00:00', updated_at: '2026-10-01 09:15:00' },
      { id: 9, kit_code: 'KIT-0009', kit_name: 'General Surgery Laparotomy Tray #3', kit_type_id: 1, department_owner_id: 1, current_status: 'RECEIVED', current_location: 'Decontamination Sorting Station #3', processing_attempt_number: 1, expiration_date: null, last_processed_at: null, total_cycles_count: 15, notes: 'Logged in by operator Kim; awaiting enzymatic bath.', created_at: '2026-09-20 08:00:00', updated_at: '2026-10-01 09:30:00' },
      { id: 10, kit_code: 'KIT-0010', kit_name: 'Total Hip Arthroplasty Prep Set #2', kit_type_id: 2, department_owner_id: 1, current_status: 'CLEANING', current_location: 'Automated Ultrasonic Washer #2', processing_attempt_number: 1, expiration_date: null, last_processed_at: null, total_cycles_count: 11, notes: 'Currently in 35-minute enzymatic soak & ultrasonic cavitation cycle.', created_at: '2026-09-20 08:00:00', updated_at: '2026-10-01 09:45:00' },
      { id: 11, kit_code: 'KIT-0011', kit_name: 'Emergency Trauma Cutdown Tray #3', kit_type_id: 3, department_owner_id: 2, current_status: 'INSPECTION', current_location: 'Clean Assembly Station #1', processing_attempt_number: 1, expiration_date: null, last_processed_at: null, total_cycles_count: 16, notes: 'Operator David Chen conducting magnification inspection.', created_at: '2026-09-20 08:00:00', updated_at: '2026-10-01 10:00:00' },
      { id: 12, kit_code: 'KIT-0012', kit_name: 'General Surgery Laparotomy Tray #4', kit_type_id: 1, department_owner_id: 1, current_status: 'DISPATCHED', current_location: 'In Transit to OR Suite 3', processing_attempt_number: 2, expiration_date: '2026-11-28', last_processed_at: '2026-10-01 10:45:00', total_cycles_count: 20, notes: 'Failed first attempt, quarantined, reprocessed, independently reviewed and dispatched against an urgent request.', created_at: '2026-09-20 08:00:00', updated_at: '2026-10-01 10:48:00' },
      { id: 13, kit_code: 'KIT-0013', kit_name: 'Oral & Maxillofacial Kit #2', kit_type_id: 5, department_owner_id: 3, current_status: 'PACKING', current_location: 'Clean Packaging Station #2', processing_attempt_number: 1, expiration_date: null, last_processed_at: null, total_cycles_count: 7, notes: 'Double-wrapping in progress with chemical integrator #5.', created_at: '2026-09-20 08:00:00', updated_at: '2026-10-01 10:15:00' },
      { id: 14, kit_code: 'KIT-0014', kit_name: 'Microsurgical Craniotomy Kit #2', kit_type_id: 6, department_owner_id: 1, current_status: 'PROCESSING', current_location: 'Autoclave Bay #2 (Steris AMSCO 400)', processing_attempt_number: 1, expiration_date: null, last_processed_at: null, total_cycles_count: 10, notes: 'Active sterilization cycle running at 134°C prevacuum in Batch BAT-2026-0005.', created_at: '2026-09-20 08:00:00', updated_at: '2026-10-01 11:15:00' },
      { id: 15, kit_code: 'KIT-0015', kit_name: 'Total Hip Arthroplasty Prep Set #3', kit_type_id: 2, department_owner_id: 1, current_status: 'AWAITING_QC', current_location: 'Sterilizer Cool-Down Staging Area', processing_attempt_number: 1, expiration_date: null, last_processed_at: null, total_cycles_count: 13, notes: 'Cycle completed in Batch BAT-2026-0004. Awaiting coordinator review.', created_at: '2026-09-20 08:00:00', updated_at: '2026-10-01 10:45:00' },
      { id: 16, kit_code: 'KIT-0016', kit_name: 'General Surgery Laparotomy Tray #5', kit_type_id: 1, department_owner_id: 1, current_status: 'AWAITING_QC', current_location: 'Sterilizer Cool-Down Staging Area', processing_attempt_number: 1, expiration_date: null, last_processed_at: null, total_cycles_count: 17, notes: 'Awaiting biological readout confirmation.', created_at: '2026-09-20 08:00:00', updated_at: '2026-10-01 10:45:00' },
      { id: 17, kit_code: 'KIT-0017', kit_name: 'Emergency Trauma Cutdown Tray #4', kit_type_id: 3, department_owner_id: 2, current_status: 'QUARANTINED', current_location: 'Quarantine Hold Vault Q-02', processing_attempt_number: 1, expiration_date: null, last_processed_at: null, total_cycles_count: 14, notes: 'QUARANTINED: Moisture detected in packaging wrap following autoclave cycle.', created_at: '2026-09-20 08:00:00', updated_at: '2026-09-30 16:05:00' },
      { id: 18, kit_code: 'KIT-0018', kit_name: 'Cardiac Catheterization Tray #2', kit_type_id: 4, department_owner_id: 1, current_status: 'QUARANTINED', current_location: 'Quarantine Hold Vault Q-01', processing_attempt_number: 1, expiration_date: null, last_processed_at: null, total_cycles_count: 4, notes: 'QUARANTINED: VHP cycle pressure drop anomaly at minute 24.', created_at: '2026-09-20 08:00:00', updated_at: '2026-09-30 17:30:00' },
      { id: 19, kit_code: 'KIT-0019', kit_name: 'General Surgery Laparotomy Tray #6', kit_type_id: 1, department_owner_id: 1, current_status: 'EXPIRED', current_location: 'Sterile Storage Bay A-09', processing_attempt_number: 1, expiration_date: '2026-09-15', last_processed_at: '2026-08-15 09:00:00', total_cycles_count: 22, notes: 'Exceeded 30-day sterile barrier limit; requires re-packaging and reprocessing.', created_at: '2026-08-10 08:00:00', updated_at: '2026-09-16 00:00:00' },
      { id: 20, kit_code: 'KIT-0020', kit_name: 'Oral & Maxillofacial Kit #3', kit_type_id: 5, department_owner_id: 3, current_status: 'RECEIVED_BY_DEPT', current_location: 'Dental Clinic Procedure Room 2', processing_attempt_number: 1, expiration_date: '2026-11-12', last_processed_at: '2026-09-22 13:00:00', total_cycles_count: 8, notes: 'Dispatched yesterday and verified received by dental clinic supervisor.', created_at: '2026-09-15 08:00:00', updated_at: '2026-09-22 13:05:00' },
    ];
    this.nextIds.kits = 21;

    // Batches
    this.batches = [
      { id: 1, batch_code: 'BAT-2026-0001', operator_id: 4, sterilizer_unit_id: 'Autoclave Unit #1 (Steris AMSCO)', processing_method: 'STEAM_AUTOCLAVE', target_temperature_c: 134.0, target_pressure_psi: 30.5, exposure_time_minutes: 18, started_at: '2026-09-30 06:00:00', completed_at: '2026-09-30 07:15:00', status: 'COMPLETED', physical_indicators_passed: 1, chemical_indicators_passed: 1, biological_indicators_passed: 1, processing_notes: 'Routine morning pre-vacuum run. All parameters within ISO tolerances.', created_at: '2026-09-30 06:00:00' },
      { id: 2, batch_code: 'BAT-2026-0002', operator_id: 5, sterilizer_unit_id: 'Autoclave Unit #1 (Steris AMSCO)', processing_method: 'STEAM_AUTOCLAVE', target_temperature_c: 134.0, target_pressure_psi: 30.5, exposure_time_minutes: 18, started_at: '2026-09-30 14:00:00', completed_at: '2026-09-30 15:20:00', status: 'FAILED', physical_indicators_passed: 1, chemical_indicators_passed: 1, biological_indicators_passed: 0, processing_notes: 'FAILED RUN: Rapid readout biological indicator showed fluorescence at 24 mins. Entire load quarantined!', created_at: '2026-09-30 14:00:00' },
      { id: 3, batch_code: 'BAT-2026-0003', operator_id: 4, sterilizer_unit_id: 'Autoclave Unit #2 (Getinge GSS67)', processing_method: 'STEAM_AUTOCLAVE', target_temperature_c: 134.0, target_pressure_psi: 31.0, exposure_time_minutes: 18, started_at: '2026-10-01 07:00:00', completed_at: '2026-10-01 08:20:00', status: 'COMPLETED', physical_indicators_passed: 1, chemical_indicators_passed: 1, biological_indicators_passed: 1, processing_notes: 'Reprocessing batch for previously quarantined items. Autoclave #2 biological indicator negative.', created_at: '2026-10-01 07:00:00' },
      { id: 4, batch_code: 'BAT-2026-0004', operator_id: 5, sterilizer_unit_id: 'Autoclave Unit #2 (Getinge GSS67)', processing_method: 'STEAM_AUTOCLAVE', target_temperature_c: 134.0, target_pressure_psi: 31.0, exposure_time_minutes: 18, started_at: '2026-10-01 09:30:00', completed_at: '2026-10-01 10:45:00', status: 'COMPLETED', physical_indicators_passed: 1, chemical_indicators_passed: 1, biological_indicators_passed: 1, processing_notes: 'Pre-op trays sterilized for afternoon surgical schedule. Awaiting coordinator signoff.', created_at: '2026-10-01 09:30:00' },
      { id: 5, batch_code: 'BAT-2026-0005', operator_id: 4, sterilizer_unit_id: 'Autoclave Unit #1 (Steris AMSCO)', processing_method: 'STEAM_AUTOCLAVE', target_temperature_c: 134.0, target_pressure_psi: 30.5, exposure_time_minutes: 18, started_at: '2026-10-01 11:15:00', completed_at: null, status: 'IN_PROGRESS', physical_indicators_passed: null, chemical_indicators_passed: null, biological_indicators_passed: null, processing_notes: 'Cycle currently active. Chamber temp 134.1°C, pressure 30.7 psi.', created_at: '2026-10-01 11:15:00' },
    ];
    this.nextIds.batches = 6;

    // Batch Kits
    this.batch_kits = [
      { id: 1, batch_id: 1, kit_id: 1, attempt_number: 1, created_at: '2026-09-30 06:00:00' },
      { id: 2, batch_id: 1, kit_id: 2, attempt_number: 1, created_at: '2026-09-30 06:00:00' },
      { id: 3, batch_id: 1, kit_id: 3, attempt_number: 1, created_at: '2026-09-30 06:00:00' },
      { id: 4, batch_id: 2, kit_id: 12, attempt_number: 1, created_at: '2026-09-30 14:00:00' }, // KIT-0012 Attempt 1 in failed batch
      { id: 5, batch_id: 2, kit_id: 17, attempt_number: 1, created_at: '2026-09-30 14:00:00' },
      { id: 6, batch_id: 3, kit_id: 12, attempt_number: 2, created_at: '2026-10-01 07:00:00' }, // KIT-0012 Reprocessed in Batch 3 Attempt 2
      { id: 7, batch_id: 4, kit_id: 15, attempt_number: 1, created_at: '2026-10-01 09:30:00' },
      { id: 8, batch_id: 4, kit_id: 16, attempt_number: 1, created_at: '2026-10-01 09:30:00' },
      { id: 9, batch_id: 5, kit_id: 14, attempt_number: 1, created_at: '2026-10-01 11:15:00' },
    ];
    this.nextIds.batch_kits = 10;

    // Processing Attempts (NEVER OVERWRITTEN)
    this.processing_attempts = [
      { id: 1, kit_id: 1, attempt_number: 1, batch_id: 1, received_at: '2026-09-30 04:00:00', cleaned_at: '2026-09-30 04:45:00', inspected_at: '2026-09-30 05:15:00', packed_at: '2026-09-30 05:45:00', result: 'PASSED', qc_status: 'APPROVED', operator_id: 4, reviewer_id: 6, failure_reason: null, notes: 'Clean processing run.', created_at: '2026-09-30 04:00:00' },
      { id: 2, kit_id: 2, attempt_number: 1, batch_id: 1, received_at: '2026-09-30 04:10:00', cleaned_at: '2026-09-30 04:50:00', inspected_at: '2026-09-30 05:20:00', packed_at: '2026-09-30 05:50:00', result: 'PASSED', qc_status: 'APPROVED', operator_id: 4, reviewer_id: 6, failure_reason: null, notes: 'Full check complete.', created_at: '2026-09-30 04:10:00' },
      // KIT-0012 ATTEMPT 1 (FAILED - PERMANENT HISTORICAL RECORD)
      { id: 3, kit_id: 12, attempt_number: 1, batch_id: 2, received_at: '2026-09-30 11:00:00', cleaned_at: '2026-09-30 11:45:00', inspected_at: '2026-09-30 12:15:00', packed_at: '2026-09-30 13:00:00', result: 'FAILED', qc_status: 'REJECTED', operator_id: 5, reviewer_id: 6, failure_reason: 'Biological indicator failure on Autoclave Unit #1: Geobacillus stearothermophilus spore test positive after 24 minutes incubation.', notes: 'Batch BAT-2026-0002 failed sterility confirmation. Kit immediately quarantined.', created_at: '2026-09-30 11:00:00' },
      { id: 4, kit_id: 17, attempt_number: 1, batch_id: 2, received_at: '2026-09-30 11:15:00', cleaned_at: '2026-09-30 12:00:00', inspected_at: '2026-09-30 12:30:00', packed_at: '2026-09-30 13:15:00', result: 'FAILED', qc_status: 'REJECTED', operator_id: 5, reviewer_id: 6, failure_reason: 'Co-located in failed batch BAT-2026-0002. Package wrapper was wet at cycle extraction (wet pack syndrome).', notes: 'Quarantined for full breakdown and re-cleaning.', created_at: '2026-09-30 11:15:00' },
      // KIT-0012 ATTEMPT 2 (PASSED & APPROVED)
      { id: 5, kit_id: 12, attempt_number: 2, batch_id: 3, received_at: '2026-10-01 05:00:00', cleaned_at: '2026-10-01 05:35:00', inspected_at: '2026-10-01 06:05:00', packed_at: '2026-10-01 06:40:00', result: 'PASSED', qc_status: 'APPROVED', operator_id: 4, reviewer_id: 6, failure_reason: null, notes: 'Full re-processing sequence executed. Repacked with fresh SMS wrap. Autoclave Unit #2 rapid readout confirmed negative.', created_at: '2026-10-01 05:00:00' },
      { id: 6, kit_id: 15, attempt_number: 1, batch_id: 4, received_at: '2026-10-01 07:30:00', cleaned_at: '2026-10-01 08:15:00', inspected_at: '2026-10-01 08:45:00', packed_at: '2026-10-01 09:15:00', result: 'PASSED', qc_status: 'PENDING_REVIEW', operator_id: 5, reviewer_id: null, failure_reason: null, notes: 'Loaded in Autoclave #2. Cycle complete, awaiting QC inspection.', created_at: '2026-10-01 07:30:00' },
      { id: 7, kit_id: 16, attempt_number: 1, batch_id: 4, received_at: '2026-10-01 07:45:00', cleaned_at: '2026-10-01 08:25:00', inspected_at: '2026-10-01 08:50:00', packed_at: '2026-10-01 09:20:00', result: 'PASSED', qc_status: 'PENDING_REVIEW', operator_id: 5, reviewer_id: null, failure_reason: null, notes: 'Loaded in Autoclave #2. Awaiting QC signoff.', created_at: '2026-10-01 07:45:00' },
    ];
    this.nextIds.processing_attempts = 8;

    // QC Reviews (INDEPENDENT REVIEW ONLY)
    this.qc_reviews = [
      { id: 1, batch_id: 1, reviewer_id: 6, decision: 'APPROVED', biological_test_result: 'NEGATIVE (CLEAR at 180 min)', chemical_indicator_result: 'CLASS 5 INTEGRATOR FULLY TURNED BLACK', packaging_integrity_verified: 1, notes: 'Sterilization cycle physical tape printout reviewed. All thermal and pressure plateau targets met. Batched kits released to Sterile Storage.', reviewed_at: '2026-09-30 08:00:00' },
      { id: 2, batch_id: 2, reviewer_id: 6, decision: 'REJECTED', biological_test_result: 'POSITIVE (FAILURE DETECTED at 24 min)', chemical_indicator_result: 'INCOMPLETE TRANSITION ON CHAMBER BACK INTEGRATOR', packaging_integrity_verified: 0, notes: 'CRITICAL REJECTION: Autoclave #1 failed biological lethality test. Chamber sensor calibrated incorrectly. All contents remanded to immediate Quarantine.', reviewed_at: '2026-09-30 16:00:00' },
      { id: 3, batch_id: 3, reviewer_id: 6, decision: 'APPROVED', biological_test_result: 'NEGATIVE (CLEAR at 180 min)', chemical_indicator_result: 'CLASS 5 INTEGRATOR VERIFIED PASS', packaging_integrity_verified: 1, notes: 'Reprocessed load in Autoclave #2 passed rigorous validation. Physical graph verified. Chemical & biological negative. Kit KIT-0012 released to Available inventory.', reviewed_at: '2026-10-01 09:00:00' },
    ];
    this.nextIds.qc_reviews = 4;

    // Quarantine Records
    this.quarantine_records = [
      { id: 1, kit_id: 12, batch_id: 2, attempt_number: 1, quarantined_by_user_id: 6, quarantine_reason: 'Sterilization Batch BAT-2026-0002 failed biological indicator verification.', status: 'SENT_FOR_REPROCESSING', quarantined_at: '2026-09-30 16:05:00', resolved_at: '2026-10-01 05:00:00', resolved_by_user_id: 6, resolution_notes: 'Released from Quarantine for complete reprocessing under Attempt #2.' },
      { id: 2, kit_id: 17, batch_id: 2, attempt_number: 1, quarantined_by_user_id: 6, quarantine_reason: 'Biological indicator failure on Batch BAT-2026-0002 and moisture detected on outer wrap.', status: 'ACTIVE_QUARANTINE', quarantined_at: '2026-09-30 16:05:00', resolved_at: null, resolved_by_user_id: null, resolution_notes: null },
      { id: 3, kit_id: 18, batch_id: null, attempt_number: 1, quarantined_by_user_id: 7, quarantine_reason: 'VHP chamber cycle pressure anomaly during packaging exposure.', status: 'ACTIVE_QUARANTINE', quarantined_at: '2026-09-30 17:30:00', resolved_at: null, resolved_by_user_id: null, resolution_notes: null },
    ];
    this.nextIds.quarantine_records = 4;

    // Requests
    this.requests = [
      { id: 1, request_code: 'REQ-2026-0001', department_id: 1, requested_by_user_id: 2, kit_type_id: 1, quantity: 1, priority: 'URGENT', clinical_reason: 'Emergency bowel resection scheduled for 11:30 in OR Suite 3. Patient presenting with acute peritonitis.', status: 'FULFILLED', required_by_date: '2026-10-01 11:00:00', created_at: '2026-10-01 08:30:00', approved_at: '2026-10-01 08:45:00', completed_at: '2026-10-01 10:50:00' },
      { id: 2, request_code: 'REQ-2026-0002', department_id: 2, requested_by_user_id: 3, kit_type_id: 3, quantity: 1, priority: 'URGENT', clinical_reason: 'Multiple trauma inbound via EMS - high speed motor vehicle collision with chest trauma.', status: 'PENDING', required_by_date: '2026-10-01 12:30:00', created_at: '2026-10-01 09:15:00', approved_at: '2026-10-01 09:20:00', completed_at: null },
      { id: 3, request_code: 'REQ-2026-0003', department_id: 1, requested_by_user_id: 2, kit_type_id: 2, quantity: 2, priority: 'HIGH', clinical_reason: 'Elective total hip replacement revision scheduled for 13:00 tomorrow in OR Suite 5.', status: 'PENDING', required_by_date: '2026-10-02 12:00:00', created_at: '2026-10-01 09:40:00', approved_at: null, completed_at: null },
      { id: 4, request_code: 'REQ-2026-0004', department_id: 3, requested_by_user_id: 1, kit_type_id: 5, quantity: 1, priority: 'ROUTINE', clinical_reason: 'Scheduled bilateral wisdom tooth surgical impactions in Clinic Room 2.', status: 'PENDING', required_by_date: '2026-10-02 08:30:00', created_at: '2026-10-01 10:00:00', approved_at: null, completed_at: null },
      { id: 5, request_code: 'REQ-2026-0005', department_id: 1, requested_by_user_id: 2, kit_type_id: 6, quantity: 1, priority: 'HIGH', clinical_reason: 'Urgent subdural hematoma evacuation required for neuro patient in ICU Bed 4.', status: 'PENDING', required_by_date: '2026-10-01 14:00:00', created_at: '2026-10-01 10:15:00', approved_at: null, completed_at: null },
      { id: 6, request_code: 'REQ-2026-0006', department_id: 1, requested_by_user_id: 2, kit_type_id: 1, quantity: 1, priority: 'ROUTINE', clinical_reason: 'Standard elective lap cholecystectomy for OR Suite 2.', status: 'PENDING', required_by_date: '2026-10-02 10:00:00', created_at: '2026-10-01 10:30:00', approved_at: null, completed_at: null },
      { id: 7, request_code: 'REQ-2026-0007', department_id: 2, requested_by_user_id: 3, kit_type_id: 3, quantity: 1, priority: 'ROUTINE', clinical_reason: 'Replenishing standby trauma resuscitation tray stock.', status: 'PENDING', required_by_date: '2026-10-02 15:00:00', created_at: '2026-10-01 10:45:00', approved_at: null, completed_at: null },
      { id: 8, request_code: 'REQ-2026-0008', department_id: 3, requested_by_user_id: 1, kit_type_id: 5, quantity: 1, priority: 'ROUTINE', clinical_reason: 'Dental clinic afternoon maxillofacial biopsy set.', status: 'FULFILLED', required_by_date: '2026-09-22 12:00:00', created_at: '2026-09-21 16:00:00', approved_at: '2026-09-22 08:00:00', completed_at: '2026-09-22 13:10:00' },
      { id: 9, request_code: 'REQ-2026-0009', department_id: 1, requested_by_user_id: 2, kit_type_id: 4, quantity: 1, priority: 'ROUTINE', clinical_reason: 'Cardiology pacemaker generator change procedure.', status: 'PENDING', required_by_date: '2026-10-03 09:00:00', created_at: '2026-10-01 11:00:00', approved_at: null, completed_at: null },
      { id: 10, request_code: 'REQ-2026-0010', department_id: 2, requested_by_user_id: 3, kit_type_id: 3, quantity: 2, priority: 'HIGH', clinical_reason: 'Weekend mass casualty surge reserve restock.', status: 'PENDING', required_by_date: '2026-10-03 18:00:00', created_at: '2026-10-01 11:20:00', approved_at: null, completed_at: null },
    ];
    this.nextIds.requests = 11;

    // Request Priority History
    this.request_priority_history = [
      { id: 1, request_id: 1, changed_by_user_id: 2, previous_priority: 'ROUTINE', new_priority: 'URGENT', justification: 'Surgeon notified that patient vitals are deteriorating rapidly with free air under diaphragm; moved case into OR 3.', created_at: '2026-10-01 08:35:00' },
      { id: 2, request_id: 2, changed_by_user_id: 3, previous_priority: 'ROUTINE', new_priority: 'URGENT', justification: 'County EMS dispatch radioed severe multi-trauma en route with ETA 15 minutes; bilateral tension pneumothorax.', created_at: '2026-10-01 09:18:00' },
    ];
    this.nextIds.request_priority_history = 3;

    // Dispatches
    this.dispatches = [
      { id: 1, dispatch_code: 'DSP-2026-0001', request_id: 1, kit_id: 12, dispatched_by_user_id: 6, recipient_department_id: 1, status: 'DISPATCHED', transport_case_id: 'CASE-RED-SECURE-09', dispatch_notes: 'Dispatched for Urgent Peritonitis surgery. Reprocessed kit KIT-0012 with Attempt #2 pass. Seal tag #88412.', dispatched_at: '2026-10-01 10:48:00' },
      { id: 2, dispatch_code: 'DSP-2026-0002', request_id: 8, kit_id: 20, dispatched_by_user_id: 7, recipient_department_id: 3, status: 'RECEIVED', transport_case_id: 'CASE-BLUE-MED-04', dispatch_notes: 'Delivered to Dental Clinic receptionist. Biological indicator card confirmed negative.', dispatched_at: '2026-09-22 12:45:00' },
    ];
    this.nextIds.dispatches = 3;

    // Receipts
    this.receipts = [
      { id: 1, dispatch_id: 2, kit_id: 20, received_by_user_id: 1, recipient_department_id: 3, packaging_intact: 1, indicator_color_verified: 1, condition_notes: 'Verified pouch sterile seal unbroken. External tape turned dark brown. Received in excellent condition.', received_at: '2026-09-22 13:05:00' },
    ];
    this.nextIds.receipts = 2;

    // Audit Events
    this.audit_events = [
      { id: 1, actor_user_id: 1, actor_name: 'Dr. Evelyn Vance', actor_role: 'ADMINISTRATOR', entity_type: 'SYSTEM', entity_id: 'SYS-001', action: 'SYSTEM_INITIALIZED', previous_state: null, new_state: 'OPERATIONAL', metadata_json: JSON.stringify({ version: '1.0.0', environment: 'production' }), created_at: '2026-09-29 08:00:00' },
      { id: 2, actor_user_id: 4, actor_name: 'Kimberley Taylor', actor_role: 'REPROCESSING_OPERATOR', entity_type: 'BATCH', entity_id: 'BAT-2026-0001', action: 'BATCH_CREATED', previous_state: null, new_state: 'IN_PROGRESS', metadata_json: JSON.stringify({ sterilizer: 'Autoclave Unit #1', temp: 134.0 }), created_at: '2026-09-30 06:00:00' },
      { id: 3, actor_user_id: 4, actor_name: 'Kimberley Taylor', actor_role: 'REPROCESSING_OPERATOR', entity_type: 'BATCH', entity_id: 'BAT-2026-0001', action: 'BATCH_COMPLETED', previous_state: 'IN_PROGRESS', new_state: 'COMPLETED', metadata_json: JSON.stringify({ duration_minutes: 75 }), created_at: '2026-09-30 07:15:00' },
      { id: 4, actor_user_id: 6, actor_name: 'Sarah Chen', actor_role: 'QUALITY_COORDINATOR', entity_type: 'BATCH', entity_id: 'BAT-2026-0001', action: 'QC_APPROVED', previous_state: 'COMPLETED', new_state: 'APPROVED', metadata_json: JSON.stringify({ biological_test: 'NEGATIVE' }), created_at: '2026-09-30 08:00:00' },
      { id: 5, actor_user_id: 5, actor_name: 'David Chen', actor_role: 'REPROCESSING_OPERATOR', entity_type: 'BATCH', entity_id: 'BAT-2026-0002', action: 'BATCH_CREATED', previous_state: null, new_state: 'IN_PROGRESS', metadata_json: JSON.stringify({ kits: ['KIT-0012', 'KIT-0017'] }), created_at: '2026-09-30 14:00:00' },
      { id: 6, actor_user_id: 5, actor_name: 'David Chen', actor_role: 'REPROCESSING_OPERATOR', entity_type: 'BATCH', entity_id: 'BAT-2026-0002', action: 'BATCH_FAILED', previous_state: 'IN_PROGRESS', new_state: 'FAILED', metadata_json: JSON.stringify({ reason: 'Biological spore failure' }), created_at: '2026-09-30 15:20:00' },
      { id: 7, actor_user_id: 6, actor_name: 'Sarah Chen', actor_role: 'QUALITY_COORDINATOR', entity_type: 'QC_REVIEW', entity_id: 'QC-2', action: 'QC_REJECTED', previous_state: 'PENDING', new_state: 'REJECTED', metadata_json: JSON.stringify({ batch: 'BAT-2026-0002', quarantined_count: 2 }), created_at: '2026-09-30 16:00:00' },
      { id: 8, actor_user_id: 6, actor_name: 'Sarah Chen', actor_role: 'QUALITY_COORDINATOR', entity_type: 'KIT', entity_id: 'KIT-0012', action: 'KIT_QUARANTINED', previous_state: 'PROCESSING', new_state: 'QUARANTINED', metadata_json: JSON.stringify({ attempt_number: 1, reason: 'Batch BAT-2026-0002 failed biological indicator' }), created_at: '2026-09-30 16:05:00' },
      { id: 9, actor_user_id: 6, actor_name: 'Sarah Chen', actor_role: 'QUALITY_COORDINATOR', entity_type: 'KIT', entity_id: 'KIT-0012', action: 'REPROCESSING_AUTHORIZED', previous_state: 'QUARANTINED', new_state: 'RECEIVED', metadata_json: JSON.stringify({ new_attempt_number: 2 }), created_at: '2026-10-01 05:00:00' },
      { id: 10, actor_user_id: 4, actor_name: 'Kimberley Taylor', actor_role: 'REPROCESSING_OPERATOR', entity_type: 'KIT', entity_id: 'KIT-0012', action: 'KIT_CLEANING_COMPLETED', previous_state: 'RECEIVED', new_state: 'INSPECTION', metadata_json: JSON.stringify({ attempt_number: 2 }), created_at: '2026-10-01 05:35:00' },
      { id: 11, actor_user_id: 4, actor_name: 'Kimberley Taylor', actor_role: 'REPROCESSING_OPERATOR', entity_type: 'KIT', entity_id: 'KIT-0012', action: 'KIT_INSPECTION_COMPLETED', previous_state: 'INSPECTION', new_state: 'PACKING', metadata_json: JSON.stringify({ attempt_number: 2, defects_found: false }), created_at: '2026-10-01 06:05:00' },
      { id: 12, actor_user_id: 4, actor_name: 'Kimberley Taylor', actor_role: 'REPROCESSING_OPERATOR', entity_type: 'KIT', entity_id: 'KIT-0012', action: 'KIT_PACKING_COMPLETED', previous_state: 'PACKING', new_state: 'PROCESSING', metadata_json: JSON.stringify({ attempt_number: 2, batch: 'BAT-2026-0003' }), created_at: '2026-10-01 06:40:00' },
      { id: 13, actor_user_id: 6, actor_name: 'Sarah Chen', actor_role: 'QUALITY_COORDINATOR', entity_type: 'BATCH', entity_id: 'BAT-2026-0003', action: 'QC_APPROVED', previous_state: 'COMPLETED', new_state: 'APPROVED', metadata_json: JSON.stringify({ biological_test: 'NEGATIVE', chemical: 'PASS' }), created_at: '2026-10-01 09:00:00' },
      { id: 14, actor_user_id: 6, actor_name: 'Sarah Chen', actor_role: 'QUALITY_COORDINATOR', entity_type: 'KIT', entity_id: 'KIT-0012', action: 'QC_APPROVED', previous_state: 'AWAITING_QC', new_state: 'AVAILABLE', metadata_json: JSON.stringify({ attempt_number: 2, approved_by: 'Sarah Chen' }), created_at: '2026-10-01 09:05:00' },
      { id: 15, actor_user_id: 2, actor_name: 'Nurse Marcus Brody', actor_role: 'DEPARTMENT_STAFF', entity_type: 'REQUEST', entity_id: 'REQ-2026-0001', action: 'REQUEST_CREATED', previous_state: null, new_state: 'PENDING', metadata_json: JSON.stringify({ priority: 'ROUTINE', kit_type: 'Major General Laparotomy' }), created_at: '2026-10-01 08:30:00' },
      { id: 16, actor_user_id: 2, actor_name: 'Nurse Marcus Brody', actor_role: 'DEPARTMENT_STAFF', entity_type: 'REQUEST', entity_id: 'REQ-2026-0001', action: 'PRIORITY_ESCALATED', previous_state: 'ROUTINE', new_state: 'URGENT', metadata_json: JSON.stringify({ justification: 'Emergency bowel resection scheduled in OR 3' }), created_at: '2026-10-01 08:35:00' },
      { id: 17, actor_user_id: 6, actor_name: 'Sarah Chen', actor_role: 'QUALITY_COORDINATOR', entity_type: 'DISPATCH', entity_id: 'DSP-2026-0001', action: 'KIT_DISPATCHED', previous_state: 'AVAILABLE', new_state: 'DISPATCHED', metadata_json: JSON.stringify({ kit_code: 'KIT-0012', request_code: 'REQ-2026-0001', department: 'SURG' }), created_at: '2026-10-01 10:48:00' },
    ];
    this.nextIds.audit_events = 18;

    this.isInitialized = true;
  }
}

// -------------------------------------------------------------
// Database Connector & Query Engine
// -------------------------------------------------------------
class DatabaseEngine {
  public store: RelationalMemoryStore;
  private sqlite: DatabaseSync | null = null;
  public databasePath = '';

  constructor() {
    this.store = new RelationalMemoryStore();
  }

  async init() {
    this.sqlite?.close();
    this.databasePath = path.resolve(process.env.DATABASE_PATH || '.data/steritrack.sqlite');
    mkdirSync(path.dirname(this.databasePath), { recursive: true });
    this.sqlite = new DatabaseSync(this.databasePath, { timeout: 5000 });
    this.sqlite.exec(`PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS store_rows (
        entity TEXT NOT NULL, id INTEGER NOT NULL, payload TEXT NOT NULL,
        PRIMARY KEY (entity, id)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS store_meta (name TEXT PRIMARY KEY, payload TEXT NOT NULL) STRICT;
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, csrf_token TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);`);
    const prior = this.sqlite.prepare('SELECT payload FROM store_meta WHERE name = ?').get('nextIds') as {payload: string} | undefined;
    if (prior) {
      const snapshot = this.store.snapshot();
      for (const table of Object.keys(snapshot.tables)) {
        snapshot.tables[table] = (this.sqlite.prepare('SELECT payload FROM store_rows WHERE entity = ? ORDER BY id').all(table) as {payload: string}[]).map(row => JSON.parse(row.payload));
      }
      snapshot.nextIds = JSON.parse(prior.payload);
      this.store.restore(snapshot);
      // Earlier coursework builds gave several seeded roles the same password.
      // Rotate only identical hashes; a separately changed password is retained.
      const shared = new Map<string, DbUser[]>();
      for (const user of this.store.users) {
        if (!user.password_hash) continue;
        shared.set(user.password_hash, [...(shared.get(user.password_hash) || []), user]);
      }
      const rotate = [...shared.values()].filter(group => group.length > 1).flat();
      if (rotate.length) {
        console.log('One-time role credential separation for accounts with a shared password:');
        for (const user of rotate) {
          const password = randomBytes(18).toString('base64url');
          user.password_hash = bcrypt.hashSync(password, 12);
          this.deleteSessionsForUser(user.id);
          console.log(`  ${user.username}: ${password}`);
        }
        this.persist();
        console.log('Save these passwords now. Existing sessions for rotated accounts were revoked.');
      }
    } else {
      console.log('First-run account credentials (each account has its own password):');
      for (const user of this.store.users) {
        const password = user.username === 'admin' && process.env.INITIAL_PASSWORD
          ? process.env.INITIAL_PASSWORD
          : randomBytes(18).toString('base64url');
        user.password_hash = bcrypt.hashSync(password, 12);
        console.log(`  ${user.username}: ${password}`);
      }
      this.persist();
      console.log('Save these passwords now. They are shown only on first run.');
    }
    console.log(`SQLite database ready at ${this.databasePath}`);
  }

  persist() {
    if (!this.sqlite) return;
    const snapshot = this.store.snapshot();
    this.sqlite.exec('BEGIN IMMEDIATE');
    try {
      const insert = this.sqlite.prepare('INSERT INTO store_rows(entity,id,payload) VALUES(?,?,?)');
      for (const [name, rows] of Object.entries(snapshot.tables)) {
        this.sqlite.prepare('DELETE FROM store_rows WHERE entity = ?').run(name);
        for (const row of rows as Array<{id:number}>) insert.run(name, row.id, JSON.stringify(row));
      }
      this.sqlite.prepare('INSERT INTO store_meta(name,payload) VALUES(?,?) ON CONFLICT(name) DO UPDATE SET payload=excluded.payload').run('nextIds',JSON.stringify(snapshot.nextIds));
      this.sqlite.exec('COMMIT');
    } catch (error) {
      this.sqlite.exec('ROLLBACK');
      throw error;
    }
  }

  createSession(tokenHash: string, userId: number, csrfToken: string, expiresAt: number) {
    if (!this.sqlite) throw new Error('Database is not initialized');
    this.sqlite.prepare('INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at) VALUES(?,?,?,?)').run(tokenHash,userId,csrfToken,expiresAt);
  }

  getSession(tokenHash: string): {user_id:number;csrf_token:string;expires_at:number}|undefined {
    return this.sqlite?.prepare('SELECT user_id,csrf_token,expires_at FROM sessions WHERE token_hash=?').get(tokenHash) as any;
  }

  deleteSession(tokenHash: string) { this.sqlite?.prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash); }
  deleteSessionsForUser(userId: number) { this.sqlite?.prepare('DELETE FROM sessions WHERE user_id=?').run(userId); }
  close() { this.sqlite?.close(); this.sqlite = null; }

  /**
   * Universal transaction execution helper
   */
  async transaction<T>(callback: (engine: DatabaseEngine) => Promise<T>): Promise<T> {
    const backup = this.store.snapshot();
    try { return await callback(this); }
    catch (error) { this.store.restore(backup); throw error; }
  }
}

export const db = new DatabaseEngine();
