
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db, DbUser, DbKit } from '../db/index.js';
import { authenticate, createSession, requireRoles, AuthenticatedRequest } from '../middleware/auth.js';
import { WorkflowService } from '../services/workflow.js';
import { BatchService } from '../services/batch.js';
import { QcService } from '../services/qc.js';
import { ReprocessingService } from '../services/reprocessing.js';
import { DispatchService } from '../services/dispatch.js';
import { RequestService } from '../services/request.js';
import { TraceabilityService } from '../services/traceability.js';
import { DashboardService } from '../services/dashboard.js';
import { AlertService } from '../services/alerts.js';
import { logAudit } from '../services/audit.js';

const api = Router();

api.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'SteriTrack API',
    database: 'ready (local SQLite)',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    persistence: 'SQLite file'
  });
});

const loginAttempts = new Map<string,{count:number;resetAt:number}>();
api.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required.' });
    }
    const origin = req.get('Origin');
    if (origin && new URL(origin).host !== req.get('host')) return res.status(403).json({success:false,error:'Request origin is not allowed.'});
    const key = `${req.ip}:${username.toLowerCase()}`;
    const attempt = loginAttempts.get(key);
    if (attempt && attempt.resetAt > Date.now() && attempt.count >= 5) return res.status(429).json({success:false,error:'Too many attempts. Try again later.'});
    if (attempt && attempt.resetAt <= Date.now()) loginAttempts.delete(key);

    const user = db.store.users.find(
      u => (u.username.toLowerCase() === username.toLowerCase() || u.email.toLowerCase() === username.toLowerCase()) && u.is_active === 1
    );

    const isMatch = user ? await bcrypt.compare(password, user.password_hash) : false;
    if (!isMatch || !user) {
      const current = loginAttempts.get(key);
      loginAttempts.set(key,{count:(current?.count || 0)+1,resetAt:current?.resetAt && current.resetAt>Date.now()?current.resetAt:Date.now()+15*60*1000});
      return res.status(401).json({ success: false, error: 'Invalid username or password.' });
    }
    loginAttempts.delete(key);

    user.last_login_at = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const {token,csrfToken} = createSession(user.id);
    res.cookie('steritrack_session',token,{httpOnly:true,sameSite:'lax',secure:req.secure,path:'/api',maxAge:8*60*60*1000});

    logAudit({
      actorUserId: user.id,
      actorName: user.full_name,
      actorRole: user.role_code,
      entityType: 'USER',
      entityId: user.username,
      action: 'USER_LOGIN',
      newState: 'LOGGED_IN',
    });

    return res.json({
      success: true,
      csrfToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        role: user.role_code,
        departmentId: user.department_id,
        badgeNumber: user.badge_number,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

api.get('/auth/me', authenticate, (req: AuthenticatedRequest, res: Response) => {
  return res.json({ success: true, user: req.user, csrfToken: db.getSession(req.sessionTokenHash!)?.csrf_token });
});

api.post('/auth/logout', authenticate, (req: AuthenticatedRequest, res: Response) => {
  if (req.user) {
    logAudit({
      actor: req.user,
      entityType: 'USER',
      entityId: req.user.username,
      action: 'USER_LOGOUT',
    });
  }
  db.deleteSession(req.sessionTokenHash!);
  res.clearCookie('steritrack_session',{path:'/api'});
  return res.json({ success: true, message: 'Logged out successfully.' });
});

// A single, deny-by-default role policy protects every business endpoint. Navigation
// is only a convenience; these checks also apply to direct HTTP requests.
const A = 'ADMINISTRATOR', D = 'DEPARTMENT_STAFF', O = 'REPROCESSING_OPERATOR', Q = 'QUALITY_COORDINATOR';
const accessRules: Array<[string, RegExp, readonly string[]]> = [
  ['GET', /^\/(dashboard|alerts|departments|kit-types)$/, [A,D,O,Q]],
  ['POST', /^\/users\/me\/password$/, [A,D,O,Q]],
  ['GET', /^\/kits(?:\/[^/]+(?:\/trace)?)?$/, [D,O,Q]],
  ['POST', /^\/kits$/, [Q]],
  ['GET', /^\/processing\/queues$/, [O]],
  ['POST', /^\/processing\/[^/]+\/transition$/, [O]],
  ['POST', /^\/processing\/[^/]+\/return$/, [D]],
  ['GET', /^\/batches(?:\/[^/]+)?$/, [O,Q]],
  ['POST', /^\/batches(?:\/[^/]+\/(?:complete|fail))?$/, [O]],
  ['GET', /^\/qc\/pending$/, [Q]],
  ['POST', /^\/qc\/[^/]+\/review$/, [Q]],
  ['GET', /^\/quarantine$/, [O,Q]],
  ['POST', /^\/quarantine\/[^/]+\/reprocess$/, [Q]],
  ['GET', /^\/requests(?:\/[^/]+\/priority-history)?$/, [D,Q]],
  ['POST', /^\/requests$/, [D,Q]],
  ['PUT', /^\/requests\/[^/]+\/priority$/, [Q]],
  ['GET', /^\/dispatch\/eligible$/, [Q]],
  ['GET', /^\/dispatch\/history$/, [D,Q]],
  ['POST', /^\/dispatch$/, [Q]],
  ['POST', /^\/receipts\/confirm$/, [D]],
  ['GET', /^\/inventory\/summary$/, [D,Q]],
  ['GET', /^\/(audit|reports\/[^/]+)$/, [A,Q]],
  ['GET', /^\/users$/, [A]],
  ['POST', /^\/users$/, [A]],
  ['PUT', /^\/users\/[^/]+\/toggle-active$/, [A]],
];
api.use((req: AuthenticatedRequest, res: Response, next) => {
  const rule = accessRules.find(([method, pattern]) => method === req.method && pattern.test(req.path));
  if (!rule) return next();
  return authenticate(req, res, () => {
    if (!req.user || !rule[2].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Your role cannot access this function.', code: 'FORBIDDEN' });
    }
    next();
  });
});

api.get('/dashboard', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = DashboardService.getMetricsForUser(req.user!);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

api.get('/alerts', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const alerts = req.user?.role === 'QUALITY_COORDINATOR' ? AlertService.getActiveAlerts() : [];
    res.json({ success: true, data: alerts });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

api.get('/kits', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, typeId, deptId, search, page = '1', limit = '50' } = req.query;

    let kits = [...db.store.kits];

    // Department staff see available stock and kits assigned to their department.
    if (req.user?.role === 'DEPARTMENT_STAFF' && req.user.departmentId) {
      kits = kits.filter(k => k.department_owner_id === req.user?.departmentId || k.current_status === 'AVAILABLE');
      if (req.query.scope === 'own') kits = kits.filter(k => k.department_owner_id === req.user?.departmentId);
    }

    if (status) {
      kits = kits.filter(k => k.current_status === status);
    }
    if (typeId) {
      kits = kits.filter(k => k.kit_type_id === Number(typeId));
    }
    if (deptId) {
      kits = kits.filter(k => k.department_owner_id === Number(deptId));
    }
    if (search) {
      const q = String(search).toLowerCase();
      kits = kits.filter(
        k => k.kit_code.toLowerCase().includes(q) || k.kit_name.toLowerCase().includes(q) || (k.notes && k.notes.toLowerCase().includes(q))
      );
    }

    const enriched = kits.map(k => {
      const type = db.store.kit_types.find(kt => kt.id === k.kit_type_id);
      const dept = db.store.departments.find(d => d.id === k.department_owner_id);
      return {
        ...k,
        typeName: type ? type.name : 'Unknown Type',
        typeCategory: type ? type.category : 'General',
        ownerDepartmentName: dept ? dept.name : 'Unknown Department',
        ownerDepartmentCode: dept ? dept.code : 'DEPT',
      };
    });

    const p = parseInt(page as string, 10);
    const l = parseInt(limit as string, 10);
    const paginated = enriched.slice((p - 1) * l, p * l);

    res.json({
      success: true,
      data: paginated,
      total: enriched.length,
      page: p,
      limit: l,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

api.get('/kits/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const kit = db.store.kits.find(k => k.id === Number(req.params.id) || k.kit_code === req.params.id);
  if (!kit) return res.status(404).json({ success: false, error: 'Kit not found' });
  if (req.user?.role === 'DEPARTMENT_STAFF' && kit.department_owner_id !== req.user.departmentId && kit.current_status !== 'AVAILABLE') return res.status(403).json({success:false,error:'Kit is outside your department.'});
  const type = db.store.kit_types.find(kt => kt.id === kit.kit_type_id);
  const dept = db.store.departments.find(d => d.id === kit.department_owner_id);
  res.json({
    success: true,
    data: {
      ...kit,
      typeName: type ? type.name : '',
      ownerDepartmentName: dept ? dept.name : '',
    },
  });
});

api.get('/kits/:id/trace', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const kit = db.store.kits.find(k => k.id === Number(req.params.id) || k.kit_code === req.params.id);
    if (req.user?.role === 'DEPARTMENT_STAFF' && kit && kit.department_owner_id !== req.user.departmentId && kit.current_status !== 'AVAILABLE') return res.status(403).json({success:false,error:'Kit is outside your department.'});
    const trace = await TraceabilityService.getKitTraceability(req.params.id);
    res.json({ success: true, data: trace });
  } catch (err: any) {
    res.status(404).json({ success: false, error: err.message });
  }
});

// Create new kit (Admin / Coordinator)
api.post('/kits', authenticate, requireRoles('QUALITY_COORDINATOR'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { kitCode, kitName, kitTypeId, departmentOwnerId, notes } = req.body;
    if (typeof kitCode !== 'string' || !/^[A-Z0-9-]{3,32}$/i.test(kitCode.trim()) || typeof kitName !== 'string' || kitName.trim().length < 3 || !Number.isInteger(Number(kitTypeId)) || !db.store.kit_types.some(t => t.id === Number(kitTypeId)) || !Number.isInteger(Number(departmentOwnerId)) || !db.store.departments.some(d => d.id === Number(departmentOwnerId) && d.is_active === 1)) {
      return res.status(400).json({ success: false, error: 'Provide a valid kit code, name, kit type and active owner department.' });
    }

    if (db.store.kits.some(k => k.kit_code.toLowerCase() === kitCode.toLowerCase())) {
      return res.status(400).json({ success: false, error: `Kit code "${kitCode}" already exists.` });
    }

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const newKit: DbKit = {
      id: db.store.getNextId('kits'),
      kit_code: kitCode.toUpperCase().trim(),
      kit_name: kitName.trim(),
      kit_type_id: Number(kitTypeId),
      department_owner_id: Number(departmentOwnerId),
      current_status: 'RETURNED',
      current_location: 'Receiving area',
      processing_attempt_number: 1,
      expiration_date: null,
      last_processed_at: null,
      total_cycles_count: 0,
      notes: notes || 'Registered into hospital inventory',
      created_at: now,
      updated_at: now,
    };

    db.store.kits.push(newKit);

    logAudit({
      actor: req.user,
      entityType: 'KIT',
      entityId: newKit.kit_code,
      action: 'KIT_REGISTERED',
      newState: 'RETURNED',
    });

    res.status(201).json({ success: true, data: newKit });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

api.get('/processing/queues', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const enrich = (kits: DbKit[]) =>
      kits.map(k => ({
        ...k,
        typeName: db.store.kit_types.find(kt => kt.id === k.kit_type_id)?.name,
        ownerDept: db.store.departments.find(d => d.id === k.department_owner_id)?.code,
      }));

    res.json({
      success: true,
      data: {
        returned: enrich(db.store.kits.filter(k => k.current_status === 'RETURNED')),
        received: enrich(db.store.kits.filter(k => k.current_status === 'RECEIVED')),
        cleaning: enrich(db.store.kits.filter(k => k.current_status === 'CLEANING')),
        inspection: enrich(db.store.kits.filter(k => k.current_status === 'INSPECTION')),
        packing: enrich(db.store.kits.filter(k => k.current_status === 'PACKING')),
        awaitingQc: enrich(db.store.kits.filter(k => k.current_status === 'AWAITING_QC')),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

api.post('/processing/:kitId/transition', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { targetStatus, notes, location, failureReason } = req.body;
    if (!targetStatus) {
      return res.status(400).json({ success: false, error: 'targetStatus is required.' });
    }

    const result = await WorkflowService.transitionKit(
      Number(req.params.kitId),
      targetStatus,
      req.user!,
      { notes, location, failureReason }
    );

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Mark kit returned from clinical floor
api.post('/processing/:kitId/return', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { notes } = req.body;
    const result = await WorkflowService.transitionKit(
      Number(req.params.kitId),
      'RETURNED',
      req.user!,
      { notes: notes || 'Returned contaminated from procedure' }
    );
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

api.get('/batches', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const batches = [...db.store.batches].sort((a, b) => b.id - a.id);
    const enriched = batches.map(b => {
      const operator = db.store.users.find(u => u.id === b.operator_id);
      const qcReview = db.store.qc_reviews.find(q => q.batch_id === b.id);
      const reviewer = qcReview ? db.store.users.find(u => u.id === qcReview.reviewer_id) : null;
      const linkedKitsCount = db.store.batch_kits.filter(bk => bk.batch_id === b.id).length;

      return {
        ...b,
        operatorName: operator ? operator.full_name : 'Staff Tech',
        qcDecision: qcReview ? qcReview.decision : 'Awaiting Review',
        qcReviewerName: reviewer ? reviewer.full_name : null,
        kitCount: linkedKitsCount,
      };
    });

    res.json({ success: true, data: enriched });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

api.get('/batches/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const batch = db.store.batches.find(b => b.id === Number(req.params.id));
  if (!batch) return res.status(404).json({ success: false, error: 'Batch not found' });

  const operator = db.store.users.find(u => u.id === batch.operator_id);
  const qcReview = db.store.qc_reviews.find(q => q.batch_id === batch.id);
  const reviewer = qcReview ? db.store.users.find(u => u.id === qcReview.reviewer_id) : null;

  const linkedKits = db.store.batch_kits
    .filter(bk => bk.batch_id === batch.id)
    .map(bk => {
      const kit = db.store.kits.find(k => k.id === bk.kit_id);
      const type = kit ? db.store.kit_types.find(kt => kt.id === kit.kit_type_id) : null;
      return {
        ...kit,
        typeName: type ? type.name : '',
        attemptNumber: bk.attempt_number,
      };
    });

  res.json({
    success: true,
    data: {
      ...batch,
      operatorName: operator ? operator.full_name : 'Staff Tech',
      qcReview,
      qcReviewerName: reviewer ? reviewer.full_name : null,
      kits: linkedKits,
    },
  });
});

api.post('/batches', authenticate, requireRoles('REPROCESSING_OPERATOR'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sterilizerUnitId, processingMethod, targetTemperatureC, targetPressurePsi, exposureTimeMinutes, kitIds, notes } = req.body;
    const batch = await BatchService.createBatch(
      {
        sterilizerUnitId,
        processingMethod,
        targetTemperatureC,
        targetPressurePsi,
        exposureTimeMinutes,
        kitIds,
        notes,
      },
      req.user!
    );
    res.status(201).json({ success: true, data: batch });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

api.post('/batches/:id/complete', authenticate, requireRoles('REPROCESSING_OPERATOR'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { physicalPassed, chemicalPassed, notes } = req.body;
    const batch = await BatchService.completeBatch(
      Number(req.params.id),
      req.user!,
      { physicalPassed, chemicalPassed, notes }
    );
    res.json({ success: true, data: batch });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

api.post('/batches/:id/fail', authenticate, requireRoles('REPROCESSING_OPERATOR'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, error: 'Failure reason is required.' });
    const batch = await BatchService.failBatch(Number(req.params.id), req.user!, reason);
    res.json({ success: true, data: batch });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

api.get('/qc/pending', authenticate, requireRoles('QUALITY_COORDINATOR'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const reviewedBatchIds = new Set(db.store.qc_reviews.map(q => q.batch_id));
    const pendingBatches = db.store.batches
      .filter(b => b.status === 'COMPLETED' && !reviewedBatchIds.has(b.id))
      .map(b => {
        const operator = db.store.users.find(u => u.id === b.operator_id);
        const linkedKitsCount = db.store.batch_kits.filter(bk => bk.batch_id === b.id).length;
        return {
          ...b,
          operatorName: operator ? operator.full_name : 'Staff Tech',
          kitCount: linkedKitsCount,
          isSelfRun: b.operator_id === req.user?.id, // Flag so UI can inform coordinator
        };
      });

    res.json({ success: true, data: pendingBatches });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

api.post('/qc/:batchId/review', authenticate, requireRoles('QUALITY_COORDINATOR'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { decision, biologicalTestResult, chemicalIndicatorResult, packagingIntegrityVerified, notes } = req.body;
    if (!decision || (decision !== 'APPROVED' && decision !== 'REJECTED')) {
      return res.status(400).json({ success: false, error: 'decision must be APPROVED or REJECTED.' });
    }

    const review = await QcService.submitReview(
      {
        batchId: Number(req.params.batchId),
        decision,
        biologicalTestResult,
        chemicalIndicatorResult,
        packagingIntegrityVerified,
        notes,
      },
      req.user!
    );

    res.json({ success: true, data: review });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

api.get('/quarantine', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const records = db.store.quarantine_records.map(qr => {
      const kit = db.store.kits.find(k => k.id === qr.kit_id);
      const batch = qr.batch_id ? db.store.batches.find(b => b.id === qr.batch_id) : null;
      const quarantiner = db.store.users.find(u => u.id === qr.quarantined_by_user_id);
      const resolver = qr.resolved_by_user_id ? db.store.users.find(u => u.id === qr.resolved_by_user_id) : null;

      return {
        ...qr,
        kitCode: kit ? kit.kit_code : 'KIT',
        kitName: kit ? kit.kit_name : 'Instrument Set',
        currentStatus: kit ? kit.current_status : 'QUARANTINED',
        batchCode: batch ? batch.batch_code : 'N/A',
        quarantinedByName: quarantiner ? quarantiner.full_name : 'Quality Lead',
        resolvedByName: resolver ? resolver.full_name : null,
      };
    });

    res.json({ success: true, data: records });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

api.post('/quarantine/:kitId/reprocess', authenticate, requireRoles('QUALITY_COORDINATOR'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { justification } = req.body;
    if (!justification || justification.trim().length < 5) {
      return res.status(400).json({ success: false, error: 'A clinical justification is required to authorize reprocessing.' });
    }

    const result = await ReprocessingService.startReprocessing(
      Number(req.params.kitId),
      req.user!,
      justification
    );

    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

api.get('/requests', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    let list = [...db.store.requests];

    // Department staff only see own department requests unless administrator or coordinator
    if (req.user?.role === 'DEPARTMENT_STAFF' && req.user.departmentId) {
      list = list.filter(r => r.department_id === req.user?.departmentId);
    }

    const enriched = list.map(r => {
      const dept = db.store.departments.find(d => d.id === r.department_id);
      const user = db.store.users.find(u => u.id === r.requested_by_user_id);
      const kitType = db.store.kit_types.find(kt => kt.id === r.kit_type_id);
      const priorityChanges = db.store.request_priority_history.filter(h => h.request_id === r.id);

      return {
        ...r,
        departmentName: dept ? dept.name : 'Unknown Department',
        departmentCode: dept ? dept.code : 'DEPT',
        requestedByName: user ? user.full_name : 'Clinical Staff',
        kitTypeName: kitType ? kitType.name : 'Kit Type',
        priorityChangeCount: priorityChanges.length,
      };
    });

    res.json({ success: true, data: enriched });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

api.post('/requests', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { departmentId, kitTypeId, quantity, priority, clinicalReason, requiredByDate } = req.body;
    const request = await RequestService.createRequest(
      { departmentId, kitTypeId, quantity, priority, clinicalReason, requiredByDate },
      req.user!
    );
    res.status(201).json({ success: true, data: request });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

api.put('/requests/:id/priority', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { newPriority, justification } = req.body;
    if (!newPriority || !justification) {
      return res.status(400).json({ success: false, error: 'newPriority and justification are required.' });
    }

    const updated = await RequestService.updatePriority(
      {
        requestId: Number(req.params.id),
        newPriority,
        justification,
      },
      req.user!
    );

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

api.get('/requests/:id/priority-history', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const requestRecord = db.store.requests.find(r => r.id === Number(req.params.id));
  if (!requestRecord) return res.status(404).json({success:false,error:'Request not found.'});
  if (req.user?.role === 'DEPARTMENT_STAFF' && requestRecord.department_id !== req.user.departmentId) return res.status(403).json({success:false,error:'Request is outside your department.'});
  const history = db.store.request_priority_history
    .filter(h => h.request_id === Number(req.params.id))
    .map(h => {
      const user = db.store.users.find(u => u.id === h.changed_by_user_id);
      return {
        ...h,
        changedByName: user ? user.full_name : 'Staff Member',
      };
    });
  res.json({ success: true, data: history });
});

api.get('/dispatch/eligible', authenticate, requireRoles('QUALITY_COORDINATOR'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { kitTypeId } = req.query;
    const todayStr = new Date().toISOString().split('T')[0];

    let eligible = db.store.kits.filter(k => {
      if (k.current_status !== 'AVAILABLE') return false;
      if (k.expiration_date && k.expiration_date < todayStr) return false;
      const latestAttempt = db.store.processing_attempts
        .filter(pa => pa.kit_id === k.id && pa.attempt_number === k.processing_attempt_number)
        .sort((a, b) => b.id - a.id)[0];
      return latestAttempt && latestAttempt.qc_status === 'APPROVED';
    });

    if (kitTypeId) {
      eligible = eligible.filter(k => k.kit_type_id === Number(kitTypeId));
    }

    const enriched = eligible.map(k => {
      const type = db.store.kit_types.find(kt => kt.id === k.kit_type_id);
      return {
        ...k,
        typeName: type ? type.name : '',
      };
    });

    res.json({ success: true, data: enriched });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

api.get('/dispatch/history', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const visibleDispatches = req.user?.role === 'DEPARTMENT_STAFF' ? db.store.dispatches.filter(d => d.recipient_department_id === req.user?.departmentId) : db.store.dispatches;
    const list = visibleDispatches.map(d => {
      const kit = db.store.kits.find(k => k.id === d.kit_id);
      const reqRecord = db.store.requests.find(r => r.id === d.request_id);
      const dept = db.store.departments.find(dep => dep.id === d.recipient_department_id);
      const user = db.store.users.find(u => u.id === d.dispatched_by_user_id);
      const receipt = db.store.receipts.find(rc => rc.dispatch_id === d.id);

      return {
        ...d,
        kitCode: kit ? kit.kit_code : 'KIT',
        kitName: kit ? kit.kit_name : 'Kit',
        requestCode: reqRecord ? reqRecord.request_code : 'REQ',
        recipientDepartmentName: dept ? dept.name : 'Clinical Dept',
        dispatchedByName: user ? user.full_name : 'Coordinator',
        isReceived: Boolean(receipt),
        receivedAt: receipt ? receipt.received_at : null,
      };
    });

    res.json({ success: true, data: list.sort((a, b) => b.id - a.id) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

api.post('/dispatch', authenticate, requireRoles('QUALITY_COORDINATOR'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { requestId, kitId, kitIds, transportCaseId, notes } = req.body;
    if (!requestId || (!kitId && !kitIds)) {
      return res.status(400).json({ success: false, error: 'requestId and kit IDs are required.' });
    }

    const dispatch = await DispatchService.dispatchRequest(
      { requestId: Number(requestId), kitIds: Array.isArray(kitIds) ? kitIds.map(Number) : [Number(kitId)], transportCaseId, notes },
      req.user!
    );

    res.status(201).json({ success: true, data: dispatch });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

api.post('/receipts/confirm', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dispatchId, packagingIntact, indicatorColorVerified, conditionNotes } = req.body;
    if (!dispatchId) {
      return res.status(400).json({ success: false, error: 'dispatchId is required.' });
    }

    const receipt = await DispatchService.confirmReceipt(
      {
        dispatchId: Number(dispatchId),
        packagingIntact,
        indicatorColorVerified,
        conditionNotes,
      },
      req.user!
    );

    res.status(201).json({ success: true, data: receipt });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

api.get('/inventory/summary', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];

    const byType = db.store.kit_types.map(type => {
      const typeKits = db.store.kits.filter(k => k.kit_type_id === type.id);
      const available = typeKits.filter(k => k.current_status === 'AVAILABLE').length;
      const processing = typeKits.filter(k =>
        ['RECEIVED', 'CLEANING', 'INSPECTION', 'PACKING', 'PROCESSING', 'AWAITING_QC'].includes(k.current_status)
      ).length;
      const quarantined = typeKits.filter(k => k.current_status === 'QUARANTINED').length;
      const inCirculation = typeKits.filter(k => ['DISPATCHED', 'RECEIVED_BY_DEPT'].includes(k.current_status)).length;
      const expired = typeKits.filter(k => k.expiration_date && k.expiration_date < todayStr).length;

      return {
        kitTypeId: type.id,
        kitTypeCode: type.code,
        kitTypeName: type.name,
        category: type.category,
        totalStock: typeKits.length,
        available,
        processing,
        quarantined,
        inCirculation,
        expired,
      };
    });

    res.json({ success: true, data: byType });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

api.get('/audit', authenticate, requireRoles('ADMINISTRATOR', 'QUALITY_COORDINATOR'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { entityType, entityId, actorId, action, search, limit = '100' } = req.query;

    let logs = [...db.store.audit_events];

    if (entityType) logs = logs.filter(l => l.entity_type === entityType);
    if (entityId) logs = logs.filter(l => l.entity_id.toLowerCase().includes(String(entityId).toLowerCase()));
    if (actorId) logs = logs.filter(l => l.actor_user_id === Number(actorId));
    if (action) logs = logs.filter(l => l.action.toLowerCase().includes(String(action).toLowerCase()));
    if (search) {
      const q = String(search).toLowerCase();
      logs = logs.filter(
        l =>
          l.entity_id.toLowerCase().includes(q) ||
          l.actor_name.toLowerCase().includes(q) ||
          l.action.toLowerCase().includes(q) ||
          (l.metadata_json && l.metadata_json.toLowerCase().includes(q))
      );
    }

    const l = parseInt(limit as string, 10);
    res.json({ success: true, data: logs.slice(0, l), total: logs.length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

api.get('/reports/:reportType', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reportType } = req.params;

    if (reportType === 'failed-attempts') {
      const failed = db.store.processing_attempts
        .filter(pa => pa.result === 'FAILED')
        .map(pa => {
          const kit = db.store.kits.find(k => k.id === pa.kit_id);
          const batch = pa.batch_id ? db.store.batches.find(b => b.id === pa.batch_id) : null;
          const operator = db.store.users.find(u => u.id === pa.operator_id);
          const reviewer = pa.reviewer_id ? db.store.users.find(u => u.id === pa.reviewer_id) : null;
          return {
            attemptId: pa.id,
            kitCode: kit ? kit.kit_code : 'KIT',
            kitName: kit ? kit.kit_name : 'Kit',
            attemptNumber: pa.attempt_number,
            batchCode: batch ? batch.batch_code : 'None',
            operator: operator ? operator.full_name : 'Operator',
            reviewer: reviewer ? reviewer.full_name : 'Coordinator',
            failureReason: pa.failure_reason,
            createdAt: pa.created_at,
          };
        });
      return res.json({ success: true, data: failed });
    }

    if (reportType === 'qc-activity') {
      const reviews = db.store.qc_reviews.map(q => {
        const batch = db.store.batches.find(b => b.id === q.batch_id);
        const reviewer = db.store.users.find(u => u.id === q.reviewer_id);
        return {
          reviewId: q.id,
          batchCode: batch ? batch.batch_code : 'BAT',
          reviewerName: reviewer ? reviewer.full_name : 'Sarah Chen',
          decision: q.decision,
          biologicalTest: q.biological_test_result,
          chemicalIndicator: q.chemical_indicator_result,
          reviewedAt: q.reviewed_at,
          notes: q.notes,
        };
      });
      return res.json({ success: true, data: reviews });
    }

    if (reportType === 'dispatch-fulfillment') {
      const dispatches = db.store.dispatches.map(d => {
        const kit = db.store.kits.find(k => k.id === d.kit_id);
        const reqItem = db.store.requests.find(r => r.id === d.request_id);
        const dept = db.store.departments.find(dep => dep.id === d.recipient_department_id);
        return {
          dispatchCode: d.dispatch_code,
          requestCode: reqItem ? reqItem.request_code : 'REQ',
          kitCode: kit ? kit.kit_code : 'KIT',
          department: dept ? dept.name : 'Clinical Dept',
          dispatchedAt: d.dispatched_at,
          status: d.status,
        };
      });
      return res.json({ success: true, data: dispatches });
    }

    // Default: Kit Status summary
    const kitSummary = db.store.kits.map(k => {
      const type = db.store.kit_types.find(kt => kt.id === k.kit_type_id);
      const dept = db.store.departments.find(d => d.id === k.department_owner_id);
      return {
        kitCode: k.kit_code,
        name: k.kit_name,
        type: type ? type.name : '',
        ownerDepartment: dept ? dept.name : '',
        status: k.current_status,
        location: k.current_location,
        cycles: k.total_cycles_count,
        attemptNumber: k.processing_attempt_number,
        expirationDate: k.expiration_date || 'N/A',
      };
    });

    res.json({ success: true, data: kitSummary });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

api.get('/departments', authenticate, (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: db.store.departments });
});

api.get('/kit-types', authenticate, (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: db.store.kit_types });
});

api.get('/users', authenticate, requireRoles('ADMINISTRATOR'), (req: AuthenticatedRequest, res: Response) => {
  const users = db.store.users.map(u => {
    const dept = db.store.departments.find(d => d.id === u.department_id);
    return {
      id: u.id,
      username: u.username,
      email: u.email,
      fullName: u.full_name,
      role: u.role_code,
      departmentId: u.department_id,
      departmentName: dept ? dept.name : 'Hospital-wide',
      badgeNumber: u.badge_number,
      isActive: u.is_active === 1,
      lastLoginAt: u.last_login_at,
      createdAt: u.created_at,
    };
  });
  res.json({ success: true, data: users });
});

api.post('/users', authenticate, requireRoles('ADMINISTRATOR'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { username, email, fullName, role, departmentId, password } = req.body;
    if (typeof username !== 'string' || !/^[a-z][a-z0-9_.-]{2,39}$/i.test(username) || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof fullName !== 'string' || fullName.trim().length < 3 || typeof password !== 'string' || password.length < 12) return res.status(400).json({success:false,error:'Provide a valid username, email, full name and password of at least 12 characters.'});
    if (!['ADMINISTRATOR','DEPARTMENT_STAFF','REPROCESSING_OPERATOR','QUALITY_COORDINATOR'].includes(role)) return res.status(400).json({success:false,error:'Invalid role.'});
    const dept = db.store.departments.find(d => d.id === Number(departmentId) && d.is_active === 1);
    if (!dept) return res.status(400).json({success:false,error:'Choose an active department.'});
    if (db.store.users.some(u => u.username.toLowerCase() === username.toLowerCase() || u.email.toLowerCase() === email.toLowerCase())) return res.status(409).json({success:false,error:'Username or email already exists.'});
    const now = new Date().toISOString();
    const newUser: DbUser = {id:db.store.getNextId('users'),username:username.trim().toLowerCase(),email:email.trim().toLowerCase(),full_name:fullName.trim(),password_hash:await bcrypt.hash(password,12),role_code:role,department_id:dept.id,badge_number:null,is_active:1,last_login_at:null,created_at:now,updated_at:now};
    db.store.users.push(newUser);
    logAudit({actor:req.user,entityType:'USER',entityId:newUser.username,action:'USER_CREATED',newState:'ACTIVE'});
    return res.status(201).json({success:true,user:{id:newUser.id,username:newUser.username}});
  } catch { return res.status(500).json({success:false,error:'Account could not be created.'}); }
});

api.post('/users/me/password', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const user = db.store.users.find(u => u.id === req.user?.id);
  const { currentPassword, newPassword } = req.body;
  if (!user || typeof currentPassword !== 'string' || typeof newPassword !== 'string' || newPassword.length < 12) return res.status(400).json({success:false,error:'Provide your current password and a new password of at least 12 characters.'});
  if (!await bcrypt.compare(currentPassword,user.password_hash)) return res.status(403).json({success:false,error:'Current password is incorrect.'});
  user.password_hash = await bcrypt.hash(newPassword,12);
  user.updated_at = new Date().toISOString();
  logAudit({actor:req.user,entityType:'USER',entityId:user.username,action:'PASSWORD_CHANGED'});
  db.deleteSessionsForUser(user.id);
  res.clearCookie('steritrack_session',{path:'/api'});
  return res.json({success:true,message:'Password changed. Sign in again.'});
});

api.put('/users/:id/toggle-active', authenticate, requireRoles('ADMINISTRATOR'), (req: AuthenticatedRequest, res: Response) => {
  const user = db.store.users.find(u => u.id === Number(req.params.id));
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  if (user.id === req.user?.id) {
    return res.status(400).json({ success: false, error: 'Administrators cannot deactivate their own active account.' });
  }

  user.is_active = user.is_active === 1 ? 0 : 1;
  logAudit({
    actor: req.user,
    entityType: 'USER',
    entityId: user.username,
    action: user.is_active === 1 ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
    newState: user.is_active === 1 ? 'ACTIVE' : 'DEACTIVATED',
  });

  res.json({ success: true, user: { id: user.id, username: user.username, isActive: user.is_active === 1 } });
});

export default api;
