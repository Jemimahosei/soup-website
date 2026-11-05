const crypto = require("crypto");
const { pool } = require("./db");

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      event_date DATE NOT NULL,
      start_time TIME,
      end_time TIME,
      category TEXT NOT NULL DEFAULT 'hike',
      difficulty TEXT NOT NULL DEFAULT 'moderate',
      spots_total INTEGER,
      spots_taken INTEGER NOT NULL DEFAULT 0,
      image_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS resources (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'guide',
      description TEXT NOT NULL DEFAULT '',
      url TEXT,
      body TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS announcements (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      pinned BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    -- Admin sessions live in the database (not server memory) so a
    -- redeploy/restart does not log everyone out mid-session.
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      expires_at BIGINT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Photos: resources gained an image_url column with the retrofit
  // (event stories carry their real photos). Safe on existing DBs.
  await pool.query(`
    ALTER TABLE resources ADD COLUMN IF NOT EXISTS image_url TEXT;
  `);

  // Seeded admin account (dev/demo only — change via env vars).
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "soup-admin";
  await pool.query(
    `INSERT INTO admins (username, password_hash)
     VALUES ($1, $2)
     ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [username, sha256(password)]
  );

  console.log("Migrations complete.");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
