import { getAccountEmail, updateCredentials } from '../core/auth';
import { getTheme, setTheme } from '../core/theme';

const SETTINGS_STYLE_ID = 'settings-page-styles';

const settingsStyles = `
  .settings-page {
    display: grid;
    gap: clamp(1rem, 3vw, 1.5rem);
  }

  .settings-page [hidden] {
    display: none !important;
  }

  .settings-header,
  .settings-section {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-medium);
    box-shadow: var(--shadow-surface);
    transition:
      background-color var(--motion-duration-normal) var(--motion-ease-standard),
      border-color var(--motion-duration-normal) var(--motion-ease-standard),
      box-shadow var(--motion-duration-normal) var(--motion-ease-standard);
  }

  .settings-header {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: clamp(1.25rem, 4vw, 2rem);
  }

  .settings-header__icon {
    display: grid;
    width: 3.25rem;
    height: 3.25rem;
    flex: 0 0 auto;
    place-items: center;
    color: var(--color-info-strong);
    background: var(--color-info-soft);
    border-radius: 1rem;
  }

  .settings-header__icon svg {
    width: 1.5rem;
    height: 1.5rem;
  }

  .settings-header__content {
    display: grid;
    min-width: 0;
    gap: 0.375rem;
  }

  .settings-header__eyebrow {
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

  .settings-header__description,
  .settings-option__description,
  .settings-feedback {
    color: var(--color-text-muted);
  }

  .settings-section {
    overflow: hidden;
  }

  .settings-section__header {
    display: grid;
    gap: 0.25rem;
    padding: 1rem clamp(1rem, 4vw, 1.5rem);
    border-bottom: 1px solid var(--color-border);
  }

  .settings-section__header h3 {
    font-size: 1rem;
  }

  .settings-section__header p {
    color: var(--color-text-muted);
    font-size: 0.8125rem;
  }

  .settings-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
    padding: clamp(1rem, 4vw, 1.5rem);
  }

  .settings-option__content {
    display: grid;
    min-width: 0;
    gap: 0.25rem;
  }

  .settings-option__title {
    font-weight: 700;
  }

  .settings-option__description {
    font-size: 0.875rem;
  }

  .theme-switch {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
  }

  .theme-switch__input {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .theme-switch__track {
    position: relative;
    width: 3.25rem;
    height: 1.875rem;
    background: var(--color-surface-muted);
    border: 1px solid var(--color-border);
    border-radius: 999px;
    transition:
      background-color var(--motion-duration-normal) var(--motion-ease-standard),
      border-color var(--motion-duration-normal) var(--motion-ease-standard);
  }

  .theme-switch__track::after {
    position: absolute;
    top: 0.1875rem;
    left: 0.1875rem;
    width: 1.375rem;
    height: 1.375rem;
    background: var(--color-switch-thumb);
    border-radius: 50%;
    box-shadow: 0 0.125rem 0.375rem rgb(0 0 0 / 20%);
    content: '';
    transition:
      transform var(--motion-duration-normal) var(--motion-ease-emphasized),
      box-shadow var(--motion-duration-normal) var(--motion-ease-standard);
  }

  .theme-switch__input:checked + .theme-switch__track {
    background: var(--color-info);
    border-color: var(--color-info);
  }

  .theme-switch__input:checked + .theme-switch__track::after {
    transform: translateX(1.375rem) scale(1.04);
  }

  .theme-switch:active .theme-switch__track::after {
    transform: scale(0.9);
  }

  .theme-switch:active
    .theme-switch__input:checked
    + .theme-switch__track::after {
    transform: translateX(1.375rem) scale(0.9);
  }

  .theme-switch__input:focus-visible + .theme-switch__track {
    outline: 0.1875rem solid var(--color-focus);
    outline-offset: 0.1875rem;
  }

  .theme-switch__status {
    min-width: 4.5rem;
    color: var(--color-text-muted);
    font-size: 0.8125rem;
    font-weight: 650;
    text-align: right;
  }

  .settings-feedback {
    min-height: 1.5rem;
    padding-inline: clamp(1rem, 4vw, 1.5rem);
    padding-bottom: 1rem;
    font-size: 0.8125rem;
  }

  .settings-feedback:not(:empty) {
    animation: app-item-enter var(--motion-duration-normal)
      var(--motion-ease-emphasized) backwards;
  }

  .settings-account-form {
    display: grid;
    gap: 1rem;
    padding: clamp(1rem, 4vw, 1.5rem);
  }

  .settings-account-fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
  }

  .settings-field {
    display: grid;
    min-width: 0;
    gap: 0.5rem;
    color: var(--color-text-muted);
    font-size: 0.8125rem;
    font-weight: 600;
  }

  .settings-field input {
    width: 100%;
    min-width: 0;
    min-height: 2.875rem;
    padding: 0.625rem 0.75rem;
    color: var(--color-text);
    background: var(--color-surface);
    border: 1px solid var(--color-input-border);
    border-radius: var(--radius-small);
  }

  .settings-field input:hover {
    border-color: var(--color-info);
  }

  .settings-field input:focus {
    border-color: var(--color-info-strong);
    box-shadow: 0 0 0 0.1875rem var(--color-info-soft);
  }

  .settings-account-note {
    color: var(--color-text-muted);
    font-size: 0.75rem;
  }

  .settings-account-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 1rem;
  }

  .settings-account-submit {
    min-height: 2.875rem;
    padding: 0.625rem 1rem;
    color: var(--color-on-action);
    background: var(--color-action);
    border: 0;
    border-radius: var(--radius-small);
    cursor: pointer;
    font-weight: 750;
  }

  .settings-account-submit:hover:not(:disabled) {
    background: var(--color-action-hover);
  }

  .settings-account-submit:disabled {
    cursor: wait;
    opacity: 0.65;
  }

  .settings-account-feedback {
    padding: 0.75rem;
    color: var(--color-text-muted);
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-small);
    font-size: 0.8125rem;
  }

  .settings-account-feedback:not([hidden]) {
    animation: app-item-enter var(--motion-duration-normal)
      var(--motion-ease-emphasized) backwards;
  }

  .settings-account-feedback--error {
    color: var(--color-danger);
    background: var(--color-danger-soft);
    border-color: var(--color-danger-border);
  }

  .settings-account-feedback--success {
    color: var(--color-success-strong);
    background: var(--color-success-soft);
    border-color: var(--color-success);
  }

  @media (hover: hover) and (pointer: fine) {
    .settings-account-submit:hover:not(:disabled) {
      transform: translateY(-0.0625rem);
    }
  }

  @media (max-width: 30rem) {
    .settings-option {
      align-items: flex-start;
      flex-direction: column;
    }

    .theme-switch {
      width: 100%;
      justify-content: space-between;
    }

    .settings-header__icon {
      width: 2.875rem;
      height: 2.875rem;
      border-radius: 0.875rem;
    }

    .settings-account-fields {
      grid-template-columns: minmax(0, 1fr);
    }

    .settings-account-actions,
    .settings-account-submit {
      width: 100%;
    }
  }
`;

