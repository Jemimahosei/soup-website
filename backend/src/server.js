const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const { pool } = require("./db");

const app = express();
app.use(cors());
app.use(express.json());

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

// Passwords are stored as salted scrypt hashes ("scrypt:<salt>:<hash>").
// Rows written before this change hold a bare sha256 hex digest; those
// still verify, and are upgraded to scrypt on the next successful login.
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}
function verifyPassword(stored, password) {
  if (!stored || typeof password !== "string") return false;
  if (stored.startsWith("scrypt:")) {
    const [, salt, expected] = stored.split(":");
    if (!salt || !expected) return false;
    const actual = crypto.scryptSync(password, salt, 64);
    const exp = Buffer.from(expected, "hex");
    return actual.length === exp.length && crypto.timingSafeEqual(actual, exp);
  }
  return stored === sha256(password); // legacy rows
}
const isLegacyHash = (stored) => !!stored && !stored.startsWith("scrypt:");

// Sessions gained a username column (used by the change-password and
// remove-admin guards). Add it on boot as well as in migrate.js, so a
// deploy that only restarts the server still works.
pool
  .query("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS username TEXT")
  .catch((e) => console.error(e));

// Admin sessions are stored in the database (see migrate.js), so a
// redeploy or restart does not invalidate a signed-in session.
async function requireAdmin(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (token) {
    try {
      const { rows } = await pool.query(
        "SELECT expires_at, username FROM sessions WHERE token = $1",
        [token]
      );
      if (rows.length && rows[0].expires_at > Date.now()) {
        req.adminUsername = rows[0].username || null;
        return next();
      }
    } catch (e) {
      console.error(e);
    }
  }
  return res.status(401).json({ error: "Admin login required" });
}

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

app.get("/api/health", (req, res) => res.json({ ok: true }));

// "Today" means today in Ithaca, not today on the server. The host runs
// on UTC, so after 7pm Eastern it is already tomorrow there and an event
// dated today would wrongly fall into "past". Compute the New York date
// in JS and compare against it.
function todayNY() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });
}

// ---- Public: events ----
app.get(
  "/api/events",
  asyncHandler(async (req, res) => {
    const filter = req.query.filter || "all";
    if (!["all", "upcoming", "past"].includes(filter)) {
      return res.status(400).json({ error: "Unknown filter" });
    }
    let where = "";
    let params = [];
    if (filter === "upcoming") {
      where = "WHERE event_date >= $1";
      params = [todayNY()];
    }
    if (filter === "past") {
      where = "WHERE event_date < $1";
      params = [todayNY()];
    }
    const { rows } = await pool.query(
      `SELECT * FROM events ${where} ORDER BY event_date ASC, start_time ASC`,
      params
    );
    res.json(rows);
  })
);

// IDs in the URL must be valid Postgres integers; anything else is a 404,
// not a 500 (previously "abc" or an out-of-range id crashed the query).
function parseId(req, res) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) {
    res.status(404).json({ error: "Not found" });
    return null;
  }
  return id;
}

app.get(
  "/api/events/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req, res);
    if (id === null) return;
    const { rows } = await pool.query("SELECT * FROM events WHERE id = $1", [
      id,
    ]);
    if (!rows.length) return res.status(404).json({ error: "Event not found" });
    res.json(rows[0]);
  })
);

// ---- Public: resources ----
app.get(
  "/api/resources",
  asyncHandler(async (req, res) => {
    const { category } = req.query;
    const { rows } = category
      ? await pool.query(
          "SELECT * FROM resources WHERE category = $1 ORDER BY title ASC",
          [category]
        )
      : await pool.query("SELECT * FROM resources ORDER BY title ASC");
    res.json(rows);
  })
);

app.get(
  "/api/resources/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req, res);
    if (id === null) return;
    const { rows } = await pool.query("SELECT * FROM resources WHERE id = $1", [
      id,
    ]);
    if (!rows.length)
      return res.status(404).json({ error: "Resource not found" });
    res.json(rows[0]);
  })
);

// ---- Public: announcements (pinned first, then newest) ----
app.get(
  "/api/announcements",
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      "SELECT * FROM announcements ORDER BY pinned DESC, created_at DESC, id DESC"
    );
    res.json(rows);
  })
);

