import {
  calculateDailySummary,
  calculateMonthlySummary,
} from '../core/calculations';
import {
  addMonthlyConfig,
  deleteMonthlyConfig,
  getConfigByReferenceMonth,
  listExpensesByMonth,
  listProductsByMonth,
  listServicesByMonth,
} from '../core/database/operations';
import { getGlobalMonth, setGlobalMonth } from '../core/state';
import type {
  ISODate,
  MonthlyConfig,
  Product,
  ReferenceMonth,
  Service,
} from '../types';

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const DASHBOARD_STYLE_ID = 'dashboard-page-styles';
const renderVersions = new WeakMap<HTMLElement, number>();

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});
const dailyDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  weekday: 'short',
});

const dashboardStyles = `
  .dashboard-page {
    display: grid;
    gap: clamp(1rem, 3vw, 1.5rem);
  }

  .dashboard-page [hidden] {
    display: none !important;
  }

  .dashboard-header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(20rem, 26rem);
    align-items: stretch;
    gap: clamp(1.25rem, 4vw, 2rem);
    padding: clamp(1.25rem, 4vw, 2rem);
    overflow: hidden;
    background: linear-gradient(135deg, var(--color-surface) 58%, var(--color-monthly-wash) 100%);
    border: 1px solid var(--color-info-border);
    border-radius: var(--radius-medium);
    box-shadow: var(--shadow-monthly);
  }

  .dashboard-header__intro {
    display: flex;
    min-width: 0;
    align-items: flex-start;
    gap: 1rem;
  }

  .dashboard-header__icon {
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

  .dashboard-header__icon svg {
    width: 1.5rem;
    height: 1.5rem;
  }

  .dashboard-header__content {
    display: grid;
    min-width: 0;
    align-content: center;
    gap: 0.375rem;
  }

  .dashboard-header__content h2 {
    font-size: clamp(1.375rem, 4vw, 1.75rem);
    letter-spacing: -0.025em;
    line-height: 1.2;
  }

  .dashboard-header__eyebrow {
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

  .dashboard-header__description {
    color: var(--color-text-muted);
    font-size: 0.9375rem;
  }

  .dashboard-filters {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 0.85fr);
    width: 100%;
    min-width: 0;
    align-content: center;
    gap: 0.875rem;
    padding: 1rem;
    background: var(--color-elevated-glass);
    border: 1px solid var(--color-info-border);
    border-radius: var(--radius-medium);
    box-shadow: var(--shadow-panel);
  }

  .dashboard-filter-field {
    display: grid;
    min-width: 0;
    gap: 0.375rem;
    color: var(--color-text-muted);
    font-size: 0.8125rem;
    font-weight: 600;
  }

  .dashboard-filter-field[for="dashboard-month"] {
    display: grid;
    gap: 0.375rem;
    width: 100%;
    max-width: 100%;
    color: var(--color-text-muted);
    font-size: 0.8125rem;
    font-weight: 600;
  }

  .dashboard-filter-field input {
    width: 100%;
    min-height: 2.75rem;
    padding: 0.625rem 0.75rem;
    background: var(--color-surface);
    border: 1px solid var(--color-input-border);
    border-radius: var(--radius-small);
  }

  .dashboard-filter-field[for="dashboard-month"] input {
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

  .dashboard-filter-field input:hover:not(:disabled) {
    border-color: var(--color-info);
  }

  .dashboard-filter-field input:focus:not(:disabled) {
    border-color: var(--color-info);
    box-shadow: 0 0 0 0.1875rem var(--color-info-soft);
  }

  .dashboard-filter-field input:disabled {
    cursor: wait;
    opacity: 0.65;
  }

  .dashboard-feedback {
    padding: 1rem;
    color: var(--color-text-muted);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-small);
  }

  .dashboard-feedback:not([hidden]) {
    animation: app-item-enter var(--motion-duration-normal)
      var(--motion-ease-emphasized) backwards;
  }

  .dashboard-feedback--error {
    color: var(--color-danger);
    background: var(--color-danger-soft);
    border-color: var(--color-danger-border);
  }

  .dashboard-summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr));
    gap: 1rem;
  }

  .dashboard-card {
    --dashboard-card-accent: var(--color-success);
    display: grid;
    min-height: 9rem;
    align-content: space-between;
    gap: 1.25rem;
    padding: clamp(1.25rem, 4vw, 1.75rem);
    overflow: hidden;
    background: var(--color-surface);
    border: 1px solid var(--color-soft-border);
    border-radius: var(--radius-medium);
    box-shadow:
      inset 0 0.1875rem 0 var(--dashboard-card-accent),
      var(--shadow-card);
    animation: app-panel-enter var(--motion-duration-slow)
      var(--motion-ease-emphasized) backwards;
    transition:
      transform var(--motion-duration-normal) var(--motion-ease-standard),
      box-shadow var(--motion-duration-normal) var(--motion-ease-standard);
  }

  .dashboard-card:nth-child(2) {
    animation-delay: 45ms;
  }

  .dashboard-card:nth-child(3) {
    animation-delay: 90ms;
  }

  .dashboard-card:nth-child(4) {
    animation-delay: 135ms;
  }

  .dashboard-card--expense {
    --dashboard-card-accent: var(--color-danger);
  }

  .dashboard-card--goal {
    --dashboard-card-accent: var(--color-warning);
  }

  .dashboard-card--salary {
    --dashboard-card-accent: var(--color-info);
  }

  .dashboard-card__label {
    color: var(--dashboard-card-accent);
  }

  .dashboard-card__detail {
    color: var(--color-subtle-label);
  }

  .dashboard-card__label {
    font-size: 0.8125rem;
    font-weight: 600;
  }

  .dashboard-card__value {
    overflow-wrap: anywhere;
    font-size: clamp(1.5rem, 5vw, 2rem);
    font-weight: 800;
    letter-spacing: -0.035em;
    line-height: 1.1;
  }

  .dashboard-card__detail {
    font-size: 0.7rem;
  }

  .dashboard-daily-details {
    width: 100%;
    min-width: 0;
    max-width: 100%;
    margin-top: clamp(1.5rem, 5vw, 2.5rem);
  }

  .dashboard-daily-summary {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    width: 100%;
    min-height: 3.25rem;
    padding: 0.75rem 1rem;
    color: var(--color-info-strong);
    background: var(--color-info-soft);
    border: 1px solid var(--color-info-border);
    border-radius: var(--radius-medium);
    cursor: pointer;
    font-weight: 650;
    list-style: none;
    text-align: center;
    user-select: none;
    transition:
      transform var(--motion-duration-fast) var(--motion-ease-standard),
      background-color var(--motion-duration-fast) var(--motion-ease-standard),
      border-color var(--motion-duration-fast) var(--motion-ease-standard);
  }

  .dashboard-daily-summary::-webkit-details-marker {
    display: none;
  }

  .dashboard-daily-summary::after {
    width: 0.5rem;
    height: 0.5rem;
    border-right: 0.125rem solid currentColor;
    border-bottom: 0.125rem solid currentColor;
    content: '';
    transform: translateY(-0.125rem) rotate(45deg);
    transition: transform 160ms ease;
  }

  .dashboard-daily-summary:hover {
    background: var(--color-info-hover);
    border-color: var(--color-info-border);
  }

  .dashboard-daily-summary:active {
    transform: scale(0.99);
  }

  .dashboard-daily-details[open] .dashboard-daily-summary::after {
    transform: translateY(0.125rem) rotate(225deg);
  }

  .dashboard-daily-details[open] .dashboard-daily {
    margin-top: 0.75rem;
    animation: dashboard-daily-reveal 180ms ease-out;
  }

  .dashboard-daily {
    width: 100%;
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-medium);
    box-shadow: var(--shadow-surface);
  }

  .dashboard-daily__header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem 1rem;
    padding: clamp(1rem, 3vw, 1.5rem);
    border-bottom: 1px solid var(--color-border);
  }

  .dashboard-daily__header h3 {
    font-size: 1.125rem;
  }

  .dashboard-daily__header p {
    color: var(--color-text-muted);
    font-size: 0.8125rem;
  }

  .dashboard-daily__table-wrapper {
    width: 100%;
    min-width: 0;
    max-width: 100%;
    overflow-x: auto;
    overscroll-behavior-inline: contain;
    -webkit-overflow-scrolling: touch;
  }

  .dashboard-daily__table {
    width: 100%;
    min-width: 32rem;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
  }

  .dashboard-daily__table th,
  .dashboard-daily__table td {
    padding: 0.75rem clamp(1rem, 3vw, 1.5rem);
    border-bottom: 1px solid var(--color-border);
    text-align: left;
  }

  .dashboard-daily__table th {
    color: var(--color-text-muted);
    background: var(--color-background);
    font-size: 0.75rem;
    font-weight: 750;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .dashboard-daily__table th:not(:first-child),
  .dashboard-daily__table td:not(:first-child) {
    text-align: right;
  }

  .dashboard-daily__table tbody tr:hover {
    background: var(--color-primary-soft);
  }

  .dashboard-daily__table tbody tr[data-empty="true"] {
    color: var(--color-text-muted);
  }

  .dashboard-daily__table tfoot td {
    background: var(--color-surface-muted);
    border-bottom: 0;
    font-weight: 800;
  }

  @keyframes dashboard-daily-reveal {
    from {
      opacity: 0;
      transform: translateY(-0.5rem);
    }

    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (max-width: 48rem) {
    .dashboard-header {
      grid-template-columns: minmax(0, 1fr);
    }

    .dashboard-header__intro,
    .dashboard-filters {
      width: 100%;
    }
  }

  @media (hover: hover) and (pointer: fine) {
    .dashboard-card:hover {
      transform: translateY(-0.125rem);
      box-shadow:
        inset 0 0.1875rem 0 var(--dashboard-card-accent),
        var(--shadow-surface);
    }
  }

  @media (max-width: 30rem) {
    .dashboard-filters {
      grid-template-columns: minmax(0, 1fr);
      width: 100%;
    }

    .dashboard-header__icon {
      width: 2.875rem;
      height: 2.875rem;
      border-radius: 0.875rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .dashboard-daily-summary::after {
      transition: none;
    }

    .dashboard-daily-details[open] .dashboard-daily {
      animation: none;
    }
  }
`;

