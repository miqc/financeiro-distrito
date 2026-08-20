import { listCatalogItems } from '../../core/database/operations';
import { showConfirmDialog } from '../../components/confirm-dialog';
import type {
  CatalogItem,
  EntityId,
  ISODate,
  ReferenceMonth,
} from '../../types';

export interface CrudRecord {
  id: EntityId;
  date: ISODate;
  description: string;
  amount: number;
}

export type CrudAccent = 'danger' | 'success' | 'primary';

export interface CrudPageOptions<T extends CrudRecord> {
  title: string;
  accent: CrudAccent;
  addRecord: (record: Omit<CrudRecord, 'id'>) => Promise<T>;
  listRecordsByMonth: (month: ReferenceMonth) => Promise<T[]>;
  deleteRecord: (id: EntityId) => Promise<void>;
  catalogType?: CatalogItem['type'];
}

const CRUD_STYLE_ID = 'crud-page-styles';
const pageVersions = new WeakMap<HTMLElement, number>();
const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});
const dateFormatter = new Intl.DateTimeFormat('pt-BR');
const monthFormatter = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
});

const crudStyles = `
  .crud-page {
    --crud-accent: var(--color-primary);
    --crud-accent-strong: var(--color-primary-strong);
    --crud-accent-soft: var(--color-primary-soft);
    display: grid;
    gap: clamp(1rem, 3vw, 1.5rem);
  }

  .crud-page--danger {
    --crud-accent: #3d3d3d;
    --crud-accent-strong: #111111;
    --crud-accent-soft: #e4e4e1;
  }

  .crud-page--success {
    --crud-accent: #5e5e5e;
    --crud-accent-strong: #111111;
    --crud-accent-soft: #e4e4e1;
  }

  .crud-page [hidden] {
    display: none !important;
  }

  .crud-page__header,
  .crud-form,
  .crud-records {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-medium);
    box-shadow: var(--shadow-surface);
  }

  .crud-page__header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: clamp(1rem, 3vw, 1.5rem);
    border-left: 0.35rem solid var(--crud-accent);
  }

  .crud-page__eyebrow {
    color: var(--crud-accent-strong);
    font-size: 0.75rem;
    font-weight: 750;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .crud-page__period {
    color: var(--color-text-muted);
    font-size: 0.875rem;
    text-transform: capitalize;
  }

  .crud-form {
    display: grid;
    grid-template-columns: minmax(9rem, 0.85fr) minmax(14rem, 2fr) minmax(9rem, 0.85fr) auto;
    align-items: end;
    gap: 0.875rem;
    padding: clamp(1rem, 3vw, 1.5rem);
  }

  .crud-form--with-catalog {
    grid-template-columns: minmax(9rem, 0.7fr) minmax(12rem, 1.15fr) minmax(14rem, 1.5fr) minmax(9rem, 0.7fr) auto;
  }

  .crud-field {
    display: grid;
    min-width: 0;
    gap: 0.375rem;
    color: var(--color-text);
    font-size: 0.8125rem;
    font-weight: 700;
  }

  .crud-field input,
  .crud-field select {
    width: 100%;
    min-height: 2.75rem;
    padding: 0.625rem 0.75rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-small);
  }

  .crud-field input:hover,
  .crud-field select:hover {
    border-color: var(--crud-accent);
  }

  .crud-field input:focus,
  .crud-field select:focus {
    border-color: var(--crud-accent-strong);
  }

  .crud-submit-button,
  .crud-delete-button {
    min-height: 2.75rem;
    border: 0;
    border-radius: var(--radius-small);
    cursor: pointer;
    font-weight: 750;
  }

  .crud-submit-button {
    padding: 0.625rem 1rem;
    color: #ffffff;
    background: var(--crud-accent-strong);
  }

  .crud-submit-button:hover:not(:disabled) {
    background: var(--crud-accent);
  }

  .crud-submit-button:disabled,
  .crud-delete-button:disabled {
    cursor: wait;
    opacity: 0.6;
  }

  .crud-feedback {
    grid-column: 1 / -1;
    margin-top: 0.125rem;
    padding: 0.75rem;
    color: var(--color-text-muted);
    background: var(--color-background);
    border-radius: var(--radius-small);
    font-size: 0.875rem;
  }

  .crud-feedback--error {
    color: var(--color-danger);
    background: var(--color-surface-muted);
  }

  .crud-feedback--success {
    color: var(--color-primary-strong);
    background: var(--color-surface-muted);
  }

  .crud-records {
    overflow: hidden;
  }

  .crud-records__header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 1rem clamp(1rem, 3vw, 1.5rem);
    border-bottom: 1px solid var(--color-border);
  }

  .crud-records__header h3 {
    font-size: 1rem;
  }

  .crud-records__status {
    color: var(--color-text-muted);
    font-size: 0.8125rem;
  }

  .crud-list-header,
  .crud-list-item {
    display: grid;
    grid-template-columns: minmax(7.5rem, 0.75fr) minmax(0, 2fr) minmax(7.5rem, 0.75fr) 3rem;
    align-items: center;
    gap: 1rem;
  }

  .crud-list-header {
    padding: 0.625rem clamp(1rem, 3vw, 1.5rem);
    color: var(--color-text-muted);
    background: var(--color-background);
    border-bottom: 1px solid var(--color-border);
    font-size: 0.75rem;
    font-weight: 750;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .crud-list {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .crud-list-item {
    min-height: 4rem;
    padding: 0.625rem clamp(1rem, 3vw, 1.5rem);
    border-bottom: 1px solid var(--color-border);
  }

  .crud-list-item:last-child {
    border-bottom: 0;
  }

  .crud-list-item__date,
  .crud-list-item__description,
  .crud-list-item__amount {
    min-width: 0;
  }

  .crud-list-item__date {
    color: var(--color-text-muted);
    font-size: 0.875rem;
  }

  .crud-list-item__description {
    overflow-wrap: anywhere;
    font-weight: 650;
  }

  .crud-list-item__amount {
    font-variant-numeric: tabular-nums;
    font-weight: 750;
    text-align: right;
  }

  .crud-delete-button {
    display: grid;
    width: 2.75rem;
    padding: 0;
    place-items: center;
    color: var(--color-danger);
    background: var(--color-surface-muted);
    font-size: 1.25rem;
  }

  .crud-delete-button:hover:not(:disabled) {
    color: #ffffff;
    background: var(--color-danger);
  }

  .crud-empty-state {
    padding: 2rem 1rem;
    color: var(--color-text-muted);
    text-align: center;
  }

  @media (max-width: 64rem) {
    .crud-form {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .crud-submit-button {
      width: 100%;
    }
  }

  @media (max-width: 40rem) {
    .crud-form {
      grid-template-columns: minmax(0, 1fr);
    }

    .crud-list-header {
      display: none;
    }

    .crud-list-item {
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 0.375rem 0.75rem;
      padding-block: 0.875rem;
    }

    .crud-list-item__description {
      grid-column: 1;
      grid-row: 1;
    }

    .crud-list-item__date {
      grid-column: 1;
      grid-row: 2;
    }

    .crud-list-item__amount {
      grid-column: 1;
      grid-row: 3;
      text-align: left;
    }

    .crud-delete-button {
      grid-column: 2;
      grid-row: 1 / span 3;
    }
  }
`;