// ---- Admin: login ----
app.post(
  "/api/admin/login",
  asyncHandler(async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }
    const { rows } = await pool.query(
      "SELECT * FROM admins WHERE username = $1",
      [username]
    );
    if (!rows.length || !verifyPassword(rows[0].password_hash, password)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    if (isLegacyHash(rows[0].password_hash)) {
      // Transparently upgrade the stored hash to scrypt.
      await pool.query(
        "UPDATE admins SET password_hash = $1 WHERE id = $2",
        [hashPassword(password), rows[0].id]
      );
    }
    const token = crypto.randomBytes(32).toString("hex");
    const expiry = Date.now() + 24 * 60 * 60 * 1000;
    await pool.query("DELETE FROM sessions WHERE expires_at < $1", [Date.now()]);
    await pool.query(
      "INSERT INTO sessions (token, expires_at, username) VALUES ($1, $2, $3)",
      [token, expiry, username]
    );
    res.json({ token, username });
  })
);

// ---- Admin: logout (invalidate the session server-side) ----
app.post(
  "/api/admin/logout",
  asyncHandler(async (req, res) => {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (token) {
      await pool.query("DELETE FROM sessions WHERE token = $1", [token]);
    }
    res.json({ ok: true });
  })
);

// ---- Admin: manage who has admin access ----
// Each executive-board member gets their own account. A signed-in
// admin can add the next board, remove people who have left, and
// change their own password — so access survives the yearly handover
// without one shared password that can never be taken back.
const USERNAME_RE = /^[A-Za-z0-9._-]{3,32}$/;
const validNewPassword = (p) => typeof p === "string" && p.length >= 8;

app.get(
  "/api/admin/admins",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      "SELECT username, created_at FROM admins ORDER BY created_at ASC, username ASC"
    );
    res.json(rows);
  })
);

app.post(
  "/api/admin/admins",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { username, password } = req.body || {};
    const name = typeof username === "string" ? username.trim() : "";
    if (!USERNAME_RE.test(name)) {
      return res.status(400).json({
        error:
          "Username must be 3–32 characters: letters, numbers, dots, dashes or underscores",
      });
    }
    if (!validNewPassword(password)) {
      return res
        .status(400)
        .json({ error: "Password must be at least 8 characters" });
    }
    const existing = await pool.query(
      "SELECT id FROM admins WHERE username = $1",
      [name]
    );
    if (existing.rows.length) {
      return res.status(409).json({ error: "That username is already taken" });
    }
    await pool.query(
      "INSERT INTO admins (username, password_hash) VALUES ($1, $2)",
      [name, hashPassword(password)]
    );
    res.status(201).json({ username: name });
  })
);

app.delete(
  "/api/admin/admins/:username",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const name = req.params.username;
    const { rows: all } = await pool.query("SELECT username FROM admins");
    if (!all.some((a) => a.username === name)) {
      return res.status(404).json({ error: "No such admin" });
    }
    if (all.length <= 1) {
      return res
        .status(400)
        .json({ error: "You can't remove the last admin account" });
    }
    if (req.adminUsername && name === req.adminUsername) {
      return res.status(400).json({
        error: "You can't remove your own account — ask another admin to do it",
      });
    }
    await pool.query("DELETE FROM admins WHERE username = $1", [name]);
    // Sign the removed person out everywhere, too.
    await pool.query("DELETE FROM sessions WHERE username = $1", [name]);
    res.json({ ok: true });
  })
);

app.post(
  "/api/admin/change-password",
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (!req.adminUsername) {
      return res
        .status(401)
        .json({ error: "Please log in again to change your password" });
    }
    const { currentPassword, newPassword } = req.body || {};
    if (!validNewPassword(newPassword)) {
      return res
        .status(400)
        .json({ error: "New password must be at least 8 characters" });
    }
    const { rows } = await pool.query(
      "SELECT * FROM admins WHERE username = $1",
      [req.adminUsername]
    );
    if (!rows.length || !verifyPassword(rows[0].password_hash, currentPassword || "")) {
      return res.status(401).json({ error: "Current password is wrong" });
    }
    await pool.query(
      "UPDATE admins SET password_hash = $1 WHERE username = $2",
      [hashPassword(newPassword), req.adminUsername]
    );
    res.json({ ok: true });
  })
);

// ---- Admin: generic CRUD over the three content tables ----
const TABLES = {
  events: {
    cols: [
      "title", "description", "location", "event_date", "start_time",
      "end_time", "category", "difficulty", "spots_total", "spots_taken",
      "image_url",
    ],
  },
  resources: { cols: ["title", "category", "description", "url", "body", "image_url"] },
  announcements: { cols: ["title", "body", "pinned"] },
};

