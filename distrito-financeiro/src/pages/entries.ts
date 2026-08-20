import {
  addExpense,
  addProduct,
  addService,
  deleteExpense,
  deleteProduct,
  deleteService,
  listExpensesByMonth,
  listProductsByMonth,
  listServicesByMonth,
} from '../core/database/operations';
import { getGlobalMonth, setGlobalMonth } from '../core/state';
import { renderCrudPage } from './shared/crud-page';

const ENTRIES_STYLE_ID = 'entries-page-styles';

const ENTRY_TABS = ['expenses', 'services', 'products'] as const;
type EntryTab = (typeof ENTRY_TABS)[number];

const entriesStyles = `
  .entries-page {
    display: grid;
    gap: 1rem;
  }

  .entries-header {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    justify-content: space-between;
    gap: 1rem;
    padding: clamp(1rem, 3vw, 1.5rem);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-medium);
    box-shadow: var(--shadow-surface);
  }

  .entries-header__content {
    display: grid;
    gap: 0.25rem;
  }

  .entries-header__eyebrow {
    color: var(--color-primary-strong);
    font-size: 0.75rem;
    font-weight: 750;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .entries-header__description {
    color: var(--color-text-muted);
    font-size: 0.9375rem;
  }

  .entries-month-field {
    display: grid;
    gap: 0.375rem;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    font-size: 0.875rem;
    font-weight: 700;
  }

  .entries-month-field input {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
    -webkit-appearance: none;
    appearance: none;
    min-height: 2.75rem;
    padding: 0.625rem 0.75rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-small);
  }

  .entries-month-field input:hover {
    border-color: var(--color-primary);
  }

  .entries-tabs-wrapper {
    max-width: 100%;
    overflow-x: auto;
    scrollbar-width: thin;
  }

  .entries-tabs {
    display: grid;
    grid-template-columns: repeat(3, minmax(7.5rem, 1fr));
    width: min(100%, 34rem);
    min-width: max-content;
    padding: 0.375rem;
    background: var(--color-surface-muted);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-medium);
  }

  .entries-tab {
    --entries-tab-accent: var(--color-primary-strong);
    --entries-tab-soft: var(--color-surface);
    min-height: 2.75rem;
    padding: 0.625rem 1rem;
    color: var(--color-text-muted);
    background: transparent;
    border: 0;
    border-radius: var(--radius-small);
    cursor: pointer;
    font: inherit;
    font-size: 0.875rem;
    font-weight: 750;
    transition:
      color 160ms ease,
      background-color 160ms ease,
      box-shadow 160ms ease;
  }

  .entries-tab[data-entry-tab="expenses"] {
    --entries-tab-accent: var(--color-danger);
    --entries-tab-soft: var(--color-danger-soft);
  }

  .entries-tab[data-entry-tab="services"] {
    --entries-tab-accent: var(--color-success-strong);
    --entries-tab-soft: var(--color-success-soft);
  }

  .entries-tab[data-entry-tab="products"] {
    --entries-tab-accent: var(--color-info-strong);
    --entries-tab-soft: var(--color-info-soft);
  }

  .entries-tab:hover:not([aria-selected="true"]) {
    color: var(--entries-tab-accent);
    background: var(--entries-tab-soft);
  }

  .entries-tab[aria-selected="true"] {
    color: var(--entries-tab-accent);
    background: var(--entries-tab-soft);
    box-shadow:
      inset 0 -0.125rem 0 var(--entries-tab-accent),
      0 0.125rem 0.5rem rgb(23 33 31 / 10%);
  }

  .entries-tab-panel {
    min-width: 0;
  }

  @media (min-width: 48rem) {
    .entries-month-field {
      width: min(100%, 13rem);
    }
  }

  @media (max-width: 30rem) {
    .entries-month-field {
      width: 100%;
    }

    .entries-tabs {
      width: 100%;
    }
  }
`;

