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
import { initDB } from './index';

type DatedStoreName = 'expenses' | 'services' | 'products';
type NewRecord<K extends StoreName> = NewEntity<DatabaseSchema[K]> & {
  id?: EntityId;
};

export class DatabaseOperationError extends Error {
  readonly storeName: StoreName;
  readonly operation: string;
  override readonly cause: unknown;

  constructor(
    message: string,
    storeName: StoreName,
    operation: string,
    cause?: unknown,
  ) {
    super(message);
    this.name = 'DatabaseOperationError';
    this.storeName = storeName;
    this.operation = operation;
    this.cause = cause;
  }
}

function generateEntityId(): EntityId {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const randomPart = Math.random().toString(36).slice(2);
  return `${Date.now().toString(36)}-${randomPart}`;
}

function runRequest<T>(
  database: IDBDatabase,
  storeName: StoreName,
  mode: IDBTransactionMode,
  operation: string,
  createRequest: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let requestResult: T;
    let requestError: DOMException | null = null;

    const rejectOperation = (cause?: unknown): void => {
      reject(
        new DatabaseOperationError(
          `Falha ao executar "${operation}" em "${storeName}".`,
          storeName,
          operation,
          cause,
        ),
      );
    };

    try {
      const transaction = database.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      const request = createRequest(store);

      request.onsuccess = () => {
        requestResult = request.result;
      };

      request.onerror = () => {
        requestError = request.error;
      };

      transaction.oncomplete = () => resolve(requestResult);
      transaction.onerror = () =>
        rejectOperation(requestError ?? transaction.error);
      transaction.onabort = () =>
        rejectOperation(requestError ?? transaction.error);
    } catch (error) {
      rejectOperation(error);
    }
  });
}

async function executeRequest<T>(
  storeName: StoreName,
  mode: IDBTransactionMode,
  operation: string,
  createRequest: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await initDB();

  try {
    return await runRequest(
      database,
      storeName,
      mode,
      operation,
      createRequest,
    );
  } finally {
    database.close();
  }
}

export async function addRecord<K extends StoreName>(
  storeName: K,
  input: NewRecord<K>,
): Promise<DatabaseSchema[K]> {
  const record = {
    ...input,
    id: input.id ?? generateEntityId(),
  } as DatabaseSchema[K];

  await executeRequest(
    storeName,
    'readwrite',
    'add',
    (store) => store.add(record),
  );

  return record;
}

export function getRecordById<K extends StoreName>(
  storeName: K,
  id: EntityId,
): Promise<DatabaseSchema[K] | undefined> {
  return executeRequest(
    storeName,
    'readonly',
    'get-by-id',
    (store) => store.get(id) as IDBRequest<DatabaseSchema[K] | undefined>,
  );
}

export function getAllRecords<K extends StoreName>(
  storeName: K,
): Promise<DatabaseSchema[K][]> {
  return executeRequest(
    storeName,
    'readonly',
    'get-all',
    (store) => store.getAll() as IDBRequest<DatabaseSchema[K][]>,
  );
}

export function getRecordsByDate<K extends DatedStoreName>(
  storeName: K,
  date: ISODate,
): Promise<DatabaseSchema[K][]> {
  return executeRequest(
    storeName,
    'readonly',
    'get-by-date',
    (store) =>
      store.index('by-date').getAll(IDBKeyRange.only(date)) as IDBRequest<
        DatabaseSchema[K][]
      >,
  );
}

export function getRecordsByMonth<K extends DatedStoreName>(
  storeName: K,
  referenceMonth: ReferenceMonth,
): Promise<DatabaseSchema[K][]> {
  const monthRange = IDBKeyRange.bound(
    `${referenceMonth}-01`,
    `${referenceMonth}-31`,
  );

  return executeRequest(
    storeName,
    'readonly',
    'get-by-month',
    (store) =>
      store.index('by-date').getAll(monthRange) as IDBRequest<
        DatabaseSchema[K][]
      >,
  );
}

export async function deleteRecord<K extends StoreName>(
  storeName: K,
  id: EntityId,
): Promise<void> {
  await executeRequest(storeName, 'readwrite', 'delete', (store) =>
    store.delete(id),
  );
}

export function getConfigByReferenceMonth(
  referenceMonth: ReferenceMonth,
): Promise<MonthlyConfig | undefined> {
  return executeRequest(
    'config',
    'readonly',
    'get-config-by-reference-month',
    (store) =>
      store.index('by-reference-month').get(referenceMonth) as IDBRequest<
        MonthlyConfig | undefined
      >,
  );
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

export const listServices = (): Promise<Service[]> =>
  getAllRecords('services');

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

export const listProducts = (): Promise<Product[]> =>
  getAllRecords('products');

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

export async function updateCatalogItem(
  id: EntityId,
  item: Omit<CatalogItem, 'id'>,
): Promise<CatalogItem> {
  const updatedItem: CatalogItem = { ...item, id };

  await executeRequest('catalog', 'readwrite', 'update', (store) =>
    store.put(updatedItem),
  );

  return updatedItem;
}

export const deleteCatalogItem = (id: EntityId): Promise<void> =>
  deleteRecord('catalog', id);

export async function listCatalogItems(
  type?: CatalogItem['type'],
): Promise<CatalogItem[]> {
  const items = await getAllRecords('catalog');
  return type ? items.filter((item) => item.type === type) : items;
}
