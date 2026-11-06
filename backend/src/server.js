const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const { pool } = require("./db");

const app = express();
app.use(cors());
app.use(express.json());

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

// Admin sessions are stored in the database (see migrate.js), so a
// redeploy or restart does not invalidate a signed-in session.
async function requireAdmin(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (token) {
    try {
      const { rows } = await pool.query(
        "SELECT expires_at FROM sessions WHERE token = $1",
        [token]
      );
      if (rows.length && rows[0].expires_at > Date.now()) return next();
    } catch (e) {
      console.error(e);
    }
  }
  return res.status(401).json({ error: "Admin login required" });
}

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

app.get("/api/health", (req, res) => res.json({ ok: true }));

// ---- Public: events ----
app.get(
  "/api/events",
  asyncHandler(async (req, res) => {
    const filter = req.query.filter || "all";
    if (!["all", "upcoming", "past"].includes(filter)) {
      return res.status(400).json({ error: "Unknown filter" });
    }
    let where = "";
    if (filter === "upcoming") where = "WHERE event_date >= CURRENT_DATE";
    if (filter === "past") where = "WHERE event_date < CURRENT_DATE";
    const { rows } = await pool.query(
      `SELECT * FROM events ${where} ORDER BY event_date ASC, start_time ASC`
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
    if (!rows.length || rows[0].password_hash !== sha256(password)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = crypto.randomBytes(32).toString("hex");
    const expiry = Date.now() + 24 * 60 * 60 * 1000;
    await pool.query("DELETE FROM sessions WHERE expires_at < $1", [Date.now()]);
    await pool.query(
      "INSERT INTO sessions (token, expires_at) VALUES ($1, $2)",
      [token, expiry]
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
