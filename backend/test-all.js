// Full backend test suite: boots the REAL migrate.js, seed.js, server.js
// against in-memory Postgres (pg-mem) and exercises every endpoint,
// including auth, validation, and edge cases. Exits non-zero on any failure.
const Module = require("module");
const { newDb } = require("pg-mem");

const BACKEND = __dirname;
process.env.ADMIN_USERNAME = "admin";
process.env.ADMIN_PASSWORD = "soup-admin-2026-verify";
process.env.PORT = "3131";
process.env.DATABASE_URL = "postgres://soup:soup@localhost:5432/soup";

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
const failures = [];
function check(name, cond, extra = "") {
  if (cond) {
    passed++;
    console.log(`  PASS ${name}`);
  } else {
    failed++;
    failures.push(name);
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
    if (Date.now() - start > timeoutMs)
      throw new Error(`timeout waiting for ${label}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

const BASE = "http://localhost:3131";
async function call(method, path, { token, body, rawBody } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : rawBody,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json, text: res.status, headers: res.headers };
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
  require(`${BACKEND}/src/seed.js`);
  await waitFor(async () => {
    const { rows } = await pool.query("SELECT count(*)::int AS n FROM events");
    return rows[0].n === 2 ? true : null;
  }, "seed");
  require(`${BACKEND}/src/server.js`);
  await waitFor(async () => {
    const res = await fetch(`${BASE}/api/health`);
    return res.ok ? true : null;
  }, "server");
  console.log("== boot OK ==\n-- public API --");

  let r = await call("GET", "/api/health");
  check("health 200 {ok:true}", r.status === 200 && r.json && r.json.ok === true);

  r = await call("GET", "/api/events");
  check("events all = 2, date ASC", r.status === 200 && r.json.length === 2 && r.json[0].title.includes("161 Things"));

  r = await call("GET", "/api/events?filter=upcoming");
  check("events upcoming = []", r.status === 200 && Array.isArray(r.json) && r.json.length === 0);

  r = await call("GET", "/api/events?filter=past");
  check("events past = 2", r.status === 200 && r.json.length === 2);

  r = await call("GET", "/api/events?filter=bogus");
  check("events bogus filter -> 400", r.status === 400, `got ${r.status}`);

  r = await call("GET", "/api/events/1");
  check("event 1 = 161 Things", r.status === 200 && r.json.title.includes("161 Things"));

  r = await call("GET", "/api/events/999");
  check("event 999 -> 404", r.status === 404, `got ${r.status}`);

  r = await call("GET", "/api/events/abc");
  check("event abc -> 404 (not 500)", r.status === 404, `got ${r.status}`);

  r = await call("GET", "/api/events/99999999999999999999");
  check("event huge id -> 404 (not 500)", r.status === 404, `got ${r.status}`);

  r = await call("GET", "/api/events/0");
  check("event 0 -> 404", r.status === 404, `got ${r.status}`);

  r = await call("GET", "/api/events/-1");
  check("event -1 -> 404", r.status === 404, `got ${r.status}`);

  r = await call("GET", "/api/resources");
  check("resources all = 13", r.status === 200 && r.json.length === 13, `got ${r.json && r.json.length}`);

  for (const [cat, n] of [["story", 7], ["poem", 2], ["guide", 2], ["link", 2]]) {
    r = await call("GET", `/api/resources?category=${cat}`);
    check(`resources category=${cat} = ${n}`, r.status === 200 && r.json.length === n, `got ${r.json && r.json.length}`);
  }
  r = await call("GET", "/api/resources?category=bogus");
  check("resources bogus category = []", r.status === 200 && r.json.length === 0);

  r = await call("GET", "/api/resources/1");
  check("resource 1 -> 200", r.status === 200 && !!r.json.title);
  r = await call("GET", "/api/resources/999");
  check("resource 999 -> 404", r.status === 404, `got ${r.status}`);
  r = await call("GET", "/api/resources/abc");
  check("resource abc -> 404 (not 500)", r.status === 404, `got ${r.status}`);

  r = await call("GET", "/api/announcements");
  check(
    "announcements = 3, pinned first",
    r.status === 200 && r.json.length === 3 && r.json[0].pinned === true,
    `got ${r.json && r.json.length}`
  );

  r = await call("GET", "/api/nope");
  check("unknown API route -> 404 json", r.status === 404 && r.json && r.json.error === "Not found", `got ${r.status}`);

  const homeRes = await fetch(`${BASE}/`);
  check("GET / serves SPA html", homeRes.status === 200 && (homeRes.headers.get("content-type") || "").includes("html"));

  const imgRes = await fetch(`${BASE}/images/does-not-exist.jpg`);
  check("GET /images/missing -> 404 (not SPA)", imgRes.status === 404, `got ${imgRes.status}`);

  console.log("\n-- auth --");
  r = await call("POST", "/api/admin/login", { body: { username: "admin" } });
  check("login missing password -> 400", r.status === 400, `got ${r.status}`);
  r = await call("POST", "/api/admin/login", { body: { password: "x" } });
  check("login missing username -> 400", r.status === 400, `got ${r.status}`);
  r = await call("POST", "/api/admin/login", { body: { username: "admin", password: "wrong" } });
  check("login wrong password -> 401", r.status === 401, `got ${r.status}`);
  r = await call("POST", "/api/admin/login", { body: { username: "nobody", password: "x" } });
  check("login unknown user -> 401", r.status === 401, `got ${r.status}`);
  r = await call("POST", "/api/admin/login", { body: { username: "admin", password: "soup-admin-2026-verify" } });
  check("login correct -> 200 + token", r.status === 200 && !!r.json.token, `got ${r.status}`);
  const token = r.json.token;

  // Expired session must be rejected.
  await pool.query("INSERT INTO sessions (token, expires_at) VALUES ($1, $2)", ["expired-token", Date.now() - 1000]);
  r = await call("GET", "/api/events", { token: "expired-token" });
  check("expired token on public route is ignored (public stays public)", r.status === 200);
  r = await call("POST", "/api/admin/events", { token: "expired-token", body: { title: "x", event_date: "2026-12-01" } });
  check("expired token on admin create -> 401", r.status === 401, `got ${r.status}`);

  console.log("\n-- admin CRUD: events --");
  const goodEvent = {
    title: "Test Hike", description: "d", location: "l", event_date: "2026-12-01",
    start_time: "09:00", end_time: "12:00", category: "trip", difficulty: "easy",
    spots_total: 10, spots_taken: 0, image_url: null,
  };
  r = await call("POST", "/api/admin/events", { body: goodEvent });
  check("create without token -> 401", r.status === 401, `got ${r.status}`);
  r = await call("POST", "/api/admin/events", { token: "bad-token", body: goodEvent });
  check("create bad token -> 401", r.status === 401, `got ${r.status}`);
  r = await call("POST", "/api/admin/events", { token, body: goodEvent });
  check("create valid -> 201", r.status === 201 && r.json.id > 2, `got ${r.status}`);
  const evId = r.json && r.json.id;

  r = await call("POST", "/api/admin/events", { token, body: { ...goodEvent, spots_total: null, spots_taken: 0 } });
  check("create blank spots -> 201", r.status === 201, `got ${r.status}`);

  // The admin form leaves blank times as "" — that must save as NULL, not 500.
  r = await call("POST", "/api/admin/events", { token, body: { ...goodEvent, title: "Blank Times", start_time: "", end_time: "" } });
  check("create blank times -> 201", r.status === 201 && r.json.start_time === null, `got ${r.status} ${JSON.stringify(r.json)}`);

  r = await call("POST", "/api/admin/events", { token, body: { ...goodEvent, title: "" } });
  check("create empty title -> 400 (not 500)", r.status === 400, `got ${r.status}`);
  r = await call("POST", "/api/admin/events", { token, body: { ...goodEvent, title: undefined, event_date: undefined } });
  check("create missing title+date -> 400 (not 500)", r.status === 400, `got ${r.status}`);
  r = await call("POST", "/api/admin/events", { token, body: { ...goodEvent, event_date: "not-a-date" } });
  check("create bad date -> 400 (not 500)", r.status === 400, `got ${r.status}`);
  r = await call("POST", "/api/admin/events", { token, body: { ...goodEvent, start_time: "25:00" } });
  check("create bad time -> 400 (not 500)", r.status === 400, `got ${r.status}`);
  r = await call("POST", "/api/admin/events", { token, body: { ...goodEvent, title: "Extra Field", surprise: "ignored" } });
  check("create extra field ignored -> 201", r.status === 201 && r.json.surprise === undefined, `got ${r.status}`);

  r = await call("PUT", `/api/admin/events/${evId}`, { token, body: { ...goodEvent, title: "Test Hike Updated" } });
  check("update valid -> 200", r.status === 200 && r.json.title === "Test Hike Updated", `got ${r.status}`);
  r = await call("PUT", "/api/admin/events/999", { token, body: goodEvent });
  check("update missing -> 404", r.status === 404, `got ${r.status}`);
  r = await call("PUT", "/api/admin/events/abc", { token, body: goodEvent });
  check("update abc id -> 404 (not 500)", r.status === 404, `got ${r.status}`);
  r = await call("PUT", `/api/admin/events/${evId}`, { token, body: { ...goodEvent, title: "" } });
  check("update empty title -> 400", r.status === 400, `got ${r.status}`);
  r = await call("DELETE", `/api/admin/events/${evId}`, { token });
  check("delete valid -> 200", r.status === 200 && r.json.deleted === true, `got ${r.status}`);
  r = await call("DELETE", `/api/admin/events/${evId}`, { token });
  check("delete again -> 404", r.status === 404, `got ${r.status}`);
  r = await call("DELETE", "/api/admin/events/abc", { token });
  check("delete abc id -> 404 (not 500)", r.status === 404, `got ${r.status}`);

  // Upcoming/past boundary is "today in Ithaca", not "today on the server"
  // (the host runs on UTC, so after 7pm Eastern it is already tomorrow
  // there). An event dated today-NY is upcoming; yesterday-NY is past.
  const todayNY = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const [nyY, nyM, nyD] = todayNY.split("-").map(Number);
  const ydayNY = new Date(Date.UTC(nyY, nyM - 1, nyD - 1)).toISOString().slice(0, 10);
  r = await call("POST", "/api/admin/events", { token, body: { ...goodEvent, title: "Today NY", event_date: todayNY } });
  check("create today-NY event -> 201", r.status === 201 && r.json.id, `got ${r.status}`);
  const todayId = r.json && r.json.id;
  r = await call("POST", "/api/admin/events", { token, body: { ...goodEvent, title: "Yesterday NY", event_date: ydayNY } });
  check("create yesterday-NY event -> 201", r.status === 201 && r.json.id, `got ${r.status}`);
  const ydayId = r.json && r.json.id;
  r = await call("GET", "/api/events?filter=upcoming");
  check("upcoming includes today-NY, excludes yesterday-NY", r.status === 200 && r.json.some((e) => e.title === "Today NY") && !r.json.some((e) => e.title === "Yesterday NY"), `got ${JSON.stringify(r.json.map((e) => e.title))}`);
  r = await call("GET", "/api/events?filter=past");
  check("past includes yesterday-NY, excludes today-NY", r.status === 200 && r.json.some((e) => e.title === "Yesterday NY") && !r.json.some((e) => e.title === "Today NY"), `got ${JSON.stringify(r.json.map((e) => e.title))}`);
  r = await call("DELETE", `/api/admin/events/${todayId}`, { token });
  check("delete today-NY test event -> 200", r.status === 200, `got ${r.status}`);
  r = await call("DELETE", `/api/admin/events/${ydayId}`, { token });
  check("delete yesterday-NY test event -> 200", r.status === 200, `got ${r.status}`);
  r = await call("PUT", `/api/admin/events/${evId}`, { body: goodEvent });
  check("update without token -> 401", r.status === 401, `got ${r.status}`);

  console.log("\n-- admin CRUD: resources + announcements --");
  r = await call("POST", "/api/admin/resources", { token, body: { title: "Test Story", category: "story", description: "d", body: "b", image_url: null } });
  check("resource create -> 201", r.status === 201 && r.json.id, `got ${r.status}`);
  const resId = r.json && r.json.id;
  r = await call("POST", "/api/admin/resources", { token, body: { title: "", category: "story" } });
  check("resource create empty title -> 400", r.status === 400, `got ${r.status}`);
  r = await call("PUT", `/api/admin/resources/${resId}`, { token, body: { title: "Test Story 2", category: "story", description: "d", body: "b" } });
  check("resource update -> 200", r.status === 200 && r.json.title === "Test Story 2", `got ${r.status}`);
  r = await call("DELETE", `/api/admin/resources/${resId}`, { token });
  check("resource delete -> 200", r.status === 200, `got ${r.status}`);
  r = await call("DELETE", "/api/admin/resources/999", { token });
  check("resource delete missing -> 404", r.status === 404, `got ${r.status}`);

  r = await call("POST", "/api/admin/announcements", { token, body: { title: "Test Note", body: "b", pinned: true } });
  check("announcement create -> 201", r.status === 201 && r.json.id, `got ${r.status}`);
  const annId = r.json && r.json.id;
  r = await call("POST", "/api/admin/announcements", { token, body: { title: "", body: "b" } });
  check("announcement create empty title -> 400", r.status === 400, `got ${r.status}`);
  r = await call("PUT", `/api/admin/announcements/${annId}`, { token, body: { title: "Test Note 2", body: "b", pinned: false } });
  check("announcement update -> 200", r.status === 200 && r.json.title === "Test Note 2", `got ${r.status}`);
  r = await call("DELETE", `/api/admin/announcements/${annId}`, { token });
  check("announcement delete -> 200", r.status === 200, `got ${r.status}`);

  console.log("\n-- logout --");
  r = await call("POST", "/api/admin/logout", { token });
  check("logout -> 200", r.status === 200, `got ${r.status}`);
  r = await call("POST", "/api/admin/events", { token, body: goodEvent });
  check("token dead after logout -> 401", r.status === 401, `got ${r.status}`);
  r = await call("POST", "/api/admin/logout", {});
  check("logout without token -> 200 (idempotent)", r.status === 200, `got ${r.status}`);

  console.log(`\n== ${passed} passed, ${failed} failed ==`);
  if (failed) {
    console.log("Failures:", failures.join("; "));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("HARNESS FAIL:", e.message);
  process.exit(1);
});
