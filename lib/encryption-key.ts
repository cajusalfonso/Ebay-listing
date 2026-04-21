import { parseEncryptionKey } from '../src/lib/encryption';

/**
 * Lazily-loaded 32-byte encryption key for AES-256-GCM. Cached on globalThis
 * to avoid re-parsing on every server action invocation.
 */
const globalForKey = globalThis as unknown as { encryptionKey?: Buffer };

export function getEncryptionKey(): Buffer {
  if (!globalForKey.encryptionKey) {
    const hex = process.env.TOKEN_ENCRYPTION_KEY;
    if (!hex) {
      throw new Error(
        'TOKEN_ENCRYPTION_KEY is not set. Generate one via `openssl rand -hex 32` and set it in your environment.'
      );
    }
    globalForKey.encryptionKey = parseEncryptionKey(hex);
  }
  return globalForKey.encryptionKey;
}
