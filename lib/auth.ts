import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { getUserByUsername } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-me';
const TOKEN_NAME = 'pos-auth-token';
const TOKEN_EXPIRY = '24h';

export interface TokenPayload {
  userId: number;
  username: string;
  role: string;
}

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function authenticateUser(username: string, password: string) {
  const user = await getUserByUsername(username);
  if (!user) return null;

  const isValid = await comparePassword(password, user.password_hash);
  if (!isValid) return null;

  const token = generateToken({
    userId: user.id,
    username: user.username,
    role: user.role,
  });

  return { token, user: { id: user.id, username: user.username, role: user.role } };
}

export function setAuthCookie(token: string) {
  const cookieStore = cookies();
  cookieStore.set(TOKEN_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 86400, // 24 hours
    path: '/',
  });
}

export function removeAuthCookie() {
  const cookieStore = cookies();
  cookieStore.delete(TOKEN_NAME);
}

export function getAuthFromCookies(): TokenPayload | null {
  const cookieStore = cookies();
  const token = cookieStore.get(TOKEN_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function getAuthFromHeaders(request: Request): TokenPayload | null {
  // Check Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    return verifyToken(token);
  }

  // Check cookies
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const tokenMatch = cookieHeader.match(new RegExp(`${TOKEN_NAME}=([^;]+)`));
    if (tokenMatch) {
      return verifyToken(tokenMatch[1]);
    }
  }

  return null;
}
