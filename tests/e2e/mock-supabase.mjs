/**
 * In-memory Supabase stand-in for extension end-to-end tests.
 *
 * It implements only the endpoints the extension uses: password/refresh
 * grants, logout, the vault and credential tables, and the retrieval RPC.
 * The vault is sealed with the real client-side crypto so the extension has
 * to perform a genuine unlock.
 */
import http from "node:http";

const { createSealedVault } = await import("./.build/crypto.mjs");

export const USER_ID = "11111111-1111-4111-8111-111111111111";
export const USER_EMAIL = "qa@example.com";
export const ACCOUNT_PASSWORD = "AccountPass!234";
export const MASTER_PASSWORD = "MasterVault!5678";

const state = {
  vault: null,
  credentials: [],
  tokens: new Map(),
};

const sealed = await createSealedVault(USER_ID, MASTER_PASSWORD);
const now = new Date().toISOString();
state.vault = {
  id: "22222222-2222-4222-8222-222222222222",
  user_id: USER_ID,
  kdf_salt: sealed.kdfSalt,
  kdf_iterations: sealed.kdfIterations,
  wrapped_dek: sealed.wrappedDek,
  wrapped_dek_iv: sealed.wrappedDekIv,
  recovery_salt: sealed.recoverySalt,
  recovery_iterations: sealed.recoveryIterations,
  recovery_wrapped_dek: sealed.recoveryWrappedDek,
  recovery_wrapped_dek_iv: sealed.recoveryWrappedDekIv,
  encryption_version: 1,
  created_at: now,
  updated_at: now,
};

function json(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  });
  res.end(status === 204 ? undefined : JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return null;
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}

function issueTokens() {
  const accessToken = `access-${Math.random().toString(36).slice(2)}`;
  const refreshToken = `refresh-${Math.random().toString(36).slice(2)}`;
  state.tokens.set(accessToken, { refreshToken });
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: USER_ID, email: USER_EMAIL, aud: "authenticated", role: "authenticated" },
  };
}

function authorized(req) {
  const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  return state.tokens.has(token);
}

export function createMockSupabase() {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    const path = url.pathname;

    if (req.method === "OPTIONS") {
      json(res, 204, {});
      return;
    }

    if (path === "/auth/v1/token") {
      const grant = url.searchParams.get("grant_type");
      const body = await readBody(req);
      if (grant === "password") {
        if (!body || body.email !== USER_EMAIL || body.password !== ACCOUNT_PASSWORD) {
          json(res, 400, {
            error: "invalid_grant",
            error_description: "Invalid login credentials",
          });
          return;
        }
        json(res, 200, issueTokens());
        return;
      }
      if (grant === "refresh_token") {
        const known = [...state.tokens.values()].some(
          (item) => item.refreshToken === body?.refresh_token,
        );
        if (!known) {
          json(res, 400, { error: "invalid_grant", error_description: "Invalid refresh token" });
          return;
        }
        json(res, 200, issueTokens());
        return;
      }
      json(res, 400, { error: "unsupported_grant_type" });
      return;
    }

    if (path === "/auth/v1/logout") {
      const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      state.tokens.delete(token);
      json(res, 204, {});
      return;
    }

    if (path === "/auth/v1/user") {
      if (!authorized(req)) {
        json(res, 401, { message: "invalid token" });
        return;
      }
      json(res, 200, { id: USER_ID, email: USER_EMAIL });
      return;
    }

    if (!authorized(req)) {
      json(res, 401, { message: "JWT missing" });
      return;
    }

    if (path === "/rest/v1/vaults" && req.method === "GET") {
      json(res, 200, [state.vault]);
      return;
    }

    if (path === "/rest/v1/credentials" && req.method === "GET") {
      json(res, 200, state.credentials);
      return;
    }

    if (path === "/rest/v1/credentials" && req.method === "POST") {
      const body = await readBody(req);
      const row = {
        id: body.id,
        user_id: body.user_id,
        vault_id: body.vault_id,
        ciphertext: body.ciphertext,
        iv: body.iv,
        encryption_version: body.encryption_version ?? 1,
        created_at: now,
        updated_at: now,
        last_retrieved_at: null,
      };
      state.credentials.push(row);
      json(res, 201, [row]);
      return;
    }

    if (path === "/rest/v1/credentials" && req.method === "PATCH") {
      const id = url.searchParams.get("id")?.replace("eq.", "");
      const body = await readBody(req);
      const row = state.credentials.find((item) => item.id === id);
      if (!row) {
        json(res, 404, { message: "not found" });
        return;
      }
      row.ciphertext = body.ciphertext ?? row.ciphertext;
      row.iv = body.iv ?? row.iv;
      row.updated_at = new Date().toISOString();
      json(res, 200, [row]);
      return;
    }

    if (path === "/rest/v1/rpc/mark_credential_retrieved" && req.method === "POST") {
      const body = await readBody(req);
      const row = state.credentials.find((item) => item.id === body?.p_credential_id);
      if (row) row.last_retrieved_at = new Date().toISOString();
      json(res, 200, row?.last_retrieved_at ?? null);
      return;
    }

    json(res, 404, { message: `no route for ${req.method} ${path}` });
  });

  return server;
}

export function credentialRows() {
  return state.credentials;
}