function ensureDashboardStyles(): void {
  if (document.querySelector(`#${DASHBOARD_STYLE_ID}`)) return;

  const style = document.createElement('style');
  style.id = DASHBOARD_STYLE_ID;
  style.textContent = dashboardStyles;
  document.head.append(style);
}

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function getDaysInMonth(referenceMonth: ReferenceMonth): number {
  const [year, month] = referenceMonth.split('-').map(Number);
  return new Date(year, month, 0).getDate();
}

function formatDailyDate(date: ISODate): string {
  const [year, month, day] = date.split('-').map(Number);
  return dailyDateFormatter.format(new Date(year, month - 1, day));
}

function groupRecordsByDate<T extends { date: ISODate }>(
  records: readonly T[],
): Map<ISODate, T[]> {
  const recordsByDate = new Map<ISODate, T[]>();

  for (const record of records) {
    const recordsForDate = recordsByDate.get(record.date) ?? [];
    recordsForDate.push(record);
    recordsByDate.set(record.date, recordsForDate);
  }

  return recordsByDate;
}

function renderDailyRevenueTable(
  tableBody: HTMLTableSectionElement,
  referenceMonth: ReferenceMonth,
  services: readonly Service[],
  products: readonly Product[],
): void {
  const servicesByDate = groupRecordsByDate(services);
  const productsByDate = groupRecordsByDate(products);
  const fragment = document.createDocumentFragment();

  for (let day = 1; day <= getDaysInMonth(referenceMonth); day += 1) {
    const date = `${referenceMonth}-${String(day).padStart(2, '0')}` as ISODate;
    const dailySummary = calculateDailySummary(
      servicesByDate.get(date) ?? [],
      productsByDate.get(date) ?? [],
    );
    const row = document.createElement('tr');
    row.dataset.empty = String(dailySummary.totalRevenue === 0);

    const dateCell = document.createElement('td');
    const time = document.createElement('time');
    time.dateTime = date;
    time.textContent = formatDailyDate(date);
    dateCell.append(time);

    const revenueCell = document.createElement('td');
    revenueCell.textContent = formatCurrency(dailySummary.totalRevenue);

    const withdrawalCell = document.createElement('td');
    withdrawalCell.textContent = formatCurrency(dailySummary.totalWithdrawal);

    row.append(dateCell, revenueCell, withdrawalCell);
    fragment.append(row);
  }

  tableBody.replaceChildren(fragment);
}

