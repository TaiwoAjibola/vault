// @vitest-environment node
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const binaries = ["initdb", "pg_ctl"].every(
  (binary) => spawnSync(binary, ["--version"]).status === 0,
);

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const CREDENTIAL_A = "44444444-4444-4444-8444-444444444444";
const CREDENTIAL_B = "55555555-5555-4555-8555-555555555555";

let tempRoot = "";
let dataDir = "";
let socketDir = "";
let logFile = "";
let port = 0;
let admin: Client;
let config: { host: string; port: number; user: string; database: string };

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const chosen = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(chosen));
    });
  });
}

async function asUser<T>(
  userId: string,
  callback: (client: Client) => Promise<T>,
): Promise<T> {
  const client = new Client(config);
  await client.connect();
  try {
    await client.query("begin");
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    const result = await callback(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

async function insertVault(client: Client, userId: string): Promise<string> {
  const result = await client.query<{ id: string }>(
    `insert into public.vaults (
       user_id, kdf_salt, kdf_iterations, wrapped_dek, wrapped_dek_iv,
       recovery_salt, recovery_iterations, recovery_wrapped_dek, recovery_wrapped_dek_iv
     ) values ($1, 'c2FsdA==', 600000, repeat('A', 32), repeat('B', 16),
               'c2FsdA==', 600000, repeat('C', 32), repeat('D', 16))
     returning id`,
    [userId],
  );
  return result.rows[0].id;
}

async function insertCredential(
  client: Client,
  userId: string,
  vaultId: string,
  id?: string,
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `insert into public.credentials (id, user_id, vault_id, ciphertext, iv)
     values (coalesce($3::uuid, gen_random_uuid()), $1, $2, repeat('E', 32), repeat('F', 16))
     returning id`,
    [userId, vaultId, id ?? null],
  );
  return result.rows[0].id;
}

async function countRows(userId: string, table: string): Promise<number> {
  return asUser(userId, async (client) => {
    const result = await client.query(`select id from public.${table}`);
    return result.rowCount ?? 0;
  });
}

const maybe = binaries ? describe : describe.skip;

maybe("row-level security", () => {
  beforeAll(async () => {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), "keyhold-pg-"));
    dataDir = path.join(tempRoot, "data");
    socketDir = path.join(tempRoot, "sock");
    logFile = path.join(tempRoot, "postgres.log");
    await mkdir(socketDir, { recursive: true });
    port = await freePort();

    execFileSync(
      "initdb",
      ["-D", dataDir, "-U", "postgres", "-A", "trust", "--no-locale", "-E", "UTF8"],
      { stdio: "pipe" },
    );
    execFileSync(
      "pg_ctl",
      [
        "-D",
        dataDir,
        "-o",
        `-p ${port} -k ${socketDir} -c listen_addresses=''`,
        "-l",
        logFile,
        "-w",
        "start",
      ],
      { stdio: "pipe" },
    );

    config = { host: socketDir, port, user: "postgres", database: "postgres" };
    admin = new Client(config);
    await admin.connect();

    await admin.query(`
      create role anon nologin;
      create role authenticated nologin;
      create schema auth;
      create table auth.users (
        id uuid primary key,
        email text not null unique
      );
      create or replace function auth.uid()
      returns uuid
      language sql
      stable
      as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      grant usage on schema auth to anon, authenticated;
      grant usage on schema public to anon, authenticated;
      insert into auth.users (id, email) values
        ('${USER_A}', 'a@example.com'),
        ('${USER_B}', 'b@example.com');
    `);

    const migrationDir = path.join(process.cwd(), "supabase/migrations");
    const migrationFiles = (await readdir(migrationDir))
      .filter((name) => name.endsWith(".sql"))
      .sort();
    expect(migrationFiles.length).toBeGreaterThan(0);
    for (const file of migrationFiles) {
      const migration = await readFile(path.join(migrationDir, file), "utf8");
      await admin.query(migration);
    }
  });

  beforeEach(async () => {
    await admin.query(
      "truncate table public.vault_events, public.credentials, public.vaults cascade",
    );
  });

  afterAll(async () => {
    await admin?.end().catch(() => undefined);
    if (dataDir) {
      try {
        execFileSync("pg_ctl", ["-D", dataDir, "-m", "immediate", "-w", "stop"], {
          stdio: "pipe",
        });
      } catch {
        // Best effort cleanup.
      }
    }
    if (tempRoot) await rm(tempRoot, { recursive: true, force: true });
  });

  it("lets users create and read only their own vault", async () => {
    const vaultA = await asUser(USER_A, (client) => insertVault(client, USER_A));

    await asUser(USER_A, async (client) => {
      const rows = await client.query("select id from public.vaults");
      expect(rows.rowCount).toBe(1);
    });

    expect(await countRows(USER_B, "vaults")).toBe(0);

    await expect(
      asUser(USER_B, (client) =>
        client.query(
          `insert into public.vaults (
             user_id, kdf_salt, kdf_iterations, wrapped_dek, wrapped_dek_iv,
             recovery_salt, recovery_iterations, recovery_wrapped_dek, recovery_wrapped_dek_iv
           ) values ($1, 'c2FsdA==', 600000, repeat('A', 32), repeat('B', 16),
                     'c2FsdA==', 600000, repeat('C', 32), repeat('D', 16))`,
          [USER_A],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);

    await asUser(USER_B, async (client) => {
      const updates = await client.query(
        "update public.vaults set kdf_salt = 'b3RoZXI=' where id = $1",
        [vaultA],
      );
      expect(updates.rowCount).toBe(0);
    });
  });

  it("blocks credentials in another user's vault and immutable ownership changes", async () => {
    const vaultA = await asUser(USER_A, (client) => insertVault(client, USER_A));
    const credentialA = await asUser(USER_A, (client) =>
      insertCredential(client, USER_A, vaultA, CREDENTIAL_A),
    );
    expect(credentialA).toBe(CREDENTIAL_A);

    expect(await countRows(USER_B, "credentials")).toBe(0);

    await expect(
      asUser(USER_B, (client) => insertCredential(client, USER_B, vaultA)),
    ).rejects.toThrow(/does not belong|row-level security/i);

    await asUser(USER_B, async (client) => {
      const updates = await client.query(
        "update public.credentials set ciphertext = repeat('G', 32) where id = $1",
        [credentialA],
      );
      expect(updates.rowCount).toBe(0);
    });

    await expect(
      asUser(USER_A, (client) =>
        client.query("update public.credentials set user_id = $1 where id = $2", [
          USER_B,
          credentialA,
        ]),
      ),
    ).rejects.toThrow(/ownership|row-level security/i);
  });

  it("writes audit events through triggers and blocks direct event writes", async () => {
    const vaultA = await asUser(USER_A, (client) => insertVault(client, USER_A));
    const credentialA = await asUser(USER_A, (client) =>
      insertCredential(client, USER_A, vaultA, CREDENTIAL_A),
    );

    await asUser(USER_A, async (client) => {
      const events = await client.query<{ event_type: string }>(
        "select event_type from public.vault_events order by id",
      );
      expect(events.rows.map((row) => row.event_type)).toEqual(["created"]);

      await client.query(
        "update public.credentials set ciphertext = repeat('H', 32) where id = $1",
        [credentialA],
      );

      const stamp = await client.query<{ mark_credential_retrieved: string }>(
        "select public.mark_credential_retrieved($1)",
        [credentialA],
      );
      expect(stamp.rows[0].mark_credential_retrieved).toBeTruthy();

      const detail = await client.query<{ last_retrieved_at: string | null }>(
        "select last_retrieved_at from public.credentials where id = $1",
        [credentialA],
      );
      expect(detail.rows[0].last_retrieved_at).toBeTruthy();
    });

    await expect(
      asUser(USER_A, (client) =>
        client.query(
          `insert into public.vault_events (user_id, credential_id, event_type)
           values ($1, $2, 'retrieved')`,
          [USER_A, credentialA],
        ),
      ),
    ).rejects.toThrow(/permission denied/i);

    await asUser(USER_A, async (client) => {
      const events = await client.query<{ event_type: string }>(
        "select event_type from public.vault_events order by id",
      );
      expect(events.rows.map((row) => row.event_type)).toEqual([
        "created",
        "updated",
        "retrieved",
      ]);
    });

    expect(await countRows(USER_B, "vault_events")).toBe(0);
    await expect(
      asUser(USER_B, (client) =>
        client.query("select public.mark_credential_retrieved($1)", [credentialA]),
      ),
    ).rejects.toThrow(/not found/i);
  });

  it("deletes only the caller's vault data, including audit rows", async () => {
    const vaultA = await asUser(USER_A, (client) => insertVault(client, USER_A));
    await asUser(USER_A, (client) => insertCredential(client, USER_A, vaultA, CREDENTIAL_A));

    const vaultB = await asUser(USER_B, (client) => insertVault(client, USER_B));
    await asUser(USER_B, (client) => insertCredential(client, USER_B, vaultB, CREDENTIAL_B));

    await asUser(USER_B, async (client) => {
      const result = await client.query("delete from public.vaults where id = $1", [vaultA]);
      expect(result.rowCount).toBe(0);
    });

    await asUser(USER_A, async (client) => {
      await client.query("select public.delete_vault_data()");
      const vaults = await client.query("select id from public.vaults");
      const credentials = await client.query("select id from public.credentials");
      const events = await client.query("select id from public.vault_events");
      expect(vaults.rowCount).toBe(0);
      expect(credentials.rowCount).toBe(0);
      expect(events.rowCount).toBe(0);
    });

    await asUser(USER_B, async (client) => {
      const vaults = await client.query("select id from public.vaults");
      const credentials = await client.query("select id from public.credentials");
      expect(vaults.rowCount).toBe(1);
      expect(credentials.rowCount).toBe(1);
    });
  });

  it("deletes an account without failing on the audit trigger", async () => {
    const vaultA = await asUser(USER_A, (client) => insertVault(client, USER_A));
    await asUser(USER_A, (client) => insertCredential(client, USER_A, vaultA, CREDENTIAL_A));

    // The audit trigger fires while the cascade runs. It must not try to write
    // an event for an account that is already gone.
    await expect(
      admin.query("delete from auth.users where id = $1", [USER_A]),
    ).resolves.toBeDefined();

    const vaults = await admin.query("select id from public.vaults");
    const credentials = await admin.query("select id from public.credentials");
    const events = await admin.query("select id from public.vault_events");
    expect(vaults.rowCount).toBe(0);
    expect(credentials.rowCount).toBe(0);
    expect(events.rowCount).toBe(0);

    await admin.query(
      "insert into auth.users (id, email) values ($1, 'a@example.com')",
      [USER_A],
    );
  });
});
