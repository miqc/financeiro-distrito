import type { ReferenceMonth } from '../types';

const REFERENCE_MONTH_KEY = 'distrito_reference_month';
const REFERENCE_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

let memoryMonth: ReferenceMonth | null = null;

function getCurrentReferenceMonth(): ReferenceMonth {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}` as ReferenceMonth;
}

function isReferenceMonth(month: string | null): month is ReferenceMonth {
  return month !== null && REFERENCE_MONTH_PATTERN.test(month);
}

export function getGlobalMonth(): ReferenceMonth {
  if (memoryMonth) return memoryMonth;

  try {
    const storedMonth = window.localStorage.getItem(REFERENCE_MONTH_KEY);

    if (isReferenceMonth(storedMonth)) {
      memoryMonth = storedMonth;
      return storedMonth;
    }
  } catch (error) {
    console.error('Não foi possível ler o mês de referência salvo.', error);
  }

  memoryMonth = getCurrentReferenceMonth();
  return memoryMonth;
}

export function setGlobalMonth(month: string): void {
  if (!isReferenceMonth(month)) {
    throw new RangeError('O mês de referência deve estar no formato YYYY-MM.');
  }

  memoryMonth = month;

  try {
    window.localStorage.setItem(REFERENCE_MONTH_KEY, month);
  } catch (error) {
    console.error('Não foi possível salvar o mês de referência.', error);
  }
}
