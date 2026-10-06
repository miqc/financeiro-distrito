import {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, dirname, join, resolve, sep } from 'node:path';
import {
  initializeDatabase,
  closeDatabase,
  getClient,
  isProduction,
  getDbMode,
} from './db/index.mjs';

const rootDirectory = resolve(process.cwd());
const distributionDirectory = join(rootDirectory, 'dist');
const host = process.env.HOST ?? '0.0.0.0';
const port = Number(process.env.PORT ?? 8787);
const sessionDurationHours = Number(process.env.SESSION_TTL_HOURS ?? 24 * 7);
const sessionDurationSeconds = Math.max(1, sessionDurationHours) * 60 * 60;
const cookieName = 'distrito_session';
const cookieIsSecure =
  process.env.COOKIE_SECURE === 'true' ||
  (process.env.COOKIE_SECURE !== 'false' && isProduction());
const allowedOrigins = new Set(
  (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);
const loginAttempts = new Map();
const loginAttemptWindowMs = 15 * 60 * 1000;
const maximumLoginAttempts = 8;
const maximumJsonBodyBytes = 5 * 1024 * 1024;
const maximumDescriptionLength = 500;
const maximumItemsPerSale = 100;
const datedStores = new Set(['expenses', 'services', 'products']);
const dataStores = new Set([
  ...datedStores,
  'config',
  'catalog',
]);
const paymentMethods = new Set(['cash', 'card', 'pix']);
const catalogTypes = new Set(['service', 'product']);

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

await initializeDatabase();

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

async function seedAdminAccount() {
  const db = await getClient();
  const existingAccount = await db.prepare('SELECT id FROM admin_accounts WHERE id = 1').get();
  if (existingAccount) {
    db.release();
    return;
  }

  const email = normalizeEmail(
    process.env.ADMIN_EMAIL ?? 'admin@distrito.com',
  );
  const password = process.env.ADMIN_PASSWORD ?? 'admin';

  if (!isValidEmail(email)) {
    throw new Error('ADMIN_EMAIL precisa conter um e-mail válido.');
  }

  if (isProduction() && password.length < 8) {
    throw new Error(
      'Defina ADMIN_PASSWORD com pelo menos 8 caracteres antes de iniciar em produção.',
    );
  }

  if (!isProduction() && !process.env.ADMIN_PASSWORD) {
    console.warn(
      'A conta inicial de desenvolvimento usa admin@distrito.com / admin. Altere-a em Configurações.',
    );
  }

  const credentials = hashPassword(password);
  const now = Date.now();

  await db.prepare(`
    INSERT INTO admin_accounts (
      id, email, password_hash, password_salt, created_at, updated_at
    ) VALUES (1, $1, $2, $3, $4, $5)
  `).run(email, credentials.hash, credentials.salt, now, now);

  db.release();
}

await seedAdminAccount();

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

async function getAuthenticatedSession(request) {
  const token = parseCookies(request).get(cookieName);
  if (!token) return undefined;

  const tokenHash = hashSessionToken(token);
  const now = Date.now();

  const db = await getClient();
  await db
    .prepare('DELETE FROM auth_sessions WHERE expires_at <= $1')
    .run(now);

  const session = await db
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
      WHERE auth_sessions.token_hash = $1
        AND auth_sessions.expires_at > $2
    `)
    .get(tokenHash, now);

  db.release();

  return session ? { ...session, token } : undefined;
}

async function createSession(accountId) {
  const token = randomBytes(32).toString('base64url');
  const now = Date.now();

  const db = await getClient();
  await db
    .prepare(`
      INSERT INTO auth_sessions (
        token_hash, account_id, created_at, expires_at
      ) VALUES ($1, $2, $3, $4)
    `)
    .run(
      hashSessionToken(token),
      accountId,
      now,
      now + sessionDurationSeconds * 1000,
    );

  db.release();
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
    !isProduction() ||
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
    if (receivedBytes > maximumJsonBodyBytes) {
      const error = new Error('O corpo da requisição excedeu o limite.');
      error.statusCode = 413;
      error.errorCode = 'payload_too_large';
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
    error.errorCode = 'invalid_json';
    throw error;
  }
}

function requestError(statusCode, errorCode) {
  const error = new Error(errorCode);
  error.statusCode = statusCode;
  error.errorCode = errorCode;
  return error;
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseEntityId(value, { required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw requestError(400, 'invalid_id');
    return randomUUID();
  }

  if (
    typeof value !== 'string' ||
    value.length > 128 ||
    !/^[a-zA-Z0-9._:-]+$/.test(value)
  ) {
    throw requestError(400, 'invalid_id');
  }

  return value;
}

function parseDescription(value) {
  if (typeof value !== 'string') {
    throw requestError(400, 'invalid_description');
  }

  const description = value.trim();
  if (!description || description.length > maximumDescriptionLength) {
    throw requestError(400, 'invalid_description');
  }

  return description;
}

function parseDate(value) {
  if (typeof value !== 'string') throw requestError(400, 'invalid_date');

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw requestError(400, 'invalid_date');

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    year < 1000 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw requestError(400, 'invalid_date');
  }

  return value;
}

function parseReferenceMonth(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(value) ||
    Number(value.slice(0, 4)) < 1000
  ) {
    throw requestError(400, 'invalid_month');
  }

  return value;
}

function getNextReferenceMonth(referenceMonth) {
  const year = Number(referenceMonth.slice(0, 4));
  const month = Number(referenceMonth.slice(5, 7));
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return `${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}`;
}

function parseMoney(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw requestError(400, 'invalid_amount');
  }

  const cents = Math.round(value * 100);
  if (
    !Number.isSafeInteger(cents) ||
    Math.abs(cents / 100 - value) > Number.EPSILON * Math.max(1, value) * 4
  ) {
    throw requestError(400, 'invalid_amount');
  }

  return cents;
}

function moneyFromCents(cents) {
  return cents / 100;
}

function parsePaymentMethod(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !paymentMethods.has(value)) {
    throw requestError(400, 'invalid_payment_method');
  }
  return value;
}

function parseRecordedAt(value, defaultToNow) {
  if (value === undefined || value === null || value === '') {
    return defaultToNow ? new Date().toISOString() : null;
  }

  if (typeof value !== 'string') {
    throw requestError(400, 'invalid_created_at');
  }

  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) {
    throw requestError(400, 'invalid_created_at');
  }

  return new Date(milliseconds).toISOString();
}

function parseOptionalCatalogItemId(value) {
  if (value === undefined || value === null || value === '') return null;
  return parseEntityId(value, { required: true });
}

function parseAttendanceItem(value) {
  if (!isObject(value)) throw requestError(400, 'invalid_items');

  return {
    catalogItemId: parseOptionalCatalogItemId(value.catalogItemId),
    description: parseDescription(value.description),
    amountCents: parseMoney(value.amount),
  };
}

function parseAttendanceItems(value, { fallback, required = false } = {}) {
  if (
    value === undefined ||
    value === null ||
    (Array.isArray(value) && value.length === 0)
  ) {
    if (fallback) return [fallback];
    if (required) throw requestError(400, 'invalid_items');
    return [];
  }

  if (!Array.isArray(value) || value.length > maximumItemsPerSale) {
    throw requestError(400, 'invalid_items');
  }

  const items = value.map(parseAttendanceItem);
  if (required && items.length === 0) {
    throw requestError(400, 'invalid_items');
  }
  return items;
}

function sumItemCents(items) {
  return items.reduce((total, item) => {
    const nextTotal = total + item.amountCents;
    if (!Number.isSafeInteger(nextTotal)) {
      throw requestError(400, 'invalid_amount');
    }
    return nextTotal;
  }, 0);
}

function parseExpenseInput(value, options = {}) {
  if (!isObject(value)) throw requestError(400, 'invalid_request');

  return {
    id: parseEntityId(value.id, options),
    date: parseDate(value.date),
    description: parseDescription(value.description),
    amountCents: parseMoney(value.amount),
  };
}

function parseCatalogInput(value, options = {}) {
  if (!isObject(value)) throw requestError(400, 'invalid_request');
  if (typeof value.type !== 'string' || !catalogTypes.has(value.type)) {
    throw requestError(400, 'invalid_catalog_type');
  }

  return {
    id: parseEntityId(value.id, options),
    type: value.type,
    description: parseDescription(value.description),
    priceCents: parseMoney(value.price),
  };
}

function parseConfigInput(value, options = {}) {
  if (!isObject(value)) throw requestError(400, 'invalid_request');

  const workingDays = Number(value.workingDays);
  if (!Number.isInteger(workingDays) || workingDays < 1 || workingDays > 31) {
    throw requestError(400, 'invalid_working_days');
  }

  return {
    id: parseEntityId(value.id, options),
    referenceMonth: parseReferenceMonth(value.referenceMonth),
    workingDays,
  };
}

function parseSaleInput(value, source, options = {}) {
  if (!isObject(value)) throw requestError(400, 'invalid_request');

  const id = parseEntityId(value.id, options);
  const date = parseDate(value.date);
  const recordedAt = parseRecordedAt(value.createdAt, options.defaultCreatedAt);
  const paymentMethod = parsePaymentMethod(value.paymentMethod);
  if (!paymentMethod && !options.allowMissingPayment) {
    throw requestError(400, 'invalid_payment_method');
  }

  if (source === 'legacy_product') {
    const description = parseDescription(value.description);
    const amountCents = parseMoney(value.amount);

    return {
      id,
      date,
      recordedAt,
      paymentMethod,
      serviceItems: [],
      productItems: [{ catalogItemId: null, description, amountCents }],
    };
  }

  const needsLegacyServiceFallback =
    value.serviceItems === undefined ||
    value.serviceItems === null ||
    (Array.isArray(value.serviceItems) && value.serviceItems.length === 0);
  const legacyServiceFallback = needsLegacyServiceFallback
    ? {
        catalogItemId: null,
        description: parseDescription(value.description),
        amountCents: parseMoney(value.amount),
      }
    : undefined;
  const serviceItems = parseAttendanceItems(value.serviceItems, {
    fallback: legacyServiceFallback,
    required: true,
  });
  const legacyProduct = value.product === undefined ? undefined : [value.product];
  const productItems = parseAttendanceItems(
    value.productItems === undefined ? legacyProduct : value.productItems,
  );

  if (serviceItems.length + productItems.length > maximumItemsPerSale) {
    throw requestError(400, 'invalid_items');
  }

  sumItemCents(serviceItems);
  sumItemCents(productItems);

  return {
    id,
    date,
    recordedAt,
    paymentMethod,
    serviceItems,
    productItems,
  };
}

async function withTransaction(operation) {
  const { client, release } = await getClient();
  try {
    if (getDbMode() === 'postgres') {
      await client.query('BEGIN');
      const result = await operation();
      await client.query('COMMIT');
      release();
      return result;
    } else {
      client.exec('BEGIN IMMEDIATE');
      const result = operation();
      client.exec('COMMIT');
      release();
      return result;
    }
  } catch (error) {
    if (getDbMode() === 'postgres') {
      await client.query('ROLLBACK');
    } else {
      client.exec('ROLLBACK');
    }
    release();
    throw error;
  }
}

function asExpense(row) {
  return {
    id: row.id,
    date: row.date,
    description: row.description,
    amount: moneyFromCents(row.amount_cents),
  };
}

function asCatalogItem(row) {
  return {
    id: row.id,
    type: row.type,
    description: row.description,
    price: moneyFromCents(row.price_cents),
  };
}

function asMonthlyConfig(row) {
  return {
    id: row.id,
    referenceMonth: row.reference_month,
    workingDays: row.working_days,
  };
}

function asAttendanceItem(row) {
  return {
    ...(row.catalog_item_id ? { catalogItemId: row.catalog_item_id } : {}),
    description: row.description,
    amount: moneyFromCents(row.amount_cents),
  };
}

async function getSaleItems(saleId) {
  const db = await getClient();
  const items = await db.prepare(`
    SELECT kind, position, catalog_item_id, description, amount_cents
    FROM sale_items
    WHERE sale_id = $1
    ORDER BY kind, position
  `).all(saleId);
  db.release();
  return items;
}

async function asSale(row) {
  const itemRows = await getSaleItems(row.id);
  const serviceItemRows = itemRows.filter((item) => item.kind === 'service');
  const productItemRows = itemRows.filter((item) => item.kind === 'product');
  const optionalFields = {
    ...(row.recorded_at ? { createdAt: row.recorded_at } : {}),
    ...(row.payment_method ? { paymentMethod: row.payment_method } : {}),
  };

  if (row.source === 'legacy_product') {
    const product = productItemRows[0];
    if (!product) throw requestError(500, 'invalid_stored_sale');

    return {
      id: row.id,
      date: row.date,
      ...optionalFields,
      description: product.description,
      amount: moneyFromCents(product.amount_cents),
    };
  }

  if (serviceItemRows.length === 0) {
    throw requestError(500, 'invalid_stored_sale');
  }

  const serviceItems = serviceItemRows.map(asAttendanceItem);
  const productItems = productItemRows.map(asAttendanceItem);
  const serviceAmountCents = serviceItemRows.reduce(
    (total, item) => total + item.amount_cents,
    0,
  );

  return {
    id: row.id,
    date: row.date,
    ...optionalFields,
    description: serviceItemRows.map((item) => item.description).join(', '),
    amount: moneyFromCents(serviceAmountCents),
    serviceItems,
    ...(productItems.length > 0 ? { productItems } : {}),
  };
}

async function resolveCatalogItemId(accountId, catalogItemId, kind) {
  if (!catalogItemId) return null;

  const db = await getClient();
  const catalogItem = await db.prepare(`
    SELECT id
    FROM catalog_items
    WHERE id = $1 AND account_id = $2 AND type = $3
  `).get(catalogItemId, accountId, kind);
  db.release();

  return catalogItem ? catalogItemId : null;
}

async function runInsert(statement, parameters, { ignore = false } = {}) {
  const db = await getClient();
  try {
    if (ignore && getDbMode() === 'sqlite') {
      const result = await db.prepare(statement.replace(/^INSERT /, 'INSERT OR IGNORE ')).run(...parameters);
      db.release();
      return result;
    }
    const result = await db.prepare(statement).run(...parameters);
    db.release();
    return result;
  } catch (error) {
    db.release();
    if (String(error?.message ?? '').includes('UNIQUE constraint failed') ||
        String(error?.message ?? '').includes('duplicate key')) {
      throw requestError(409, 'record_already_exists');
    }
    throw error;
  }
}

async function insertExpense(record, accountId, options = {}) {
  const now = Date.now();
  const result = await runInsert(
    `INSERT INTO expenses (
      id, account_id, date, description, amount_cents, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      record.id,
      accountId,
      record.date,
      record.description,
      record.amountCents,
      now,
      now,
    ],
    options,
  );
  return result.changes === 1;
}

