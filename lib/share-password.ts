import { randomBytes, pbkdf2Sync, timingSafeEqual } from "node:crypto"

const PBKDF2_ITERATIONS = 120_000
const SALT_BYTES = 16
const KEY_LEN = 64
const HASH_ALGO = "sha256"

/**
 * Hash a share password with a random salt (PBKDF2).
 * Returns { hash, salt } for storage.
 */
export function hashSharePassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(SALT_BYTES).toString("hex")
  const hash = pbkdf2Sync(
    password,
    salt,
    PBKDF2_ITERATIONS,
    KEY_LEN,
    HASH_ALGO
  ).toString("hex")
  return { hash, salt }
}

/**
 * Verify a share password against stored hash and salt.
 * Uses timing-safe comparison to avoid timing attacks.
 */
export function verifySharePassword(
  password: string,
  storedHash: string,
  storedSalt: string
): boolean {
  const derived = pbkdf2Sync(
    password,
    storedSalt,
    PBKDF2_ITERATIONS,
    KEY_LEN,
    HASH_ALGO
  )
  const storedBuf = Buffer.from(storedHash, "hex")
  if (derived.length !== storedBuf.length) return false
  return timingSafeEqual(derived, storedBuf)
}