// Validate an admin write before it reaches the database: bad input gets a
// 400 with a clear message instead of a 500 from a Postgres constraint.
function validateWrite(table, body) {
  const bad = (msg) => ({ error: msg });
  const nonEmpty = (v) => typeof v === "string" && v.trim() !== "";
  if (!nonEmpty(body.title)) return bad("Title is required");
  if (table === "events") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.event_date || "") || Number.isNaN(Date.parse(body.event_date))) {
      return bad("A valid event date (YYYY-MM-DD) is required");
    }
    for (const key of ["start_time", "end_time"]) {
      const t = body[key];
      if (t !== undefined && t !== null && t !== "") {
        const m = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(t);
        if (!m || +m[1] > 23 || +m[2] > 59 || (m[3] !== undefined && +m[3] > 59)) {
          return bad(`${key} must be a valid time (HH:MM)`);
        }
      }
    }
    for (const key of ["spots_total", "spots_taken"]) {
      const v = body[key];
      if (v !== undefined && v !== null && v !== "" && !Number.isInteger(v)) {
        return bad(`${key} must be a whole number`);
      }
    }
  }
  return null;
}

function crudRouter(table) {
  const router = express.Router();
  const { cols } = TABLES[table];

  // Only columns actually present in the request body are written; omitted
  // ones keep their current value (update) or the database default
  // (create) instead of being overwritten with NULL (previously a partial
  // update could 500 on a NOT NULL column). An explicitly empty string
  // IS written, so clearing a field in the admin form works.
  const presentCols = (body) => cols.filter((c) => body[c] !== undefined);
  // Blank spot counts coming from an API client get the same treatment as
  // the admin form: total is optional (null), taken defaults to 0.
  const colValue = (c, v) => {
    if (c === "spots_taken" && (v === "" || v === null)) return 0;
    if (c === "spots_total" && v === "") return null;
    // Blank time inputs arrive as "" — Postgres rejects "" for TIME, so
    // treat it as "no time" (NULL). This was the last create blocker:
    // the form leaves start/end blank unless the admin picks a time.
    if ((c === "start_time" || c === "end_time") && v === "") return null;
    return v ?? null;
  };

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      const err = validateWrite(table, body);
      if (err) return res.status(400).json(err);
      const useCols = presentCols(body);
      const values = useCols.map((c) => colValue(c, body[c]));
      const placeholders = useCols.map((_, i) => `$${i + 1}`).join(", ");
      const { rows } = await pool.query(
        `INSERT INTO ${table} (${useCols.join(", ")}) VALUES (${placeholders}) RETURNING *`,
        values
      );
      res.status(201).json(rows[0]);
    })
  );

  router.put(
    "/:id",
    asyncHandler(async (req, res) => {
      const id = parseId(req, res);
      if (id === null) return;
      const body = req.body || {};
      const err = validateWrite(table, body);
      if (err) return res.status(400).json(err);
      const useCols = presentCols(body);
      const sets = useCols.map((c, i) => `${c} = $${i + 1}`).join(", ");
      const { rows } = await pool.query(
        `UPDATE ${table} SET ${sets}, updated_at = now() WHERE id = $${useCols.length + 1} RETURNING *`,
        [...useCols.map((c) => colValue(c, body[c])), id]
      );
      if (!rows.length)
        return res.status(404).json({ error: `${table} item not found` });
      res.json(rows[0]);
    })
  );

  router.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      const id = parseId(req, res);
      if (id === null) return;
      const { rowCount } = await pool.query(
        `DELETE FROM ${table} WHERE id = $1`,
        [id]
      );
      if (!rowCount)
        return res.status(404).json({ error: `${table} item not found` });
      res.json({ deleted: true });
    })
  );

  return router;
}

app.use("/api/admin/events", requireAdmin, crudRouter("events"));
app.use("/api/admin/resources", requireAdmin, crudRouter("resources"));
app.use("/api/admin/announcements", requireAdmin, crudRouter("announcements"));

// ---- Serve the built frontend (single-service deploy) ----
// In production the API serves the Vite build from frontend/dist, so the
// whole site runs on one host. Local API-only runs (no dist folder) skip
// this and keep serving just /api.
const fs = require("fs");
const path = require("path");
const distDir = path.join(__dirname, "../../frontend/dist");
if (fs.existsSync(path.join(distDir, "index.html"))) {
  app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));
  app.use(express.static(distDir));
  app.get("*", (req, res) => {
    // Missing photos must 404 (so the frontend's raw-repo fallback can
    // trigger) instead of serving the SPA shell, which an <img> can't use.
    if (req.path.startsWith("/images/")) return res.status(404).end();
    res.sendFile(path.join(distDir, "index.html"));
  });
}

// ---- Errors ----
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`SOUP API listening on http://localhost:${port}`);
});
