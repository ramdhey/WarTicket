import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../../lib/prisma';
import { AppError } from '../../middlewares/errorHandler';
import type { RegisterInput, LoginInput, UpdateProfileInput } from './auth.schema';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
const ACCESS_TOKEN_EXPIRY = '14d';
const REFRESH_TOKEN_EXPIRY_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  /**
   * Generate access + refresh token pair.
   */
  private generateTokenPair(payload: { userId: string; email: string; role: string }): TokenPair {
    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
    const refreshToken = crypto.randomBytes(64).toString('hex');
    return { accessToken, refreshToken };
  }

  async register(input: RegisterInput) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new AppError(409, 'Email already registered', 'EMAIL_EXISTS');

    const passwordHash = await bcrypt.hash(input.password, 10);
    const tokenPayload = { userId: '', email: input.email, role: 'USER' };

    const user = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash,
        timezone: input.timezone,
        preferences: input.preferences,
        avatarUrl: input.avatarUrl,
      },
      select: { id: true, email: true, name: true, role: true, timezone: true, preferences: true, avatarUrl: true, createdAt: true },
    });

    tokenPayload.userId = user.id;
    tokenPayload.role = user.role;
    const tokens = this.generateTokenPair(tokenPayload);

    // Store hashed refresh token
    const hashedRefresh = crypto.createHash('sha256').update(tokens.refreshToken).digest('hex');
    await prisma.user.update({ where: { id: user.id }, data: { refreshToken: hashedRefresh } });

    return { user, ...tokens };
  }

  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');

    const tokens = this.generateTokenPair({ userId: user.id, email: user.email, role: user.role });

    // Store hashed refresh token
    const hashedRefresh = crypto.createHash('sha256').update(tokens.refreshToken).digest('hex');
    await prisma.user.update({ where: { id: user.id }, data: { refreshToken: hashedRefresh } });

    return {
      user: {
        id: user.id, email: user.email, name: user.name,
        role: user.role, timezone: user.timezone, preferences: user.preferences,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
      ...tokens,
    };
  }

  /**
   * Refresh tokens — validates refresh token, returns new pair.
   */
  async refreshTokens(refreshToken: string) {
    const hashedRefresh = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const user = await prisma.user.findFirst({
      where: { refreshToken: hashedRefresh },
    });

    if (!user) {
      throw new AppError(401, 'Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
    }

    // Generate new pair (rotate refresh token)
    const tokens = this.generateTokenPair({ userId: user.id, email: user.email, role: user.role });

    const newHashedRefresh = crypto.createHash('sha256').update(tokens.refreshToken).digest('hex');
    await prisma.user.update({ where: { id: user.id }, data: { refreshToken: newHashedRefresh } });

    return {
      user: {
        id: user.id, email: user.email, name: user.name,
        role: user.role, timezone: user.timezone, preferences: user.preferences,
        avatarUrl: user.avatarUrl,
      },
      ...tokens,
    };
  }

  /**
   * Logout — clear refresh token.
   */
  async logout(userId: string) {
    await prisma.user.update({ where: { id: userId }, data: { refreshToken: null } });
    return { message: 'Logged out successfully' };
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, timezone: true, preferences: true, avatarUrl: true, createdAt: true },
    });
    if (!user) throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
    return user;
  }

  async updateProfile(userId: string, input: UpdateProfileInput) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        name: input.name,
        timezone: input.timezone,
        preferences: input.preferences,
        avatarUrl: input.avatarUrl,
      },
      select: { id: true, email: true, name: true, role: true, timezone: true, preferences: true, avatarUrl: true, createdAt: true },
    });
    return user;
  }
}

export const authService = new AuthService();
