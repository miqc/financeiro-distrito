import type {
  CatalogItem,
  DatabaseSchema,
  EntityId,
  Expense,
  ISODate,
  MonthlyConfig,
  NewEntity,
  Product,
  ReferenceMonth,
  Service,
  StoreName,
} from '../../types';
import { DATABASE_NAME, initDB } from './index';

type DatedStoreName = 'expenses' | 'services' | 'products';
type NewRecord<K extends StoreName> = NewEntity<DatabaseSchema[K]> & {
  id?: EntityId;
};

type LocalDataSnapshot = {
  [K in StoreName]: DatabaseSchema[K][];
};

const API_BASE_URL = String(import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const DATA_MIGRATION_KEY = 'distrito_api_data_migration_v1';
const AUTHENTICATION_REQUIRED_EVENT = 'distrito:authentication-required';

const RESPONSE_KEYS: Record<StoreName, readonly string[]> = {
  expenses: ['expense', 'expenses'],
  services: ['service', 'services', 'attendance', 'attendances'],
  products: ['product', 'products'],
  config: ['config', 'configs'],
  catalog: ['catalogItem', 'catalog', 'items'],
};

let dataStoreInitialization: Promise<void> | null = null;
let localDataSnapshot: Promise<LocalDataSnapshot> | null = null;
let migrationCompletedInMemory = false;

export class DatabaseOperationError extends Error {
  readonly storeName: StoreName;
  readonly operation: string;
  readonly status?: number;
  override readonly cause: unknown;

  constructor(
    message: string,
    storeName: StoreName,
    operation: string,
    cause?: unknown,
    status?: number,
  ) {
    super(message);
    this.name = 'DatabaseOperationError';
    this.storeName = storeName;
    this.operation = operation;
    this.cause = cause;
    this.status = status;
  }
}

export class DataStoreInitializationError extends Error {
  readonly status?: number;
  override readonly cause: unknown;

  constructor(message: string, cause?: unknown, status?: number) {
    super(message);
    this.name = 'DataStoreInitializationError';
    this.cause = cause;
    this.status = status;
  }
}

function apiUrl(
  path: string,
  query?: Readonly<Record<string, string | undefined>>,
): string {
  const search = new URLSearchParams();

  for (const [name, value] of Object.entries(query ?? {})) {
    if (value !== undefined) search.set(name, value);
  }

  const queryString = search.toString();
  return `${API_BASE_URL}/api${path}${queryString ? `?${queryString}` : ''}`;
}

function dispatchAuthenticationRequired(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTHENTICATION_REQUIRED_EVENT));
  }
}

async function readResponseBody(response: Response): Promise<unknown> {
  const body = await response.text();

  if (!body) return undefined;

  try {
    return JSON.parse(body) as unknown;
  } catch {
    return body;
  }
}

function unwrapResponse<T>(payload: unknown, storeName: StoreName): T {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload as T;
  }

  const response = payload as Record<string, unknown>;

  if (Object.hasOwn(response, 'data')) return response.data as T;

  for (const key of RESPONSE_KEYS[storeName]) {
    if (Object.hasOwn(response, key)) return response[key] as T;
  }

  if (Object.hasOwn(response, 'records')) return response.records as T;
  return payload as T;
}

async function requestApi<T>(
  storeName: StoreName,
  operation: string,
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    query?: Readonly<Record<string, string | undefined>>;
    body?: unknown;
    allowNotFound?: boolean;
  } = {},
): Promise<T> {
  const headers = new Headers({ Accept: 'application/json' });

  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const response = await fetch(apiUrl(path, options.query), {
      method: options.method ?? 'GET',
      credentials: 'include',
      headers,
      ...(options.body === undefined
        ? {}
        : { body: JSON.stringify(options.body) }),
    });

    if (response.status === 401) dispatchAuthenticationRequired();

    if (response.status === 404 && options.allowNotFound) {
      return undefined as T;
    }

    const payload = await readResponseBody(response);

    if (!response.ok) {
      throw new DatabaseOperationError(
        `Falha ao executar "${operation}" em "${storeName}".`,
        storeName,
        operation,
        payload,
        response.status,
      );
    }

    return unwrapResponse<T>(payload, storeName);
  } catch (error) {
    if (error instanceof DatabaseOperationError) throw error;

    throw new DatabaseOperationError(
      `Falha ao executar "${operation}" em "${storeName}".`,
      storeName,
      operation,
      error,
    );
  }
}

