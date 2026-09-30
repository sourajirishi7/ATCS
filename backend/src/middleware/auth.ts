import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { RoleType } from '../models/types';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: RoleType;
  departmentId?: string | null;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      errorCode: 'UNAUTHENTICATED',
      message: 'Authentication token missing or invalid format.',
      action: 'Please log in with valid credentials.',
    });
    return;
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET || 'atcs_fallback_secret_key';

  try {
    const decoded = jwt.verify(token, secret) as AuthUser;
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({
      success: false,
      errorCode: 'INVALID_TOKEN',
      message: 'The session token has expired or is invalid.',
      action: 'Please log in again to acquire a new authentication token.',
    });
  }
}

export function authorizeRoles(...allowedRoles: RoleType[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        errorCode: 'UNAUTHENTICATED',
        message: 'User authentication required.',
        action: 'Log in to continue.',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        errorCode: 'FORBIDDEN_ROLE',
        message: `Your role (${req.user.role}) is not authorized to perform this action.`,
        action: 'Contact your administrator for elevated permissions.',
      });
      return;
    }

    next();
  };
}

/**
 * Enforces department-level scoping.
 * Employees and Managers can only access resources within their assigned department.
 * Finance and Admin roles have cross-department access.
 */
export function scopeToDepartment(targetDepartmentIdGetter: (req: Request) => string | undefined) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, errorCode: 'UNAUTHENTICATED', message: 'Authentication required.' });
      return;
    }

    // Admins and Finance have global scope
    if (req.user.role === RoleType.ADMIN || req.user.role === RoleType.FINANCE) {
      next();
      return;
    }

    const targetDeptId = targetDepartmentIdGetter(req);
    if (targetDeptId && req.user.departmentId !== targetDeptId) {
      res.status(403).json({
        success: false,
        errorCode: 'CROSS_DEPARTMENT_FORBIDDEN',
        message: 'Access denied: You cannot view or modify financial resources of another department.',
        action: 'Switch to your assigned department or contact Finance.',
      });
      return;
    }

    next();
  };
}
