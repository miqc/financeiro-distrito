import { randomBytes, scryptSync } from 'node:crypto';
import {
  initializeDatabase,
  closeDatabase,
  getClient,
  getDbMode,
} from './db/index.mjs';

const password = process.argv[2];

if (!password) {
  throw new Error(
    'Informe a nova senha: node server/reset-admin-password.mjs <senha>',
  );
}

await initializeDatabase();

const salt = randomBytes(16);
const passwordHash = scryptSync(password, salt, 64, {
  N: 16_384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
});

const db = await getClient();
const usesPostgres = getDbMode() === 'postgres';

try {
  if (usesPostgres) {
    await db.query('BEGIN');
  } else {
    db.exec('BEGIN IMMEDIATE');
  }

  const result = await db.prepare(`
    UPDATE admin_accounts
    SET password_hash = $1, password_salt = $2, updated_at = $3
    WHERE id = 1
  `).run(
    passwordHash.toString('base64'),
    salt.toString('base64'),
    Date.now(),
  );

  if (result.changes !== 1) {
    throw new Error('A conta administrativa não foi encontrada.');
  }

  await db
    .prepare('DELETE FROM auth_sessions WHERE account_id = 1')
    .run();

  if (usesPostgres) {
    await db.query('COMMIT');
  } else {
    db.exec('COMMIT');
  }

  console.log('Senha administrativa redefinida e sessões encerradas.');
} catch (error) {
  if (usesPostgres) {
    await db.query('ROLLBACK');
  } else {
    db.exec('ROLLBACK');
  }
  throw error;
} finally {
  db.release();
  await closeDatabase();
}
