import {
  addCatalogItem,
  deleteCatalogItem,
  listCatalogItems,
} from '../core/database/operations';
import { showConfirmDialog } from '../components/confirm-dialog';
import type { CatalogItem } from '../types';

const CATALOG_STYLE_ID = 'catalog-page-styles';
const pageVersions = new WeakMap<HTMLElement, number>();
const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const TYPE_LABELS: Record<CatalogItem['type'], string> = {
  service: 'Serviço',
  product: 'Produto',
};

const catalogStyles = `
  .catalog-page {
    display: grid;
    gap: clamp(1rem, 3vw, 1.5rem);
  }

  .catalog-page [hidden] {
    display: none !important;
  }

  .catalog-drawer:not([open]) {
    display: none !important;
  }

  .catalog-header,
  .catalog-records {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-medium);
    box-shadow: var(--shadow-surface);
  }

  .catalog-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: clamp(1.25rem, 4vw, 2rem);
    border-color: var(--color-border);
    box-shadow: var(--shadow-monthly);
  }

  .catalog-header__content {
    display: grid;
    min-width: 0;
    align-content: center;
    gap: 0.375rem;
  }

  .catalog-header__content h2 {
    font-size: clamp(1.375rem, 4vw, 1.75rem);
    letter-spacing: -0.025em;
    line-height: 1.2;
  }

  .catalog-header__eyebrow {
    width: fit-content;
    color: var(--color-text);
    font-size: 0.8125rem;
    font-weight: 650;
  }

  .catalog-header__description {
    color: var(--color-text-muted);
    font-size: 0.9375rem;
  }

  .catalog-open-drawer,
  .catalog-drawer__close {
    min-height: 2.75rem;
    border: 0;
    border-radius: var(--radius-small);
    cursor: pointer;
    font: inherit;
    font-weight: 750;
  }

  .catalog-open-drawer {
    padding: 0.625rem 1rem;
    color: var(--color-on-action);
    background: var(--color-action);
  }

  .catalog-open-drawer:hover {
    background: var(--color-action-hover);
  }

  .catalog-drawer {
    inset: 0;
    width: 100%;
    max-width: none;
    height: 100%;
    max-height: none;
    margin: 0;
    padding: 0;
    overflow: hidden;
    color: var(--color-text);
    background: transparent;
    border: none;
  }

  .catalog-drawer::backdrop {
    background: var(--color-overlay);
    backdrop-filter: blur(2px);
  }

  .catalog-drawer[open]::backdrop {
    animation: app-backdrop-enter var(--motion-duration-normal)
      var(--motion-ease-standard) both;
  }

  .catalog-drawer[open] {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .catalog-drawer:focus {
    outline: none;
  }

  .catalog-drawer__header {
    display: flex;
    grid-column: 1 / -1;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--color-border);
  }

  .catalog-drawer__header h3 {
    font-size: 1.125rem;
  }

  .catalog-drawer__close {
    display: grid;
    width: 2.75rem;
    padding: 0;
    place-items: center;
    color: var(--color-text-muted);
    background: var(--color-surface-muted);
    line-height: 1;
  }

  .catalog-drawer__close:hover {
    color: var(--color-text);
  }

  .catalog-form {
    display: grid;
    grid-template-columns: minmax(9rem, 0.75fr) minmax(14rem, 2fr) minmax(9rem, 0.75fr) auto;
    align-items: end;
    width: min(calc(100% - 2rem), 58rem);
    max-width: 58rem;
    max-height: min(90vh, 46rem);
    max-height: min(90dvh, 46rem);
    gap: 0.875rem;
    padding: clamp(1rem, 3vw, 1.5rem);
    overflow: auto;
    background: var(--color-surface);
    border-radius: var(--radius-medium);
    box-shadow: var(--shadow-dialog);
  }

  .catalog-drawer[open] > .catalog-form {
    animation: catalog-modal-enter var(--motion-duration-normal)
      var(--motion-ease-emphasized);
  }

  .catalog-field {
    display: grid;
    min-width: 0;
    gap: 0.5rem;
    color: var(--color-text-muted);
    font-size: 0.8125rem;
    font-weight: 500;
  }

  .catalog-field input,
  .catalog-field select {
    width: 100%;
    min-height: 2.75rem;
    padding: 0.625rem 0.75rem;
    color: var(--color-text);
    background: var(--color-surface);
    border: 1px solid var(--color-input-border);
    border-radius: var(--radius-small);
  }

  .catalog-field select {
    position: relative;
    z-index: 1;
    -webkit-appearance: menulist;
    appearance: auto;
    pointer-events: auto;
    touch-action: manipulation;
  }

  .catalog-field input:hover,
  .catalog-field select:hover {
    border-color: var(--color-primary);
  }

  .catalog-field input:focus,
  .catalog-field select:focus {
    border-color: var(--color-primary-strong);
    box-shadow: 0 0 0 0.1875rem var(--color-primary-soft);
  }

  .catalog-submit,
  .catalog-delete {
    min-height: 2.75rem;
    border: 0;
    border-radius: var(--radius-small);
    cursor: pointer;
    font: inherit;
    font-weight: 750;
  }

  .catalog-submit {
    padding: 0.625rem 1rem;
    color: var(--color-on-action);
    background: var(--color-action);
  }

  .catalog-submit:hover:not(:disabled) {
    background: var(--color-action-hover);
  }

  .catalog-submit:disabled,
  .catalog-delete:disabled {
    cursor: wait;
    opacity: 0.6;
  }

  .catalog-feedback {
    grid-column: 1 / -1;
    padding: 0.75rem;
    color: var(--color-text-muted);
    background: var(--color-background);
    border-radius: var(--radius-small);
    font-size: 0.875rem;
  }

  .catalog-feedback:not([hidden]) {
    animation: app-item-enter var(--motion-duration-normal)
      var(--motion-ease-emphasized) backwards;
  }

  .catalog-feedback--error {
    color: var(--color-danger);
    background: var(--color-danger-soft);
  }

  .catalog-feedback--success {
    color: var(--color-success-strong);
    background: var(--color-success-soft);
  }

  .catalog-records {
    overflow: hidden;
  }

  .catalog-records__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem clamp(1rem, 3vw, 1.5rem);
    border-bottom: 1px solid var(--color-border);
  }

  .catalog-records__header h3 {
    font-size: 1rem;
  }

  .catalog-records__status {
    color: var(--color-text-muted);
    font-size: 0.8125rem;
  }

  .catalog-list-header,
  .catalog-list-item {
    display: grid;
    grid-template-columns: minmax(7rem, 0.65fr) minmax(0, 2fr) minmax(7.5rem, 0.65fr) 3rem;
    align-items: center;
    gap: 1rem;
  }

  .catalog-list-header {
    padding: 0.625rem clamp(1rem, 3vw, 1.5rem);
    color: var(--color-text-muted);
    background: var(--color-background);
    border-bottom: 1px solid var(--color-border);
    font-size: 0.75rem;
    font-weight: 750;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .catalog-list {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .catalog-list-item {
    min-height: 4rem;
    padding: 0.625rem clamp(1rem, 3vw, 1.5rem);
    border-bottom: 1px solid var(--color-border);
    animation: app-item-enter var(--motion-duration-normal)
      var(--motion-ease-emphasized) backwards;
  }

  .catalog-list-item:last-child {
    border-bottom: 0;
  }

  .catalog-list-item__type {
    width: fit-content;
    padding: 0.25rem 0.5rem;
    color: var(--color-primary-strong);
    background: var(--color-primary-soft);
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 750;
  }

  .catalog-list-item__type[data-catalog-type="service"] {
    color: var(--color-success-strong);
    background: var(--color-success-soft);
  }

  .catalog-list-item__type[data-catalog-type="product"] {
    color: var(--color-info-strong);
    background: var(--color-info-soft);
  }

  .catalog-list-item__description {
    min-width: 0;
    overflow-wrap: anywhere;
    font-weight: 650;
  }

  .catalog-list-item__price {
    font-variant-numeric: tabular-nums;
    font-weight: 750;
    text-align: right;
  }

  .catalog-delete {
    display: grid;
    width: 2.75rem;
    padding: 0;
    place-items: center;
    color: var(--color-danger);
    background: var(--color-danger-soft);
    font-size: 1.25rem;
  }

  .catalog-delete:hover:not(:disabled) {
    color: var(--color-on-accent);
    background: var(--color-danger-action);
  }

  .catalog-empty {
    padding: 2rem 1rem;
    color: var(--color-text-muted);
    text-align: center;
  }

  @keyframes catalog-modal-enter {
    from {
      opacity: 0;
      transform: translateY(0.5rem) scale(0.98);
    }

    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @keyframes catalog-drawer-enter {
    from {
      transform: translateY(100%);
    }

    to {
      transform: translateY(0);
    }
  }

  @media (max-width: 64rem) {
    .catalog-form {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .catalog-submit {
      width: 100%;
    }
  }

  @media (hover: hover) and (pointer: fine) {
    .catalog-open-drawer:hover,
    .catalog-submit:hover:not(:disabled) {
      transform: translateY(-0.0625rem);
    }
  }

  @media (max-width: 40rem) {
    .catalog-open-drawer {
      width: 100%;
    }

    .catalog-drawer[open] {
      align-items: flex-end;
    }

    .catalog-drawer .catalog-form {
      width: 100%;
      max-width: 100%;
      max-height: calc(100dvh - 0.75rem);
      margin: auto 0 0;
      border-radius: 1rem 1rem 0 0;
    }

    .catalog-drawer[open] > .catalog-form {
      animation: catalog-drawer-enter var(--motion-duration-normal)
        var(--motion-ease-emphasized);
    }

    .catalog-form {
      grid-template-columns: minmax(0, 1fr);
      gap: 1.125rem;
      padding-bottom: calc(1.25rem + env(safe-area-inset-bottom));
    }

    .catalog-list-header {
      display: none;
    }

    .catalog-list-item {
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 0.375rem 0.75rem;
      padding-block: 0.875rem;
    }

    .catalog-list-item__type,
    .catalog-list-item__description,
    .catalog-list-item__price {
      grid-column: 1;
    }

    .catalog-list-item__price {
      text-align: left;
    }

    .catalog-delete {
      grid-column: 2;
      grid-row: 1 / span 3;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .catalog-drawer[open] > .catalog-form {
      animation: none;
    }
  }
`;

