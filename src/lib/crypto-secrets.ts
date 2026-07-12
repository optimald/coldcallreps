import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/**
 * Encrypt/decrypt OAuth tokens at rest.
 * Key: INTEGRATION_ENCRYPTION_KEY (32+ char secret) or derived fallback from TRAINER_GATE_SECRET.
 */
function getKey(): Buffer {
  const raw =
    process.env.INTEGRATION_ENCRYPTION_KEY ||
    process.env.TRAINER_GATE_SECRET ||
    '';
  if (!raw || raw.length < 16) {
    throw new Error(
      'INTEGRATION_ENCRYPTION_KEY (or TRAINER_GATE_SECRET) required to store integration tokens'
    );
  }
  return createHash('sha256').update(raw).digest();
}

/** Returns `iv:authTag:ciphertext` hex string. */
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

export function decryptSecret(payload: string): string {
  const key = getKey();
  const [ivHex, tagHex, dataHex] = payload.split(':');
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error('Invalid encrypted secret format');
  }
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]);
  return dec.toString('utf8');
}

export function integrationCryptoConfigured(): boolean {
  const raw =
    process.env.INTEGRATION_ENCRYPTION_KEY ||
    process.env.TRAINER_GATE_SECRET ||
    '';
  return Boolean(raw && raw.length >= 16);
}
