'use strict';

// ── PostgreSQL (production / Render) ──────────────────────────────────────────
if (process.env.DATABASE_URL) {
  const pg = require('pg');

  // Parse COUNT(*) / SUM() columns as JS Numbers instead of strings
  pg.types.setTypeParser(20,   v => parseInt(v, 10));  // BIGINT
  pg.types.setTypeParser(1700, v => parseFloat(v));    // NUMERIC

  const { Pool } = pg;
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Render's managed PostgreSQL requires SSL; skip cert verification for self-signed certs
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
    max: 10,
  });

  // ── Schema ─────────────────────────────────────────────────────────────────
  pool.query(`
    CREATE TABLE IF NOT EXISTS merchants (
      id         SERIAL PRIMARY KEY,
      name       TEXT    NOT NULL,
      email      TEXT    UNIQUE NOT NULL,
      password   TEXT    NOT NULL,
      logo_url   TEXT,
      color      TEXT    DEFAULT '#6366f1',
      plan       TEXT    DEFAULT 'free',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS customers (
      id         SERIAL PRIMARY KEY,
      first_name TEXT    NOT NULL,
      phone      TEXT    UNIQUE NOT NULL,
      qr_code    TEXT    UNIQUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS memberships (
      id          SERIAL PRIMARY KEY,
      merchant_id INTEGER NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
      customer_id INTEGER NOT NULL REFERENCES customers(id)  ON DELETE CASCADE,
      points      INTEGER NOT NULL DEFAULT 0,
      joined_at   TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (merchant_id, customer_id)
    );

    CREATE TABLE IF NOT EXISTS rewards (
      id              SERIAL PRIMARY KEY,
      merchant_id     INTEGER NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
      description     TEXT    NOT NULL,
      points_required INTEGER NOT NULL,
      active          INTEGER NOT NULL DEFAULT 1,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id          SERIAL PRIMARY KEY,
      merchant_id INTEGER NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
      customer_id INTEGER NOT NULL REFERENCES customers(id)  ON DELETE CASCADE,
      points      INTEGER NOT NULL,
      note        TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS scan_attempts (
      id          SERIAL PRIMARY KEY,
      merchant_id INTEGER NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
      customer_id INTEGER NOT NULL REFERENCES customers(id)  ON DELETE CASCADE,
      points      INTEGER,
      blocked     INTEGER NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id          SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      endpoint    TEXT    NOT NULL,
      auth        TEXT    NOT NULL,
      p256dh      TEXT    NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (customer_id, endpoint)
    );

    CREATE TABLE IF NOT EXISTS notification_logs (
      id              SERIAL PRIMARY KEY,
      merchant_id     INTEGER NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
      title           TEXT    NOT NULL,
      body            TEXT    NOT NULL,
      audience        TEXT    NOT NULL DEFAULT 'all',
      recipient_count INTEGER NOT NULL DEFAULT 0,
      sent_at         TIMESTAMPTZ DEFAULT NOW()
    );
  `).then(() => runPgMigrations()).catch(err => {
    console.error('PostgreSQL schema init failed:', err.message);
    process.exit(1);
  });

  // Run column migrations only when the column is actually missing.
  // This avoids ACCESS EXCLUSIVE locks on every startup (IF NOT EXISTS still locks).
  async function runPgMigrations() {
    const { rows } = await pool.query(
      "SELECT table_name, column_name FROM information_schema.columns WHERE table_name IN ('merchants','customers')"
    );
    const has = (table, col) => rows.some(r => r.table_name === table && r.column_name === col);

    const merchantMigrations = [
      ['disabled',               'INTEGER     NOT NULL DEFAULT 0'],
      ['reset_token',            'TEXT'],
      ['reset_token_exp',        'TIMESTAMPTZ'],
      ['subscription_status',    "TEXT        NOT NULL DEFAULT 'trial'"],
      ['trial_ends_at',          'TIMESTAMPTZ'],
      ['stripe_customer_id',     'TEXT'],
      ['stripe_subscription_id', 'TEXT'],
      ['trial_reminder_sent',    "TEXT        NOT NULL DEFAULT ''"],
      ['business_type',          'TEXT'],
      ['loyalty_mechanic',       "TEXT NOT NULL DEFAULT 'points'"],
    ];
    const customerMigrations = [
      ['email', 'TEXT'],
    ];

    for (const [col, def] of merchantMigrations) {
      if (!has('merchants', col)) {
        await pool.query(`ALTER TABLE merchants ADD COLUMN ${col} ${def}`);
      }
    }
    for (const [col, def] of customerMigrations) {
      if (!has('customers', col)) {
        await pool.query(`ALTER TABLE customers ADD COLUMN ${col} ${def}`);
      }
    }
  }

  // ── Client factory (used for both pool and transaction clients) ────────────
  function makeClient(client) {
    return {
      async one(sql, params = []) {
        const { rows } = await client.query(sql, params);
        return rows[0] ?? null;
      },
      async all(sql, params = []) {
        const { rows } = await client.query(sql, params);
        return rows;
      },
      async insert(sql, params = []) {
        const { rows } = await client.query(`${sql} RETURNING id`, params);
        return rows[0].id;
      },
      async run(sql, params = []) {
        await client.query(sql, params);
      },
    };
  }

  // "today" expression for anti-fraud query (UTC)
  const todayExpr = "DATE(created_at) = CURRENT_DATE";

  module.exports = {
    ...makeClient(pool),
    todayExpr,
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn(makeClient(client));
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
  };

