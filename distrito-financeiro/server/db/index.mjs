import { AsyncLocalStorage } from 'node:async_hooks';
import { DatabaseSync } from 'node:sqlite';
import { Pool } from 'pg';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const rootDirectory = resolve(process.cwd());

function isPostgresEnabled() {
  return Boolean(process.env.DATABASE_URL);
}

function getDatabaseUrl() {
  return process.env.DATABASE_URL;
}

// SQLite implementation
function createSqliteDatabase() {
  const databasePath = resolve(
    process.env.DATABASE_PATH ?? join(rootDirectory, 'data', 'distrito.sqlite'),
  );
  mkdirSync(dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;`);
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_accounts (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auth_sessions (
      token_hash TEXT PRIMARY KEY,
      account_id INTEGER NOT NULL REFERENCES admin_accounts(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS auth_sessions_by_expiration
    ON auth_sessions (expires_at);
  `);
  return db;
}

// Shared statements use PostgreSQL's "$n" placeholders; the SQLite driver
// only understands positional "?" bindings, so rewrite them (in order of
// appearance) before handing the statement to node:sqlite.
function bindSqliteParameters(sql, parameters) {
  const order = [];
  const text = sql.replace(/\$(\d+)/g, (_match, index) => {
    order.push(Number(index));
    return '?';
  });

  return { text, parameters: order.map((index) => parameters[index - 1]) };
}

function prepareSqliteStatement(sql) {
  if (!/\$\d+/.test(sql)) return sqliteDb.prepare(sql);

  return {
    run: (...parameters) => {
      const bound = bindSqliteParameters(sql, parameters);
      return sqliteDb.prepare(bound.text).run(...bound.parameters);
    },
    get: (...parameters) => {
      const bound = bindSqliteParameters(sql, parameters);
      return sqliteDb.prepare(bound.text).get(...bound.parameters);
    },
    all: (...parameters) => {
      const bound = bindSqliteParameters(sql, parameters);
      return sqliteDb.prepare(bound.text).all(...bound.parameters);
    },
  };
}

// PostgreSQL implementation
function createPgPool() {
  const url = getDatabaseUrl();
  const pool = new Pool({ connectionString: url, max: 10 });
  return pool;
}

// Durante uma transação o client é compartilhado por AsyncLocalStorage:
// todas as chamadas internas a getClient() usam a MESMA conexão. Sem isso o
// BEGIN/COMMIT era executado em um client do pool enquanto as consultas iam
// para outro, tornando a transação inócua no PostgreSQL (no SQLite isso já
// funcionava porque existe um único objeto de banco).
const transactionStorage = new AsyncLocalStorage();

function createPostgresHandle(client, { ownsClient }) {
  return {
    client,
    release: () => {
      // Quem está dentro de uma transação não devolve o client ao pool;
      // quem abriu a conexão (fora de transação) é responsável pelo release.
      if (ownsClient) client.release();
    },
    query: (...args) => client.query(...args),
    exec: async (sql) => {
      await client.query(sql);
    },
    prepare: (sql) => ({
      run: async (...params) => {
        const result = await client.query(sql, params);
        return {
          lastInsertRowid: result.rows.length > 0 ? result.rows[result.rows.length - 1].id : null,
          changes: result.rowCount,
        };
      },
      get: async (...params) => {
        const result = await client.query(sql, params);
        return result.rows[0] || null;
      },
      all: async (...params) => {
        const result = await client.query(sql, params);
        return result.rows;
      },
    }),
  };
}

// Database abstraction
let sqliteDb = null;
let pgPool = null;
let currentMode = null;

export function getDbMode() {
  return currentMode;
}

export function isProduction() {
  return process.env.NODE_ENV === 'production';
}

export async function getClient() {
  if (currentMode === 'postgres') {
    const activeTransaction = transactionStorage.getStore();
    if (activeTransaction) return activeTransaction;

    const client = await pgPool.connect();
    return createPostgresHandle(client, { ownsClient: true });
  } else {
    return {
      client: sqliteDb,
      release: () => {},
      query: async (sql, parameters = []) => {
        const bound = bindSqliteParameters(sql, parameters);
        const statement = sqliteDb.prepare(bound.text);

        if (/^\s*(?:select|with|pragma)/i.test(bound.text)) {
          const rows = statement.all(...bound.parameters);
          return { rows, rowCount: rows.length };
        }

        const result = statement.run(...bound.parameters);
        return {
          rows: [],
          rowCount: result.changes,
          changes: result.changes,
          lastInsertRowid: result.lastInsertRowid,
        };
      },
      exec: (sql) => sqliteDb.exec(sql),
      prepare: (sql) => prepareSqliteStatement(sql),
    };
  }
}