function ensureEntriesStyles(): void {
  if (document.querySelector(`#${ENTRIES_STYLE_ID}`)) return;

  const style = document.createElement('style');
  style.id = ENTRIES_STYLE_ID;
  style.textContent = entriesStyles;
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

export async function renderEntries(container: HTMLElement): Promise<void> {
  ensureEntriesStyles();

  container.innerHTML = `
    <section class="entries-page" aria-labelledby="entries-title">
      <div class="entries-tabs-wrapper">
        <nav class="entries-tabs" role="tablist" aria-label="Tipo de lançamento">
          <button
            id="entries-tab-expenses"
            class="entries-tab"
            type="button"
            role="tab"
            aria-controls="tab-content"
            aria-selected="true"
            data-entry-tab="expenses"
          >
            Despesas
          </button>
          <button
            id="entries-tab-services"
            class="entries-tab"
            type="button"
            role="tab"
            aria-controls="tab-content"
            aria-selected="false"
            tabindex="-1"
            data-entry-tab="services"
          >
            Serviços
          </button>
          <button
            id="entries-tab-products"
            class="entries-tab"
            type="button"
            role="tab"
            aria-controls="tab-content"
            aria-selected="false"
            tabindex="-1"
            data-entry-tab="products"
          >
            Produtos
          </button>
        </nav>
      </div>

      <header class="entries-header">
        <div class="entries-header__content">
          <p class="entries-header__eyebrow">Controle mensal</p>
          <h2 id="entries-title">Lançamentos</h2>
          <p class="entries-header__description">
            Cadastre despesas, serviços e produtos do período selecionado.
          </p>
        </div>

        <label class="entries-month-field" for="entries-month">
          Mês de referência
          <input
            id="entries-month"
            name="entries-reference-month"
            type="month"
            min="2020-01"
            max="2100-12"
          />
        </label>
      </header>

      <div
        id="tab-content"
        class="entries-tab-panel"
        role="tabpanel"
        aria-labelledby="entries-tab-expenses"
        tabindex="0"
      ></div>
    </section>
  `;

  const monthInput = getRequiredElement<HTMLInputElement>(
    container,
    '#entries-month',
  );
  const tabPanel = getRequiredElement<HTMLElement>(container, '#tab-content');
  const tabButtons = Array.from(
    container.querySelectorAll<HTMLButtonElement>('[data-entry-tab]'),
  );

  let activeTab: EntryTab = 'expenses';
  let referenceMonth = getGlobalMonth();
  monthInput.value = referenceMonth;

  const renderActiveTab = async (tab: EntryTab): Promise<void> => {
    activeTab = tab;

    for (const button of tabButtons) {
      const isActive = button.dataset.entryTab === tab;
      button.setAttribute('aria-selected', String(isActive));
      button.tabIndex = isActive ? 0 : -1;
    }

    tabPanel.setAttribute('aria-labelledby', `entries-tab-${tab}`);

    if (tab === 'expenses') {
      await renderCrudPage(
        tabPanel,
        {
          title: 'Despesas',
          accent: 'danger',
          addRecord: addExpense,
          listRecordsByMonth: listExpensesByMonth,
          deleteRecord: deleteExpense,
        },
        referenceMonth,
      );
    } else if (tab === 'services') {
      await renderCrudPage(
        tabPanel,
        {
          title: 'Serviços',
          accent: 'success',
          addRecord: addService,
          listRecordsByMonth: listServicesByMonth,
          deleteRecord: deleteService,
          catalogType: 'service',
        },
        referenceMonth,
      );
    } else {
      await renderCrudPage(
        tabPanel,
        {
          title: 'Produtos',
          accent: 'info',
          addRecord: addProduct,
          listRecordsByMonth: listProductsByMonth,
          deleteRecord: deleteProduct,
          catalogType: 'product',
        },
        referenceMonth,
      );
    }
  };

  monthInput.addEventListener('change', () => {
    if (!monthInput.reportValidity() || !monthInput.value) return;

    setGlobalMonth(monthInput.value);
    referenceMonth = getGlobalMonth();
    void renderActiveTab(activeTab);
  });

  for (const button of tabButtons) {
    button.addEventListener('click', () => {
      const tab = button.dataset.entryTab as EntryTab | undefined;

      if (!tab || !ENTRY_TABS.includes(tab)) return;

      void renderActiveTab(tab);
    });

    button.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        return;
      }

      event.preventDefault();

      const currentIndex = tabButtons.indexOf(button);
      let nextIndex = currentIndex;

      if (event.key === 'ArrowLeft') {
        nextIndex = (currentIndex - 1 + tabButtons.length) % tabButtons.length;
      } else if (event.key === 'ArrowRight') {
        nextIndex = (currentIndex + 1) % tabButtons.length;
      } else if (event.key === 'Home') {
        nextIndex = 0;
      } else if (event.key === 'End') {
        nextIndex = tabButtons.length - 1;
      }

      tabButtons[nextIndex].focus();
      tabButtons[nextIndex].click();
    });
  }

  await renderActiveTab('expenses');
}
