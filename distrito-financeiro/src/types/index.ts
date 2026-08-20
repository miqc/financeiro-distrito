/** Identificador persistido como chave primária no IndexedDB. */
export type EntityId = string;

/** Data civil no formato YYYY-MM-DD. */
export type ISODate = `${number}-${number}-${number}`;

/** Mês de referência no formato YYYY-MM. */
export type ReferenceMonth = `${number}-${number}`;

export interface BaseEntity {
  id: EntityId;
}

export interface Expense extends BaseEntity {
  date: ISODate;
  description: string;
  amount: number;
}

export interface Service extends BaseEntity {
  date: ISODate;
  description: string;
  amount: number;
}

export interface Product extends BaseEntity {
  date: ISODate;
  description: string;
  amount: number;
}

export interface MonthlyConfig extends BaseEntity {
  referenceMonth: ReferenceMonth;
  workingDays: number;
}

export interface CatalogItem extends BaseEntity {
  type: 'service' | 'product';
  description: string;
  price: number;
}

export interface DatabaseSchema {
  expenses: Expense;
  services: Service;
  products: Product;
  config: MonthlyConfig;
  catalog: CatalogItem;
}

export type StoreName = keyof DatabaseSchema;

export type NewEntity<T extends BaseEntity> = Omit<T, 'id'>;
