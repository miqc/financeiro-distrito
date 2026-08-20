const CONFIRM_DIALOG_STYLE_ID = 'confirm-dialog-styles';
let dialogSequence = 0;

const confirmDialogStyles = `
  .confirm-dialog {
    --confirm-dialog-danger: #b42318;
    --confirm-dialog-danger-hover: #8f1d15;
    width: min(calc(100% - 2rem), 28rem);
    max-width: 28rem;
    margin: auto;
    padding: 0;
    color: var(--color-text);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-medium);
    box-shadow: 0 1.5rem 4rem rgb(23 33 31 / 28%);
  }

  .confirm-dialog::backdrop {
    background: rgb(10 20 18 / 58%);
    backdrop-filter: blur(0.25rem);
  }

  .confirm-dialog[open] {
    animation: confirm-dialog-enter 160ms ease-out;
  }

  .confirm-dialog__content {
    display: grid;
    gap: 1rem;
    padding: clamp(1.25rem, 5vw, 1.75rem);
  }

  .confirm-dialog__header {
    display: grid;
    gap: 0.5rem;
  }

  .confirm-dialog__title {
    font-size: 1.25rem;
    line-height: 1.25;
  }

  .confirm-dialog__message {
    color: var(--color-text-muted);
    line-height: 1.55;
  }

  .confirm-dialog__actions {
    display: flex;
    flex-wrap: wrap-reverse;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 0.25rem;
  }

  .confirm-dialog__button {
    min-width: 7rem;
    min-height: 2.75rem;
    padding: 0.625rem 1rem;
    border-radius: var(--radius-small);
    cursor: pointer;
    font: inherit;
    font-weight: 750;
  }

  .confirm-dialog__button--cancel {
    color: var(--color-text);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
  }

  .confirm-dialog__button--cancel:hover {
    background: var(--color-surface-muted);
  }

  .confirm-dialog__button--confirm {
    color: #ffffff;
    background: var(--confirm-dialog-danger);
    border: 1px solid var(--confirm-dialog-danger);
  }

  .confirm-dialog__button--confirm:hover {
    background: var(--confirm-dialog-danger-hover);
    border-color: var(--confirm-dialog-danger-hover);
  }

  @keyframes confirm-dialog-enter {
    from {
      opacity: 0;
      transform: translateY(0.5rem) scale(0.98);
    }

    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @media (max-width: 30rem) {
    .confirm-dialog__actions,
    .confirm-dialog__button {
      width: 100%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .confirm-dialog[open] {
      animation: none;
    }
  }
`;

function ensureConfirmDialogStyles(): void {
  if (document.querySelector(`#${CONFIRM_DIALOG_STYLE_ID}`)) return;

  const style = document.createElement('style');
  style.id = CONFIRM_DIALOG_STYLE_ID;
  style.textContent = confirmDialogStyles;
  document.head.append(style);
}

export async function showConfirmDialog(
  title: string,
  message: string,
): Promise<boolean> {
  ensureConfirmDialogStyles();

  return new Promise<boolean>((resolve) => {
    dialogSequence += 1;

    const titleId = `confirm-dialog-title-${dialogSequence}`;
    const messageId = `confirm-dialog-message-${dialogSequence}`;
    const previouslyFocusedElement = document.activeElement;
    const dialog = document.createElement('dialog');
    dialog.className = 'confirm-dialog';
    dialog.setAttribute('aria-labelledby', titleId);
    dialog.setAttribute('aria-describedby', messageId);

    const content = document.createElement('div');
    content.className = 'confirm-dialog__content';

    const header = document.createElement('header');
    header.className = 'confirm-dialog__header';

    const heading = document.createElement('h2');
    heading.id = titleId;
    heading.className = 'confirm-dialog__title';
    heading.textContent = title;

    const description = document.createElement('p');
    description.id = messageId;
    description.className = 'confirm-dialog__message';
    description.textContent = message;

    const actions = document.createElement('div');
    actions.className = 'confirm-dialog__actions';

    const cancelButton = document.createElement('button');
    cancelButton.className =
      'confirm-dialog__button confirm-dialog__button--cancel';
    cancelButton.type = 'button';
    cancelButton.textContent = 'Cancelar';

    const confirmButton = document.createElement('button');
    confirmButton.className =
      'confirm-dialog__button confirm-dialog__button--confirm';
    confirmButton.type = 'button';
    confirmButton.textContent = 'Excluir';

    header.append(heading, description);
    actions.append(cancelButton, confirmButton);
    content.append(header, actions);
    dialog.append(content);
    document.body.append(dialog);

    cancelButton.addEventListener('click', () => dialog.close('cancel'));
    confirmButton.addEventListener('click', () => dialog.close('confirm'));
    dialog.addEventListener('cancel', () => {
      dialog.returnValue = 'cancel';
    });
    dialog.addEventListener(
      'close',
      () => {
        const confirmed = dialog.returnValue === 'confirm';
        dialog.remove();

        if (
          previouslyFocusedElement instanceof HTMLElement &&
          previouslyFocusedElement.isConnected
        ) {
          previouslyFocusedElement.focus();
        }

        resolve(confirmed);
      },
      { once: true },
    );

    try {
      dialog.showModal();
      cancelButton.focus();
    } catch (error) {
      console.error('Não foi possível abrir o diálogo de confirmação.', error);
      dialog.remove();
      resolve(false);
    }
  });
}
