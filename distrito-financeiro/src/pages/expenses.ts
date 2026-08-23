import {
  addExpense,
  deleteExpense,
  listExpensesByMonth,
} from '../core/database/operations';
import { getGlobalMonth, setGlobalMonth } from '../core/state';
import { renderCrudPage } from './shared/crud-page';

const EXPENSES_STYLE_ID = 'expenses-page-styles';

const expensesStyles = `
  .expenses-page {
    display: grid;
    gap: clamp(1rem, 3vw, 1.5rem);
  }

  .expenses-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: clamp(1.25rem, 4vw, 2rem);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-medium);
    box-shadow: var(--shadow-monthly);
  }

  .expenses-header__content {
    display: grid;
    min-width: 0;
    align-content: center;
    gap: 0.375rem;
  }

  .expenses-header__content h2 {
    font-size: clamp(1.375rem, 4vw, 1.75rem);
    letter-spacing: -0.025em;
    line-height: 1.2;
  }

  .expenses-header__eyebrow {
    width: fit-content;
    color: var(--color-text);
    font-size: 0.8125rem;
    font-weight: 650;
  }

  .expenses-header__description {
    color: var(--color-text-muted);
    font-size: 0.9375rem;
  }

  .expenses-header__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    justify-content: flex-end;
    gap: 0.75rem;
  }

  .expenses-month-field {
    display: grid;
    width: 15rem;
    min-width: 0;
    gap: 0.375rem;
    color: var(--color-text-muted);
    font-size: 0.8125rem;
    font-weight: 650;
  }

  .expenses-month-field input {
    width: 100%;
    min-width: 0;
    min-height: 2.625rem;
    padding: 0.5rem 0.75rem;
    background: var(--color-background);
    border: 1px solid var(--color-input-border);
    border-radius: var(--radius-small);
  }

  .expenses-month-field input:hover,
  .expenses-month-field input:focus {
    border-color: var(--color-danger);
  }

  .expenses-month-field input:focus {
    box-shadow: 0 0 0 0.1875rem var(--color-danger-soft);
  }

  .expenses-content {
    min-width: 0;
  }

  .expenses-content .crud-page {
    gap: 0;
  }

  .expenses-content .crud-page__header {
    display: none;
  }

  .expenses-page .expenses-open-drawer {
    min-height: 2.75rem;
    padding: 0.625rem 1rem;
    color: var(--color-on-accent);
    background: var(--color-danger-action);
    border: 0;
    border-radius: var(--radius-small);
    cursor: pointer;
    font-weight: 750;
  }

  .expenses-page .expenses-open-drawer:hover {
    background: var(--color-danger-action-hover);
  }

  @media (max-width: 48rem) {
    .expenses-header__actions,
    .expenses-month-field {
      width: 100%;
    }
  }

  @media (max-width: 30rem) {
    .expenses-page .expenses-open-drawer {
      width: 100%;
    }
  }
`;

function ensureExpensesStyles(): void {
  if (document.querySelector(`#${EXPENSES_STYLE_ID}`)) return;

  const style = document.createElement('style');
  style.id = EXPENSES_STYLE_ID;
  style.textContent = expensesStyles;
  document.head.append(style);
}

function getRequiredElement<T extends Element>(
  container: ParentNode,
  selector: string,
): T {
  const element = container.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Elemento obrigatório não encontrado: ${selector}`);
  }

  return element;
}

export async function renderExpensesPage(
  container: HTMLElement,
): Promise<void> {
  ensureExpensesStyles();

  container.innerHTML = `
    <section class="expenses-page" aria-labelledby="expenses-title">
      <header class="expenses-header">
        <div class="expenses-header__content">
          <p class="expenses-header__eyebrow">Controle de saídas</p>
          <h2 id="expenses-title">Despesas</h2>
          <p class="expenses-header__description">
            Registre e acompanhe os gastos do período selecionado.
          </p>
        </div>

        <div class="expenses-header__actions">
          <label class="expenses-month-field" for="expenses-month">
            Mês de referência
            <input
              id="expenses-month"
              name="expenses-reference-month"
              type="month"
              min="2020-01"
              max="2100-12"
            />
          </label>
        </div>
      </header>

      <div class="expenses-content"></div>
    </section>
  `;

  const monthInput = getRequiredElement<HTMLInputElement>(
    container,
    '#expenses-month',
  );
  const content = getRequiredElement<HTMLElement>(
    container,
    '.expenses-content',
  );
  const headerActions = getRequiredElement<HTMLElement>(
    container,
    '.expenses-header__actions',
  );

  let referenceMonth = getGlobalMonth();
  monthInput.value = referenceMonth;

  const renderExpenses = async (): Promise<void> => {
    headerActions.querySelector('.expenses-open-drawer')?.remove();

    await renderCrudPage(
      content,
      {
        title: 'Despesas',
        accent: 'danger',
        addRecord: addExpense,
        listRecordsByMonth: listExpensesByMonth,
        deleteRecord: deleteExpense,
      },
      referenceMonth,
    );

    const openDrawerButton = getRequiredElement<HTMLButtonElement>(
      content,
      '.crud-open-drawer',
    );
    openDrawerButton.className = 'expenses-open-drawer';
    openDrawerButton.textContent = 'Adicionar despesa';
    headerActions.append(openDrawerButton);
  };

  monthInput.addEventListener('change', () => {
    if (!monthInput.reportValidity() || !monthInput.value) return;

    setGlobalMonth(monthInput.value);
    referenceMonth = getGlobalMonth();
    void renderExpenses();
  });

  await renderExpenses();
}
