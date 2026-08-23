import { showConfirmDialog } from '../components/confirm-dialog';
import {
  addService,
  deleteProduct,
  deleteService,
  listCatalogItems,
  listProductsByMonth,
  listServicesByMonth,
} from '../core/database/operations';
import { getGlobalMonth, setGlobalMonth } from '../core/state';
import {
  getAttendanceProductItems,
  getAttendanceServiceItems,
  getAttendanceTotal,
  sumAttendanceItems,
} from '../core/attendance';
import type {
  AttendanceItem,
  CatalogItem,
  ISODate,
  PaymentMethod,
  Product,
  ReferenceMonth,
  Service,
} from '../types';

const ENTRIES_STYLE_ID = 'entries-page-styles';
const pageVersions = new WeakMap<HTMLElement, number>();

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});
const dateFormatter = new Intl.DateTimeFormat('pt-BR');
const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});
const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
});
const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: 'Dinheiro',
  card: 'Cartão',
  pix: 'Pix',
};

type ListedEntry =
  | { kind: 'service'; record: Service }
  | { kind: 'legacy-product'; record: Product };

const entriesStyles = `
  .entries-page {
    display: grid;
    gap: clamp(1rem, 3vw, 1.5rem);
  }

  .entries-page [hidden],
  .sales-dialog:not([open]),
  .entries-details-dialog:not([open]) {
    display: none !important;
  }

  .entries-header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(22rem, 27rem);
    align-items: stretch;
    gap: clamp(1.25rem, 4vw, 2rem);
    padding: clamp(1.25rem, 4vw, 2rem);
    overflow: hidden;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-medium);
    box-shadow: var(--shadow-monthly);
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
    color: var(--color-text);
    font-size: 0.8125rem;
    font-weight: 650;
  }

  .entries-header__description {
    color: var(--color-text-muted);
    font-size: 0.9375rem;
  }

  .entries-month-field {
    display: grid;
    width: 15rem;
    min-width: 0;
    gap: 0.375rem;
    color: var(--color-text-muted);
    font-size: 0.8125rem;
    font-weight: 650;
  }

  .entries-month-field input,
  .sales-field input,
  .sales-field select {
    width: 100%;
    min-width: 0;
    min-height: 2.75rem;
    padding: 0.625rem 0.75rem;
    color: var(--color-text);
    background: var(--color-surface);
    border: 1px solid var(--color-input-border);
    border-radius: var(--radius-small);
  }

  .entries-month-field input {
    min-height: 2.625rem;
    padding: 0.5rem 0.75rem;
    color: var(--color-text-muted);
    background: var(--color-background);
    font-weight: 650;
  }

  .entries-month-field input:hover,
  .sales-field input:hover,
  .sales-field select:hover {
    border-color: var(--color-success);
  }

  .entries-month-field input:focus,
  .sales-field input:focus,
  .sales-field select:focus {
    border-color: var(--color-success-strong);
    box-shadow: 0 0 0 0.1875rem var(--color-success-soft);
  }

  .entries-panel {
    overflow: hidden;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-medium);
    box-shadow: var(--shadow-surface);
  }

  .entries-panel__header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 1rem clamp(1rem, 3vw, 1.5rem);
    border-bottom: 1px solid var(--color-border);
  }

  .entries-panel__eyebrow {
    color: var(--color-success-strong);
    font-size: 0.75rem;
    font-weight: 750;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .entries-panel__header h3 {
    font-size: 1rem;
  }

  .entries-header__actions {
    display: flex;
    min-width: 0;
    flex-wrap: wrap;
    align-items: end;
    justify-content: flex-end;
    gap: 0.75rem;
  }

  .entries-records-status {
    color: var(--color-text-muted);
    font-size: 0.8125rem;
  }

  .entries-new-button,
  .sales-submit-button,
  .sales-dialog__close,
  .entries-delete-button {
    min-height: 2.75rem;
    border: 0;
    border-radius: var(--radius-small);
    cursor: pointer;
    font-weight: 750;
  }

  .entries-new-button,
  .sales-submit-button {
    padding: 0.625rem 1rem;
    color: var(--color-on-accent);
    background: var(--color-success-action);
  }

  .entries-new-button:hover,
  .sales-submit-button:hover:not(:disabled) {
    background: var(--color-success-action-hover);
  }

  .sales-dialog {
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
    border: 0;
  }

  .sales-dialog::backdrop {
    background: var(--color-overlay);
    backdrop-filter: blur(2px);
  }

  .sales-dialog[open] {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .sales-dialog[open]::backdrop {
    animation: app-backdrop-enter var(--motion-duration-normal)
      var(--motion-ease-standard) both;
  }

  .sales-dialog:focus {
    outline: none;
  }

  .sales-form {
    display: grid;
    width: min(calc(100% - 2rem), 62rem);
    max-height: min(92vh, 52rem);
    max-height: min(92dvh, 52rem);
    gap: 1rem;
    padding: clamp(1rem, 3vw, 1.5rem);
    overflow-x: hidden;
    overflow-y: auto;
    background: var(--color-surface);
    border-radius: var(--radius-medium);
    box-shadow: var(--shadow-dialog);
  }

  .sales-form > * {
    min-width: 0;
    max-width: 100%;
  }

  .sales-dialog[open] > .sales-form {
    animation: sales-modal-enter var(--motion-duration-normal)
      var(--motion-ease-emphasized);
  }

  .sales-dialog__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin: calc(clamp(1rem, 3vw, 1.5rem) * -1);
    margin-bottom: 0;
    padding: 1rem clamp(1rem, 3vw, 1.5rem);
    border-bottom: 1px solid var(--color-border);
  }

  .sales-dialog__header h3 {
    font-size: 1.125rem;
  }

  .sales-dialog__close {
    display: grid;
    width: 2.75rem;
    padding: 0;
    place-items: center;
    color: var(--color-text-muted);
    background: var(--color-surface-muted);
    font-size: 1.25rem;
  }

  .sales-dialog__close:hover {
    color: var(--color-text);
  }

  .sales-form__meta,
  .sales-form__fields {
    display: grid;
    gap: 0.875rem;
  }

  .sales-form__meta {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .sales-form__section {
    min-width: 0;
    margin: 0;
    padding: 1rem;
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-medium);
  }

  .sales-form__section legend {
    padding-inline: 0.5rem;
    color: var(--color-text);
    font-size: 0.875rem;
    font-weight: 750;
  }

  .sales-items-list {
    display: grid;
    gap: 0.75rem;
  }

  .sales-form__fields {
    grid-template-columns: minmax(11rem, 1.15fr) minmax(13rem, 1.5fr) minmax(8rem, 0.7fr) 2.75rem;
    align-items: end;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--color-row-divider);
  }

  .sales-form__fields:last-child {
    padding-bottom: 0;
    border-bottom: 0;
  }

  .sales-field {
    display: grid;
    width: 100%;
    min-width: 0;
    max-width: 100%;
    gap: 0.5rem;
    color: var(--color-text-muted);
    font-size: 0.8125rem;
    font-weight: 550;
  }

  .sales-field small {
    font-size: 0.75rem;
    font-weight: 450;
  }

  .sales-add-item,
  .sales-item-remove {
    min-height: 2.75rem;
    color: var(--color-text-muted);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-small);
    cursor: pointer;
    font-weight: 700;
  }

  .sales-add-item {
    width: fit-content;
    margin-top: 0.875rem;
    padding: 0.625rem 0.875rem;
  }

  .sales-item-remove {
    display: grid;
    width: 2.75rem;
    padding: 0;
    place-items: center;
    color: var(--color-danger);
    font-size: 1.125rem;
  }

  .sales-add-item:hover,
  .sales-item-remove:hover {
    color: var(--color-text);
    background: var(--color-surface-muted);
  }

  .sales-product-toggle {
    display: flex;
    min-height: 3rem;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    color: var(--color-text);
    background: var(--color-success-soft);
    border: 1px solid var(--color-soft-border);
    border-radius: var(--radius-small);
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 700;
  }

  .sales-product-toggle input {
    width: 1.125rem;
    height: 1.125rem;
    flex: 0 0 auto;
    accent-color: var(--color-success-action);
  }

  .sales-form__summary {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem 1rem;
    padding: 0.875rem 1rem;
    color: var(--color-success-strong);
    background: var(--color-success-soft);
    border-radius: var(--radius-small);
    font-size: 0.875rem;
  }

  .sales-form__summary strong {
    font-size: 1.125rem;
    font-variant-numeric: tabular-nums;
  }

  .sales-form__actions {
    display: flex;
    justify-content: flex-end;
  }

  .sales-submit-button:disabled,
  .entries-delete-button:disabled {
    cursor: wait;
    opacity: 0.6;
  }

  .sales-feedback {
    padding: 0.75rem;
    color: var(--color-text-muted);
    background: var(--color-background);
    border-radius: var(--radius-small);
    font-size: 0.875rem;
  }

  .sales-feedback--error {
    color: var(--color-danger);
    background: var(--color-danger-soft);
  }

  .sales-feedback--success {
    color: var(--color-success-strong);
    background: var(--color-success-soft);
  }

  .entries-list-header,
  .entries-list-item {
    display: grid;
    grid-template-columns: minmax(7rem, 0.7fr) minmax(12rem, 1.35fr) minmax(7rem, 0.8fr) minmax(7rem, 0.75fr) 3rem;
    align-items: center;
    gap: 1rem;
  }

  .entries-list-header {
    padding: 0.625rem clamp(1rem, 3vw, 1.5rem);
    color: var(--color-text-muted);
    background: var(--color-background);
    border-bottom: 1px solid var(--color-border);
    font-size: 0.75rem;
    font-weight: 750;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .entries-list {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .entries-list-item {
    min-height: 4rem;
    padding: 0.625rem clamp(1rem, 3vw, 1.5rem);
    border-bottom: 1px solid var(--color-border);
    animation: app-item-enter var(--motion-duration-normal)
      var(--motion-ease-emphasized) backwards;
  }

  .entries-list-item:last-child {
    border-bottom: 0;
  }

  .entries-list-item__date,
  .entries-list-item__details,
  .entries-list-item__payment,
  .entries-list-item__amount {
    min-width: 0;
  }

  .entries-list-item__date {
    color: var(--color-text-muted);
    font-size: 0.875rem;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .entries-list-item__details {
    display: grid;
    gap: 0.25rem;
  }

  .entries-protocol-button {
    width: fit-content;
    max-width: 100%;
    padding: 0.4375rem 0.6875rem;
    overflow: hidden;
    color: var(--color-text);
    background: var(--color-surface-muted);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-small);
    cursor: pointer;
    font-size: 0.8125rem;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    letter-spacing: 0.025em;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .entries-protocol-button:hover {
    color: var(--color-success-strong);
    border-color: var(--color-success-strong);
  }

  .entries-details-dialog {
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
    border: 0;
  }

  .entries-details-dialog::backdrop {
    background: var(--color-overlay);
    backdrop-filter: blur(2px);
  }

  .entries-details-dialog[open] {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .entries-details-dialog:focus {
    outline: none;
  }

  .entries-details-card {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    width: min(calc(100% - 2rem), 42rem);
    max-height: min(90vh, 48rem);
    max-height: min(90dvh, 48rem);
    overflow: hidden;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-medium);
    box-shadow: var(--shadow-dialog);
    animation: sales-modal-enter var(--motion-duration-normal)
      var(--motion-ease-emphasized);
  }

  .entries-details-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--color-border);
  }

  .entries-details-heading {
    display: grid;
    min-width: 0;
    gap: 0.25rem;
  }

  .entries-details-heading h3 {
    font-size: 1.125rem;
  }

  .entries-details-heading p {
    overflow: hidden;
    color: var(--color-success-strong);
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .entries-details-close {
    display: grid;
    width: 2.75rem;
    min-height: 2.75rem;
    flex: 0 0 auto;
    padding: 0;
    place-items: center;
    color: var(--color-text-muted);
    background: var(--color-surface-muted);
    border: 0;
    border-radius: var(--radius-small);
    cursor: pointer;
    font-size: 1.25rem;
    font-weight: 750;
  }

  .entries-details-content {
    display: grid;
    min-height: 0;
    gap: 1.25rem;
    padding: 1.25rem;
    overflow-y: auto;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
  }

  .entries-details-meta {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
    margin: 0;
  }

  .entries-details-meta > div {
    min-width: 0;
    padding: 0.75rem;
    background: var(--color-background);
    border: 1px solid var(--color-row-divider);
    border-radius: var(--radius-small);
  }

  .entries-details-meta dt {
    margin-bottom: 0.25rem;
    color: var(--color-text-muted);
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .entries-details-meta dd {
    margin: 0;
    overflow-wrap: anywhere;
    font-size: 0.875rem;
    font-weight: 650;
  }

  .entries-details-meta > div[data-meta="payment"] {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
  }

  .entries-details-meta > div[data-meta="payment"] dd {
    width: fit-content;
    align-self: center;
    justify-self: start;
    padding: 0.25rem 0.625rem;
    color: var(--color-info-strong);
    background: var(--color-info-soft);
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 700;
  }

  .entries-details-section {
    display: grid;
    gap: 0.625rem;
  }

  .entries-details-section h4 {
    font-size: 0.875rem;
  }

  .entries-details-items {
    margin: 0;
    padding: 0;
    overflow: hidden;
    list-style: none;
    border: 1px solid var(--color-row-divider);
    border-radius: var(--radius-small);
  }

  .entries-details-item {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem;
    border-bottom: 1px solid var(--color-row-divider);
    font-size: 0.875rem;
  }

  .entries-details-item:last-child {
    border-bottom: 0;
  }

  .entries-details-item span:first-child {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .entries-details-item strong {
    flex: 0 0 auto;
    font-variant-numeric: tabular-nums;
  }

  .entries-details-summary {
    display: grid;
    gap: 0.625rem;
    padding: 1rem;
    background: var(--color-success-soft);
    border-radius: var(--radius-small);
  }

  .entries-details-summary > div {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    color: var(--color-text-muted);
    font-size: 0.8125rem;
  }

  .entries-details-summary strong {
    color: var(--color-text);
    font-variant-numeric: tabular-nums;
  }

  .entries-details-summary__total {
    padding-top: 0.75rem;
    border-top: 1px solid var(--color-soft-border);
    font-size: 0.9375rem !important;
    font-weight: 750;
  }

  .entries-details-summary__total strong {
    color: var(--color-success-strong);
    font-size: 1.125rem;
  }

  .entries-list-item__payment {
    justify-self: start;
    padding: 0.25rem 0.625rem;
    color: var(--color-info-strong);
    background: var(--color-info-soft);
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 700;
    white-space: nowrap;
  }

  .entries-list-item__payment[data-payment="unknown"] {
    color: var(--color-text-muted);
    background: var(--color-surface-muted);
  }

  .entries-list-item__amount {
    color: var(--color-success-strong);
    font-variant-numeric: tabular-nums;
    font-weight: 750;
    text-align: right;
  }

  .entries-delete-button {
    display: grid;
    width: 2.75rem;
    padding: 0;
    place-items: center;
    color: var(--color-danger);
    background: var(--color-danger-soft);
    font-size: 1.25rem;
  }

  .entries-delete-button:hover:not(:disabled) {
    color: var(--color-on-accent);
    background: var(--color-danger);
  }

  .entries-empty-state {
    padding: 2.5rem 1rem;
    color: var(--color-text-muted);
    text-align: center;
  }

  @keyframes sales-modal-enter {
    from {
      opacity: 0;
      transform: translateY(0.5rem) scale(0.98);
    }

    to {
      opacity: 1;
      transform: none;
    }
  }

  @keyframes sales-drawer-enter {
    from {
      transform: translateY(100%);
    }

    to {
      transform: none;
    }
  }

  @media (hover: hover) and (pointer: fine) {
    .entries-new-button:hover,
    .sales-submit-button:hover:not(:disabled) {
      transform: translateY(-0.0625rem);
    }
  }

  @media (max-width: 48rem) {
    .entries-header {
      grid-template-columns: minmax(0, 1fr);
    }

    .entries-header__actions {
      width: 100%;
    }

    .entries-month-field {
      width: 100%;
    }

    .sales-form__fields {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .sales-form__fields .sales-field:first-child {
      grid-column: 1 / -1;
    }

    .sales-item-remove {
      grid-column: 2;
      justify-self: end;
    }
  }

  @media (max-width: 40rem) {
    .entries-header__actions,
    .entries-month-field,
    .entries-new-button {
      width: 100%;
      max-width: 100%;
    }

    .sales-dialog[open] {
      align-items: flex-end;
    }

    .sales-form {
      width: 100%;
      max-height: calc(100dvh - 0.75rem);
      margin-top: auto;
      border-radius: 1rem 1rem 0 0;
      padding-bottom: calc(1.25rem + env(safe-area-inset-bottom));
    }

    .sales-dialog[open] > .sales-form {
      animation: sales-drawer-enter var(--motion-duration-normal)
        var(--motion-ease-emphasized);
    }

    .sales-form__meta,
    .sales-form__fields {
      grid-template-columns: minmax(0, 1fr);
    }

    .sales-form__fields .sales-field:first-child {
      grid-column: auto;
    }

    .sales-item-remove {
      grid-column: 1;
      justify-self: end;
    }

    .sales-form__actions,
    .sales-submit-button {
      width: 100%;
    }

    .entries-list-header {
      display: none;
    }

    .entries-list-item {
      grid-template-columns: minmax(0, 1fr) auto 2.25rem;
      grid-template-rows: auto auto auto;
      gap: 0.25rem 0.75rem;
      min-height: 4.75rem;
      padding-block: 1rem;
      border-bottom-color: var(--color-row-divider);
    }

    .entries-list-item__details {
      grid-column: 1;
      grid-row: 1;
      align-self: end;
    }

    .entries-protocol-button {
      padding: 0.375rem 0.5625rem;
      font-size: 0.75rem;
    }

    .entries-list-item__date {
      grid-column: 1;
      grid-row: 2;
      align-self: center;
      font-size: 0.75rem;
    }

    .entries-list-item__payment {
      grid-column: 1;
      grid-row: 3;
      justify-self: start;
      margin-left: 0;
      font-size: 0.6875rem;
    }

    .entries-list-item__amount {
      grid-column: 2;
      grid-row: 1 / span 3;
      align-self: center;
    }

    .entries-delete-button {
      grid-column: 3;
      grid-row: 1 / span 3;
      align-self: center;
      width: 2.25rem;
      min-height: 2.25rem;
      color: var(--color-text-muted);
      background: transparent;
      opacity: 0.7;
    }

    .entries-details-dialog[open] {
      align-items: flex-end;
    }

    .entries-details-card {
      width: 100%;
      max-height: calc(100dvh - 0.75rem);
      border-radius: 1rem 1rem 0 0;
      animation: sales-drawer-enter var(--motion-duration-normal)
        var(--motion-ease-emphasized);
    }

    .entries-details-content {
      padding-bottom: calc(1.25rem + env(safe-area-inset-bottom));
    }

    .entries-details-meta {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sales-dialog[open] > .sales-form,
    .entries-details-card {
      animation: none;
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

function getLastDateOfMonth(referenceMonth: ReferenceMonth): ISODate {
  const [year, month] = referenceMonth.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return `${referenceMonth}-${String(lastDay).padStart(2, '0')}` as ISODate;
}

function formatDate(date: ISODate): string {
  const [year, month, day] = date.split('-').map(Number);
  const localDate = new Date(year, month - 1, day);
  return Number.isNaN(localDate.getTime())
    ? date
    : dateFormatter.format(localDate);
}

function isPaymentMethod(value: string): value is PaymentMethod {
  return Object.hasOwn(paymentMethodLabels, value);
}

function getSafeAmount(value: string): number {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}

function getEntryDate(entry: ListedEntry): ISODate {
  return entry.record.date;
}

function getEntryProtocol(entry: ListedEntry): string {
  const prefix = entry.kind === 'service' ? 'ATD' : 'PRD';
  const datePart = entry.record.date.replaceAll('-', '');
  const idPart = entry.record.id
    .replace(/[^a-z0-9]/gi, '')
    .slice(-8)
    .toUpperCase()
    .padStart(8, '0');

  return `${prefix}-${datePart}-${idPart}`;
}

function formatCreatedAt(createdAt?: string): string {
  if (!createdAt) return 'Horário não registrado';

  const timestamp = new Date(createdAt);
  return Number.isNaN(timestamp.getTime())
    ? 'Horário não registrado'
    : dateTimeFormatter.format(timestamp);
}

function formatEntryTime(createdAt?: string): string {
  if (!createdAt) return '--:--';

  const timestamp = new Date(createdAt);
  return Number.isNaN(timestamp.getTime())
    ? '--:--'
    : timeFormatter.format(timestamp);
}

export async function renderEntries(container: HTMLElement): Promise<void> {
  ensureEntriesStyles();

  const referenceMonth = getGlobalMonth();
  const pageVersion = (pageVersions.get(container) ?? 0) + 1;
  pageVersions.set(container, pageVersion);

  container.innerHTML = `
    <section class="entries-page" aria-labelledby="entries-title">
      <header class="entries-header">
        <div class="entries-header__content">
          <p class="entries-header__eyebrow">Atendimentos</p>
          <h2 id="entries-title">Lançamentos</h2>
          <p class="entries-header__description">
            Registre serviços, produtos opcionais e o pagamento em uma única venda.
          </p>
        </div>

        <div class="entries-header__actions">
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

          <button class="entries-new-button" type="button">
            Novo lançamento
          </button>
        </div>
      </header>

      <section class="entries-panel" aria-labelledby="entries-records-title">
        <header class="entries-panel__header">
          <h3 id="crud-records-title">Atendimentos registrados</h3>
          <p class="entries-records-status" role="status">Carregando...</p>
        </header>

        <dialog
          class="sales-dialog"
          aria-labelledby="sales-dialog-title"
          tabindex="-1"
        >
          <form class="sales-form">
            <header class="sales-dialog__header">
              <h3 id="sales-dialog-title">Novo Lançamento</h3>
              <button
                class="sales-dialog__close"
                type="button"
                aria-label="Cancelar e fechar formulário"
                title="Cancelar"
              >
                ×
              </button>
            </header>

            <div class="sales-form__meta">
              <label class="sales-field" for="sales-date">
                Data
                <input id="sales-date" name="date" type="date" required />
              </label>

              <label class="sales-field" for="sales-payment-method">
                Forma de pagamento
                <select
                  id="sales-payment-method"
                  name="payment-method"
                  required
                >
                  <option value="">Selecione</option>
                  <option value="cash">Dinheiro</option>
                  <option value="card">Cartão</option>
                  <option value="pix">Pix</option>
                </select>
              </label>
            </div>

            <fieldset class="sales-form__section">
              <legend>Serviços realizados</legend>
              <div id="sales-service-items" class="sales-items-list"></div>
              <button
                class="sales-add-item"
                type="button"
                data-add-item="service"
              >
                + Adicionar outro serviço
              </button>
            </fieldset>

            <label class="sales-product-toggle">
              <input
                id="sales-has-product"
                name="has-product"
                type="checkbox"
                aria-controls="sales-product-fields"
              />
              Cliente comprou um ou mais produtos
            </label>

            <fieldset
              id="sales-product-fields"
              class="sales-form__section"
              hidden
            >
              <legend>Produtos comprados</legend>
              <div id="sales-product-items" class="sales-items-list"></div>
              <button
                class="sales-add-item"
                type="button"
                data-add-item="product"
              >
                + Adicionar outro produto
              </button>
            </fieldset>

            <div class="sales-form__summary" aria-live="polite">
              <span>Total do atendimento</span>
              <strong data-sales-total>R$ 0,00</strong>
            </div>

            <div class="sales-form__actions">
              <button class="sales-submit-button" type="submit">
                Salvar atendimento
              </button>
            </div>

            <p class="sales-feedback" role="status" aria-live="polite" hidden></p>
          </form>
        </dialog>

        <dialog
          class="entries-details-dialog"
          aria-label="Resumo completo do atendimento"
          tabindex="-1"
        ></dialog>

        <div class="entries-list-header" aria-hidden="true">
          <span>Data</span>
          <span>Protocolo</span>
          <span>Pagamento</span>
          <span>Valor total</span>
          <span>Ação</span>
        </div>

        <ul class="entries-list"></ul>
      </section>
    </section>
  `;

  const page = getRequiredElement<HTMLElement>(container, '.entries-page');
  const monthInput = getRequiredElement<HTMLInputElement>(
    container,
    '#entries-month',
  );
  const dialog = getRequiredElement<HTMLDialogElement>(
    container,
    '.sales-dialog',
  );
  const detailsDialog = getRequiredElement<HTMLDialogElement>(
    container,
    '.entries-details-dialog',
  );
  const form = getRequiredElement<HTMLFormElement>(container, '.sales-form');
  const openDialogButton = getRequiredElement<HTMLButtonElement>(
    container,
    '.entries-new-button',
  );
  const closeDialogButton = getRequiredElement<HTMLButtonElement>(
    container,
    '.sales-dialog__close',
  );
  const dateInput = getRequiredElement<HTMLInputElement>(
    container,
    '#sales-date',
  );
  const paymentMethodSelect = getRequiredElement<HTMLSelectElement>(
    container,
    '#sales-payment-method',
  );
  const serviceItemsContainer = getRequiredElement<HTMLElement>(
    container,
    '#sales-service-items',
  );
  const productItemsContainer = getRequiredElement<HTMLElement>(
    container,
    '#sales-product-items',
  );
  const addServiceItemButton = getRequiredElement<HTMLButtonElement>(
    container,
    '[data-add-item="service"]',
  );
  const addProductItemButton = getRequiredElement<HTMLButtonElement>(
    container,
    '[data-add-item="product"]',
  );
  const hasProductInput = getRequiredElement<HTMLInputElement>(
    container,
    '#sales-has-product',
  );
  const productFields = getRequiredElement<HTMLFieldSetElement>(
    container,
    '#sales-product-fields',
  );
  const totalElement = getRequiredElement<HTMLElement>(
    container,
    '[data-sales-total]',
  );
  const submitButton = getRequiredElement<HTMLButtonElement>(
    container,
    '.sales-submit-button',
  );
  const feedback = getRequiredElement<HTMLElement>(
    container,
    '.sales-feedback',
  );
  const recordsStatus = getRequiredElement<HTMLElement>(
    container,
    '.entries-records-status',
  );
  const recordsList = getRequiredElement<HTMLUListElement>(
    container,
    '.entries-list',
  );

  const isCurrentPage = (): boolean =>
    pageVersions.get(container) === pageVersion && container.contains(page);

  monthInput.value = referenceMonth;
  dateInput.value = getDefaultISODate(referenceMonth);
  dateInput.min = `${referenceMonth}-01`;
  dateInput.max = getLastDateOfMonth(referenceMonth);

  const setFeedback = (
    message: string,
    tone?: 'error' | 'success',
  ): void => {
    feedback.hidden = message.length === 0;
    feedback.textContent = message;
    feedback.classList.toggle('sales-feedback--error', tone === 'error');
    feedback.classList.toggle('sales-feedback--success', tone === 'success');
  };

  type ItemKind = 'service' | 'product';

  let serviceCatalogItems: readonly CatalogItem[] = [];
  let productCatalogItems: readonly CatalogItem[] = [];
  let catalogsLoaded = false;
  let nextItemIndex = 0;

  const getItemRows = (itemsContainer: HTMLElement): HTMLElement[] =>
    Array.from(
      itemsContainer.querySelectorAll<HTMLElement>('.sales-form__fields'),
    );

  const updateTotal = (): void => {
    const serviceAmount = Array.from(
      serviceItemsContainer.querySelectorAll<HTMLInputElement>(
        '[data-item-amount]',
      ),
    ).reduce((total, input) => total + getSafeAmount(input.value), 0);
    const productAmount = hasProductInput.checked
      ? Array.from(
          productItemsContainer.querySelectorAll<HTMLInputElement>(
            '[data-item-amount]',
          ),
        ).reduce((total, input) => total + getSafeAmount(input.value), 0)
      : 0;

    totalElement.textContent = currencyFormatter.format(
      serviceAmount + productAmount,
    );
  };

  const refreshRemoveButtons = (itemsContainer: HTMLElement): void => {
    const rows = getItemRows(itemsContainer);

    for (const row of rows) {
      const removeButton = getRequiredElement<HTMLButtonElement>(
        row,
        '[data-remove-item]',
      );
      removeButton.hidden = rows.length === 1;
    }
  };

  const configureCatalogSelect = (
    select: HTMLSelectElement,
    items: readonly CatalogItem[],
    descriptionInput: HTMLInputElement,
    amountInput: HTMLInputElement,
    kind: ItemKind,
  ): void => {
    select.replaceChildren();

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = !catalogsLoaded
      ? 'Carregando catálogo...'
      : items.length === 0
        ? 'Nenhum item cadastrado'
        : 'Selecione ou preencha manualmente';
    select.append(placeholder);

    const sortedItems = [...items].sort((first, second) =>
      first.description.localeCompare(second.description, 'pt-BR'),
    );

    for (const item of sortedItems) {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = `${item.description} — ${currencyFormatter.format(
        item.price,
      )}`;
      select.append(option);
    }

    select.disabled =
      !catalogsLoaded ||
      items.length === 0 ||
      (kind === 'product' && !hasProductInput.checked);
    select.onchange = () => {
      const selectedItem = sortedItems.find((item) => item.id === select.value);
      if (!selectedItem) return;

      descriptionInput.value = selectedItem.description;
      amountInput.value = selectedItem.price.toFixed(2);
      updateTotal();
    };
  };

  const createItemRow = (kind: ItemKind): HTMLElement => {
    const itemIndex = nextItemIndex++;
    const prefix = `sales-${kind}-${itemIndex}`;
    const itemLabel = kind === 'service' ? 'Serviço' : 'Produto';
    const placeholder =
      kind === 'service' ? 'Ex.: Corte masculino' : 'Ex.: Pomada modeladora';
    const row = document.createElement('div');

    row.className = 'sales-form__fields';
    row.dataset.itemKind = kind;
    row.innerHTML = `
      <label class="sales-field" for="${prefix}-catalog">
        ${itemLabel} do catálogo
        <select id="${prefix}-catalog" data-item-catalog>
          <option value="">Carregando catálogo...</option>
        </select>
      </label>

      <label class="sales-field" for="${prefix}-description">
        Descrição do ${itemLabel.toLowerCase()}
        <input
          id="${prefix}-description"
          type="text"
          maxlength="160"
          autocomplete="off"
          placeholder="${placeholder}"
          data-item-description
          required
        />
      </label>

      <label class="sales-field" for="${prefix}-amount">
        Valor do ${itemLabel.toLowerCase()}
        <input
          id="${prefix}-amount"
          type="number"
          min="0"
          step="0.01"
          inputmode="decimal"
          placeholder="0,00"
          data-item-amount
          required
        />
      </label>

      <button
        class="sales-item-remove"
        type="button"
        data-remove-item
        aria-label="Remover ${itemLabel.toLowerCase()}"
        title="Remover ${itemLabel.toLowerCase()}"
      >
        ×
      </button>
    `;

    const catalogSelect = getRequiredElement<HTMLSelectElement>(
      row,
      '[data-item-catalog]',
    );
    const descriptionInput = getRequiredElement<HTMLInputElement>(
      row,
      '[data-item-description]',
    );
    const amountInput = getRequiredElement<HTMLInputElement>(
      row,
      '[data-item-amount]',
    );
    const removeButton = getRequiredElement<HTMLButtonElement>(
      row,
      '[data-remove-item]',
    );

    configureCatalogSelect(
      catalogSelect,
      kind === 'service' ? serviceCatalogItems : productCatalogItems,
      descriptionInput,
      amountInput,
      kind,
    );

    if (kind === 'product' && !hasProductInput.checked) {
      descriptionInput.disabled = true;
      amountInput.disabled = true;
    }

    removeButton.addEventListener('click', () => {
      const itemsContainer = row.parentElement;
      if (!itemsContainer || getItemRows(itemsContainer).length === 1) return;

      row.remove();
      refreshRemoveButtons(itemsContainer);
      updateTotal();
    });

    return row;
  };

  const resetItemRows = (): void => {
    serviceItemsContainer.replaceChildren(createItemRow('service'));
    productItemsContainer.replaceChildren(createItemRow('product'));
    refreshRemoveButtons(serviceItemsContainer);
    refreshRemoveButtons(productItemsContainer);
  };

  const setProductFieldsVisibility = (): void => {
    const hasProduct = hasProductInput.checked;
    productFields.hidden = !hasProduct;
    hasProductInput.setAttribute('aria-expanded', String(hasProduct));

    for (const row of getItemRows(productItemsContainer)) {
      const catalogSelect = getRequiredElement<HTMLSelectElement>(
        row,
        '[data-item-catalog]',
      );
      const descriptionInput = getRequiredElement<HTMLInputElement>(
        row,
        '[data-item-description]',
      );
      const amountInput = getRequiredElement<HTMLInputElement>(
        row,
        '[data-item-amount]',
      );

      catalogSelect.disabled =
        !hasProduct || !catalogsLoaded || productCatalogItems.length === 0;
      descriptionInput.disabled = !hasProduct;
      amountInput.disabled = !hasProduct;
      descriptionInput.required = hasProduct;
      amountInput.required = hasProduct;
    }

    updateTotal();
  };

  const resetForm = (): void => {
    form.reset();
    dateInput.value = getDefaultISODate(referenceMonth);
    hasProductInput.checked = false;
    resetItemRows();
    setProductFieldsVisibility();
    setFeedback('');
  };

  let lastDialogInteractionWasPointer = false;

  openDialogButton.addEventListener('pointerdown', () => {
    lastDialogInteractionWasPointer = true;
  });
  openDialogButton.addEventListener('keydown', () => {
    lastDialogInteractionWasPointer = false;
  });
  dialog.addEventListener('pointerdown', () => {
    lastDialogInteractionWasPointer = true;
  });
  dialog.addEventListener('keydown', () => {
    lastDialogInteractionWasPointer = false;
  });

  openDialogButton.addEventListener('click', (event) => {
    if (dialog.open) return;

    resetForm();
    if (event.detail > 0) lastDialogInteractionWasPointer = true;
    dialog.showModal();

    if (lastDialogInteractionWasPointer) {
      dialog.focus({ preventScroll: true });
    } else {
      dateInput.focus({ preventScroll: true });
    }
  });

  closeDialogButton.addEventListener('click', () => dialog.close('cancel'));
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close('cancel');
  });
  dialog.addEventListener('close', () => {
    setFeedback('');

    if (lastDialogInteractionWasPointer) {
      requestAnimationFrame(() => {
        if (openDialogButton.isConnected) openDialogButton.blur();
      });
    }
  });

  monthInput.addEventListener('change', () => {
    if (!monthInput.reportValidity() || !monthInput.value) return;

    setGlobalMonth(monthInput.value);
    void renderEntries(container);
  });

  hasProductInput.addEventListener('change', setProductFieldsVisibility);
  serviceItemsContainer.addEventListener('input', updateTotal);
  productItemsContainer.addEventListener('input', updateTotal);

  const appendItemRow = (kind: ItemKind): void => {
    const itemsContainer =
      kind === 'service' ? serviceItemsContainer : productItemsContainer;
    const row = createItemRow(kind);

    itemsContainer.append(row);
    refreshRemoveButtons(itemsContainer);
    getRequiredElement<HTMLInputElement>(
      row,
      '[data-item-description]',
    ).focus({ preventScroll: true });
  };

  addServiceItemButton.addEventListener('click', () =>
    appendItemRow('service'),
  );
  addProductItemButton.addEventListener('click', () =>
    appendItemRow('product'),
  );

  const refreshCatalogRows = (kind: ItemKind): void => {
    const itemsContainer =
      kind === 'service' ? serviceItemsContainer : productItemsContainer;
    const catalogItems =
      kind === 'service' ? serviceCatalogItems : productCatalogItems;

    for (const row of getItemRows(itemsContainer)) {
      configureCatalogSelect(
        getRequiredElement<HTMLSelectElement>(row, '[data-item-catalog]'),
        catalogItems,
        getRequiredElement<HTMLInputElement>(row, '[data-item-description]'),
        getRequiredElement<HTMLInputElement>(row, '[data-item-amount]'),
        kind,
      );
    }
  };

  const loadCatalogs = async (): Promise<void> => {
    try {
      const [services, products] = await Promise.all([
        listCatalogItems('service'),
        listCatalogItems('product'),
      ]);

      if (!isCurrentPage()) return;
      serviceCatalogItems = services;
      productCatalogItems = products;
    } catch (error) {
      if (!isCurrentPage()) return;

      console.error('Não foi possível carregar o catálogo.', error);
      serviceCatalogItems = [];
      productCatalogItems = [];
    }

    catalogsLoaded = true;
    refreshCatalogRows('service');
    refreshCatalogRows('product');
    setProductFieldsVisibility();
  };

  const openEntryDetails = (entry: ListedEntry): void => {
    const protocol = getEntryProtocol(entry);
    const record = entry.record;
    const serviceItems =
      entry.kind === 'service' ? getAttendanceServiceItems(entry.record) : [];
    const productItems: readonly AttendanceItem[] =
      entry.kind === 'service'
        ? getAttendanceProductItems(entry.record)
        : [{ description: record.description, amount: record.amount }];
    const serviceSubtotal = sumAttendanceItems(serviceItems);
    const productSubtotal = sumAttendanceItems(productItems);
    const total =
      entry.kind === 'service'
        ? getAttendanceTotal(entry.record)
        : record.amount;

    const card = document.createElement('article');
    card.className = 'entries-details-card';

    const header = document.createElement('header');
    header.className = 'entries-details-header';

    const heading = document.createElement('div');
    heading.className = 'entries-details-heading';

    const title = document.createElement('h3');
    title.id = 'entries-details-title';
    title.textContent = 'Resumo da venda';

    const protocolLabel = document.createElement('p');
    protocolLabel.textContent = protocol;
    heading.append(title, protocolLabel);

    const closeButton = document.createElement('button');
    closeButton.className = 'entries-details-close';
    closeButton.type = 'button';
    closeButton.textContent = '×';
    closeButton.title = 'Fechar resumo';
    closeButton.setAttribute('aria-label', 'Fechar resumo do atendimento');
    closeButton.addEventListener('click', () => detailsDialog.close());
    header.append(heading, closeButton);

    const content = document.createElement('div');
    content.className = 'entries-details-content';

    const meta = document.createElement('dl');
    meta.className = 'entries-details-meta';

    const appendMeta = (
      label: string,
      value: string,
      metaKey?: string,
    ): void => {
      const item = document.createElement('div');
      if (metaKey) item.dataset.meta = metaKey;
      const term = document.createElement('dt');
      const description = document.createElement('dd');
      term.textContent = label;
      description.textContent = value;
      item.append(term, description);
      meta.append(item);
    };

    appendMeta('Data da venda', formatDate(record.date));
    appendMeta('Lançado em', formatCreatedAt(record.createdAt));
    appendMeta(
      'Pagamento',
      record.paymentMethod
        ? paymentMethodLabels[record.paymentMethod]
        : 'Não informado',
      'payment',
    );
    appendMeta('ID interno', record.id);
    content.append(meta);

    const appendItemsSection = (
      label: string,
      items: readonly AttendanceItem[],
    ): void => {
      if (items.length === 0) return;

      const section = document.createElement('section');
      section.className = 'entries-details-section';
      const sectionTitle = document.createElement('h4');
      sectionTitle.textContent = `${label} (${items.length})`;
      const list = document.createElement('ul');
      list.className = 'entries-details-items';

      for (const attendanceItem of items) {
        const listItem = document.createElement('li');
        listItem.className = 'entries-details-item';
        const description = document.createElement('span');
        description.textContent = attendanceItem.description;
        const amount = document.createElement('strong');
        amount.textContent = currencyFormatter.format(attendanceItem.amount);
        listItem.append(description, amount);
        list.append(listItem);
      }

      section.append(sectionTitle, list);
      content.append(section);
    };

    appendItemsSection('Serviços', serviceItems);
    appendItemsSection('Produtos', productItems);

    const summary = document.createElement('div');
    summary.className = 'entries-details-summary';

    const appendSummaryRow = (
      label: string,
      value: number,
      isTotal = false,
    ): void => {
      const row = document.createElement('div');
      if (isTotal) row.className = 'entries-details-summary__total';
      const rowLabel = document.createElement('span');
      rowLabel.textContent = label;
      const rowValue = document.createElement('strong');
      rowValue.textContent = currencyFormatter.format(value);
      row.append(rowLabel, rowValue);
      summary.append(row);
    };

    if (serviceItems.length > 0) {
      appendSummaryRow('Subtotal de serviços', serviceSubtotal);
    }
    if (productItems.length > 0) {
      appendSummaryRow('Subtotal de produtos', productSubtotal);
    }
    appendSummaryRow('Total da venda', total, true);
    content.append(summary);

    card.append(header, content);
    detailsDialog.setAttribute('aria-labelledby', title.id);
    detailsDialog.replaceChildren(card);
    detailsDialog.showModal();
    closeButton.focus({ preventScroll: true });
  };

  detailsDialog.addEventListener('click', (event) => {
    if (event.target === detailsDialog) detailsDialog.close();
  });

  let listVersion = 0;

  const refreshList = async (): Promise<void> => {
    const currentListVersion = ++listVersion;
    recordsStatus.textContent = 'Atualizando...';

    try {
      const [services, legacyProducts] = await Promise.all([
        listServicesByMonth(referenceMonth),
        listProductsByMonth(referenceMonth),
      ]);

      if (!isCurrentPage() || currentListVersion !== listVersion) return;

      const entries: ListedEntry[] = [
        ...services.map((record) => ({
          kind: 'service' as const,
          record,
        })),
        ...legacyProducts.map((record) => ({
          kind: 'legacy-product' as const,
          record,
        })),
      ].sort((first, second) => {
        const dateComparison = getEntryDate(second).localeCompare(
          getEntryDate(first),
        );
        const timeComparison = (second.record.createdAt ?? '').localeCompare(
          first.record.createdAt ?? '',
        );
        return (
          dateComparison ||
          timeComparison ||
          getEntryProtocol(first).localeCompare(getEntryProtocol(second))
        );
      });
      const fragment = document.createDocumentFragment();

      if (entries.length === 0) {
        const emptyState = document.createElement('li');
        emptyState.className = 'entries-empty-state';
        emptyState.textContent = 'Nenhum atendimento encontrado neste mês.';
        fragment.append(emptyState);
      } else {
        for (const entry of entries) {
          const record = entry.record;
          const item = document.createElement('li');
          item.className = 'entries-list-item';

          const date = document.createElement('time');
          date.className = 'entries-list-item__date';
          date.dateTime = record.createdAt ?? record.date;
          date.textContent = `${formatDate(record.date)} - ${formatEntryTime(
            record.createdAt,
          )}`;

          const details = document.createElement('div');
          details.className = 'entries-list-item__details';

          const protocol = getEntryProtocol(entry);
          const protocolButton = document.createElement('button');
          protocolButton.className = 'entries-protocol-button';
          protocolButton.type = 'button';
          protocolButton.textContent = protocol;
          protocolButton.title = 'Ver resumo completo';
          protocolButton.setAttribute(
            'aria-label',
            `Ver resumo completo do protocolo ${protocol}`,
          );
          protocolButton.addEventListener('click', () =>
            openEntryDetails(entry),
          );
          details.append(protocolButton);

          const paymentMethod = record.paymentMethod;
          const payment = document.createElement('span');
          payment.className = 'entries-list-item__payment';
          payment.dataset.payment = paymentMethod ?? 'unknown';
          payment.textContent = paymentMethod
            ? paymentMethodLabels[paymentMethod]
            : 'Não informado';

          const total =
            entry.kind === 'service'
              ? getAttendanceTotal(entry.record)
              : entry.record.amount;
          const amount = document.createElement('span');
          amount.className = 'entries-list-item__amount';
          amount.textContent = currencyFormatter.format(total);

          const deleteButton = document.createElement('button');
          deleteButton.className = 'entries-delete-button';
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
            recordsStatus.textContent = 'Excluindo lançamento...';

            try {
              if (entry.kind === 'service') {
                await deleteService(record.id);
              } else {
                await deleteProduct(record.id);
              }

              if (!isCurrentPage()) return;
              await refreshList();
            } catch (error) {
              if (!isCurrentPage()) return;

              console.error('Não foi possível excluir o lançamento.', error);
              recordsStatus.textContent = 'Erro ao excluir';
              deleteButton.disabled = false;
            }
          });

          item.append(date, details, payment, amount, deleteButton);
          fragment.append(item);
        }
      }

      recordsList.replaceChildren(fragment);
      recordsStatus.textContent = `${entries.length} lançamento${
        entries.length === 1 ? '' : 's'
      }`;
    } catch (error) {
      if (!isCurrentPage() || currentListVersion !== listVersion) return;

      console.error('Não foi possível listar os lançamentos.', error);
      recordsStatus.textContent = 'Erro ao carregar';
      recordsList.replaceChildren();
    }
  };

  const collectAttendanceItems = (
    itemsContainer: HTMLElement,
  ): AttendanceItem[] =>
    getItemRows(itemsContainer).map((row) => {
      const catalogItemId = getRequiredElement<HTMLSelectElement>(
        row,
        '[data-item-catalog]',
      ).value;
      const description = getRequiredElement<HTMLInputElement>(
        row,
        '[data-item-description]',
      ).value.trim();
      const amount = Number(
        getRequiredElement<HTMLInputElement>(
          row,
          '[data-item-amount]',
        ).value,
      );

      return {
        ...(catalogItemId ? { catalogItemId } : {}),
        description,
        amount,
      };
    });

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    if (!form.reportValidity()) return;

    const paymentMethod = paymentMethodSelect.value;
    const serviceItems = collectAttendanceItems(serviceItemsContainer);
    const productItems = hasProductInput.checked
      ? collectAttendanceItems(productItemsContainer)
      : [];
    const hasInvalidItem = (item: AttendanceItem): boolean =>
      !item.description || !Number.isFinite(item.amount) || item.amount < 0;

    if (
      serviceItems.length === 0 ||
      serviceItems.some(hasInvalidItem) ||
      !isPaymentMethod(paymentMethod)
    ) {
      setFeedback(
        'Preencha o serviço, o valor e a forma de pagamento.',
        'error',
      );
      return;
    }

    if (productItems.some(hasInvalidItem)) {
      setFeedback('Preencha todos os produtos e seus valores.', 'error');
      return;
    }

    const description = serviceItems.map((item) => item.description).join(', ');
    const serviceAmount = sumAttendanceItems(serviceItems);

    void (async () => {
      submitButton.disabled = true;
      setFeedback('Salvando atendimento...');

      try {
        await addService({
          date: dateInput.value as ISODate,
          createdAt: new Date().toISOString(),
          description,
          amount: serviceAmount,
          paymentMethod,
          serviceItems,
          productItems: productItems.length > 0 ? productItems : undefined,
        });

        if (!isCurrentPage()) return;

        await refreshList();
        setFeedback('Atendimento salvo com sucesso.', 'success');

        if (dialog.open) dialog.close('saved');
      } catch (error) {
        if (!isCurrentPage()) return;

        console.error('Não foi possível salvar o atendimento.', error);
        setFeedback(
          'Não foi possível salvar o atendimento. Tente novamente.',
          'error',
        );
      } finally {
        if (isCurrentPage()) submitButton.disabled = false;
      }
    })();
  });

  resetForm();
  await Promise.all([refreshList(), loadCatalogs()]);
}