async function insertCatalogItem(record, accountId, options = {}) {
  const now = Date.now();
  const result = await runInsert(
    `INSERT INTO catalog_items (
      id, account_id, type, description, price_cents, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      record.id,
      accountId,
      record.type,
      record.description,
      record.priceCents,
      now,
      now,
    ],
    options,
  );
  return result.changes === 1;
}

async function insertMonthlyConfig(record, accountId, options = {}) {
  const now = Date.now();
  const result = await runInsert(
    `INSERT INTO monthly_configs (
      id, account_id, reference_month, working_days, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      record.id,
      accountId,
      record.referenceMonth,
      record.workingDays,
      now,
      now,
    ],
    options,
  );
  return result.changes === 1;
}

async function insertSale(record, accountId, source, options = {}) {
  const now = Date.now();
  const result = await runInsert(
    `INSERT INTO sales (
      id, account_id, source, date, recorded_at, payment_method,
      created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      record.id,
      accountId,
      source,
      record.date,
      record.recordedAt,
      record.paymentMethod,
      now,
      now,
    ],
    options,
  );

  if (result.changes !== 1) return false;

  const db = await getClient();
  const insertItem = db.prepare(`
    INSERT INTO sale_items (
      sale_id, kind, position, catalog_item_id, description, amount_cents
    ) VALUES ($1, $2, $3, $4, $5, $6)
  `);

  const itemGroups = [
    ['service', record.serviceItems],
    ['product', record.productItems],
  ];

  for (const [kind, items] of itemGroups) {
    items.forEach((item, position) => {
      insertItem.run(
        record.id,
        kind,
        position,
        resolveCatalogItemId(accountId, item.catalogItemId, kind),
        item.description,
        item.amountCents,
      );
    });
  }

  db.release();
  return true;
}

function getDatedFilter(searchParams) {
  const monthValue = searchParams.get('month');
  const dateValue = searchParams.get('date');

  if (monthValue && dateValue) throw requestError(400, 'invalid_filter');

  if (dateValue) {
    return { clause: ' AND date = $1', parameters: [parseDate(dateValue)] };
  }

  if (monthValue) {
    const month = parseReferenceMonth(monthValue);
    return {
      clause: ' AND date >= $1 AND date < $2',
      parameters: [`${month}-01`, `${getNextReferenceMonth(month)}-01`],
    };
  }

  return { clause: '', parameters: [] };
}

async function listExpenses(accountId, searchParams) {
  const filter = getDatedFilter(searchParams);
  const db = await getClient();
  const expenses = await db.prepare(`
    SELECT id, date, description, amount_cents
    FROM expenses
    WHERE account_id = $1${filter.clause}
    ORDER BY date DESC, created_at DESC, id
  `).all(accountId, ...filter.parameters);
  db.release();
  return expenses.map(asExpense);
}

async function listSales(accountId, source, searchParams) {
  const filter = getDatedFilter(searchParams);
  const db = await getClient();
  const sales = await db.prepare(`
    SELECT id, source, date, recorded_at, payment_method
    FROM sales
    WHERE account_id = $1 AND source = $2${filter.clause}
    ORDER BY date DESC, COALESCE(recorded_at, '') DESC, created_at DESC, id
  `).all(accountId, source, ...filter.parameters);
  db.release();
  return Promise.all(sales.map(asSale));
}

async function listMonthlyConfigs(accountId, searchParams) {
  const monthValue = searchParams.get('month') ?? searchParams.get('referenceMonth');
  const filter = monthValue
    ? { clause: ' AND reference_month = $1', parameters: [parseReferenceMonth(monthValue)] }
    : { clause: '', parameters: [] };

  const db = await getClient();
  const configs = await db.prepare(`
    SELECT id, reference_month, working_days
    FROM monthly_configs
    WHERE account_id = $1${filter.clause}
    ORDER BY reference_month DESC, id
  `).all(accountId, ...filter.parameters);
  db.release();
  return configs.map(asMonthlyConfig);
}

async function listCatalogItems(accountId, searchParams) {
  const typeValue = searchParams.get('type');
  if (typeValue && !catalogTypes.has(typeValue)) {
    throw requestError(400, 'invalid_catalog_type');
  }

  const filter = typeValue
    ? { clause: ' AND type = $1', parameters: [typeValue] }
    : { clause: '', parameters: [] };

  const db = await getClient();
  const items = await db.prepare(`
    SELECT id, type, description, price_cents
    FROM catalog_items
    WHERE account_id = $1${filter.clause}
    ORDER BY type, LOWER(description), id
  `).all(accountId, ...filter.parameters);
  db.release();
  return items.map(asCatalogItem);
}

async function getDataRecord(store, id, accountId) {
  const db = await getClient();

  if (store === 'expenses') {
    const row = await db.prepare(`
      SELECT id, date, description, amount_cents
      FROM expenses WHERE id = $1 AND account_id = $2
    `).get(id, accountId);
    db.release();
    return row ? asExpense(row) : undefined;
  }

  if (store === 'services' || store === 'products') {
    const source = store === 'services' ? 'service' : 'legacy_product';
    const row = await db.prepare(`
      SELECT id, source, date, recorded_at, payment_method
      FROM sales WHERE id = $1 AND account_id = $2 AND source = $3
    `).get(id, accountId, source);
    db.release();
    return row ? await asSale(row) : undefined;
  }

  if (store === 'config') {
    const row = await db.prepare(`
      SELECT id, reference_month, working_days
      FROM monthly_configs WHERE id = $1 AND account_id = $2
    `).get(id, accountId);
    db.release();
    return row ? asMonthlyConfig(row) : undefined;
  }

  const row = await db.prepare(`
    SELECT id, type, description, price_cents
    FROM catalog_items WHERE id = $1 AND account_id = $2
  `).get(id, accountId);
  db.release();
  return row ? asCatalogItem(row) : undefined;
}

function sendNoContent(response) {
  response.writeHead(204, { 'Cache-Control': 'no-store' });
  response.end();
}

function sendMethodNotAllowed(response, allowedMethods) {
  sendJson(
    response,
    405,
    { error: 'method_not_allowed' },
    { Allow: allowedMethods.join(', ') },
  );
}

async function listDataRecords(store, accountId, searchParams) {
  if (store === 'expenses') return listExpenses(accountId, searchParams);
  if (store === 'services') return listSales(accountId, 'service', searchParams);
  if (store === 'products') {
    return listSales(accountId, 'legacy_product', searchParams);
  }
  if (store === 'config') return listMonthlyConfigs(accountId, searchParams);
  return listCatalogItems(accountId, searchParams);
}

async function createExpense(body, accountId) {
  const record = parseExpenseInput(body);
  await insertExpense(record, accountId);
  return getDataRecord('expenses', record.id, accountId);
}

async function createCatalogItem(body, accountId) {
  const record = parseCatalogInput(body);
  await insertCatalogItem(record, accountId);
  return getDataRecord('catalog', record.id, accountId);
}

async function createSale(body, accountId, source) {
  const record = parseSaleInput(body, source, { defaultCreatedAt: true });
  await withTransaction(() => insertSale(record, accountId, source));
  return getDataRecord(
    source === 'service' ? 'services' : 'products',
    record.id,
    accountId,
  );
}

async function upsertMonthlyConfig(body, accountId) {
  const record = parseConfigInput(body);

  return await withTransaction(async () => {
    const db = await getClient();
    const existing = await db.prepare(`
      SELECT id
      FROM monthly_configs
      WHERE account_id = $1 AND reference_month = $2
    `).get(accountId, record.referenceMonth);

    if (existing) {
      await db.prepare(`
        UPDATE monthly_configs
        SET working_days = $1, updated_at = $2
        WHERE id = $3 AND account_id = $4
      `).run(record.workingDays, Date.now(), existing.id, accountId);
      db.release();
      return getDataRecord('config', existing.id, accountId);
    }

    await insertMonthlyConfig(record, accountId);
    db.release();
    return getDataRecord('config', record.id, accountId);
  });
}

async function createDataRecord(store, body, accountId) {
  if (store === 'expenses') return createExpense(body, accountId);
  if (store === 'services') return createSale(body, accountId, 'service');
  if (store === 'products') {
    return createSale(body, accountId, 'legacy_product');
  }
  if (store === 'config') return upsertMonthlyConfig(body, accountId);
  return createCatalogItem(body, accountId);
}

async function updateCatalogItem(id, body, accountId) {
  const record = parseCatalogInput({ ...body, id }, { required: true });
  const db = await getClient();
  const result = await db.prepare(`
    UPDATE catalog_items
    SET type = $1, description = $2, price_cents = $3, updated_at = $4
    WHERE id = $5 AND account_id = $6
  `).run(
    record.type,
    record.description,
    record.priceCents,
    Date.now(),
    id,
    accountId,
  );

  if (result.changes !== 1) throw requestError(404, 'not_found');
  db.release();
  return getDataRecord('catalog', id, accountId);
}

async function deleteDataRecord(store, id, accountId) {
  const db = await getClient();

  if (store === 'expenses') {
    await db.prepare('DELETE FROM expenses WHERE id = $1 AND account_id = $2').run(id, accountId);
    db.release();
    return;
  }

  if (store === 'services' || store === 'products') {
    const source = store === 'services' ? 'service' : 'legacy_product';
    await db.prepare(`
      DELETE FROM sales
      WHERE id = $1 AND account_id = $2 AND source = $3
    `).run(id, accountId, source);
    db.release();
    return;
  }

  if (store === 'config') {
    await db.prepare('DELETE FROM monthly_configs WHERE id = $1 AND account_id = $2').run(id, accountId);
    db.release();
    return;
  }

  await db.prepare('DELETE FROM catalog_items WHERE id = $1 AND account_id = $2').run(id, accountId);
  db.release();
}

function parseImportPayload(body) {
  if (!isObject(body)) throw requestError(400, 'invalid_import');

  for (const store of dataStores) {
    if (!Array.isArray(body[store])) {
      throw requestError(400, 'invalid_import');
    }
  }

  return {
    expenses: body.expenses.map((record) =>
      parseExpenseInput(record, { required: true }),
    ),
    services: body.services.map((record) =>
      parseSaleInput(record, 'service', {
        required: true,
        defaultCreatedAt: false,
        allowMissingPayment: true,
      }),
    ),
    products: body.products.map((record) =>
      parseSaleInput(record, 'legacy_product', {
        required: true,
        defaultCreatedAt: false,
        allowMissingPayment: true,
      }),
    ),
    config: body.config.map((record) =>
      parseConfigInput(record, { required: true }),
    ),
    catalog: body.catalog.map((record) =>
      parseCatalogInput(record, { required: true }),
    ),
  };
}

async function importData(body, accountId) {
  const records = parseImportPayload(body);
  const imported = {
    expenses: 0,
    services: 0,
    products: 0,
    config: 0,
    catalog: 0,
  };

  await withTransaction(async () => {
    for (const record of records.catalog) {
      if (await insertCatalogItem(record, accountId, { ignore: true })) {
        imported.catalog += 1;
      }
    }

    for (const record of records.expenses) {
      if (await insertExpense(record, accountId, { ignore: true })) {
        imported.expenses += 1;
      }
    }

    for (const record of records.services) {
      if (await insertSale(record, accountId, 'service', { ignore: true })) {
        imported.services += 1;
      }
    }

    for (const record of records.products) {
      if (await insertSale(record, accountId, 'legacy_product', { ignore: true })) {
        imported.products += 1;
      }
    }

    for (const record of records.config) {
      if (await insertMonthlyConfig(record, accountId, { ignore: true })) {
        imported.config += 1;
      }
    }
  });

  const skipped = Object.fromEntries(
    Object.entries(imported).map(([store, count]) => [
      store,
      records[store].length - count,
    ]),
  );

  return { imported, skipped };
}

async function handleDataRequest(request, response, url, session) {
  const pathname = url.pathname;

  if (pathname === '/api/data/import') {
    if (request.method !== 'POST') {
      sendMethodNotAllowed(response, ['POST']);
      return;
    }

    const body = await readJson(request);
    sendJson(response, 200, await importData(body, session.account_id));
    return;
  }

  const routeMatch = /^\/api\/(expenses|services|products|config|catalog)(?:\/([^/]+))?$/.exec(
    pathname,
  );
  if (!routeMatch) {
    sendJson(response, 404, { error: 'not_found' });
    return;
  }

  const store = routeMatch[1];
  const rawId = routeMatch[2];

  if (!rawId) {
    if (request.method === 'GET') {
      const records = await listDataRecords(store, session.account_id, url.searchParams);
      sendJson(response, 200, records);
      return;
    }

    if (request.method === 'POST') {
      const body = await readJson(request);
      const record = await createDataRecord(store, body, session.account_id);
      sendJson(response, 201, record);
      return;
    }

    sendMethodNotAllowed(response, ['GET', 'POST']);
    return;
  }

  const id = parseEntityId(rawId, { required: true });

  if (request.method === 'GET') {
    const record = await getDataRecord(store, id, session.account_id);
    if (!record) throw requestError(404, 'not_found');
    sendJson(response, 200, record);
    return;
  }

  if (request.method === 'DELETE') {
    await deleteDataRecord(store, id, session.account_id);
    sendNoContent(response);
    return;
  }

  if (request.method === 'PUT' && store === 'catalog') {
    const body = await readJson(request);
    sendJson(response, 200, await updateCatalogItem(id, body, session.account_id));
    return;
  }

  sendMethodNotAllowed(
    response,
    store === 'catalog' ? ['GET', 'PUT', 'DELETE'] : ['GET', 'DELETE'],
  );
}

async function handleApiRequest(request, response, url) {
  const { pathname } = url;

  if (!applyCors(request, response)) {
    sendJson(response, 403, { error: 'origin_not_allowed' });
    return;
  }

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Max-Age': '86400',
    });
    response.end();
    return;
  }

  if (request.method === 'GET' && pathname === '/api/health') {
    const db = await getClient();
    const health = await db.prepare('SELECT 1 AS healthy').get();
    db.release();
    if (health?.healthy !== 1) throw requestError(503, 'database_unavailable');
    sendJson(response, 200, { status: 'ok', database: 'ok' });
    return;
  }

  if (request.method === 'GET' && pathname === '/api/auth/session') {
    const session = await getAuthenticatedSession(request);
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
    const db = await getClient();
    const account = await db
      .prepare('SELECT * FROM admin_accounts WHERE email = $1')
      .get(email);
    db.release();

    if (!account || !verifyPassword(password, account)) {
      registerFailedLogin(request);
      sendJson(response, 401, { error: 'invalid_credentials' });
      return;
    }

    clearFailedLogins(request);
    const token = await createSession(account.id);
    sendJson(
      response,
      200,
      { authenticated: true, email: account.email },
      { 'Set-Cookie': sessionCookie(token) },
    );
    return;
  }

  if (request.method === 'POST' && pathname === '/api/auth/logout') {
    const session = await getAuthenticatedSession(request);
    if (session) {
      const db = await getClient();
      await db
        .prepare('DELETE FROM auth_sessions WHERE token_hash = $1')
        .run(session.token_hash);
      db.release();
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
    const session = await getAuthenticatedSession(request);
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

    const db = await getClient();
    await db.prepare(`
      UPDATE admin_accounts
      SET email = $1, password_hash = $2, password_salt = $3, updated_at = $4
      WHERE id = $5
    `).run(
      email,
      passwordHash,
      passwordSalt,
      Date.now(),
      session.account_id,
    );

    await db
      .prepare(`
        DELETE FROM auth_sessions
        WHERE account_id = $1 AND token_hash <> $2
      `)
      .run(session.account_id, session.token_hash);

    db.release();

    sendJson(response, 200, { updated: true, email });
    return;
  }

  if (
    pathname === '/api/data/import' ||
    /^\/api\/(expenses|services|products|config|catalog)(?:\/|$)/.test(pathname)
  ) {
    const session = await getAuthenticatedSession(request);
    if (!session) {
      sendJson(response, 401, { error: 'authentication_required' });
      return;
    }

    await handleDataRequest(request, response, url, session);
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
    try {
      await handleApiRequest(request, response, url);
    } catch (error) {
      const statusCode = Number(error?.statusCode) || 500;
      const errorCode =
        typeof error?.errorCode === 'string' ? error.errorCode : 'request_failed';
      if (statusCode >= 500) console.error(error);
      if (!response.headersSent) {
        sendJson(response, statusCode, { error: errorCode });
      }
    }
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
    const errorCode =
      typeof error?.errorCode === 'string' ? error.errorCode : 'request_failed';
    if (statusCode >= 500) console.error(error);
    if (!response.headersSent) {
      sendJson(response, statusCode, { error: errorCode });
    } else {
      response.end();
    }
  }
});

server.listen(port, host, () => {
  console.log(`Distrito API disponível em http://${host}:${port}`);
  console.log(`Banco: ${getDbMode() === 'postgres' ? 'PostgreSQL (Neon)' : 'SQLite'}`);
});

async function shutdown() {
  server.close(() => {
    closeDatabase().then(() => process.exit(0));
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
