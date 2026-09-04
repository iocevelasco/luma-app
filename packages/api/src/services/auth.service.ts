import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import type { AuthUserResponse, JWTPayload, ProjectRole, ProjectSummary } from '@luma/shared';
import { UserModel, type UserDocument } from '../models/User.js';
import { ProjectMemberModel } from '../models/ProjectMember.js';
import { ProjectModel } from '../models/Project.js';
import { JWTService } from './jwt.service.js';
import { badRequest, notFound, unauthorized } from '../utils/errors.js';

const BCRYPT_ROUNDS = 10;
const RESET_TTL_MS = 60 * 60 * 1000; // 1 hora
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 1 día
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

export class AuthService {
  static hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_ROUNDS);
  }

  static comparePassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  /** Token opaco de 32 bytes. Se guarda hasheado; el claro sólo va por email. */
  static generateToken(): { raw: string; hashed: string } {
    const raw = crypto.randomBytes(32).toString('hex');
    return { raw, hashed: crypto.createHash('sha256').update(raw).digest('hex') };
  }

  static hashToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  static tokenExpiry(kind: 'reset' | 'verify' | 'invite'): Date {
    const ttl = kind === 'reset' ? RESET_TTL_MS : kind === 'verify' ? VERIFY_TTL_MS : INVITE_TTL_MS;
    return new Date(Date.now() + ttl);
  }

  /** Proyectos donde la persona es miembro activo, con su rol en cada uno. */
  static async listProjects(userId: string): Promise<ProjectSummary[]> {
    const memberships = await ProjectMemberModel.find({
      user_id: new mongoose.Types.ObjectId(userId),
      status: 'active',
    }).lean();

    if (memberships.length === 0) return [];

    const projects = await ProjectModel.find({
      _id: { $in: memberships.map((m) => m.project_id) },
      archived: false,
    })
      .select({ name: 1, status: 1 })
      .lean();

    const roleByProject = new Map(memberships.map((m) => [m.project_id.toString(), m.role]));

    return projects.map((p) => ({
      id: p._id.toString(),
      name: p.name,
      status: p.status,
      role: roleByProject.get(p._id.toString()) as ProjectRole,
    }));
  }

  /**
   * Elige con qué proyecto arranca la sesión.
   *
   * El `preferred` sólo gana si la persona realmente pertenece a ese proyecto:
   * sin esa validación, el parámetro sería un selector libre de tenant. Si no
   * hay preferido válido, se usa el último visitado y, en última instancia, el
   * primero de la lista.
   */
  static resolveActiveProject(
    projects: ProjectSummary[],
    preferred?: string | null,
    lastVisited?: string | null,
  ): ProjectSummary | null {
    if (projects.length === 0) return null;
    const byPreferred = preferred ? projects.find((p) => p.id === preferred) : undefined;
    if (byPreferred) return byPreferred;
    const byLast = lastVisited ? projects.find((p) => p.id === lastVisited) : undefined;
    if (byLast) return byLast;
    return projects[0];
  }

  static async issueSession(
    user: UserDocument,
    preferredProjectId?: string | null,
  ): Promise<{ accessToken: string; refreshToken: string; user: AuthUserResponse }> {
    const projects = await this.listProjects(user._id.toString());
    const active = this.resolveActiveProject(
      projects,
      preferredProjectId,
      user.last_project_id?.toString(),
    );

    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      sub: user._id.toString(),
      email: user.email,
      roles: [user.role],
      ...(active ? { project_id: active.id, project_role: active.role } : {}),
    };

    if (active && user.last_project_id?.toString() !== active.id) {
      await UserModel.updateOne(
        { _id: user._id },
        { last_project_id: new mongoose.Types.ObjectId(active.id) },
      );
    }

    return {
      accessToken: JWTService.generateAccessToken(payload),
      refreshToken: JWTService.generateRefreshToken(payload),
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        email_verified: user.email_verified,
        project_id: active?.id ?? null,
        project_role: active?.role ?? null,
        projects,
      },
    };
  }

  static async authenticate(email: string, password: string): Promise<UserDocument> {
    const user = await UserModel.findOne({ email: email.toLowerCase() }).select('+password');

    // Se compara igual contra un hash falso cuando el usuario no existe: sin
    // esto, la diferencia de tiempo entre "no existe" y "contraseña mala"
    // permite enumerar cuentas.
    const hash = user?.password ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi';
    const ok = await this.comparePassword(password, hash);

    if (!user || !ok) throw unauthorized('Email o contraseña incorrectos', 'BAD_CREDENTIALS');
    if (!user.enabled) throw unauthorized('Tu cuenta está deshabilitada', 'ACCOUNT_DISABLED');
    if (!user.password) {
      throw unauthorized(
        'Tu cuenta todavía no tiene contraseña. Revisá el email de invitación.',
        'NO_PASSWORD_SET',
      );
    }
    return user;
  }

  static async findByHashedToken(
    field: 'resetToken' | 'emailVerificationToken' | 'invitationToken',
    rawToken: string,
  ): Promise<UserDocument> {
    const expiresField = `${field}Expires` as const;
    const user = await UserModel.findOne({ [field]: this.hashToken(rawToken) }).select(
      `+${field} +${expiresField}`,
    );
    if (!user) throw notFound('El link no es válido', 'INVALID_TOKEN');
    const expires = (user as unknown as Record<string, Date | undefined>)[expiresField];
    if (!expires || expires.getTime() < Date.now()) {
      throw badRequest('El link venció. Pedí uno nuevo.', 'EXPIRED_TOKEN');
    }
    return user;
  }
}
