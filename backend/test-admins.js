// Admin-account management tests: boots the REAL migrate.js and
// server.js against in-memory Postgres (pg-mem) and exercises the
// admin-account endpoints (list / add / remove / change password),
// the access guards, and the legacy sha256 -> scrypt hash upgrade.
const Module = require("module");
const crypto = require("crypto");
const { newDb } = require("pg-mem");

const BACKEND = __dirname;
process.env.ADMIN_USERNAME = "admin";
process.env.ADMIN_PASSWORD = "test-password-123";
process.env.PORT = "3132";
process.env.DATABASE_URL = "postgres://unused:unused@localhost:9/unused";

const db = newDb();
const pgMem = db.adapters.createPg();
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "pg") return pgMem;
  return origLoad.apply(this, arguments);
};

const { pool } = require(`${BACKEND}/src/db.js`);
pool.end = async () => {};

let passed = 0;
let failed = 0;
function check(name, cond, extra = "") {
  if (cond) {
    passed++;
    console.log(`  PASS ${name}`);
  } else {
    failed++;
    console.log(`  FAIL ${name} ${extra}`);
  }
}

async function waitFor(fn, label, timeoutMs = 20000) {
  const start = Date.now();
  for (;;) {
    try {
      const r = await fn();
      if (r) return r;
    } catch {}
    if (Date.now() - start > timeoutMs) throw new Error(`timeout: ${label}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

const BASE = "http://localhost:3132";
async function call(method, path, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json };
}

async function main() {
  require(`${BACKEND}/src/migrate.js`);
  await waitFor(async () => {
    const { rows } = await pool.query(
      "SELECT username FROM admins WHERE username=$1",
      ["admin"]
    );
    return rows.length ? true : null;
  }, "migrate");

  // A legacy admin exactly as the old code wrote it: bare sha256.
  const legacyHash = crypto
    .createHash("sha256")
    .update("legacy-pass-1")
    .digest("hex");
  await pool.query(
    "INSERT INTO admins (username, password_hash) VALUES ($1, $2)",
    ["oldtimer", legacyHash]
  );

  require(`${BACKEND}/src/server.js`);
  await waitFor(async () => {
    const res = await fetch(`${BASE}/api/health`);
    return res.ok ? true : null;
  }, "server");
  console.log("== boot OK ==\n-- admin accounts --");

  let r = await call("GET", "/api/admin/admins");
  check("list admins without login -> 401", r.status === 401, `got ${r.status}`);

  r = await call("POST", "/api/admin/login", {
    body: { username: "admin", password: "wrong-password" },
  });
  check("login wrong password -> 401", r.status === 401, `got ${r.status}`);

  r = await call("POST", "/api/admin/login", {
    body: { username: "admin", password: "test-password-123" },
  });
  check("seeded admin login -> 200", r.status === 200 && !!r.json.token);
  const adminToken = r.json.token;

  r = await call("POST", "/api/admin/login", {
    body: { username: "oldtimer", password: "legacy-pass-1" },
  });
  check("legacy sha256 admin login -> 200", r.status === 200 && !!r.json.token);
  const legacyToken = r.json.token;
  const { rows: after } = await pool.query(
    "SELECT password_hash FROM admins WHERE username=$1",
    ["oldtimer"]
  );
  check(
    "legacy hash upgraded to scrypt on login",
    after[0].password_hash.startsWith("scrypt:")
  );

  r = await call("GET", "/api/admin/admins", { token: adminToken });
  check(
    "list admins -> both accounts, no hashes",
    r.status === 200 &&
      r.json.length === 2 &&
      r.json.every((a) => a.username && !("password_hash" in a)),
    `got ${r.status} ${JSON.stringify(r.json)}`
  );

  r = await call("POST", "/api/admin/admins", {
    token: adminToken,
    body: { username: "president26", password: "startpass1" },
  });
  check("add admin -> 201", r.status === 201, `got ${r.status}`);

  r = await call("POST", "/api/admin/admins", {
    token: adminToken,
    body: { username: "president26", password: "whatever123" },
  });
  check("add duplicate username -> 409", r.status === 409, `got ${r.status}`);

  r = await call("POST", "/api/admin/admins", {
    token: adminToken,
    body: { username: "shorty", password: "short" },
  });
  check("add admin short password -> 400", r.status === 400, `got ${r.status}`);

  r = await call("POST", "/api/admin/admins", {
    token: adminToken,
    body: { username: "bad name!", password: "longenough1" },
  });
  check("add admin bad username -> 400", r.status === 400, `got ${r.status}`);

  r = await call("POST", "/api/admin/login", {
    body: { username: "president26", password: "startpass1" },
  });
  check("new admin can log in", r.status === 200 && !!r.json.token);
  const presToken = r.json.token;

  r = await call("POST", "/api/admin/change-password", {
    token: presToken,
    body: { currentPassword: "nope-nope", newPassword: "brandnewpass1" },
  });
  check("change password wrong current -> 401", r.status === 401, `got ${r.status}`);

  r = await call("POST", "/api/admin/change-password", {
    token: presToken,
    body: { currentPassword: "startpass1", newPassword: "brandnewpass1" },
  });
  check("change password -> 200", r.status === 200, `got ${r.status}`);

  r = await call("POST", "/api/admin/login", {
    body: { username: "president26", password: "startpass1" },
  });
  check("old password no longer works -> 401", r.status === 401, `got ${r.status}`);

  r = await call("POST", "/api/admin/login", {
    body: { username: "president26", password: "brandnewpass1" },
  });
  check("new password works", r.status === 200, `got ${r.status}`);

  r = await call("DELETE", "/api/admin/admins/president26", { token: presToken });
  check("remove own account -> 400", r.status === 400, `got ${r.status}`);

  r = await call("DELETE", "/api/admin/admins/ghost", { token: adminToken });
  check("remove nonexistent admin -> 404", r.status === 404, `got ${r.status}`);

  r = await call("DELETE", "/api/admin/admins/president26", { token: adminToken });
  check("remove another admin -> 200", r.status === 200, `got ${r.status}`);

  r = await call("GET", "/api/admin/admins", { token: presToken });
  check("removed admin's session is dead -> 401", r.status === 401, `got ${r.status}`);

  r = await call("POST", "/api/admin/login", {
    body: { username: "president26", password: "brandnewpass1" },
  });
  check("removed admin cannot log in -> 401", r.status === 401, `got ${r.status}`);

  r = await call("DELETE", "/api/admin/admins/oldtimer", { token: adminToken });
  check("remove down to one admin -> 200", r.status === 200, `got ${r.status}`);

  // 'admin' is now the only account, and this token belongs to it:
  // the last-admin guard fires before the self guard by design.
  r = await call("DELETE", "/api/admin/admins/admin", { token: adminToken });
  check("remove the last admin -> 400", r.status === 400, `got ${r.status}`);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
