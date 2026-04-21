import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { EncryptionError, decrypt, encrypt, parseEncryptionKey } from './encryption';

function randomKey(): Buffer {
  return randomBytes(32);
}

describe('parseEncryptionKey', () => {
  it('parses valid 64-char lowercase hex', () => {
    const hex = 'a'.repeat(64);
    expect(parseEncryptionKey(hex)).toHaveLength(32);
  });

  it('parses uppercase hex', () => {
    expect(parseEncryptionKey('F'.repeat(64))).toHaveLength(32);
  });

  it('throws on short key', () => {
    expect(() => parseEncryptionKey('a'.repeat(63))).toThrow(EncryptionError);
  });

  it('throws on non-hex chars', () => {
    expect(() => parseEncryptionKey(`z${'a'.repeat(63)}`)).toThrow(EncryptionError);
  });
});

describe('encrypt/decrypt round-trip', () => {
  it('encrypts and decrypts a typical token string', () => {
    const key = randomKey();
    const plaintext = 'v^1.1#i^1#p^1#f^0#r^1#I^3#t^H4sIAAAAAAAA...';
    const ct = encrypt(plaintext, key);
    expect(decrypt(ct, key)).toBe(plaintext);
  });

  it('handles empty string', () => {
    const key = randomKey();
    const ct = encrypt('', key);
    expect(decrypt(ct, key)).toBe('');
  });

  it('handles unicode (emoji, German umlauts)', () => {
    const key = randomKey();
    const plaintext = 'Gerät für äöüß — 🔒 secure 🚀';
    expect(decrypt(encrypt(plaintext, key), key)).toBe(plaintext);
  });

  it('produces different ciphertexts for identical plaintext (fresh IV per call)', () => {
    const key = randomKey();
    const p = 'same-plaintext';
    const a = encrypt(p, key);
    const b = encrypt(p, key);
    expect(a).not.toBe(b);
    expect(decrypt(a, key)).toBe(p);
    expect(decrypt(b, key)).toBe(p);
  });

  it('output format is three base64 components separated by dots', () => {
    const key = randomKey();
    const ct = encrypt('hello', key);
    const parts = ct.split('.');
    expect(parts).toHaveLength(3);
    parts.forEach((p) => {
      expect(p.length).toBeGreaterThan(0);
    });
  });
});

describe('decrypt — tamper detection', () => {
  it('wrong key fails', () => {
    const keyA = randomKey();
    const keyB = randomKey();
    const ct = encrypt('secret', keyA);
    expect(() => decrypt(ct, keyB)).toThrow(/tampered|wrong key/i);
  });

  it('flipping a ciphertext bit fails auth tag check', () => {
    const key = randomKey();
    const ct = encrypt('secret', key);
    // Tamper with one char in the ciphertext portion (third segment)
    const parts = ct.split('.');
    const original = parts[2]!;
    const tamperedChar = original.startsWith('A') ? 'B' : 'A';
    parts[2] = tamperedChar + original.slice(1);
    const tampered = parts.join('.');
    expect(() => decrypt(tampered, key)).toThrow(EncryptionError);
  });

  it('truncated payload (missing ciphertext part) throws format error', () => {
    const key = randomKey();
    expect(() => decrypt('aaa.bbb', key)).toThrow(/format/);
  });

  it('wrong IV length throws', () => {
    const key = randomKey();
    const ct = encrypt('x', key);
    const parts = ct.split('.');
    // Replace IV with 6-byte value
    parts[0] = Buffer.from([1, 2, 3, 4, 5, 6]).toString('base64');
    expect(() => decrypt(parts.join('.'), key)).toThrow(/IV length/);
  });

  it('wrong auth-tag length throws', () => {
    const key = randomKey();
    const ct = encrypt('x', key);
    const parts = ct.split('.');
    parts[1] = Buffer.from([1, 2, 3]).toString('base64');
    expect(() => decrypt(parts.join('.'), key)).toThrow(/auth tag length/);
  });
});

describe('key length enforcement', () => {
  it('encrypt rejects wrong-size key', () => {
    expect(() => encrypt('x', Buffer.alloc(16))).toThrow(/32 bytes/);
  });

  it('decrypt rejects wrong-size key', () => {
    expect(() => decrypt('a.b.c', Buffer.alloc(16))).toThrow(/32 bytes/);
  });
});