function ensureCatalogStyles(): void {
  if (document.querySelector(`#${CATALOG_STYLE_ID}`)) return;

  const style = document.createElement('style');
  style.id = CATALOG_STYLE_ID;
  style.textContent = catalogStyles;
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

export async function renderCatalogPage(container: HTMLElement): Promise<void> {
  ensureCatalogStyles();

  const pageVersion = (pageVersions.get(container) ?? 0) + 1;
  pageVersions.set(container, pageVersion);

  container.innerHTML = `
    <section class="catalog-page" aria-labelledby="catalog-title">
      <header class="catalog-header">
        <div class="catalog-header__content">
          <p class="catalog-header__eyebrow">Itens predefinidos</p>
          <h2 id="catalog-title">Catálogo</h2>
          <p class="catalog-header__description">
            Cadastre serviços e produtos para agilizar novos lançamentos.
          </p>
        </div>

        <button class="catalog-open-drawer" type="button">
          Adicionar item
        </button>
      </header>

      <dialog
        class="catalog-drawer"
        aria-labelledby="catalog-drawer-title"
        tabindex="-1"
      >
        <form class="catalog-form">
          <header class="catalog-drawer__header">
            <h3 id="catalog-drawer-title">Novo item do catálogo</h3>
            <button
              class="catalog-drawer__close"
              type="button"
              aria-label="Cancelar e fechar formulário"
              title="Cancelar"
            >
              ×
            </button>
          </header>

          <label class="catalog-field" for="catalog-type">
            Tipo
            <select id="catalog-type" name="type" required>
              <option value="service">Serviço</option>
              <option value="product">Produto</option>
            </select>
          </label>

          <label class="catalog-field" for="catalog-description">
            Descrição
            <input
              id="catalog-description"
              name="description"
              type="text"
              maxlength="160"
              autocomplete="off"
              required
            />
          </label>

          <label class="catalog-field" for="catalog-price">
            Preço padrão
            <input
              id="catalog-price"
              name="price"
              type="number"
              min="0"
              step="0.01"
              inputmode="decimal"
              placeholder="0,00"
              required
            />
          </label>

          <button class="catalog-submit" type="submit">
            Salvar item
          </button>

          <p class="catalog-feedback" role="status" aria-live="polite" hidden></p>
        </form>
      </dialog>

      <section class="catalog-records" aria-labelledby="catalog-list-title">
        <header class="catalog-records__header">
          <h3 id="catalog-list-title">Itens cadastrados</h3>
          <p class="catalog-records__status" role="status">Carregando...</p>
        </header>

        <div class="catalog-list-header" aria-hidden="true">
          <span>Tipo</span>
          <span>Descrição</span>
          <span>Preço</span>
          <span>Ação</span>
        </div>

        <ul class="catalog-list"></ul>
      </section>
    </section>
  `;

  const page = getRequiredElement<HTMLElement>(container, '.catalog-page');
  const drawer = getRequiredElement<HTMLDialogElement>(
    container,
    '.catalog-drawer',
  );
  const openDrawerButton = getRequiredElement<HTMLButtonElement>(
    container,
    '.catalog-open-drawer',
  );
  const closeDrawerButton = getRequiredElement<HTMLButtonElement>(
    container,
    '.catalog-drawer__close',
  );
  const form = getRequiredElement<HTMLFormElement>(container, '.catalog-form');
  const typeInput = getRequiredElement<HTMLSelectElement>(
    container,
    '#catalog-type',
  );
  const descriptionInput = getRequiredElement<HTMLInputElement>(
    container,
    '#catalog-description',
  );
  const priceInput = getRequiredElement<HTMLInputElement>(
    container,
    '#catalog-price',
  );
  const submitButton = getRequiredElement<HTMLButtonElement>(
    container,
    '.catalog-submit',
  );
  const feedback = getRequiredElement<HTMLElement>(
    container,
    '.catalog-feedback',
  );
  const listStatus = getRequiredElement<HTMLElement>(
    container,
    '.catalog-records__status',
  );
  const list = getRequiredElement<HTMLUListElement>(
    container,
    '.catalog-list',
  );

  let lastDrawerInteractionWasPointer = false;

  openDrawerButton.addEventListener('pointerdown', () => {
    lastDrawerInteractionWasPointer = true;
  });

  openDrawerButton.addEventListener('keydown', () => {
    lastDrawerInteractionWasPointer = false;
  });

  drawer.addEventListener('pointerdown', () => {
    lastDrawerInteractionWasPointer = true;
  });

  drawer.addEventListener('keydown', () => {
    lastDrawerInteractionWasPointer = false;
  });

  openDrawerButton.addEventListener('click', (event) => {
    if (drawer.open) return;

    if (event.detail > 0) {
      lastDrawerInteractionWasPointer = true;
    }

    drawer.showModal();

    if (lastDrawerInteractionWasPointer) {
      drawer.focus({ preventScroll: true });
    }
  });

  closeDrawerButton.addEventListener('click', () => {
    drawer.close('cancel');
  });

  const isCurrentPage = (): boolean =>
    pageVersions.get(container) === pageVersion && container.contains(page);

  const setFeedback = (
    message: string,
    tone?: 'error' | 'success',
  ): void => {
    feedback.hidden = message.length === 0;
    feedback.textContent = message;
    feedback.classList.toggle('catalog-feedback--error', tone === 'error');
    feedback.classList.toggle('catalog-feedback--success', tone === 'success');
  };

  drawer.addEventListener('close', () => {
    setFeedback('');

    if (lastDrawerInteractionWasPointer) {
      requestAnimationFrame(() => {
        if (openDrawerButton.isConnected) {
          openDrawerButton.blur();
        }
      });
    }
  });

  let listVersion = 0;

  const refreshList = async (): Promise<void> => {
    const currentListVersion = ++listVersion;
    listStatus.textContent = 'Atualizando...';

    try {
      const items = await listCatalogItems();

      if (!isCurrentPage() || currentListVersion !== listVersion) return;

      const sortedItems = [...items].sort(
        (first, second) =>
          first.type.localeCompare(second.type) ||
          first.description.localeCompare(second.description, 'pt-BR'),
      );
      const fragment = document.createDocumentFragment();

      if (sortedItems.length === 0) {
        const emptyState = document.createElement('li');
        emptyState.className = 'catalog-empty';
        emptyState.textContent = 'Nenhum item cadastrado no catálogo.';
        fragment.append(emptyState);
      } else {
        for (const item of sortedItems) {
          const row = document.createElement('li');
          row.className = 'catalog-list-item';

          const type = document.createElement('span');
          type.className = 'catalog-list-item__type';
          type.dataset.catalogType = item.type;
          type.textContent = TYPE_LABELS[item.type];

          const description = document.createElement('span');
          description.className = 'catalog-list-item__description';
          description.textContent = item.description;

          const price = document.createElement('span');
          price.className = 'catalog-list-item__price';
          price.textContent = currencyFormatter.format(item.price);

          const deleteButton = document.createElement('button');
          deleteButton.className = 'catalog-delete';
          deleteButton.type = 'button';
          deleteButton.textContent = '×';
          deleteButton.title = 'Excluir item';
          deleteButton.setAttribute(
            'aria-label',
            `Excluir do catálogo: ${item.description}`,
          );

          deleteButton.addEventListener('click', async () => {
            const confirmed = await showConfirmDialog(
              'Confirmar exclusão',
              'Deseja realmente excluir este item do catálogo?',
            );

            if (!confirmed) return;

            deleteButton.disabled = true;
            setFeedback('Excluindo item...');

            try {
              await deleteCatalogItem(item.id);

              if (!isCurrentPage()) return;

              await refreshList();
              setFeedback('Item excluído com sucesso.', 'success');
            } catch (error) {
              if (!isCurrentPage()) return;

              console.error('Não foi possível excluir o item do catálogo.', error);
              deleteButton.disabled = false;
              setFeedback(
                'Não foi possível excluir o item. Tente novamente.',
                'error',
              );
            }
          });

          row.append(type, description, price, deleteButton);
          fragment.append(row);
        }
      }

      list.replaceChildren(fragment);
      listStatus.textContent = `${sortedItems.length} ite${
        sortedItems.length === 1 ? 'm' : 'ns'
      }`;
    } catch (error) {
      if (!isCurrentPage() || currentListVersion !== listVersion) return;

      console.error('Não foi possível carregar o catálogo.', error);
      list.replaceChildren();
      listStatus.textContent = 'Erro ao carregar';
      setFeedback('Não foi possível carregar o catálogo.', 'error');
    }
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    if (!form.reportValidity()) return;

    const type = typeInput.value as CatalogItem['type'];
    const description = descriptionInput.value.trim();
    const price = Number(priceInput.value);

    if (!description || !Number.isFinite(price) || price < 0) {
      setFeedback('Preencha uma descrição e um preço válido.', 'error');
      return;
    }

    void (async () => {
      submitButton.disabled = true;
      setFeedback('Salvando item...');

      try {
        await addCatalogItem({ type, description, price });

        if (!isCurrentPage()) return;

        descriptionInput.value = '';
        priceInput.value = '';
        await refreshList();
        setFeedback('Item adicionado ao catálogo.', 'success');

        if (drawer.open) {
          drawer.close('saved');
        }
      } catch (error) {
        if (!isCurrentPage()) return;

        console.error('Não foi possível adicionar o item ao catálogo.', error);
        setFeedback(
          'Não foi possível adicionar o item. Tente novamente.',
          'error',
        );
      } finally {
        if (isCurrentPage()) submitButton.disabled = false;
      }
    })();
  });

  await refreshList();
}
