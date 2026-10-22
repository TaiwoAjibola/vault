export type EncryptedVaultRecord = {
  id: string;
  user_id: string;
  kdf_salt: string;
  kdf_iterations: number;
  wrapped_dek: string;
  wrapped_dek_iv: string;
  recovery_salt: string;
  recovery_iterations: number;
  recovery_wrapped_dek: string;
  recovery_wrapped_dek_iv: string;
  encryption_version: number;
  created_at: string;
  updated_at: string;
};

export type EncryptedCredentialRow = {
  id: string;
  user_id: string;
  vault_id: string;
  ciphertext: string;
  iv: string;
  encryption_version: number;
  created_at: string;
  updated_at: string;
  last_retrieved_at: string | null;
};

export type CredentialPayload = {
  applicationName: string;
  websiteUrl: string;
  username: string;
  password: string;
  notes: string;
};

export type DecryptedCredential = CredentialPayload & {
  id: string;
  vaultId: string;
  createdAt: string;
  updatedAt: string;
  lastRetrievedAt: string | null;
};

export type VaultEvent = {
  id: number;
  credential_id: string | null;
  event_type: "created" | "updated" | "retrieved" | "deleted";
  created_at: string;
};

export type SealedVault = {
  kdfSalt: string;
  kdfIterations: number;
  wrappedDek: string;
  wrappedDekIv: string;
  recoverySalt: string;
  recoveryIterations: number;
  recoveryWrappedDek: string;
  recoveryWrappedDekIv: string;
  recoveryKey: string;
};

export type SealedCredential = {
  id: string;
  ciphertext: string;
  iv: string;
};

export type VaultStatus = "loading" | "signed-out" | "no-vault" | "locked" | "unlocked";
