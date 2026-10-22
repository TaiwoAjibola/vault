import type {
  CredentialPayload,
  DecryptedCredential,
  EncryptedCredentialRow,
  EncryptedVaultRecord,
  SealedCredential,
  SealedVault,
} from "./types";

export const ENCRYPTION_VERSION = 1;
export const KDF_ITERATIONS = 600_000;
export const MIN_KDF_ITERATIONS = 100_000;
export const MAX_KDF_ITERATIONS = 2_000_000;

const KEY_BYTES = 32;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const RECOVERY_BYTES = 20;
const RECOVERY_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function subtle(): SubtleCrypto {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("Web Crypto is unavailable in this context.");
  }
  return crypto.subtle;
}

export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function aadFor(context: string): ArrayBuffer {
  return bufferSource(encoder.encode(`keyhold:v${ENCRYPTION_VERSION}:${context}`));
}

function bufferSource(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function importAesKey(raw: Uint8Array): Promise<CryptoKey> {
  // Extractable so the in-memory data key can be re-wrapped when the master
  // password changes. The raw key never leaves the page or extension context.
  return subtle().importKey("raw", bufferSource(raw), { name: "AES-GCM" }, true, [
    "encrypt",
    "decrypt",
  ]);
}

async function deriveKek(
  secret: string,
  saltB64: string,
  iterations: number,
): Promise<CryptoKey> {
  if (!Number.isInteger(iterations) || iterations < MIN_KDF_ITERATIONS || iterations > MAX_KDF_ITERATIONS) {
    throw new Error("Invalid key-derivation parameters.");
  }
  const baseKey = await subtle().importKey(
    "raw",
    encoder.encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return subtle().deriveKey(
    {
      name: "PBKDF2",
      salt: bufferSource(fromBase64(saltB64)),
      iterations,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptBytes(
  key: CryptoKey,
  plaintext: Uint8Array,
  context: string,
): Promise<{ ciphertext: string; iv: string }> {
  const iv = randomBytes(IV_BYTES);
  const ciphertext = await subtle().encrypt(
    { name: "AES-GCM", iv: bufferSource(iv), additionalData: aadFor(context) },
    key,
    bufferSource(plaintext),
  );
  return { ciphertext: toBase64(new Uint8Array(ciphertext)), iv: toBase64(iv) };
}

async function decryptBytes(
  key: CryptoKey,
  ciphertextB64: string,
  ivB64: string,
  context: string,
): Promise<Uint8Array> {
  const plaintext = await subtle().decrypt(
    {
      name: "AES-GCM",
      iv: bufferSource(fromBase64(ivB64)),
      additionalData: aadFor(context),
    },
    key,
    bufferSource(fromBase64(ciphertextB64)),
  );
  return new Uint8Array(plaintext);
}

export function formatRecoveryKey(bytes: Uint8Array): string {
  if (bytes.length !== RECOVERY_BYTES) {
    throw new Error("Recovery key has an unexpected length.");
  }
  let bits = 0;
  let value = 0;
  let output = "";
  for (let i = 0; i < bytes.length; i += 1) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      output += RECOVERY_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return output.match(/.{1,4}/g)?.join("-") ?? output;
}

export function normalizeRecoveryKey(input: string): string | null {
  const normalized = input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  if (normalized.length !== 32) return null;
  for (const char of normalized) {
    if (!RECOVERY_ALPHABET.includes(char)) return null;
  }
  return normalized;
}

export function generateRecoveryKey(): { display: string; bytes: Uint8Array } {
  const bytes = randomBytes(RECOVERY_BYTES);
  return { display: formatRecoveryKey(bytes), bytes };
}

export async function createSealedVault(userId: string, masterPassword: string): Promise<SealedVault> {
  if (!userId) throw new Error("A user id is required to create a vault.");
  if (!masterPassword) throw new Error("A master password is required.");

  const dekBytes = randomBytes(KEY_BYTES);

  const kdfSalt = toBase64(randomBytes(SALT_BYTES));
  const kek = await deriveKek(masterPassword, kdfSalt, KDF_ITERATIONS);
  const wrapped = await encryptBytes(kek, dekBytes, `vault:${userId}`);

  const recovery = generateRecoveryKey();
  const recoverySecret = normalizeRecoveryKey(recovery.display);
  if (!recoverySecret) throw new Error("Could not generate a recovery key.");
  const recoverySalt = toBase64(randomBytes(SALT_BYTES));
  const recoveryKek = await deriveKek(recoverySecret, recoverySalt, KDF_ITERATIONS);
  const recoveryWrapped = await encryptBytes(recoveryKek, dekBytes, `recovery:${userId}`);

  return {
    kdfSalt,
    kdfIterations: KDF_ITERATIONS,
    wrappedDek: wrapped.ciphertext,
    wrappedDekIv: wrapped.iv,
    recoverySalt,
    recoveryIterations: KDF_ITERATIONS,
    recoveryWrappedDek: recoveryWrapped.ciphertext,
    recoveryWrappedDekIv: recoveryWrapped.iv,
    recoveryKey: recovery.display,
  };
}

export async function unlockVault(
  userId: string,
  masterPassword: string,
  vault: EncryptedVaultRecord,
): Promise<CryptoKey> {
  const kek = await deriveKek(masterPassword, vault.kdf_salt, vault.kdf_iterations);
  try {
    const raw = await decryptBytes(kek, vault.wrapped_dek, vault.wrapped_dek_iv, `vault:${userId}`);
    return importAesKey(raw);
  } catch {
    throw new Error("That master password cannot unlock this vault.");
  }
}

export async function unlockVaultWithRecoveryKey(
  userId: string,
  recoveryKey: string,
  vault: EncryptedVaultRecord,
): Promise<CryptoKey> {
  const normalized = normalizeRecoveryKey(recoveryKey);
  if (!normalized) throw new Error("That recovery key is not valid.");
  const kek = await deriveKek(normalized, vault.recovery_salt, vault.recovery_iterations);
  try {
    const raw = await decryptBytes(
      kek,
      vault.recovery_wrapped_dek,
      vault.recovery_wrapped_dek_iv,
      `recovery:${userId}`,
    );
    return importAesKey(raw);
  } catch {
    throw new Error("That recovery key cannot unlock this vault.");
  }
}

export async function rewrapVault(
  userId: string,
  dek: CryptoKey,
  newMasterPassword: string,
): Promise<Pick<SealedVault, "kdfSalt" | "kdfIterations" | "wrappedDek" | "wrappedDekIv">> {
  const raw = new Uint8Array(await subtle().exportKey("raw", dek));
  const kdfSalt = toBase64(randomBytes(SALT_BYTES));
  const kek = await deriveKek(newMasterPassword, kdfSalt, KDF_ITERATIONS);
  const wrapped = await encryptBytes(kek, raw, `vault:${userId}`);
  return {
    kdfSalt,
    kdfIterations: KDF_ITERATIONS,
    wrappedDek: wrapped.ciphertext,
    wrappedDekIv: wrapped.iv,
  };
}

export async function regenerateRecoveryWrap(
  userId: string,
  dek: CryptoKey,
): Promise<Pick<
  SealedVault,
  "recoverySalt" | "recoveryIterations" | "recoveryWrappedDek" | "recoveryWrappedDekIv" | "recoveryKey"
>> {
  const raw = new Uint8Array(await subtle().exportKey("raw", dek));
  const recovery = generateRecoveryKey();
  const recoverySecret = normalizeRecoveryKey(recovery.display);
  if (!recoverySecret) throw new Error("Could not generate a recovery key.");
  const recoverySalt = toBase64(randomBytes(SALT_BYTES));
  const recoveryKek = await deriveKek(recoverySecret, recoverySalt, KDF_ITERATIONS);
  const wrapped = await encryptBytes(recoveryKek, raw, `recovery:${userId}`);
  return {
    recoverySalt,
    recoveryIterations: KDF_ITERATIONS,
    recoveryWrappedDek: wrapped.ciphertext,
    recoveryWrappedDekIv: wrapped.iv,
    recoveryKey: recovery.display,
  };
}

export async function sealCredential(
  dek: CryptoKey,
  userId: string,
  credentialId: string,
  payload: CredentialPayload,
): Promise<SealedCredential> {
  const serialized = encoder.encode(JSON.stringify(payload));
  const sealed = await encryptBytes(dek, serialized, `credential:${userId}:${credentialId}`);
  return { id: credentialId, ciphertext: sealed.ciphertext, iv: sealed.iv };
}

function parsePayload(plaintext: string): CredentialPayload {
  const value: unknown = JSON.parse(plaintext);
  if (!value || typeof value !== "object") throw new Error("Credential payload is malformed.");
  const record = value as Record<string, unknown>;
  const fields: (keyof CredentialPayload)[] = [
    "applicationName",
    "websiteUrl",
    "username",
    "password",
    "notes",
  ];
  for (const field of fields) {
    if (typeof record[field] !== "string") {
      throw new Error("Credential payload is malformed.");
    }
  }
  return {
    applicationName: record.applicationName as string,
    websiteUrl: record.websiteUrl as string,
    username: record.username as string,
    password: record.password as string,
    notes: record.notes as string,
  };
}

export async function openCredential(
  dek: CryptoKey,
  row: EncryptedCredentialRow,
): Promise<DecryptedCredential> {
  const raw = await decryptBytes(
    dek,
    row.ciphertext,
    row.iv,
    `credential:${row.user_id}:${row.id}`,
  );
  const payload = parsePayload(decoder.decode(raw));
  return {
    ...payload,
    id: row.id,
    vaultId: row.vault_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastRetrievedAt: row.last_retrieved_at,
  };
}

export async function openAllCredentials(
  dek: CryptoKey,
  rows: EncryptedCredentialRow[],
): Promise<DecryptedCredential[]> {
  const opened = await Promise.all(rows.map((row) => openCredential(dek, row)));
  return opened.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
