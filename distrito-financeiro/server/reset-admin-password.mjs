import { randomBytes, scryptSync } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const password = process.argv[2];

if (!password) {
  throw new Error(
    'Informe a nova senha: node server/reset-admin-password.mjs <senha>',
  );
}

const rootDirectory = resolve(process.cwd());
const databasePath = resolve(
  process.env.DATABASE_PATH ?? join(rootDirectory, 'data', 'distrito.sqlite'),
);

mkdirSync(dirname(databasePath), { recursive: true });

const salt = randomBytes(16);
const passwordHash = scryptSync(password, salt, 64, {
  N: 16_384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
});
const database = new DatabaseSync(databasePath);

database.exec('BEGIN IMMEDIATE');

try {
  const result = database
    .prepare(`
      UPDATE admin_accounts
      SET password_hash = ?, password_salt = ?, updated_at = ?
      WHERE id = 1
    `)
    .run(
      passwordHash.toString('base64'),
      salt.toString('base64'),
      Date.now(),
    );

  database
    .prepare(`
      UPDATE users
      SET password_hash = ?, password_salt = ?, updated_at = ?
      WHERE id = 1
    `)
    .run(
      passwordHash.toString('base64'),
      salt.toString('base64'),
      Date.now(),
    );

  if (result.changes !== 1) {
    throw new Error('A conta administrativa não foi encontrada.');
  }

  database
    .prepare('DELETE FROM auth_sessions WHERE account_id = 1')
    .run();
  database.prepare('DELETE FROM user_sessions WHERE user_id = 1').run();
  database.exec('COMMIT');
  console.log('Senha administrativa redefinida e sessões encerradas.');
} catch (error) {
  database.exec('ROLLBACK');
  throw error;
} finally {
  database.close();
}
