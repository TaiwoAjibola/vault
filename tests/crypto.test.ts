// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  createSealedVault,
  openCredential,
  regenerateRecoveryWrap,
  rewrapVault,
  sealCredential,
  unlockVault,
  unlockVaultWithRecoveryKey,
} from "../src/lib/vault/crypto";
import type {
  CredentialPayload,
  EncryptedCredentialRow,
  EncryptedVaultRecord,
  SealedVault,
} from "../src/lib/vault/types";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const MASTER = "correct horse battery staple";
const NEW_MASTER = "a different master password entirely";

function recordFor(userId: string, sealed: SealedVault): EncryptedVaultRecord {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    user_id: userId,
    kdf_salt: sealed.kdfSalt,
    kdf_iterations: sealed.kdfIterations,
    wrapped_dek: sealed.wrappedDek,
    wrapped_dek_iv: sealed.wrappedDekIv,
    recovery_salt: sealed.recoverySalt,
    recovery_iterations: sealed.recoveryIterations,
    recovery_wrapped_dek: sealed.recoveryWrappedDek,
    recovery_wrapped_dek_iv: sealed.recoveryWrappedDekIv,
    encryption_version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function rowFor(
  userId: string,
  id: string,
  sealed: { ciphertext: string; iv: string },
): EncryptedCredentialRow {
  return {
    id,
    user_id: userId,
    vault_id: "33333333-3333-4333-8333-333333333333",
    ciphertext: sealed.ciphertext,
    iv: sealed.iv,
    encryption_version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_retrieved_at: null,
  };
}

const payload: CredentialPayload = {
  applicationName: "Example",
  websiteUrl: "https://example.com",
  username: "ada@example.com",
  password: "s3cret-value",
  notes: "two-factor backup codes in the safe",
};

describe("vault crypto", () => {
  it("creates an encrypted vault and a grouped recovery key", async () => {
    const sealed = await createSealedVault(USER_A, MASTER);
    expect(sealed.kdfIterations).toBe(600_000);
    expect(sealed.recoveryKey).toMatch(/^[0-9A-Z]{4}(-[0-9A-Z]{4}){7}$/);
    expect(sealed.wrappedDek).not.toContain(MASTER);
    expect(sealed.wrappedDekIv.length).toBeGreaterThan(10);
  });

  it("rejects the wrong master password and opens a sealed credential with the right one", async () => {
    const sealed = await createSealedVault(USER_A, MASTER);
    const record = recordFor(USER_A, sealed);

    await expect(unlockVault(USER_A, "wrong password", record)).rejects.toThrow(
      /cannot unlock/i,
    );

    const dek = await unlockVault(USER_A, MASTER, record);
    const row = rowFor(USER_A, "44444444-4444-4444-8444-444444444444", await sealCredential(
      dek,
      USER_A,
      "44444444-4444-4444-8444-444444444444",
      payload,
    ));

    await expect(openCredential(dek, row)).resolves.toMatchObject(payload);
  });

  it("binds ciphertext to the owning user and credential id", async () => {
    const sealed = await createSealedVault(USER_A, MASTER);
    const dek = await unlockVault(USER_A, MASTER, recordFor(USER_A, sealed));
    const id = "44444444-4444-4444-8444-444444444444";
    const sealedCredential = await sealCredential(dek, USER_A, id, payload);
    const row = rowFor(USER_A, id, sealedCredential);

    await expect(openCredential(dek, { ...row, user_id: USER_B })).rejects.toThrow();
    await expect(
      openCredential(dek, { ...row, id: "55555555-5555-4555-8555-555555555555" }),
    ).rejects.toThrow();

    const tampered = sealedCredential.ciphertext.startsWith("A")
      ? `B${sealedCredential.ciphertext.slice(1)}`
      : `A${sealedCredential.ciphertext.slice(1)}`;
    await expect(
      openCredential(dek, { ...row, ciphertext: tampered }),
    ).rejects.toThrow();
  });

  it("supports recovery, rewrap, and recovery-key rotation", async () => {
    const sealed = await createSealedVault(USER_A, MASTER);
    const record = recordFor(USER_A, sealed);
    const lowercaseRecovery = sealed.recoveryKey.replace(/-/g, "").toLowerCase();

    const recoveryDek = await unlockVaultWithRecoveryKey(USER_A, lowercaseRecovery, record);
    expect(recoveryDek).toBeDefined();

    const wrapped = await rewrapVault(USER_A, recoveryDek, NEW_MASTER);
    const rewrapped: EncryptedVaultRecord = {
      ...record,
      kdf_salt: wrapped.kdfSalt,
      kdf_iterations: wrapped.kdfIterations,
      wrapped_dek: wrapped.wrappedDek,
      wrapped_dek_iv: wrapped.wrappedDekIv,
    };
    await expect(unlockVault(USER_A, MASTER, rewrapped)).rejects.toThrow();
    const newDek = await unlockVault(USER_A, NEW_MASTER, rewrapped);
    expect(newDek).toBeDefined();

    const nextRecovery = await regenerateRecoveryWrap(USER_A, newDek);
    const rotated: EncryptedVaultRecord = {
      ...rewrapped,
      recovery_salt: nextRecovery.recoverySalt,
      recovery_iterations: nextRecovery.recoveryIterations,
      recovery_wrapped_dek: nextRecovery.recoveryWrappedDek,
      recovery_wrapped_dek_iv: nextRecovery.recoveryWrappedDekIv,
    };
    expect(nextRecovery.recoveryKey).not.toBe(sealed.recoveryKey);
    await expect(
      unlockVaultWithRecoveryKey(USER_A, sealed.recoveryKey, rotated),
    ).rejects.toThrow();
    await expect(
      unlockVaultWithRecoveryKey(USER_A, nextRecovery.recoveryKey, rotated),
    ).resolves.toBeDefined();
  });
});
