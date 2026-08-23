import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, dirname, join, resolve, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const rootDirectory = resolve(process.cwd());
const distributionDirectory = join(rootDirectory, 'dist');
const databasePath = resolve(
  process.env.DATABASE_PATH ?? join(rootDirectory, 'data', 'distrito.sqlite'),
);
const host = process.env.HOST ?? '0.0.0.0';
const port = Number(process.env.PORT ?? 8787);
const isProduction = process.env.NODE_ENV === 'production';
const sessionDurationHours = Number(process.env.SESSION_TTL_HOURS ?? 24 * 7);
const sessionDurationSeconds = Math.max(1, sessionDurationHours) * 60 * 60;
const cookieName = 'distrito_session';
const cookieIsSecure =
  process.env.COOKIE_SECURE === 'true' ||
  (process.env.COOKIE_SECURE !== 'false' && isProduction);
const allowedOrigins = new Set(
  (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);
const loginAttempts = new Map();
const loginAttemptWindowMs = 15 * 60 * 1000;
const maximumLoginAttempts = 8;

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webmanifest', 'application/manifest+json'],
  ['.woff2', 'font/woff2'],
]);

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error('PORT deve ser um número entre 1 e 65535.');
}

mkdirSync(dirname(databasePath), { recursive: true });

const database = new DatabaseSync(databasePath);
database.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

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

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function hashPassword(password, salt = randomBytes(16)) {
  const passwordHash = scryptSync(password, salt, 64, {
    N: 16_384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });

  return {
    hash: passwordHash.toString('base64'),
    salt: salt.toString('base64'),
  };
}

function verifyPassword(password, account) {
  const expectedHash = Buffer.from(account.password_hash, 'base64');
  const actualHash = Buffer.from(
    hashPassword(password, Buffer.from(account.password_salt, 'base64')).hash,
    'base64',
  );

  return (
    expectedHash.length === actualHash.length &&
    timingSafeEqual(expectedHash, actualHash)
  );
}

function seedAdminAccount() {
  const existingAccount = database
    .prepare('SELECT id FROM admin_accounts WHERE id = 1')
    .get();

  if (existingAccount) return;

  const email = normalizeEmail(
    process.env.ADMIN_EMAIL ?? 'admin@distrito.com',
  );
  const password = process.env.ADMIN_PASSWORD ?? 'admin';

  if (!isValidEmail(email)) {
    throw new Error('ADMIN_EMAIL precisa conter um e-mail válido.');
  }

  if (isProduction && password.length < 8) {
    throw new Error(
      'Defina ADMIN_PASSWORD com pelo menos 8 caracteres antes de iniciar em produção.',
    );
  }

  if (!isProduction && !process.env.ADMIN_PASSWORD) {
    console.warn(
      'A conta inicial de desenvolvimento usa admin@distrito.com / admin. Altere-a em Configurações.',
    );
  }

  const credentials = hashPassword(password);
  const now = Date.now();

  database
    .prepare(`
      INSERT INTO admin_accounts (
        id, email, password_hash, password_salt, created_at, updated_at
      ) VALUES (1, ?, ?, ?, ?, ?)
    `)
    .run(email, credentials.hash, credentials.salt, now, now);
}

seedAdminAccount();

function hashSessionToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function parseCookies(request) {
  const cookies = new Map();

  for (const cookie of (request.headers.cookie ?? '').split(';')) {
    const separatorIndex = cookie.indexOf('=');
    if (separatorIndex < 0) continue;

    const name = cookie.slice(0, separatorIndex).trim();
    const value = cookie.slice(separatorIndex + 1).trim();
    if (name) cookies.set(name, decodeURIComponent(value));
  }

  return cookies;
}

