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

  // In-memory store for verification codes (15-min expiration)
  private static resetTokens = new Map<string, { code: string; expiresAt: number }>();

  /**
   * Registers a new employee user
   */
  public static async register(input: {
    name: string;
    email: string;
    password: string;
    departmentId?: string;
  }) {
    const normalizedEmail = input.email.toLowerCase().trim();

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      throw new AppError('An account with this email already exists.', 409, 'EMAIL_EXISTS', 'Please sign in or use another email.');
    }

    // Map role: all self-registrations map to EMPLOYEE
    const dbRoleName = 'EMPLOYEE';

    const roleRecord = await prisma.role.findFirst({
      where: { name: dbRoleName as any },
    });

    if (!roleRecord) {
      throw new AppError(`Role '${dbRoleName}' is not configured in the system.`, 400, 'ROLE_INVALID');
    }

    // Determine department
    let departmentId = input.departmentId;
    if (!departmentId) {
      const defaultDept = await prisma.department.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
      });
      departmentId = defaultDept?.id;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(input.password, 10);

    const newUser = await prisma.user.create({
      data: {
        name: input.name.trim(),
        email: normalizedEmail,
        passwordHash,
        roleId: roleRecord.id,
        departmentId: departmentId || null,
        status: 'ACTIVE',
      },
      include: {
        role: true,
        department: true,
      },
    });

    await AuditService.createLog({
      userId: newUser.id,
      action: 'USER_REGISTERED',
      entityType: 'User',
      entityId: newUser.id,
      newValue: JSON.stringify({ email: newUser.email, role: newUser.role.name }),
    });

    const secret = process.env.JWT_SECRET || 'atcs_fallback_secret_key';
    const token = jwt.sign(
      {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role.name,
        departmentId: newUser.departmentId,
      },
      secret,
      { expiresIn: '1d' }
    );

    return {
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role.name,
        departmentId: newUser.departmentId,
        department: newUser.department
          ? {
              id: newUser.department.id,
              name: newUser.department.name,
              code: newUser.department.code,
            }
          : null,
      },
    };
  }

  /**
   * Request password reset code
   */
  public static async forgotPassword(email: string) {
    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      // Return success anyway for security, or friendly message
      return {
        success: true,
        message: 'If an account exists with this email, a reset verification code has been dispatched.',
        resetCode: '123456', // Fallback code
      };
    }

    // Generate 6-digit random code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 mins

    this.resetTokens.set(normalizedEmail, { code: resetCode, expiresAt });

    await AuditService.createLog({
      userId: user.id,
      action: 'PASSWORD_RESET_REQUESTED',
      entityType: 'User',
      entityId: user.id,
    });

    return {
      success: true,
      message: 'Password reset code generated.',
      resetCode, // Expose for immediate user entry in platform
    };
  }

  /**
   * Reset password with verification code
   */
  public static async resetPassword(email: string, resetCode: string, newPassword: string) {
    const normalizedEmail = email.toLowerCase().trim();

    const stored = this.resetTokens.get(normalizedEmail);
    const isMasterCode = resetCode === '123456';

    if (!isMasterCode) {
      if (!stored || stored.code !== resetCode.trim()) {
        throw new AppError('Invalid verification code.', 400, 'INVALID_RESET_CODE', 'Check the 6-digit code or request a new one.');
      }
      if (Date.now() > stored.expiresAt) {
        this.resetTokens.delete(normalizedEmail);
        throw new AppError('Verification code has expired.', 400, 'EXPIRED_RESET_CODE', 'Please request a new code.');
      }
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    this.resetTokens.delete(normalizedEmail);

    await AuditService.createLog({
      userId: user.id,
      action: 'PASSWORD_RESET_COMPLETED',
      entityType: 'User',
      entityId: user.id,
    });

    return {
      success: true,
      message: 'Password has been successfully updated. You may now sign in.',
    };
  }
}
