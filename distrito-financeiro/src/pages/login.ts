import { login, register } from '../core/auth';
import { initializeDataStore } from '../core/database/operations';
import financeIllustrationUrl from '../assets/finance-cuate.svg';
import districtLogoUrl from '../assets/barbearia-distrito-logo.jpg';

const LOGIN_STYLE_ID = 'login-page-styles';

const loginStyles = `
  body.auth-screen .app-workspace {
    min-height: 100vh;
    min-height: 100dvh;
    padding-bottom: 0;
  }

  body.auth-screen .app-content {
    display: grid;
    width: 100%;
    min-height: 100vh;
    min-height: 100dvh;
    padding: clamp(1rem, 4vw, 2rem);
    place-items: center;
  }

  .login-page {
    display: grid;
    grid-template-columns: minmax(0, 1.08fr) minmax(22rem, 0.92fr);
    width: min(100%, 68rem);
    min-height: min(42rem, calc(100dvh - 4rem));
    overflow: hidden;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 1.25rem;
    box-shadow: var(--shadow-dialog);
  }

  .login-screen {
    display: grid;
    width: min(100%, 68rem);
    justify-items: center;
  }

  .login-page [hidden] {
    display: none !important;
  }

  .login-page__credit {
    position: fixed;
    bottom: max(0.5rem, env(safe-area-inset-bottom));
    left: 50%;
    z-index: 2;
    color: var(--color-text-muted);
    font-size: 0.625rem;
    letter-spacing: 0.03em;
    opacity: 0.7;
    transform: translateX(-50%);
    white-space: nowrap;
  }

  .login-page__visual {
    display: grid;
    min-width: 0;
    align-content: space-between;
    gap: 1.5rem;
    padding: clamp(2rem, 5vw, 3.5rem);
    overflow: hidden;
    background: var(--color-background);
    border-right: 1px solid var(--color-border);
  }

  .login-page__visual-copy {
    display: grid;
    max-width: 28rem;
    gap: 0.625rem;
  }

  .login-page__eyebrow {
    color: var(--color-text-muted);
    font-size: 0.75rem;
    font-weight: 750;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .login-page__visual-copy h2 {
    font-size: clamp(1.75rem, 4vw, 2.75rem);
    letter-spacing: -0.04em;
    line-height: 1.08;
  }

  .login-page__visual-copy p:last-child {
    color: var(--color-text-muted);
    font-size: 0.9375rem;
  }

  .login-page__illustration {
    display: block;
    width: min(100%, 29rem);
    max-height: 27rem;
    justify-self: center;
    object-fit: contain;
  }

  .login-page__access {
    position: relative;
    display: grid;
    min-width: 0;
    align-content: center;
    gap: 1.75rem;
    padding: clamp(2rem, 5vw, 3.5rem);
  }

  .login-page__copyright {
    position: absolute;
    right: 1.5rem;
    bottom: 1.25rem;
    left: 1.5rem;
    color: var(--color-text-muted);
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    opacity: 0.65;
    text-align: center;
  }

  .login-page__header {
    display: grid;
    justify-items: start;
    gap: 0.625rem;
  }

  .login-page__logo {
    width: 4rem;
    height: 4rem;
    margin-bottom: 0.5rem;
    object-fit: cover;
    background: #090909;
    border: 1px solid var(--color-border);
    border-radius: 0.875rem;
    box-shadow: var(--shadow-surface);
    animation: app-pop-enter var(--motion-duration-slow)
      var(--motion-ease-emphasized) 60ms backwards;
  }

  .login-page__header h1 {
    font-size: clamp(1.625rem, 4vw, 2rem);
    letter-spacing: -0.025em;
    line-height: 1.2;
  }

  .login-page__header p {
    color: var(--color-text-muted);
    font-size: 0.9375rem;
  }

  .login-form {
    display: grid;
    gap: 1rem;
  }

  .login-field {
    display: grid;
    gap: 0.375rem;
    font-size: 0.875rem;
    font-weight: 700;
  }

  .login-field input {
    width: 100%;
    min-height: 3rem;
    padding: 0.6875rem 0.875rem;
    background: var(--color-background);
    border: 1px solid var(--color-input-border);
    border-radius: var(--radius-small);
  }

  .login-field input:hover {
    border-color: var(--color-primary);
  }

  .login-field input:focus {
    border-color: var(--color-primary-strong);
    box-shadow: 0 0 0 0.1875rem var(--color-primary-soft);
    outline: 0;
  }

  .login-field input:focus-visible {
    outline: 0;
  }

  .login-password-control {
    position: relative;
    display: grid;
    min-width: 0;
  }

  .login-password-control input {
    padding-right: 3.25rem;
  }

  .login-password-toggle {
    position: absolute;
    top: 50%;
    right: 0.375rem;
    display: grid;
    width: 2.25rem;
    min-height: 2.25rem;
    padding: 0;
    place-items: center;
    color: var(--color-text-muted);
    background: transparent;
    border: 0;
    border-radius: 0.375rem;
    cursor: pointer;
    transform: translateY(-50%);
  }

  .login-password-toggle:hover {
    color: var(--color-text);
    background: var(--color-surface-muted);
  }

  .login-password-toggle:active:not(:disabled) {
    transform: translateY(-50%) scale(0.96);
  }

  .login-password-toggle svg {
    width: 1.125rem;
    height: 1.125rem;
  }

  .login-password-toggle[aria-pressed="false"] .login-password-icon--hide,
  .login-password-toggle[aria-pressed="true"] .login-password-icon--show {
    display: none;
  }

  .login-submit {
    min-height: 3rem;
    margin-top: 0.25rem;
    padding: 0.75rem 1rem;
    color: var(--color-on-action);
    background: var(--color-action);
    border: 0;
    border-radius: var(--radius-small);
    cursor: pointer;
    font-weight: 800;
  }

  .login-submit:hover:not(:disabled) {
    background: var(--color-action-hover);
  }

  .login-submit:disabled {
    cursor: wait;
    opacity: 0.65;
  }

  .login-signup-link,
  .login-signin-link {
    width: 100%;
    min-height: 3rem;
    padding: 0.75rem 1rem;
    color: #ffffff;
    background: #0f1113;
    border: 0;
    border-radius: var(--radius-small);
    cursor: pointer;
    font-weight: 800;
  }

  .login-signup-link:hover,
  .login-signin-link:hover {
    background: #181b1e;
  }

  .login-signup-link:focus-visible,
  .login-signin-link:focus-visible {
    box-shadow: 0 0 0 0.1875rem var(--color-primary-soft);
    outline: 0;
  }

  .login-error {
    padding: 0.75rem;
    color: var(--color-danger);
    background: var(--color-danger-soft);
    border: 1px solid var(--color-danger-border);
    border-radius: var(--radius-small);
    font-size: 0.875rem;
  }

  .login-error:not([hidden]) {
    animation: app-item-enter var(--motion-duration-normal)
      var(--motion-ease-emphasized) backwards;
  }

  .login-error--success {
    color: var(--color-success-strong);
    background: var(--color-success-soft);
    border-color: var(--color-success);
  }

  @media (hover: hover) and (pointer: fine) {
    .login-submit:hover:not(:disabled) {
      transform: translateY(-0.0625rem);
    }
  }

  @media (max-width: 48rem) {
    body.auth-screen .app-content {
      align-items: start;
    }

    .login-page {
      grid-template-columns: minmax(0, 1fr);
      width: min(100%, 31rem);
      min-height: 0;
    }

    .login-screen {
      width: min(100%, 31rem);
      gap: 0.625rem;
    }

    .login-page__credit {
      position: static;
      padding-bottom: max(0.25rem, env(safe-area-inset-bottom));
      transform: none;
    }

    .login-page__visual {
      grid-template-columns: minmax(0, 1fr) minmax(8rem, 0.6fr);
      align-items: center;
      gap: 1rem;
      padding: 1.5rem;
      border-right: 0;
      border-bottom: 1px solid var(--color-border);
    }

    .login-page__visual-copy h2 {
      font-size: clamp(1.375rem, 7vw, 1.75rem);
    }

    .login-page__visual-copy p:last-child {
      display: none;
    }

    .login-page__illustration {
      width: 9rem;
      max-height: 9rem;
    }

    .login-page__access {
      gap: 1.5rem;
      padding: clamp(1.5rem, 7vw, 2rem);
    }

    .login-page__copyright {
      position: static;
      margin-top: 0.25rem;
    }
  }

  @media (max-width: 23rem) {
    .login-page__visual {
      grid-template-columns: minmax(0, 1fr) 6.5rem;
      padding: 1.25rem;
    }

    .login-page__illustration {
      width: 6.5rem;
      max-height: 6.5rem;
    }
  }
`;