async function saveMonthlyConfig(
  currentConfig: MonthlyConfig | undefined,
  referenceMonth: ReferenceMonth,
  workingDays: number,
): Promise<MonthlyConfig> {
  if (!currentConfig) {
    return addMonthlyConfig({ referenceMonth, workingDays });
  }

  if (currentConfig.workingDays === workingDays) {
    return currentConfig;
  }

  await deleteMonthlyConfig(currentConfig.id);

  try {
    return await addMonthlyConfig({
      id: currentConfig.id,
      referenceMonth,
      workingDays,
    });
  } catch (error) {
    try {
      await addMonthlyConfig(currentConfig);
    } catch (rollbackError) {
      console.error(
        'Não foi possível restaurar a configuração mensal anterior.',
        rollbackError,
      );
    }

    throw error;
  }
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

export async function renderDashboard(
  container: HTMLElement,
): Promise<void> {
  ensureDashboardStyles();

  const referenceMonth = getGlobalMonth();
  const renderVersion = (renderVersions.get(container) ?? 0) + 1;
  renderVersions.set(container, renderVersion);

  container.innerHTML = `
    <section class="dashboard-page" aria-labelledby="dashboard-title">
      <header class="dashboard-header">
        <div class="dashboard-header__intro">
          <span class="dashboard-header__icon" aria-hidden="true">
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

          <div class="dashboard-header__content">
            <p class="dashboard-header__eyebrow">Visão mensal</p>
            <h2 id="dashboard-title">Resumo financeiro</h2>
            <p class="dashboard-header__description">
              Serviços, produtos, despesas e resultado do período.
            </p>
          </div>
        </div>

        <div class="dashboard-filters" aria-label="Configurações do mês">
          <label class="dashboard-filter-field" for="dashboard-month">
            Mês de referência
            <input
              id="dashboard-month"
              name="reference-month"
              type="month"
              min="2020-01"
              max="2100-12"
            />
          </label>

          <label class="dashboard-filter-field" for="dashboard-working-days">
            Dias de funcionamento
            <input
              id="dashboard-working-days"
              name="working-days"
              type="number"
              min="1"
              max="31"
              step="1"
              inputmode="numeric"
              disabled
            />
          </label>
        </div>
      </header>

      <p class="dashboard-feedback" role="status">Carregando resumo...</p>

      <section
        class="dashboard-summary-grid"
        aria-label="Indicadores financeiros do mês"
        hidden
      >
        <article class="dashboard-card">
          <p class="dashboard-card__label">Total faturado</p>
          <strong class="dashboard-card__value" data-summary="revenue">R$ 0,00</strong>
          <p class="dashboard-card__detail">Serviços e produtos</p>
        </article>

        <article class="dashboard-card dashboard-card--expense">
          <p class="dashboard-card__label">Total de despesas</p>
          <strong class="dashboard-card__value" data-summary="expenses">R$ 0,00</strong>
          <p class="dashboard-card__detail">Saídas registradas no período</p>
        </article>

        <article class="dashboard-card dashboard-card--goal">
          <p class="dashboard-card__label">Meta diária</p>
          <strong class="dashboard-card__value" data-summary="daily-goal">R$ 0,00</strong>
          <p class="dashboard-card__detail" data-summary-detail="working-days">
            Nenhum dia de funcionamento configurado
          </p>
        </article>

        <article class="dashboard-card dashboard-card--salary" data-summary-card="salary">
          <p class="dashboard-card__label">Salário acumulado</p>
          <strong class="dashboard-card__value" data-summary="salary">R$ 0,00</strong>
          <p class="dashboard-card__detail">Soma das retiradas diárias de 10%</p>
        </article>
      </section>

      <details class="dashboard-daily-details" hidden>
        <summary class="dashboard-daily-summary">
          Ver faturamento dia a dia
        </summary>

        <section
          class="dashboard-daily"
          aria-labelledby="dashboard-daily-title"
        >
          <header class="dashboard-daily__header">
            <h3 id="dashboard-daily-title">Faturamento diário</h3>
            <p>Serviços e produtos somados por dia</p>
          </header>

          <div class="dashboard-daily__table-wrapper">
            <table class="dashboard-daily__table">
              <thead>
                <tr>
                  <th scope="col">Dia</th>
                  <th scope="col">Faturamento</th>
                  <th scope="col">Retirada (10%)</th>
                </tr>
              </thead>
              <tbody></tbody>
              <tfoot>
                <tr>
                  <td>Total do mês</td>
                  <td data-daily-total="revenue">R$ 0,00</td>
                  <td data-daily-total="withdrawal">R$ 0,00</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      </details>
    </section>
  `;

  const monthInput = getRequiredElement<HTMLInputElement>(
    container,
    '#dashboard-month',
  );
  const feedback = getRequiredElement<HTMLElement>(
    container,
    '.dashboard-feedback',
  );
  const workingDaysInput = getRequiredElement<HTMLInputElement>(
    container,
    '#dashboard-working-days',
  );
  const dashboardPage = getRequiredElement<HTMLElement>(
    container,
    '.dashboard-page',
  );
  const summaryGrid = getRequiredElement<HTMLElement>(
    container,
    '.dashboard-summary-grid',
  );
  const dailySection = getRequiredElement<HTMLElement>(
    container,
    '.dashboard-daily-details',
  );
  const dailyTableBody = getRequiredElement<HTMLTableSectionElement>(
    container,
    '.dashboard-daily__table tbody',
  );

  monthInput.value = referenceMonth;
  monthInput.addEventListener('change', () => {
    if (!MONTH_PATTERN.test(monthInput.value)) return;
    setGlobalMonth(monthInput.value);
    void renderDashboard(container);
  });

  try {
    const [expenses, services, products, config] = await Promise.all([
      listExpensesByMonth(referenceMonth),
      listServicesByMonth(referenceMonth),
      listProductsByMonth(referenceMonth),
      getConfigByReferenceMonth(referenceMonth),
    ]);

    if (
      renderVersions.get(container) !== renderVersion ||
      !container.contains(dashboardPage)
    ) {
      return;
    }

    const workingDays = config?.workingDays ?? 0;
    workingDaysInput.value = config ? String(config.workingDays) : '';
    workingDaysInput.disabled = false;

    workingDaysInput.addEventListener('change', () => {
      workingDaysInput.setCustomValidity('');

      if (!workingDaysInput.reportValidity()) return;

      const updatedWorkingDays = Number(workingDaysInput.value);

      if (
        !Number.isInteger(updatedWorkingDays) ||
        updatedWorkingDays < 1 ||
        updatedWorkingDays > 31
      ) {
        workingDaysInput.setCustomValidity(
          'Informe um número inteiro entre 1 e 31.',
        );
        workingDaysInput.reportValidity();
        return;
      }

      workingDaysInput.disabled = true;
      feedback.hidden = false;
      feedback.classList.remove('dashboard-feedback--error');
      feedback.textContent = 'Salvando dias de funcionamento...';

      void (async () => {
        try {
          await saveMonthlyConfig(
            config,
            referenceMonth,
            updatedWorkingDays,
          );

          if (
            renderVersions.get(container) !== renderVersion ||
            !container.contains(dashboardPage)
          ) {
            return;
          }

          await renderDashboard(container);
        } catch (error) {
          if (
            renderVersions.get(container) !== renderVersion ||
            !container.contains(dashboardPage)
          ) {
            return;
          }

          console.error(
            'Não foi possível salvar os dias de funcionamento.',
            error,
          );
          workingDaysInput.disabled = false;
          feedback.classList.add('dashboard-feedback--error');
          feedback.textContent =
            'Não foi possível salvar os dias de funcionamento. Tente novamente.';
        }
      })();
    });

    const summary = calculateMonthlySummary(
      expenses,
      services,
      products,
      { workingDays },
    );

    getRequiredElement<HTMLElement>(container, '[data-summary="revenue"]').textContent =
      formatCurrency(summary.totalRevenue);
    getRequiredElement<HTMLElement>(container, '[data-summary="expenses"]').textContent =
      formatCurrency(summary.totalExpenses);
    getRequiredElement<HTMLElement>(container, '[data-summary="daily-goal"]').textContent =
      formatCurrency(summary.dailyGoal);
    getRequiredElement<HTMLElement>(container, '[data-summary="salary"]').textContent =
      formatCurrency(summary.accumulatedSalary);

    renderDailyRevenueTable(
      dailyTableBody,
      referenceMonth,
      services,
      products,
    );
    getRequiredElement<HTMLElement>(
      container,
      '[data-daily-total="revenue"]',
    ).textContent = formatCurrency(summary.totalRevenue);
    getRequiredElement<HTMLElement>(
      container,
      '[data-daily-total="withdrawal"]',
    ).textContent = formatCurrency(summary.totalWithdrawals);

    const workingDaysDetail = getRequiredElement<HTMLElement>(
      container,
      '[data-summary-detail="working-days"]',
    );
    workingDaysDetail.textContent =
      workingDays > 0
        ? `Calculada com ${workingDays} dia${workingDays === 1 ? '' : 's'} de funcionamento`
        : 'Nenhum dia de funcionamento configurado';

    feedback.hidden = true;
    summaryGrid.hidden = false;
    dailySection.hidden = false;
  } catch (error) {
    if (
      renderVersions.get(container) !== renderVersion ||
      !container.contains(dashboardPage)
    ) {
      return;
    }

    console.error('Não foi possível carregar o resumo financeiro.', error);
    feedback.classList.add('dashboard-feedback--error');
    feedback.textContent =
      'Não foi possível carregar os dados deste mês. Tente novamente.';
    summaryGrid.hidden = true;
    dailySection.hidden = true;
  }
}
