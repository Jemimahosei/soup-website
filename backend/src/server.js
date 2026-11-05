const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const { pool } = require("./db");

const app = express();
app.use(cors());
app.use(express.json());

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

// Demo-only admin sessions: token -> expiry timestamp. Not production auth.
const sessions = new Map();

function requireAdmin(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const expiry = sessions.get(token);
  if (!token || !expiry || expiry < Date.now()) {
    return res.status(401).json({ error: "Admin login required" });
  }
  next();
}

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

app.get("/api/health", (req, res) => res.json({ ok: true }));

// ---- Public: events ----
app.get(
  "/api/events",
  asyncHandler(async (req, res) => {
    const filter = req.query.filter || "all";
    let where = "";
    if (filter === "upcoming") where = "WHERE event_date >= CURRENT_DATE";
    if (filter === "past") where = "WHERE event_date < CURRENT_DATE";
    const { rows } = await pool.query(
      `SELECT * FROM events ${where} ORDER BY event_date ASC, start_time ASC`
    );
    res.json(rows);
  })
);

app.get(
  "/api/events/:id",
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query("SELECT * FROM events WHERE id = $1", [
      req.params.id,
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
    const { rows } = await pool.query("SELECT * FROM resources WHERE id = $1", [
      req.params.id,
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
    sessions.set(token, Date.now() + 24 * 60 * 60 * 1000);
    res.json({ token, username });
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

function crudRouter(table) {
  const router = express.Router();
  const { cols } = TABLES[table];

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const values = cols.map((c) => req.body[c] ?? null);
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
      const { rows } = await pool.query(
        `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders}) RETURNING *`,
        values
      );
      res.status(201).json(rows[0]);
    })
  );

  router.put(
    "/:id",
    asyncHandler(async (req, res) => {
      const sets = cols.map((c, i) => `${c} = $${i + 1}`).join(", ");
      const { rows } = await pool.query(
        `UPDATE ${table} SET ${sets}, updated_at = now() WHERE id = $${cols.length + 1} RETURNING *`,
        [...cols.map((c) => req.body[c] ?? null), req.params.id]
      );
      if (!rows.length)
        return res.status(404).json({ error: `${table} item not found` });
      res.json(rows[0]);
    })
  );

  router.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      const { rowCount } = await pool.query(
        `DELETE FROM ${table} WHERE id = $1`,
        [req.params.id]
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
