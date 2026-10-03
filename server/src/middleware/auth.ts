// ==========================================================
// SteriTrack: Authentication & Role-Based Access Control
// ==========================================================

import { Request, Response, NextFunction } from 'express';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { RoleCode } from '../config/index.js';
import { db } from '../db/index.js';

export interface AuthenticatedUser {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: RoleCode;
  departmentId: number | null;
  badgeNumber: string | null;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  sessionTokenHash?: string;
}

export const sessionHash = (token: string) => createHash('sha256').update(token).digest('hex');

export function createSession(userId: number) {
  const token = randomBytes(32).toString('base64url');
  const csrfToken = randomBytes(24).toString('base64url');
  db.createSession(sessionHash(token), userId, csrfToken, Date.now() + 8 * 60 * 60 * 1000);
  return { token, csrfToken };
}

function equalSecret(left: string, right: string): boolean {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.headers.cookie?.split(';').map(item => item.trim()).find(item => item.startsWith('steritrack_session='))?.slice('steritrack_session='.length);
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return res.status(401).json({
      success: false,
      error: 'Please sign in to continue.',
      code: 'UNAUTHENTICATED',
    });
  }

  try {
    const hash = sessionHash(token);
    const session = db.getSession(hash);
    if (!session || session.expires_at <= Date.now()) {
      if (session) db.deleteSession(hash);
      return res.status(401).json({ success: false, error: 'Session expired. Please sign in again.', code: 'SESSION_EXPIRED' });
    }
    const user = db.store.users.find(u => u.id === session.user_id && u.is_active === 1);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User account is deactivated or no longer valid.',
        code: 'USER_DEACTIVATED',
      });
    }

    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.get('Origin');
      if (origin && new URL(origin).host !== req.get('host')) return res.status(403).json({success:false,error:'Request origin is not allowed.'});
      if (!equalSecret(String(req.get('X-CSRF-Token') || ''), session.csrf_token)) return res.status(403).json({success:false,error:'Request verification failed.'});
    }

    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      role: user.role_code as RoleCode,
      departmentId: user.department_id,
      badgeNumber: user.badge_number,
    };
    req.sessionTokenHash = hash;
    next();
  } catch (err: any) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired session token. Please log in again.',
      code: 'TOKEN_INVALID',
    });
  }
}

/**
 * Require one or more specific roles
 */
export function requireRoles(...allowedRoles: RoleCode[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.',
        code: 'UNAUTHENTICATED',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access Denied: Role [${req.user.role}] does not have authorization for this operation. Permitted roles: ${allowedRoles.join(', ')}.`,
        code: 'FORBIDDEN',
      });
    }

    next();
  };
}

/**
 * Enforce department isolation for department staff:
 * Cannot request or view data for another department unless authorized.
 */
export function enforceDepartmentAccess(departmentIdParamKey = 'departmentId') {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthenticated' });

    // Administrators and Quality Coordinators have hospital-wide access
    if (req.user.role === 'ADMINISTRATOR' || req.user.role === 'QUALITY_COORDINATOR' || req.user.role === 'REPROCESSING_OPERATOR') {
      return next();
    }

    // For Department Staff: check target department ID
    const targetDeptId = parseInt(
      (req.params[departmentIdParamKey] || req.body[departmentIdParamKey] || req.query[departmentIdParamKey]) as string,
      10
    );

    if (targetDeptId && req.user.departmentId && req.user.departmentId !== targetDeptId) {
      return res.status(403).json({
        success: false,
        error: 'Access Denied: Clinical staff may only create or manage records within their assigned department.',
        code: 'DEPARTMENT_MISMATCH',
      });
    }

    next();
  };
}
