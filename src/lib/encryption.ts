import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { AppError } from './errors';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH_BYTES = 32;
const IV_LENGTH_BYTES = 12; // 96-bit IV is recommended for GCM (NIST SP 800-38D)
const AUTH_TAG_LENGTH_BYTES = 16;

export class EncryptionError extends AppError {
  public override readonly code = 'ENCRYPTION_ERROR';
}

/**
 * Parse a 64-hex-char string (32 bytes) into a Buffer. Use at app startup so
 * every subsequent encrypt/decrypt call can reuse the Buffer without re-parsing.
 */
export function parseEncryptionKey(hexKey: string): Buffer {
  if (!/^[0-9a-fA-F]{64}$/.test(hexKey)) {
    throw new EncryptionError('Encryption key must be 64 hex chars (32 bytes)', {
      length: hexKey.length,
    });
  }
  return Buffer.from(hexKey, 'hex');
}

/**
 * Encrypt a UTF-8 plaintext. Output is `base64(iv).base64(authTag).base64(ciphertext)`.
 * - A fresh random IV per call means encrypting the same plaintext twice yields
 *   different ciphertexts (important for token storage — prevents frequency analysis).
 * - The GCM auth tag detects tampering: decrypt throws if the ciphertext or tag
 *   is altered, or if the wrong key is used.
 */
export function encrypt(plaintext: string, key: Buffer): string {
  if (key.length !== KEY_LENGTH_BYTES) {
    throw new EncryptionError(`Key must be ${KEY_LENGTH_BYTES} bytes (got ${key.length})`);
  }
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(
    '.'
  );
}

/**
 * Reverse of `encrypt`. Throws `EncryptionError` for any malformation or auth-tag
 * mismatch — never returns partial / wrong plaintext.
 */
export function decrypt(encrypted: string, key: Buffer): string {
  if (key.length !== KEY_LENGTH_BYTES) {
    throw new EncryptionError(`Key must be ${KEY_LENGTH_BYTES} bytes (got ${key.length})`);
  }
  const parts = encrypted.split('.');
  if (parts.length !== 3) {
    throw new EncryptionError('Invalid encrypted payload format (expected iv.authTag.ciphertext)');
  }
  const [ivB64, authTagB64, ciphertextB64] = parts as [string, string, string];
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');

  if (iv.length !== IV_LENGTH_BYTES) {
    throw new EncryptionError(`Invalid IV length (${iv.length})`);
  }
  if (authTag.length !== AUTH_TAG_LENGTH_BYTES) {
    throw new EncryptionError(`Invalid auth tag length (${authTag.length})`);
  }

  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plain.toString('utf8');
  } catch (cause) {
    throw new EncryptionError(
      'Decryption failed — payload was tampered with or wrong key used',
      {},
      { cause }
    );
  }
}