export function addRecord<K extends StoreName>(
  storeName: K,
  input: NewRecord<K>,
): Promise<DatabaseSchema[K]> {
  return requestApi<DatabaseSchema[K]>(storeName, 'add', `/${storeName}`, {
    method: 'POST',
    body: input,
  });
}

export function getRecordById<K extends StoreName>(
  storeName: K,
  id: EntityId,
): Promise<DatabaseSchema[K] | undefined> {
  return requestApi<DatabaseSchema[K] | undefined>(
    storeName,
    'get-by-id',
    `/${storeName}/${encodeURIComponent(id)}`,
    { allowNotFound: true },
  );
}

export function getAllRecords<K extends StoreName>(
  storeName: K,
): Promise<DatabaseSchema[K][]> {
  return requestApi<DatabaseSchema[K][]>(storeName, 'get-all', `/${storeName}`);
}

export function getRecordsByDate<K extends DatedStoreName>(
  storeName: K,
  date: ISODate,
): Promise<DatabaseSchema[K][]> {
  return requestApi<DatabaseSchema[K][]>(
    storeName,
    'get-by-date',
    `/${storeName}`,
    { query: { date } },
  );
}

export function getRecordsByMonth<K extends DatedStoreName>(
  storeName: K,
  referenceMonth: ReferenceMonth,
): Promise<DatabaseSchema[K][]> {
  return requestApi<DatabaseSchema[K][]>(
    storeName,
    'get-by-month',
    `/${storeName}`,
    { query: { month: referenceMonth } },
  );
}

export async function deleteRecord<K extends StoreName>(
  storeName: K,
  id: EntityId,
): Promise<void> {
  await requestApi<void>(
    storeName,
    'delete',
    `/${storeName}/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
}

export async function getConfigByReferenceMonth(
  referenceMonth: ReferenceMonth,
): Promise<MonthlyConfig | undefined> {
  const configs = await requestApi<MonthlyConfig[]>(
    'config',
    'get-config-by-reference-month',
    '/config',
    {
      query: { month: referenceMonth },
    },
  );

  return configs[0];
}

export const addExpense = (expense: NewRecord<'expenses'>): Promise<Expense> =>
  addRecord('expenses', expense);

export const getExpenseById = (
  id: EntityId,
): Promise<Expense | undefined> => getRecordById('expenses', id);

export const listExpenses = (): Promise<Expense[]> =>
  getAllRecords('expenses');

export const listExpensesByDate = (date: ISODate): Promise<Expense[]> =>
  getRecordsByDate('expenses', date);

export const listExpensesByMonth = (
  month: ReferenceMonth,
): Promise<Expense[]> => getRecordsByMonth('expenses', month);

export const deleteExpense = (id: EntityId): Promise<void> =>
  deleteRecord('expenses', id);

export const addService = (service: NewRecord<'services'>): Promise<Service> =>
  addRecord('services', service);

export const getServiceById = (
  id: EntityId,
): Promise<Service | undefined> => getRecordById('services', id);

export const listServices = (): Promise<Service[]> => getAllRecords('services');

export const listServicesByDate = (date: ISODate): Promise<Service[]> =>
  getRecordsByDate('services', date);

export const listServicesByMonth = (
  month: ReferenceMonth,
): Promise<Service[]> => getRecordsByMonth('services', month);

export const deleteService = (id: EntityId): Promise<void> =>
  deleteRecord('services', id);

export const addProduct = (product: NewRecord<'products'>): Promise<Product> =>
  addRecord('products', product);

export const getProductById = (
  id: EntityId,
): Promise<Product | undefined> => getRecordById('products', id);

export const listProducts = (): Promise<Product[]> => getAllRecords('products');

export const listProductsByDate = (date: ISODate): Promise<Product[]> =>
  getRecordsByDate('products', date);

export const listProductsByMonth = (
  month: ReferenceMonth,
): Promise<Product[]> => getRecordsByMonth('products', month);

export const deleteProduct = (id: EntityId): Promise<void> =>
  deleteRecord('products', id);

export const addMonthlyConfig = (
  config: NewRecord<'config'>,
): Promise<MonthlyConfig> => addRecord('config', config);

export const getMonthlyConfigById = (
  id: EntityId,
): Promise<MonthlyConfig | undefined> => getRecordById('config', id);

export const listMonthlyConfigs = (): Promise<MonthlyConfig[]> =>
  getAllRecords('config');

export const deleteMonthlyConfig = (id: EntityId): Promise<void> =>
  deleteRecord('config', id);

export const addCatalogItem = (
  item: NewRecord<'catalog'>,
): Promise<CatalogItem> => addRecord('catalog', item);

export function updateCatalogItem(
  id: EntityId,
  item: Omit<CatalogItem, 'id'>,
): Promise<CatalogItem> {
  return requestApi<CatalogItem>(
    'catalog',
    'update',
    `/catalog/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      body: item,
    },
  );
}