function ensureLoginStyles(): void {
  if (document.querySelector(`#${LOGIN_STYLE_ID}`)) return;

  const style = document.createElement('style');
  style.id = LOGIN_STYLE_ID;
  style.textContent = loginStyles;
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

export function renderLogin(container: HTMLElement): void {
  ensureLoginStyles();

  container.innerHTML = `
    <div class="login-screen">
      <section class="login-page" aria-labelledby="login-title">
      <div class="login-page__visual" aria-hidden="true">
        <div class="login-page__visual-copy">
          <p class="login-page__eyebrow">Barbearia Distrito</p>
          <h2>Painel do Distrito</h2>
          <p>Acompanhe e agende atendimentos em um só lugar.</p>
        </div>

        <img
          class="login-page__illustration"
          src="${financeIllustrationUrl}"
          alt=""
          width="500"
          height="500"
        />
      </div>

      <div class="login-page__access">
        <header class="login-page__header">
          <img
            class="login-page__logo"
            src="${districtLogoUrl}"
            alt="Barbearia Distrito"
            width="150"
            height="150"
          />
          <h1 id="login-title">Bem-vindo de volta!</h1>
          <p>Entre com seus dados para acessar o painel.</p>
        </header>

        <form class="login-form">
          <label class="login-field" for="login-email">
            E-mail
            <input
              id="login-email"
              name="email"
              type="email"
              autocomplete="username"
              inputmode="email"
              placeholder="Digite seu email"
              required
            />
          </label>

          <label class="login-field" for="login-password">
            Senha
            <span class="login-password-control">
              <input
                id="login-password"
                name="password"
                type="password"
                autocomplete="current-password"
                placeholder="Digite sua senha"
                required
              />
              <button
                class="login-password-toggle"
                type="button"
                aria-label="Mostrar senha"
                aria-pressed="false"
              >
                <svg
                  class="login-password-icon--show"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <svg
                  class="login-password-icon--hide"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="m3 3 18 18" />
                  <path d="M10.6 5.2A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a16 16 0 0 1-2.1 3.1" />
                  <path d="M6.6 6.7C3.6 8.7 2 12 2 12s3.5 7 10 7a9.8 9.8 0 0 0 4.1-.9" />
                  <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                </svg>
              </button>
            </span>
          </label>

          <p class="login-error" role="alert" hidden></p>

          <button class="login-submit" type="submit">Entrar</button>
        </form>

        <button class="login-signup-link" type="button">Criar conta</button>
        <form class="login-form login-register-form" hidden>
          <label class="login-field" for="register-first-name">Nome
            <input id="register-first-name" name="firstName" autocomplete="given-name" required minlength="2" placeholder="Digite seu nome" />
          </label>
          <label class="login-field" for="register-last-name">Sobrenome
            <input id="register-last-name" name="lastName" autocomplete="family-name" required minlength="2" placeholder="Digite seu sobrenome" />
          </label>
          <label class="login-field" for="register-email">E-mail
            <input id="register-email" name="email" type="email" autocomplete="email" required placeholder="Digite seu email" />
          </label>
          <label class="login-field" for="register-password">Senha
            <input id="register-password" name="password" type="password" autocomplete="new-password" minlength="8" required placeholder="Mínimo de 8 caracteres" />
          </label>
          <p class="login-register-feedback" role="alert" hidden></p>
          <button class="login-submit" type="submit">Criar minha conta</button>
        </form>
        <button class="login-signin-link" type="button" hidden>Já tenho uma conta</button>

        <p class="login-page__copyright">Distrito Barbearia © 2026</p>
      </div>

      </section>

    </div>
  `;

  const form = getRequiredElement<HTMLFormElement>(container, '.login-form');
  const emailInput = getRequiredElement<HTMLInputElement>(
    container,
    '#login-email',
  );
  const passwordInput = getRequiredElement<HTMLInputElement>(
    container,
    '#login-password',
  );
  const passwordToggle = getRequiredElement<HTMLButtonElement>(
    container,
    '.login-password-toggle',
  );
  const errorMessage = getRequiredElement<HTMLElement>(
    container,
    '.login-error',
  );
  const submitButton = getRequiredElement<HTMLButtonElement>(
    container,
    '.login-submit',
  );
  const signupLink = getRequiredElement<HTMLButtonElement>(container, '.login-signup-link');
  const signinLink = getRequiredElement<HTMLButtonElement>(container, '.login-signin-link');
  const registerForm = getRequiredElement<HTMLFormElement>(container, '.login-register-form');
  const registerFeedback = getRequiredElement<HTMLElement>(container, '.login-register-feedback');

  const showRegister = (isRegistering: boolean): void => {
    form.hidden = isRegistering;
    registerForm.hidden = !isRegistering;
    signupLink.hidden = isRegistering;
    signinLink.hidden = !isRegistering;
    errorMessage.hidden = true;
    errorMessage.classList.remove('login-error--success');
    (isRegistering ? registerForm : form).querySelector<HTMLInputElement>('input')?.focus();
  };

  signupLink.addEventListener('click', () => showRegister(true));
  signinLink.addEventListener('click', () => showRegister(false));

  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!registerForm.reportValidity()) return;
    const data = new FormData(registerForm);
    const button = registerForm.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (button) button.disabled = true;
    registerFeedback.hidden = true;
    try {
      await register({
        firstName: String(data.get('firstName') ?? ''),
        lastName: String(data.get('lastName') ?? ''),
        email: String(data.get('email') ?? ''),
        password: String(data.get('password') ?? ''),
      });
      registerForm.reset();
      showRegister(false);
      errorMessage.textContent = 'Conta criada. Agora entre com seu e-mail e senha.';
      errorMessage.classList.add('login-error--success');
      errorMessage.hidden = false;
    } catch (error) {
      registerFeedback.textContent = error instanceof Error ? error.message : 'Não foi possível criar sua conta.';
      registerFeedback.hidden = false;
    } finally {
      if (button) button.disabled = false;
    }
  });

  passwordToggle.addEventListener('click', () => {
    const passwordIsVisible = passwordInput.type === 'text';
    passwordInput.type = passwordIsVisible ? 'password' : 'text';
    passwordToggle.setAttribute('aria-pressed', String(!passwordIsVisible));
    passwordToggle.setAttribute(
      'aria-label',
      passwordIsVisible ? 'Mostrar senha' : 'Ocultar senha',
    );
    passwordInput.focus({ preventScroll: true });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!form.reportValidity() || submitButton.disabled) return;

    submitButton.disabled = true;
    errorMessage.hidden = true;
    errorMessage.classList.remove('login-error--success');

    try {
      const authenticated = await login(
        emailInput.value,
        passwordInput.value,
      );

      if (authenticated) {
        try {
          await initializeDataStore();
        } catch (error) {
          console.error(
            'Não foi possível migrar os dados locais para o servidor.',
            error,
          );
        }

        window.location.hash = '#dashboard';
        return;
      }

      errorMessage.textContent = 'E-mail ou senha inválidos.';
      errorMessage.hidden = false;
      passwordInput.select();
      passwordInput.focus();
    } catch (error) {
      console.error('Não foi possível validar os dados de acesso.', error);
      errorMessage.textContent =
        'Não foi possível entrar agora. Tente novamente.';
      errorMessage.hidden = false;
    } finally {
      if (submitButton.isConnected) submitButton.disabled = false;
    }
  });

  queueMicrotask(() => emailInput.focus());
}