// Executa `operation` dentro de uma transação, garantindo que todas as
// chamadas internas a getClient() participem da MESMA transação (mesma
// conexão no PostgreSQL; mesma base de dados no SQLite).
export async function runInTransaction(operation) {
  if (currentMode === 'postgres') {
    const client = await pgPool.connect();
    const handle = createPostgresHandle(client, { ownsClient: false });

    return transactionStorage.run(handle, async () => {
      await client.query('BEGIN');
      try {
        const result = await operation();
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    });
  }

  sqliteDb.exec('BEGIN IMMEDIATE');
  try {
    const result = await operation();
    sqliteDb.exec('COMMIT');
    return result;
  } catch (error) {
    sqliteDb.exec('ROLLBACK');
    throw error;
  }
}

export async function initializeDatabase() {
  if (isProduction() && !isPostgresEnabled()) {
    throw new Error('DATABASE_URL é obrigatória em produção; SQLite não é permitido.');
  }

  if (isPostgresEnabled()) {
    currentMode = 'postgres';
    pgPool = createPgPool();
    
    // Test connection
    const client = await pgPool.connect();
    try {
      await client.query('SELECT 1');
    } finally {
      client.release();
    }
    
    // Create tables for PostgreSQL
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS admin_accounts (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        first_name TEXT NOT NULL DEFAULT '',
        last_name TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL DEFAULT '',
        profile_photo TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'client',
        status TEXT NOT NULL DEFAULT 'active',
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS user_sessions (
        token_hash TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at BIGINT NOT NULL,
        expires_at BIGINT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS user_sessions_by_expiration ON user_sessions (expires_at);

      CREATE TABLE IF NOT EXISTS auth_sessions (
        token_hash TEXT PRIMARY KEY,
        account_id INTEGER NOT NULL REFERENCES admin_accounts(id) ON DELETE CASCADE,
        created_at BIGINT NOT NULL,
        expires_at BIGINT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS auth_sessions_by_expiration ON auth_sessions (expires_at);
    `);

    // Ensure userName columns exist (PostgreSQL version)
    const usersColumns = await pgPool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'");
    const columnNames = new Set(usersColumns.rows.map(r => r.column_name));
    
    if (!columnNames.has('first_name')) {
      await pgPool.query("ALTER TABLE users ADD COLUMN first_name TEXT NOT NULL DEFAULT ''");
    }
    if (!columnNames.has('last_name')) {
      await pgPool.query("ALTER TABLE users ADD COLUMN last_name TEXT NOT NULL DEFAULT ''");
    }
    if (!columnNames.has('phone')) {
      await pgPool.query("ALTER TABLE users ADD COLUMN phone TEXT NOT NULL DEFAULT ''");
    }
    if (!columnNames.has('profile_photo')) {
      await pgPool.query("ALTER TABLE users ADD COLUMN profile_photo TEXT NOT NULL DEFAULT ''");
    }

    // Apply migrations
    await applyMigrations();
  } else {
    currentMode = 'sqlite';
    sqliteDb = createSqliteDatabase();
    ensureUserNameColumns();
    applyDatabaseMigrations();
  }
}

async function applyMigrations() {
  // Create schema_migrations table
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at BIGINT NOT NULL
    );
  `);

  const migration = await pgPool.query('SELECT 1 FROM schema_migrations WHERE version = 1');
  if (migration.rows.length > 0) return;

  await pgPool.query('BEGIN');
  try {
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        account_id INTEGER NOT NULL REFERENCES admin_accounts(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        description TEXT NOT NULL,
        amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS expenses_by_account_date ON expenses (account_id, date DESC, created_at DESC);

      CREATE TABLE IF NOT EXISTS catalog_items (
        id TEXT PRIMARY KEY,
        account_id INTEGER NOT NULL REFERENCES admin_accounts(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK (type IN ('service', 'product')),
        description TEXT NOT NULL,
        price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS catalog_items_by_account_type ON catalog_items (account_id, type, description);

      CREATE TABLE IF NOT EXISTS sales (
        id TEXT PRIMARY KEY,
        account_id INTEGER NOT NULL REFERENCES admin_accounts(id) ON DELETE CASCADE,
        source TEXT NOT NULL CHECK (source IN ('service', 'legacy_product')),
        date TEXT NOT NULL,
        recorded_at TEXT,
        payment_method TEXT CHECK (payment_method IS NULL OR payment_method IN ('cash', 'card', 'pix')),
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS sales_by_account_source_date ON sales (account_id, source, date DESC, recorded_at DESC, created_at DESC);

      CREATE TABLE IF NOT EXISTS sale_items (
        id SERIAL PRIMARY KEY,
        sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK (kind IN ('service', 'product')),
        position INTEGER NOT NULL CHECK (position >= 0),
        catalog_item_id TEXT REFERENCES catalog_items(id) ON DELETE SET NULL,
        description TEXT NOT NULL,
        amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
        UNIQUE (sale_id, kind, position)
      );

      CREATE INDEX IF NOT EXISTS sale_items_by_sale ON sale_items (sale_id, kind, position);

      CREATE TABLE IF NOT EXISTS monthly_configs (
        id TEXT PRIMARY KEY,
        account_id INTEGER NOT NULL REFERENCES admin_accounts(id) ON DELETE CASCADE,
        reference_month TEXT NOT NULL,
        working_days INTEGER NOT NULL CHECK (working_days BETWEEN 1 AND 31),
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL,
        UNIQUE (account_id, reference_month)
      );

      CREATE INDEX IF NOT EXISTS monthly_configs_by_account_month ON monthly_configs (account_id, reference_month);
    `);

    await pgPool.query(
      `INSERT INTO schema_migrations (version, name, applied_at) VALUES (1, 'financial_data', $1)`,
      [Date.now()],
    );
    await pgPool.query('COMMIT');
  } catch (error) {
    await pgPool.query('ROLLBACK');
    throw error;
  }
}

function ensureUserNameColumns() {
  if (currentMode !== 'sqlite' || !sqliteDb) return;

  const usersTable = sqliteDb
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'users'")
    .get();
  if (!usersTable) return;

  const columns = sqliteDb.prepare('PRAGMA table_info(users)').all();
  const columnNames = new Set(columns.map((column) => column.name));
  if (!columnNames.has('first_name')) {
    sqliteDb.exec("ALTER TABLE users ADD COLUMN first_name TEXT NOT NULL DEFAULT ''");
  }
  if (!columnNames.has('last_name')) {
    sqliteDb.exec("ALTER TABLE users ADD COLUMN last_name TEXT NOT NULL DEFAULT ''");
  }
  if (!columnNames.has('phone')) {
    sqliteDb.exec("ALTER TABLE users ADD COLUMN phone TEXT NOT NULL DEFAULT ''");
  }
  if (!columnNames.has('profile_photo')) {
    sqliteDb.exec("ALTER TABLE users ADD COLUMN profile_photo TEXT NOT NULL DEFAULT ''");
  }
}

function applyDatabaseMigrations() {
  if (currentMode !== 'sqlite' || !sqliteDb) return;
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `);

  const migrationAlreadyApplied = sqliteDb.prepare('SELECT 1 FROM schema_migrations WHERE version = 1').get();
  if (migrationAlreadyApplied) return;

  sqliteDb.exec('BEGIN IMMEDIATE');
  try {
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        account_id INTEGER NOT NULL REFERENCES admin_accounts(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        description TEXT NOT NULL,
        amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS expenses_by_account_date ON expenses (account_id, date DESC, created_at DESC);

      CREATE TABLE IF NOT EXISTS catalog_items (
        id TEXT PRIMARY KEY,
        account_id INTEGER NOT NULL REFERENCES admin_accounts(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK (type IN ('service', 'product')),
        description TEXT NOT NULL,
        price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS catalog_items_by_account_type ON catalog_items (account_id, type, description COLLATE NOCASE);

      CREATE TABLE IF NOT EXISTS sales (
        id TEXT PRIMARY KEY,
        account_id INTEGER NOT NULL REFERENCES admin_accounts(id) ON DELETE CASCADE,
        source TEXT NOT NULL CHECK (source IN ('service', 'legacy_product')),
        date TEXT NOT NULL,
        recorded_at TEXT,
        payment_method TEXT CHECK (payment_method IS NULL OR payment_method IN ('cash', 'card', 'pix')),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS sales_by_account_source_date ON sales (account_id, source, date DESC, recorded_at DESC, created_at DESC);

      CREATE TABLE IF NOT EXISTS sale_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK (kind IN ('service', 'product')),
        position INTEGER NOT NULL CHECK (position >= 0),
        catalog_item_id TEXT REFERENCES catalog_items(id) ON DELETE SET NULL,
        description TEXT NOT NULL,
        amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
        UNIQUE (sale_id, kind, position)
      );

      CREATE INDEX IF NOT EXISTS sale_items_by_sale ON sale_items (sale_id, kind, position);

      CREATE TABLE IF NOT EXISTS monthly_configs (
        id TEXT PRIMARY KEY,
        account_id INTEGER NOT NULL REFERENCES admin_accounts(id) ON DELETE CASCADE,
        reference_month TEXT NOT NULL,
        working_days INTEGER NOT NULL CHECK (working_days BETWEEN 1 AND 31),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE (account_id, reference_month)
      );

      CREATE INDEX IF NOT EXISTS monthly_configs_by_account_month ON monthly_configs (account_id, reference_month);
    `);

    sqliteDb.prepare(`
      INSERT INTO schema_migrations (version, name, applied_at) VALUES (1, 'financial_data', ?)
    `).run(Date.now());
    sqliteDb.exec('COMMIT');
  } catch (error) {
    sqliteDb.exec('ROLLBACK');
    throw error;
  }
}

export async function closeDatabase() {
  if (currentMode === 'postgres' && pgPool) {
    await pgPool.end();
    pgPool = null;
  } else if (currentMode === 'sqlite' && sqliteDb) {
    sqliteDb.close();
    sqliteDb = null;
  }
  currentMode = null;
}

// Export the raw database for backward compatibility in some cases
export function getRawDatabase() {
  if (currentMode === 'postgres') {
    return pgPool;
  }
  return sqliteDb;
}
