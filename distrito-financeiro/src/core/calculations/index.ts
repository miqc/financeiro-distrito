import type {
  Expense,
  MonthlyConfig,
  Product,
  Service,
} from '../../types';
import {
  getAttendanceProductAmount,
  getAttendanceServiceAmount,
} from '../attendance';

interface FinancialEntry {
  amount: number;
}

interface DatedFinancialEntry extends FinancialEntry {
  date: string;
}

export interface DailySummary {
  totalRevenue: number;
  totalWithdrawal: number;
}

export interface MonthlySummary {
  totalRevenue: number;
  totalExpenses: number;
  dailyGoal: number;
  totalWithdrawals: number;
  accumulatedSalary: number;
}

function toCents(value: number): number {
  if (!Number.isFinite(value)) {
    throw new TypeError('O valor financeiro deve ser um número finito.');
  }

  if (value < 0) {
    throw new RangeError('O valor financeiro não pode ser negativo.');
  }

  const cents = Math.round(value * 100);

  if (!Number.isSafeInteger(cents)) {
    throw new RangeError('O valor financeiro excede o limite suportado.');
  }

  return cents;
}

function fromCents(cents: number): number {
  return cents / 100;
}

function sumInCents(entries: readonly FinancialEntry[]): number {
  return entries.reduce((total, entry) => {
    const nextTotal = total + toCents(entry.amount);

    if (!Number.isSafeInteger(nextTotal)) {
      throw new RangeError('A soma financeira excede o limite suportado.');
    }

    return nextTotal;
  }, 0);
}

function sumServicesInCents(services: readonly Service[]): number {
  return services.reduce((total, service) => {
    const serviceTotal =
      toCents(getAttendanceServiceAmount(service)) +
      toCents(getAttendanceProductAmount(service));
    const nextTotal = total + serviceTotal;

    if (!Number.isSafeInteger(nextTotal)) {
      throw new RangeError('A soma financeira excede o limite suportado.');
    }

    return nextTotal;
  }, 0);
}

function calculateWithdrawalInCents(totalInCents: number): number {
  return Math.round(totalInCents * 0.1);
}

function sumDailyWithdrawalsInCents(
  services: readonly Service[],
  products: readonly Product[],
): number {
  const revenueByDate = new Map<string, number>();

  const addRevenue = (entry: DatedFinancialEntry): void => {
    const currentRevenue = revenueByDate.get(entry.date) ?? 0;
    const dailyRevenue = currentRevenue + toCents(entry.amount);

    if (!Number.isSafeInteger(dailyRevenue)) {
      throw new RangeError('A soma financeira diária excede o limite suportado.');
    }

    revenueByDate.set(entry.date, dailyRevenue);
  };

  for (const service of services) {
    addRevenue({
      date: service.date,
      amount:
        getAttendanceServiceAmount(service) +
        getAttendanceProductAmount(service),
    });
  }

  for (const product of products) {
    addRevenue(product);
  }

  let totalWithdrawals = 0;

  for (const dailyRevenue of revenueByDate.values()) {
    totalWithdrawals += calculateWithdrawalInCents(dailyRevenue);

    if (!Number.isSafeInteger(totalWithdrawals)) {
      throw new RangeError('A soma das retiradas excede o limite suportado.');
    }
  }

  return totalWithdrawals;
}

export function calculateTenPercent(value: number): number {
  return fromCents(calculateWithdrawalInCents(toCents(value)));
}

export function calculateDailySummary(
  services: readonly Service[],
  products: readonly Product[],
): DailySummary {
  const totalRevenueInCents =
    sumServicesInCents(services) + sumInCents(products);
  const totalWithdrawalInCents = calculateWithdrawalInCents(
    totalRevenueInCents,
  );

  return {
    totalRevenue: fromCents(totalRevenueInCents),
    totalWithdrawal: fromCents(totalWithdrawalInCents),
  };
}

export function calculateMonthlySummary(
  expenses: readonly Expense[],
  services: readonly Service[],
  products: readonly Product[],
  config: Pick<MonthlyConfig, 'workingDays'>,
): MonthlySummary {
  const totalRevenueInCents =
    sumServicesInCents(services) + sumInCents(products);
  const totalExpensesInCents = sumInCents(expenses);
  const totalWithdrawalsInCents = sumDailyWithdrawalsInCents(
    services,
    products,
  );

  const dailyGoalInCents =
    Number.isFinite(config.workingDays) && config.workingDays > 0
      ? Math.round(totalExpensesInCents / config.workingDays)
      : 0;

  return {
    totalRevenue: fromCents(totalRevenueInCents),
    totalExpenses: fromCents(totalExpensesInCents),
    dailyGoal: fromCents(dailyGoalInCents),
    totalWithdrawals: fromCents(totalWithdrawalsInCents),
    accumulatedSalary: fromCents(totalWithdrawalsInCents),
  };
}
