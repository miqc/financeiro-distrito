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
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(13rem, 16rem);
    align-items: stretch;
    gap: clamp(1.25rem, 4vw, 2rem);
    padding: clamp(1.25rem, 4vw, 2rem);
    overflow: hidden;
    background: linear-gradient(135deg, var(--color-surface) 58%, var(--color-monthly-wash) 100%);
    border: 1px solid var(--color-info-border);
    border-radius: var(--radius-medium);
    box-shadow: var(--shadow-monthly);
  }

  .entries-header__intro {
    display: flex;
    min-width: 0;
    align-items: flex-start;
    gap: 1rem;
  }

  .entries-header__icon {
    display: grid;
    flex: 0 0 auto;
    width: 3.25rem;
    height: 3.25rem;
    place-items: center;
    color: var(--color-info-strong);
    background: var(--color-info-soft);
    border: 1px solid var(--color-info-border);
    border-radius: 1rem;
  }

  .entries-header__icon svg {
    width: 1.5rem;
    height: 1.5rem;
  }

  .entries-header__content {
    display: grid;
    min-width: 0;
    align-content: center;
    gap: 0.375rem;
  }

  .entries-header__content h2 {
    font-size: clamp(1.375rem, 4vw, 1.75rem);
    letter-spacing: -0.025em;
    line-height: 1.2;
  }

  .entries-header__eyebrow {
    width: fit-content;
    padding: 0.25rem 0.625rem;
    color: var(--color-info-strong);
    background: var(--color-info-soft);
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 750;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .entries-header__description {
    color: var(--color-text-muted);
    font-size: 0.9375rem;
  }

  .entries-month-field {
    display: grid;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    align-content: center;
    gap: 0.5rem;
    padding: 1rem;
    color: var(--color-info-strong);
    background: var(--color-elevated-glass);
    border: 1px solid var(--color-info-border);
    border-radius: var(--radius-medium);
    box-shadow: var(--shadow-panel);
    font-size: 0.8125rem;
    font-weight: 600;
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
    border: 1px solid var(--color-input-border);
    border-radius: var(--radius-small);
  }

  .entries-month-field input:hover {
    border-color: var(--color-info);
  }

  .entries-month-field input:focus {
    border-color: var(--color-info);
    box-shadow: 0 0 0 0.1875rem var(--color-info-soft);
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
      transform var(--motion-duration-fast) var(--motion-ease-standard),
      color var(--motion-duration-fast) var(--motion-ease-standard),
      background-color var(--motion-duration-fast) var(--motion-ease-standard),
      box-shadow var(--motion-duration-fast) var(--motion-ease-standard);
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
      var(--shadow-active-control);
  }

  .entries-tab:active {
    transform: scale(0.97);
  }

  .entries-tab-panel {
    min-width: 0;
  }

  @media (max-width: 48rem) {
    .entries-header {
      grid-template-columns: minmax(0, 1fr);
    }

    .entries-header__intro,
    .entries-month-field {
      width: 100%;
    }
  }

  @media (max-width: 30rem) {
    .entries-month-field {
      width: 100%;
    }

    .entries-tabs-wrapper {
      width: 100%;
      min-width: 0;
      overflow: visible;
    }

    .entries-tabs {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      width: 100%;
      min-width: 0;
      max-width: 100%;
    }

    .entries-tab {
      min-width: 0;
      padding-inline: 0.5rem;
      overflow: hidden;
      font-size: 0.8125rem;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .entries-header__icon {
      width: 2.875rem;
      height: 2.875rem;
      border-radius: 0.875rem;
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
        <div class="entries-header__intro">
          <span class="entries-header__icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="3" y="4" width="18" height="17" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          </span>

          <div class="entries-header__content">
            <p class="entries-header__eyebrow">Controle mensal</p>
            <h2 id="entries-title">Lançamentos</h2>
            <p class="entries-header__description">
              Cadastre despesas, serviços e produtos do período selecionado.
            </p>
          </div>
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
