const { Pool } = require("pg");

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgres://soup:soup@localhost:5432/soup",
});

module.exports = { pool };
