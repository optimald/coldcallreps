import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

export type GatePayload = {
  u: string;
  m: number;
  exp: number;
  /** Unique hold id (jti) — single-use reservation */
  j: string;
  brandId?: string | null;
  packId?: string | null;
};

function secret() {
  const s = process.env.TRAINER_GATE_SECRET || process.env.CRON_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('TRAINER_GATE_SECRET is required in production');
    }
    return 'dev-gate-secret';
  }
  return s;
}

export function newGateJti(): string {
  return randomBytes(16).toString('hex');
}

export function signGateToken(payload: GatePayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyGateToken(token: string): GatePayload | null {
  try {
    const [body, sig] = token.split('.');
    if (!body || !sig) return null;
    const expected = createHmac('sha256', secret()).update(body).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as GatePayload;
    if (!payload.u || !payload.exp || payload.exp < Date.now()) return null;
    if (payload.m < 1) return null;
    if (!payload.j) return null;
    return payload;
  } catch {
    return null;
  }
}

export function internalSecretOk(header: string | null): boolean {
  const expected = process.env.TRAINER_INTERNAL_SECRET || process.env.CRON_SECRET;
  if (!expected) return false;
  if (!header) return false;
  try {
    const a = Buffer.from(header);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