// ── SQLite (local development fallback) ──────────────────────────────────────
} else {
  const { DatabaseSync } = require('node:sqlite');
  const path = require('path');

  const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../fidelyzio.db');
  const sqlite  = new DatabaseSync(DB_PATH);

  sqlite.exec('PRAGMA journal_mode = WAL');
  sqlite.exec('PRAGMA foreign_keys = ON');

  // Drop tables that still have the old card_id schema (pre-universal-card migration)
  const txCols = sqlite.prepare("PRAGMA table_info(transactions)").all();
  if (txCols.length > 0 && txCols.find(c => c.name === 'card_id')) {
    sqlite.exec('DROP TABLE IF EXISTS transactions');
    sqlite.exec('DROP TABLE IF EXISTS cards');
  }

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS merchants (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      email      TEXT    UNIQUE NOT NULL,
      password   TEXT    NOT NULL,
      logo_url   TEXT,
      color      TEXT    DEFAULT '#6366f1',
      plan       TEXT    DEFAULT 'free',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customers (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT    NOT NULL,
      phone      TEXT    UNIQUE NOT NULL,
      qr_code    TEXT    UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS memberships (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      merchant_id INTEGER NOT NULL,
      customer_id INTEGER NOT NULL,
      points      INTEGER NOT NULL DEFAULT 0,
      joined_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (merchant_id, customer_id),
      FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
      FOREIGN KEY (customer_id) REFERENCES customers(id)  ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS rewards (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      merchant_id     INTEGER NOT NULL,
      description     TEXT    NOT NULL,
      points_required INTEGER NOT NULL,
      active          INTEGER NOT NULL DEFAULT 1,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      merchant_id INTEGER NOT NULL,
      customer_id INTEGER NOT NULL,
      points      INTEGER NOT NULL,
      note        TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
      FOREIGN KEY (customer_id) REFERENCES customers(id)  ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS scan_attempts (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      merchant_id INTEGER NOT NULL,
      customer_id INTEGER NOT NULL,
      points      INTEGER,
      blocked     INTEGER NOT NULL DEFAULT 0,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
      FOREIGN KEY (customer_id) REFERENCES customers(id)  ON DELETE CASCADE
    );
  `);

  // Migrations for new columns
  const merchantCols = sqlite.prepare('PRAGMA table_info(merchants)').all();
  const mcAdd = (col, def) => { if (!merchantCols.find(c => c.name === col)) sqlite.exec(`ALTER TABLE merchants ADD COLUMN ${col} ${def}`); };
  mcAdd('disabled',               'INTEGER NOT NULL DEFAULT 0');
  mcAdd('reset_token',            'TEXT');
  mcAdd('reset_token_exp',        'DATETIME');
  mcAdd('subscription_status',    "TEXT NOT NULL DEFAULT 'trial'");
  mcAdd('trial_ends_at',          'DATETIME');
  mcAdd('stripe_customer_id',     'TEXT');
  mcAdd('stripe_subscription_id', 'TEXT');
  mcAdd('trial_reminder_sent',    "TEXT NOT NULL DEFAULT ''");
  mcAdd('business_type',          'TEXT');
  mcAdd('loyalty_mechanic',       "TEXT NOT NULL DEFAULT 'points'");

  const customerCols = sqlite.prepare('PRAGMA table_info(customers)').all();
  if (!customerCols.find(c => c.name === 'email'))
    sqlite.exec('ALTER TABLE customers ADD COLUMN email TEXT');

  sqlite.exec(`CREATE TABLE IF NOT EXISTS push_subscriptions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    endpoint    TEXT    NOT NULL,
    auth        TEXT    NOT NULL,
    p256dh      TEXT    NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (customer_id, endpoint),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
  );`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS notification_logs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    merchant_id     INTEGER NOT NULL,
    title           TEXT    NOT NULL,
    body            TEXT    NOT NULL,
    audience        TEXT    NOT NULL DEFAULT 'all',
    recipient_count INTEGER NOT NULL DEFAULT 0,
    sent_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
  );`);

  // Convert $1, $2, ... → ? (SQLite positional) and reorder params accordingly.
  // Handles repeated $N correctly: each occurrence pushes the corresponding param value.
  function toSqlite(sql, params) {
    const bound = [];
    const converted = sql.replace(/\$(\d+)/g, (_, n) => {
      bound.push(params[+n - 1]);
      return '?';
    });
    return [converted, bound];
  }

  function makeClient(sq) {
    return {
      one(sql, params = []) {
        const [s, p] = toSqlite(sql, params);
        return Promise.resolve(sq.prepare(s).get(...p) ?? null);
      },
      all(sql, params = []) {
        const [s, p] = toSqlite(sql, params);
        return Promise.resolve(sq.prepare(s).all(...p));
      },
      insert(sql, params = []) {
        const [s, p] = toSqlite(sql, params);
        const result = sq.prepare(s).run(...p);
        return Promise.resolve(Number(result.lastInsertRowid));
      },
      run(sql, params = []) {
        const [s, p] = toSqlite(sql, params);
        sq.prepare(s).run(...p);
        return Promise.resolve();
      },
    };
  }

  const client = makeClient(sqlite);

  module.exports = {
    ...client,
    todayExpr: "DATE(created_at) = DATE('now')",
    async transaction(fn) {
      sqlite.exec('BEGIN');
      try {
        const result = await fn(client);
        sqlite.exec('COMMIT');
        return result;
      } catch (err) {
        sqlite.exec('ROLLBACK');
        throw err;
      }
    },
  };
}