function ensureCrudStyles(): void {
  if (document.querySelector(`#${CRUD_STYLE_ID}`)) return;

  const style = document.createElement('style');
  style.id = CRUD_STYLE_ID;
  style.textContent = crudStyles;
  document.head.append(style);
}

function getCurrentISODate(): ISODate {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}` as ISODate;
}

function getDefaultISODate(referenceMonth: ReferenceMonth): ISODate {
  const currentDate = getCurrentISODate();
  return currentDate.startsWith(`${referenceMonth}-`)
    ? currentDate
    : (`${referenceMonth}-01` as ISODate);
}

function formatDate(date: ISODate): string {
  const [year, month, day] = date.split('-').map(Number);
  const localDate = new Date(year, month - 1, day);
  return Number.isNaN(localDate.getTime())
    ? date
    : dateFormatter.format(localDate);
}

function formatMonth(referenceMonth: ReferenceMonth): string {
  const [year, month] = referenceMonth.split('-').map(Number);
  return monthFormatter.format(new Date(year, month - 1, 1));
}

function getLastDateOfMonth(referenceMonth: ReferenceMonth): ISODate {
  const [year, month] = referenceMonth.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return `${referenceMonth}-${String(lastDay).padStart(2, '0')}` as ISODate;
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

export async function renderCrudPage<T extends CrudRecord>(
  container: HTMLElement,
  options: CrudPageOptions<T>,
  referenceMonth: ReferenceMonth,
): Promise<void> {
  ensureCrudStyles();

  const pageVersion = (pageVersions.get(container) ?? 0) + 1;
  pageVersions.set(container, pageVersion);

  container.innerHTML = `
    <section class="crud-page crud-page--${options.accent}" aria-labelledby="crud-page-title">
      <header class="crud-page__header">
        <div>
          <p class="crud-page__eyebrow">Lançamentos</p>
          <h2 id="crud-page-title"></h2>
        </div>
        <p class="crud-page__period"></p>
      </header>

      <form class="crud-form">
        <label class="crud-field" for="crud-date">
          Data
          <input id="crud-date" name="date" type="date" required />
        </label>

        <label class="crud-field" for="crud-description">
          Descrição
          <input
            id="crud-description"
            name="description"
            type="text"
            maxlength="160"
            autocomplete="off"
            placeholder="Digite uma descrição"
            required
          />
        </label>

        <label class="crud-field" for="crud-amount">
          Valor
          <input
            id="crud-amount"
            name="amount"
            type="number"
            min="0"
            step="0.01"
            inputmode="decimal"
            placeholder="0,00"
            required
          />
        </label>

        <button class="crud-submit-button" type="submit">
          Adicionar lançamento
        </button>

        <p class="crud-feedback" role="status" aria-live="polite" hidden></p>
      </form>

      <section class="crud-records" aria-labelledby="crud-records-title">
        <header class="crud-records__header">
          <h3 id="crud-records-title">Lançamentos do mês</h3>
          <p class="crud-records__status" role="status">Carregando...</p>
        </header>

        <div class="crud-list-header" aria-hidden="true">
          <span>Data</span>
          <span>Descrição</span>
          <span>Valor</span>
          <span>Ação</span>
        </div>

        <ul class="crud-list"></ul>
      </section>
    </section>
  `;

  const page = getRequiredElement<HTMLElement>(container, '.crud-page');
  const title = getRequiredElement<HTMLElement>(container, '#crud-page-title');
  const period = getRequiredElement<HTMLElement>(container, '.crud-page__period');
  const form = getRequiredElement<HTMLFormElement>(container, '.crud-form');
  const dateInput = getRequiredElement<HTMLInputElement>(container, '#crud-date');
  const descriptionInput = getRequiredElement<HTMLInputElement>(
    container,
    '#crud-description',
  );
  const amountInput = getRequiredElement<HTMLInputElement>(
    container,
    '#crud-amount',
  );
  const submitButton = getRequiredElement<HTMLButtonElement>(
    container,
    '.crud-submit-button',
  );
  const feedback = getRequiredElement<HTMLElement>(
    container,
    '.crud-feedback',
  );
  const recordsStatus = getRequiredElement<HTMLElement>(
    container,
    '.crud-records__status',
  );
  const recordsList = getRequiredElement<HTMLUListElement>(
    container,
    '.crud-list',
  );

  title.textContent = options.title;
  period.textContent = formatMonth(referenceMonth);
  dateInput.value = getDefaultISODate(referenceMonth);
  dateInput.min = `${referenceMonth}-01`;
  dateInput.max = getLastDateOfMonth(referenceMonth);

  const isCurrentPage = (): boolean =>
    pageVersions.get(container) === pageVersion && container.contains(page);

  const setFeedback = (
    message: string,
    tone?: 'error' | 'success',
  ): void => {
    feedback.hidden = message.length === 0;
    feedback.textContent = message;
    feedback.classList.toggle('crud-feedback--error', tone === 'error');
    feedback.classList.toggle('crud-feedback--success', tone === 'success');
  };

  let listVersion = 0;

  const loadCatalogField = async (): Promise<void> => {
    if (!options.catalogType) return;

    try {
      const catalogItems = await listCatalogItems(options.catalogType);

      if (!isCurrentPage() || catalogItems.length === 0) return;

      const sortedItems = [...catalogItems].sort((first, second) =>
        first.description.localeCompare(second.description, 'pt-BR'),
      );
      const field = document.createElement('label');
      field.className = 'crud-field crud-catalog-field';
      field.htmlFor = 'crud-catalog-item';
      field.append('Item predefinido');

      const select = document.createElement('select');
      select.id = 'crud-catalog-item';
      select.className = 'crud-catalog-select';
      select.name = 'catalog-item';

      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = '--- Selecione um item predefinido ---';
      select.append(placeholder);

      for (const item of sortedItems) {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = `${item.description} — ${currencyFormatter.format(
          item.price,
        )}`;
        select.append(option);
      }

      select.addEventListener('change', () => {
        const selectedItem = sortedItems.find(
          (item) => item.id === select.value,
        );

        if (!selectedItem) return;

        descriptionInput.value = selectedItem.description;
        amountInput.value = selectedItem.price.toFixed(2);
      });

      field.append(select);
      const descriptionField = descriptionInput.closest('.crud-field');

      if (!descriptionField) {
        throw new Error('O campo de descrição não foi encontrado.');
      }

      form.classList.add('crud-form--with-catalog');
      form.insertBefore(field, descriptionField);
    } catch (error) {
      if (!isCurrentPage()) return;
      console.error('Não foi possível carregar os itens do catálogo.', error);
    }
  };

  const refreshList = async (): Promise<void> => {
    const currentListVersion = ++listVersion;
    recordsStatus.textContent = 'Atualizando...';

    try {
      const records = await options.listRecordsByMonth(referenceMonth);

      if (!isCurrentPage() || currentListVersion !== listVersion) return;

      const sortedRecords = [...records].sort((first, second) =>
        second.date.localeCompare(first.date),
      );
      const fragment = document.createDocumentFragment();

      if (sortedRecords.length === 0) {
        const emptyState = document.createElement('li');
        emptyState.className = 'crud-empty-state';
        emptyState.textContent = 'Nenhum lançamento encontrado neste mês.';
        fragment.append(emptyState);
      } else {
        for (const record of sortedRecords) {
          const item = document.createElement('li');
          item.className = 'crud-list-item';

          const date = document.createElement('time');
          date.className = 'crud-list-item__date';
          date.dateTime = record.date;
          date.textContent = formatDate(record.date);

          const description = document.createElement('span');
          description.className = 'crud-list-item__description';
          description.textContent = record.description;

          const amount = document.createElement('span');
          amount.className = 'crud-list-item__amount';
          amount.textContent = currencyFormatter.format(record.amount);

          const deleteButton = document.createElement('button');
          deleteButton.className = 'crud-delete-button';
          deleteButton.type = 'button';
          deleteButton.textContent = '×';
          deleteButton.title = 'Excluir lançamento';
          deleteButton.setAttribute(
            'aria-label',
            `Excluir lançamento: ${record.description}`,
          );

          deleteButton.addEventListener('click', async () => {
            const confirmed = await showConfirmDialog(
              'Confirmar exclusão',
              'Deseja realmente excluir este lançamento?',
            );

            if (!confirmed) return;

            deleteButton.disabled = true;
            setFeedback('Excluindo lançamento...');

            try {
              await options.deleteRecord(record.id);

              if (!isCurrentPage()) return;

              await refreshList();
              setFeedback('Lançamento excluído com sucesso.', 'success');
            } catch (error) {
              if (!isCurrentPage()) return;

              console.error('Não foi possível excluir o lançamento.', error);
              setFeedback(
                'Não foi possível excluir o lançamento. Tente novamente.',
                'error',
              );
              deleteButton.disabled = false;
            }
          });

          item.append(date, description, amount, deleteButton);
          fragment.append(item);
        }
      }

      recordsList.replaceChildren(fragment);
      recordsStatus.textContent = `${sortedRecords.length} lançamento${
        sortedRecords.length === 1 ? '' : 's'
      }`;
    } catch (error) {
      if (!isCurrentPage() || currentListVersion !== listVersion) return;

      console.error('Não foi possível listar os lançamentos.', error);
      recordsStatus.textContent = 'Erro ao carregar';
      recordsList.replaceChildren();
      setFeedback(
        'Não foi possível carregar os lançamentos deste mês.',
        'error',
      );
    }
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    if (!form.reportValidity()) return;

    const description = descriptionInput.value.trim();
    const amount = Number(amountInput.value);

    if (!description || !Number.isFinite(amount) || amount < 0) {
      setFeedback('Preencha uma descrição e um valor válido.', 'error');
      return;
    }

    void (async () => {
      submitButton.disabled = true;
      setFeedback('Salvando lançamento...');

      try {
        await options.addRecord({
          date: dateInput.value as ISODate,
          description,
          amount,
        });

        if (!isCurrentPage()) return;

        descriptionInput.value = '';
        amountInput.value = '';
        await refreshList();
        setFeedback('Lançamento salvo com sucesso.', 'success');
        descriptionInput.focus();
      } catch (error) {
        if (!isCurrentPage()) return;

        console.error('Não foi possível salvar o lançamento.', error);
        setFeedback(
          'Não foi possível salvar o lançamento. Tente novamente.',
          'error',
        );
      } finally {
        if (isCurrentPage()) submitButton.disabled = false;
      }
    })();
  });

  await Promise.all([refreshList(), loadCatalogField()]);
}
