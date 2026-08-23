type ValidatedControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

let validationMessageId = 0;
let firstInvalidControl: ValidatedControl | null = null;
let focusScheduled = false;

function getValidationMessage(control: ValidatedControl): string {
  const { validity } = control;

  if (validity.valueMissing) return 'Preencha este campo.';
  if (validity.typeMismatch && control instanceof HTMLInputElement) {
    return control.type === 'email'
      ? 'Digite um e-mail válido.'
      : 'Digite um valor válido.';
  }
  if (validity.badInput) return 'Digite um valor válido.';
  if (validity.patternMismatch) return 'Confira o formato informado.';
  if (
    validity.tooShort &&
    (control instanceof HTMLInputElement ||
      control instanceof HTMLTextAreaElement)
  ) {
    return `Digite pelo menos ${control.minLength} caracteres.`;
  }
  if (
    validity.tooLong &&
    (control instanceof HTMLInputElement ||
      control instanceof HTMLTextAreaElement)
  ) {
    return `Digite no máximo ${control.maxLength} caracteres.`;
  }
  if (validity.rangeUnderflow && control instanceof HTMLInputElement) {
    return `O valor mínimo é ${control.min}.`;
  }
  if (validity.rangeOverflow && control instanceof HTMLInputElement) {
    return `O valor máximo é ${control.max}.`;
  }
  if (validity.stepMismatch) return 'Digite um valor permitido.';
  if (validity.customError) return control.validationMessage;

  return 'Confira este campo.';
}

function clearValidationMessage(control: ValidatedControl): void {
  const messageId = control.dataset.validationMessageId;

  if (messageId) {
    document.getElementById(messageId)?.remove();
    delete control.dataset.validationMessageId;
  }

  control.removeAttribute('aria-invalid');

  if (messageId) {
    const describedBy = (control.getAttribute('aria-describedby') ?? '')
      .split(/\s+/)
      .filter((id) => id && id !== messageId)
      .join(' ');

    if (describedBy) control.setAttribute('aria-describedby', describedBy);
    else control.removeAttribute('aria-describedby');
  }
}

function showValidationMessage(control: ValidatedControl): void {
  clearValidationMessage(control);

  const message = document.createElement('span');
  const messageId = `field-validation-${++validationMessageId}`;
  const host = control.closest('label') ?? control.parentElement;

  if (!host) return;

  message.id = messageId;
  message.className = 'field-validation-message';
  message.setAttribute('role', 'alert');
  message.textContent = getValidationMessage(control);
  control.dataset.validationMessageId = messageId;
  control.setAttribute('aria-invalid', 'true');
  control.setAttribute(
    'aria-describedby',
    [control.getAttribute('aria-describedby'), messageId].filter(Boolean).join(' '),
  );
  host.append(message);
}

function scheduleFirstInvalidFocus(control: ValidatedControl): void {
  if (!firstInvalidControl) firstInvalidControl = control;
  if (focusScheduled) return;

  focusScheduled = true;
  queueMicrotask(() => {
    const target = firstInvalidControl;
    firstInvalidControl = null;
    focusScheduled = false;

    if (!target?.isConnected) return;

    target.focus({ preventScroll: true });
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

export function initializeFormValidation(): void {
  document.addEventListener(
    'invalid',
    (event) => {
      if (
        !(event.target instanceof HTMLInputElement) &&
        !(event.target instanceof HTMLSelectElement) &&
        !(event.target instanceof HTMLTextAreaElement)
      ) {
        return;
      }

      event.preventDefault();
      showValidationMessage(event.target);
      scheduleFirstInvalidFocus(event.target);
    },
    true,
  );

  const clearMessage = (event: Event): void => {
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLSelectElement ||
      event.target instanceof HTMLTextAreaElement
    ) {
      clearValidationMessage(event.target);
    }
  };

  document.addEventListener('input', clearMessage, true);
  document.addEventListener('change', clearMessage, true);
}
