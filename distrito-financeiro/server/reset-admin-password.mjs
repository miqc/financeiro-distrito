import { randomBytes, scryptSync } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { Pool } from 'pg';
import { initializeDatabase, closeDatabase, getClient, getDbMode, isProduction } from './db/index.mjs';

const password = process.argv[2];

if (!password) {
  throw new Error(
    'Informe a nova senha: node server/reset-admin-password.mjs <senha>',
  );
}

const rootDirectory = resolve(process.cwd());

await initializeDatabase();

const salt = randomBytes(16);
const passwordHash = scryptSync(password, salt, 64, {
  N: 16_384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
});

const db = await getClient();

await db.query('BEGIN');

try {
  const result = await db.query(`
    UPDATE admin_accounts
    SET password_hash = $1, password_salt = $2, updated_at = $3
    WHERE id = 1
  `, [
    passwordHash.toString('base64'),
    salt.toString('base64'),
    Date.now(),
  ]);

  await db.query(`
    UPDATE users
    SET password_hash = $1, password_salt = $2, updated_at = $3
    WHERE id = 1
  `, [
    passwordHash.toString('base64'),
    salt.toString('base64'),
    Date.now(),
  ]);

  if (result.rowCount === 0) {
    throw new Error('A conta administrativa não foi encontrada.');
  }

  await db.query('DELETE FROM auth_sessions WHERE account_id = 1');
  await db.query('DELETE FROM user_sessions WHERE user_id = 1');
  await db.query('COMMIT');
  console.log('Senha administrativa redefinida e sessões encerradas.');
} catch (error) {
  await db.query('ROLLBACK');
  throw error;
} finally {
  db.release();
  await closeDatabase();
}
