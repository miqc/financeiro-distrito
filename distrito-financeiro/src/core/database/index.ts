import type { StoreName } from '../../types';

export const DATABASE_NAME = 'distrito-financeiro';
export const DATABASE_VERSION = 2;

const STORE_NAMES = {
  expenses: 'expenses',
  services: 'services',
  products: 'products',
  config: 'config',
  catalog: 'catalog',
} as const satisfies Record<StoreName, StoreName>;

interface IndexDefinition {
  name: string;
  keyPath: string | string[];
  options?: IDBIndexParameters;
}

interface StoreDefinition {
  name: StoreName;
  options: IDBObjectStoreParameters;
  indexes: readonly IndexDefinition[];
}

const DATE_INDEX: IndexDefinition = {
  name: 'by-date',
  keyPath: 'date',
};

const STORE_DEFINITIONS: readonly StoreDefinition[] = [
  {
    name: STORE_NAMES.expenses,
    options: { keyPath: 'id' },
    indexes: [DATE_INDEX],
  },
  {
    name: STORE_NAMES.services,
    options: { keyPath: 'id' },
    indexes: [DATE_INDEX],
  },
  {
    name: STORE_NAMES.products,
    options: { keyPath: 'id' },
    indexes: [DATE_INDEX],
  },
  {
    name: STORE_NAMES.config,
    options: { keyPath: 'id' },
    indexes: [
      {
        name: 'by-reference-month',
        keyPath: 'referenceMonth',
        options: { unique: true },
      },
    ],
  },
  {
    name: STORE_NAMES.catalog,
    options: { keyPath: 'id' },
    indexes: [],
  },
];

export class DatabaseInitializationError extends Error {
  override readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'DatabaseInitializationError';
    this.cause = cause;
  }
}

function configureObjectStores(
  database: IDBDatabase,
  transaction: IDBTransaction,
): void {
  for (const definition of STORE_DEFINITIONS) {
    const store = database.objectStoreNames.contains(definition.name)
      ? transaction.objectStore(definition.name)
      : database.createObjectStore(definition.name, definition.options);

    for (const index of definition.indexes) {
      if (!store.indexNames.contains(index.name)) {
        store.createIndex(index.name, index.keyPath, index.options);
      }
    }
  }
}

function asInitializationError(
  message: string,
  cause?: unknown,
): DatabaseInitializationError {
  return cause instanceof DatabaseInitializationError
    ? cause
    : new DatabaseInitializationError(message, cause);
}

export function initDB(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    let settled = false;
    let upgradeError: unknown;

    const fail = (message: string, cause?: unknown): void => {
      if (settled) return;

      settled = true;
      reject(asInitializationError(message, cause));
    };

    try {
      if (typeof indexedDB === 'undefined') {
        fail('IndexedDB não está disponível neste ambiente.');
        return;
      }

      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

      request.onupgradeneeded = () => {
        try {
          const transaction = request.transaction;

          if (!transaction) {
            throw new DatabaseInitializationError(
              'A transação de atualização do banco não foi criada.',
            );
          }

          configureObjectStores(request.result, transaction);
        } catch (error) {
          upgradeError = error;
          request.transaction?.abort();
          fail('Não foi possível configurar o banco de dados local.', error);
        }
      };

      request.onsuccess = () => {
        const database = request.result;

        if (settled) {
          database.close();
          return;
        }

        database.onversionchange = () => database.close();
        settled = true;
        resolve(database);
      };

      request.onerror = () => {
        fail(
          'Não foi possível inicializar o banco de dados local.',
          upgradeError ?? request.error,
        );
      };

      request.onblocked = () => {
        fail(
          'A atualização do banco foi bloqueada por outra aba aberta da aplicação.',
        );
      };
    } catch (error) {
      fail('Ocorreu um erro inesperado ao abrir o banco de dados local.', error);
    }
  });
}