export const deleteCatalogItem = (id: EntityId): Promise<void> =>
  deleteRecord('catalog', id);

export async function listCatalogItems(
  type?: CatalogItem['type'],
): Promise<CatalogItem[]> {
  return requestApi<CatalogItem[]>('catalog', 'get-all', '/catalog', {
    query: { type },
  });
}

function hasCompletedMigration(): boolean {
  if (migrationCompletedInMemory) return true;

  try {
    return window.localStorage.getItem(DATA_MIGRATION_KEY) === 'complete';
  } catch (error) {
    console.warn('Não foi possível consultar o estado da migração local.', error);
    return false;
  }
}

function markMigrationAsCompleted(): void {
  migrationCompletedInMemory = true;

  try {
    window.localStorage.setItem(DATA_MIGRATION_KEY, 'complete');
  } catch (error) {
    console.warn('Não foi possível salvar o estado da migração local.', error);
  }
}

async function readLocalData(): Promise<LocalDataSnapshot> {
  const database = await initDB();

  try {
    return await new Promise<LocalDataSnapshot>((resolve, reject) => {
      let settled = false;

      const transaction = database.transaction(
        ['expenses', 'services', 'products', 'config', 'catalog'],
        'readonly',
      );
      const expensesRequest = transaction.objectStore('expenses').getAll();
      const servicesRequest = transaction.objectStore('services').getAll();
      const productsRequest = transaction.objectStore('products').getAll();
      const configRequest = transaction.objectStore('config').getAll();
      const catalogRequest = transaction.objectStore('catalog').getAll();

      const fail = (cause?: unknown): void => {
        if (settled) return;
        settled = true;
        reject(
          new DataStoreInitializationError(
            'Não foi possível ler os dados armazenados neste navegador.',
            cause,
          ),
        );
      };

      transaction.oncomplete = () => {
        if (settled) return;
        settled = true;
        resolve({
          expenses: expensesRequest.result as Expense[],
          services: servicesRequest.result as Service[],
          products: productsRequest.result as Product[],
          config: configRequest.result as MonthlyConfig[],
          catalog: catalogRequest.result as CatalogItem[],
        });
      };
      transaction.onerror = () => fail(transaction.error);
      transaction.onabort = () => fail(transaction.error);
    });
  } finally {
    database.close();
  }
}

function getLocalDataOnce(): Promise<LocalDataSnapshot> {
  localDataSnapshot ??= readLocalData();
  return localDataSnapshot;
}

async function importLocalData(snapshot: LocalDataSnapshot): Promise<void> {
  let response: Response;

  try {
    response = await fetch(apiUrl('/data/import'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(snapshot),
    });
  } catch (error) {
    throw new DataStoreInitializationError(
      'Não foi possível enviar os dados locais ao servidor.',
      error,
    );
  }

  if (response.status === 401) dispatchAuthenticationRequired();

  if (!response.ok) {
    const payload = await readResponseBody(response);
    throw new DataStoreInitializationError(
      'O servidor não aceitou a migração dos dados locais.',
      payload,
      response.status,
    );
  }
}

async function deleteLocalDatabase(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;

  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    let settled = false;

    const finish = (): void => {
      if (settled) return;
      settled = true;
      resolve();
    };

    request.onsuccess = finish;
    request.onerror = () => {
      if (settled) return;
      settled = true;
      reject(request.error);
    };
    request.onblocked = () => {
      console.warn(
        'A remoção do banco local foi bloqueada por outra aba aberta.',
      );
      finish();
    };
  });
}

async function initializeDataStoreOnce(): Promise<void> {
  if (hasCompletedMigration()) return;

  const snapshot = await getLocalDataOnce();
  await importLocalData(snapshot);
  markMigrationAsCompleted();

  try {
    await deleteLocalDatabase();
  } catch (error) {
    console.warn(
      'Os dados foram migrados, mas o banco local não pôde ser removido.',
      error,
    );
  }
}

export function initializeDataStore(): Promise<void> {
  dataStoreInitialization ??= initializeDataStoreOnce();
  return dataStoreInitialization;
}