function getAuthenticatedSession(request) {
  const token = parseCookies(request).get(cookieName);
  if (!token) return undefined;

  const tokenHash = hashSessionToken(token);
  const now = Date.now();

  database
    .prepare('DELETE FROM auth_sessions WHERE expires_at <= ?')
    .run(now);

  const session = database
    .prepare(`
      SELECT
        auth_sessions.token_hash,
        admin_accounts.id AS account_id,
        admin_accounts.email,
        admin_accounts.password_hash,
        admin_accounts.password_salt
      FROM auth_sessions
      INNER JOIN admin_accounts
        ON admin_accounts.id = auth_sessions.account_id
      WHERE auth_sessions.token_hash = ?
        AND auth_sessions.expires_at > ?
    `)
    .get(tokenHash, now);

  return session ? { ...session, token } : undefined;
}

function createSession(accountId) {
  const token = randomBytes(32).toString('base64url');
  const now = Date.now();

  database
    .prepare(`
      INSERT INTO auth_sessions (
        token_hash, account_id, created_at, expires_at
      ) VALUES (?, ?, ?, ?)
    `)
    .run(
      hashSessionToken(token),
      accountId,
      now,
      now + sessionDurationSeconds * 1000,
    );

  return token;
}

function sessionCookie(token, maxAge = sessionDurationSeconds) {
  return [
    `${cookieName}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
    cookieIsSecure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

function applyCors(request, response) {
  const origin = request.headers.origin;
  if (!origin) return true;

  const forwardedHost = String(request.headers['x-forwarded-host'] ?? '')
    .split(',')[0]
    .trim();
  const requestHost = forwardedHost || request.headers.host;
  let originHost = '';

  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }

  const originIsAllowed =
    !isProduction ||
    originHost === requestHost ||
    allowedOrigins.has(origin);
  if (!originIsAllowed) return false;

  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader('Vary', 'Origin');
  return true;
}

function getLoginAttemptKey(request) {
  return String(request.headers['x-forwarded-for'] ?? request.socket.remoteAddress)
    .split(',')[0]
    .trim();
}

function isLoginTemporarilyBlocked(request) {
  const key = getLoginAttemptKey(request);
  const attempt = loginAttempts.get(key);
  if (!attempt) return false;

  if (Date.now() - attempt.startedAt >= loginAttemptWindowMs) {
    loginAttempts.delete(key);
    return false;
  }

  return attempt.count >= maximumLoginAttempts;
}

function registerFailedLogin(request) {
  const key = getLoginAttemptKey(request);
  const now = Date.now();
  const attempt = loginAttempts.get(key);

  if (!attempt || now - attempt.startedAt >= loginAttemptWindowMs) {
    loginAttempts.set(key, { count: 1, startedAt: now });
    return;
  }

  attempt.count += 1;
}

function clearFailedLogins(request) {
  loginAttempts.delete(getLoginAttemptKey(request));
}

function sendJson(response, statusCode, payload, headers = {}) {
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    ...headers,
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const chunks = [];
  let receivedBytes = 0;

  for await (const chunk of request) {
    receivedBytes += chunk.length;
    if (receivedBytes > 32 * 1024) {
      const error = new Error('O corpo da requisição excedeu o limite.');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) return {};

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('JSON inválido.');
    error.statusCode = 400;
    throw error;
  }
}

async function handleApiRequest(request, response, pathname) {
  if (!applyCors(request, response)) {
    sendJson(response, 403, { error: 'origin_not_allowed' });
    return;
  }

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Max-Age': '86400',
    });
    response.end();
    return;
  }

  if (request.method === 'GET' && pathname === '/api/health') {
    sendJson(response, 200, { status: 'ok' });
    return;
  }

  if (request.method === 'GET' && pathname === '/api/auth/session') {
    const session = getAuthenticatedSession(request);
    sendJson(response, 200, {
      authenticated: Boolean(session),
      email: session?.email,
    });
    return;
  }

  if (request.method === 'POST' && pathname === '/api/auth/login') {
    if (isLoginTemporarilyBlocked(request)) {
      sendJson(response, 429, { error: 'too_many_attempts' });
      return;
    }

    const body = await readJson(request);
    const email = normalizeEmail(body.email);
    const password = String(body.password ?? '');
    const account = database
      .prepare('SELECT * FROM admin_accounts WHERE email = ? COLLATE NOCASE')
      .get(email);

    if (!account || !verifyPassword(password, account)) {
      registerFailedLogin(request);
      sendJson(response, 401, { error: 'invalid_credentials' });
      return;
    }

    clearFailedLogins(request);
    const token = createSession(account.id);
    sendJson(
      response,
      200,
      { authenticated: true, email: account.email },
      { 'Set-Cookie': sessionCookie(token) },
    );
    return;
  }

  if (request.method === 'POST' && pathname === '/api/auth/logout') {
    const session = getAuthenticatedSession(request);
    if (session) {
      database
        .prepare('DELETE FROM auth_sessions WHERE token_hash = ?')
        .run(session.token_hash);
    }

    sendJson(
      response,
      200,
      { authenticated: false },
      { 'Set-Cookie': sessionCookie('', 0) },
    );
    return;
  }

  if (request.method === 'PUT' && pathname === '/api/account') {
    const session = getAuthenticatedSession(request);
    if (!session) {
      sendJson(response, 401, { error: 'authentication_required' });
      return;
    }

    const body = await readJson(request);
    const email = normalizeEmail(body.email);
    const currentPassword = String(body.currentPassword ?? '');
    const newPassword =
      body.newPassword === undefined ? undefined : String(body.newPassword);

    if (!isValidEmail(email)) {
      sendJson(response, 400, { error: 'invalid_email' });
      return;
    }

    if (newPassword !== undefined && newPassword.length < 8) {
      sendJson(response, 400, { error: 'password_too_short' });
      return;
    }

    if (!verifyPassword(currentPassword, session)) {
      sendJson(response, 403, { error: 'invalid_current_password' });
      return;
    }

    let passwordHash = session.password_hash;
    let passwordSalt = session.password_salt;

    if (newPassword !== undefined) {
      const credentials = hashPassword(newPassword);
      passwordHash = credentials.hash;
      passwordSalt = credentials.salt;
    }

    database
      .prepare(`
        UPDATE admin_accounts
        SET email = ?, password_hash = ?, password_salt = ?, updated_at = ?
        WHERE id = ?
      `)
      .run(
        email,
        passwordHash,
        passwordSalt,
        Date.now(),
        session.account_id,
      );

    database
      .prepare(`
        DELETE FROM auth_sessions
        WHERE account_id = ? AND token_hash <> ?
      `)
      .run(session.account_id, session.token_hash);

    sendJson(response, 200, { updated: true, email });
    return;
  }

  sendJson(response, 404, { error: 'not_found' });
}

function serveStaticFile(response, pathname) {
  if (!existsSync(distributionDirectory)) {
    sendJson(response, 503, {
      error: 'frontend_not_built',
      message: 'Execute npm run build antes de iniciar em produção.',
    });
    return;
  }

  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  let filePath = resolve(distributionDirectory, `.${requestedPath}`);
  const distributionPrefix = `${distributionDirectory}${sep}`;

  if (
    filePath !== distributionDirectory &&
    !filePath.startsWith(distributionPrefix)
  ) {
    response.writeHead(403);
    response.end();
    return;
  }

  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    filePath = join(distributionDirectory, 'index.html');
  }

  const extension = extname(filePath).toLowerCase();
  response.writeHead(200, {
    'Content-Type': mimeTypes.get(extension) ?? 'application/octet-stream',
    'Cache-Control': extension === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
  });
  response.end(readFileSync(filePath));
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);

    if (pathname.startsWith('/api/')) {
      await handleApiRequest(request, response, pathname);
      return;
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' });
      response.end();
      return;
    }

    serveStaticFile(response, pathname);
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    if (statusCode >= 500) console.error(error);
    if (!response.headersSent) {
      sendJson(response, statusCode, { error: 'request_failed' });
    } else {
      response.end();
    }
  }
});

server.listen(port, host, () => {
  console.log(`Distrito API disponível em http://${host}:${port}`);
  console.log(`Banco de autenticação: ${databasePath}`);
});

function shutdown() {
  server.close(() => {
    database.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
