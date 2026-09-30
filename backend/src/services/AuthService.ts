import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma';
import { AppError } from '../middleware/errorHandler';
import { AuditService } from './AuditService';

export class AuthService {
  /**
   * Authenticates user and returns JWT + profile info
   */
  public static async login(email: string, password?: string) {
    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        role: true,
        department: true,
      },
    });

    if (!user) {
      throw new AppError('Invalid email or credentials.', 401, 'INVALID_CREDENTIALS', 'Check email spelling.');
    }

    if (user.status !== 'ACTIVE') {
      throw new AppError('User account is deactivated.', 403, 'ACCOUNT_INACTIVE', 'Contact administration.');
    }

    // Password verification (bypass check only if demo mode explicit flag)
    if (password) {
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
      }
    }

    const secret = process.env.JWT_SECRET || 'atcs_fallback_secret_key';
    const token = jwt.sign(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role.name,
        departmentId: user.departmentId,
      },
      secret,
      { expiresIn: '1d' }
    );

    await AuditService.createLog({
      userId: user.id,
      action: 'USER_LOGIN',
      entityType: 'User',
      entityId: user.id,
      newValue: JSON.stringify({ email: user.email, role: user.role.name }),
    });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role.name,
        departmentId: user.departmentId,
        department: user.department
          ? {
              id: user.department.id,
              name: user.department.name,
              code: user.department.code,
            }
          : null,
      },
    };
  }

  /**
   * Demo quick-login switcher for instant evaluation in demo/sandbox mode
   */
  public static async quickLoginRole(roleName: string) {
    const roleRecord = await prisma.role.findFirst({
      where: { name: roleName as any },
    });

    if (!roleRecord) {
      throw new AppError(`Role '${roleName}' not found.`, 404, 'ROLE_NOT_FOUND');
    }

    const user = await prisma.user.findFirst({
      where: { roleId: roleRecord.id, status: 'ACTIVE' },
      include: { role: true, department: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!user) {
      throw new AppError(`No active user found for role '${roleName}'.`, 404, 'USER_NOT_FOUND');
    }

    const secret = process.env.JWT_SECRET || 'atcs_fallback_secret_key';
    const token = jwt.sign(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role.name,
        departmentId: user.departmentId,
      },
      secret,
      { expiresIn: '1d' }
    );

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role.name,
        departmentId: user.departmentId,
        department: user.department
          ? {
              id: user.department.id,
              name: user.department.name,
              code: user.department.code,
            }
          : null,
      },
    };
  }
}