function ensureSettingsStyles(): void {
  if (document.querySelector(`#${SETTINGS_STYLE_ID}`)) return;

  const style = document.createElement('style');
  style.id = SETTINGS_STYLE_ID;
  style.textContent = settingsStyles;
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

export function renderSettingsPage(container: HTMLElement): void {
  ensureSettingsStyles();

  container.innerHTML = `
    <section class="settings-page" aria-labelledby="settings-title">
      <header class="settings-header">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.6v-.1A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.1 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H2.3V9.6h.1A1.7 1.7 0 0 0 4.1 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 8.5 4.1a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V2.3h4v.1A1.7 1.7 0 0 0 15 4.1a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 8.5a1.7 1.7 0 0 0 .6 1 1.7 1.7 0 0 0 1.1.4h.1v4h-.1A1.7 1.7 0 0 0 19.4 15Z" />
          </svg>
        </span>

        <div class="settings-header__content">
          <p class="catalog-header__eyebrow">Preferências</p>
          <h2 id="settings-title">Configurações</h2>
          <p class="settings-header__description">
            Personalize a experiência do Distrito Financeiro.
          </p>
        </div>
      </header>

      <section class="settings-section" aria-labelledby="appearance-title">
        <header class="settings-section__header">
          <h3 id="appearance-title">Aparência</h3>
          <p>Escolha o tema mais confortável para o ambiente.</p>
        </header>

        <div class="settings-option">
          <div class="settings-option__content">
            <p class="settings-option__title">Modo escuro</p>
            <p class="settings-option__description">
              Reduz o brilho mantendo contraste e cores semânticas.
            </p>
          </div>

          <label class="theme-switch">
            <input
              class="theme-switch__input"
              type="checkbox"
              role="switch"
              aria-label="Ativar modo escuro"
            />
            <span class="theme-switch__track" aria-hidden="true"></span>
            <span class="theme-switch__status">Desativado</span>
          </label>
        </div>

        <p class="settings-feedback" role="status" aria-live="polite"></p>
      </section>

      <section class="settings-section" aria-labelledby="account-title">
        <header class="settings-section__header">
          <h3 id="account-title">Dados de acesso</h3>
          <p>Atualize o e-mail e a senha usados para entrar no aplicativo.</p>
        </header>

        <form class="settings-account-form">
          <div class="settings-account-fields">
            <label class="settings-field" for="settings-account-email">
              E-mail de acesso
              <input
                id="settings-account-email"
                name="email"
                type="email"
                inputmode="email"
                autocomplete="username"
                required
              />
            </label>

            <label class="settings-field" for="settings-current-password">
              Senha atual
              <input
                id="settings-current-password"
                name="current-password"
                type="password"
                autocomplete="current-password"
                required
              />
            </label>

            <label class="settings-field" for="settings-new-password">
              Nova senha
              <input
                id="settings-new-password"
                name="new-password"
                type="password"
                minlength="8"
                autocomplete="new-password"
                placeholder="Mínimo de 8 caracteres"
              />
            </label>

            <label class="settings-field" for="settings-confirm-password">
              Confirmar nova senha
              <input
                id="settings-confirm-password"
                name="confirm-password"
                type="password"
                minlength="8"
                autocomplete="new-password"
              />
            </label>
          </div>

          <p class="settings-account-note">
            Deixe os campos de nova senha em branco para manter a senha atual.
            As alterações ficam salvas somente neste navegador.
          </p>

          <p
            class="settings-account-feedback"
            role="status"
            aria-live="polite"
            hidden
          ></p>

          <div class="settings-account-actions">
            <button class="settings-account-submit" type="submit">
              Salvar dados de acesso
            </button>
          </div>
        </form>
      </section>
    </section>
  `;

  const themeInput = getRequiredElement<HTMLInputElement>(
    container,
    '.theme-switch__input',
  );
  const themeStatus = getRequiredElement<HTMLElement>(
    container,
    '.theme-switch__status',
  );
  const feedback = getRequiredElement<HTMLElement>(
    container,
    '.settings-feedback',
  );
  const accountForm = getRequiredElement<HTMLFormElement>(
    container,
    '.settings-account-form',
  );
  const emailInput = getRequiredElement<HTMLInputElement>(
    container,
    '#settings-account-email',
  );
  const currentPasswordInput = getRequiredElement<HTMLInputElement>(
    container,
    '#settings-current-password',
  );
  const newPasswordInput = getRequiredElement<HTMLInputElement>(
    container,
    '#settings-new-password',
  );
  const confirmPasswordInput = getRequiredElement<HTMLInputElement>(
    container,
    '#settings-confirm-password',
  );
  const accountSubmitButton = getRequiredElement<HTMLButtonElement>(
    container,
    '.settings-account-submit',
  );
  const accountFeedback = getRequiredElement<HTMLElement>(
    container,
    '.settings-account-feedback',
  );

  const updateThemeControl = (isDark: boolean): void => {
    themeInput.checked = isDark;
    themeStatus.textContent = isDark ? 'Ativado' : 'Desativado';
  };

  updateThemeControl(getTheme() === 'dark');
  emailInput.value = getAccountEmail();

  themeInput.addEventListener('change', () => {
    const theme = themeInput.checked ? 'dark' : 'light';
    setTheme(theme);
    updateThemeControl(theme === 'dark');
    feedback.textContent = `Modo escuro ${
      theme === 'dark' ? 'ativado' : 'desativado'
    }.`;
  });

  const setAccountFeedback = (
    message: string,
    tone?: 'error' | 'success',
  ): void => {
    accountFeedback.hidden = message.length === 0;
    accountFeedback.textContent = message;
    accountFeedback.classList.toggle(
      'settings-account-feedback--error',
      tone === 'error',
    );
    accountFeedback.classList.toggle(
      'settings-account-feedback--success',
      tone === 'success',
    );
  };

  const clearPasswordConfirmationError = (): void => {
    confirmPasswordInput.setCustomValidity('');
  };

  newPasswordInput.addEventListener('input', clearPasswordConfirmationError);
  confirmPasswordInput.addEventListener(
    'input',
    clearPasswordConfirmationError,
  );

  accountForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearPasswordConfirmationError();

    if (newPasswordInput.value !== confirmPasswordInput.value) {
      confirmPasswordInput.setCustomValidity('As novas senhas não coincidem.');
    }

    if (!accountForm.reportValidity() || accountSubmitButton.disabled) return;

    accountSubmitButton.disabled = true;
    setAccountFeedback('Salvando novos dados de acesso...');

    try {
      const credentialsWereUpdated = await updateCredentials({
        email: emailInput.value,
        currentPassword: currentPasswordInput.value,
        newPassword: newPasswordInput.value || undefined,
      });

      if (!credentialsWereUpdated) {
        setAccountFeedback('A senha atual está incorreta.', 'error');
        currentPasswordInput.select();
        currentPasswordInput.focus();
        return;
      }

      emailInput.value = getAccountEmail();
      currentPasswordInput.value = '';
      newPasswordInput.value = '';
      confirmPasswordInput.value = '';
      setAccountFeedback(
        'Dados de acesso atualizados com sucesso.',
        'success',
      );
    } catch (error) {
      console.error('Não foi possível atualizar os dados de acesso.', error);
      setAccountFeedback(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar os dados de acesso.',
        'error',
      );
    } finally {
      if (accountSubmitButton.isConnected) {
        accountSubmitButton.disabled = false;
      }
    }
  });
}
