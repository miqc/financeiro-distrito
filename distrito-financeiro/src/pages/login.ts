import { login } from '../core/auth';

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
    padding: clamp(1rem, 5vw, 2rem);
    place-items: center;
  }

  .login-page {
    display: grid;
    width: min(100%, 27rem);
    gap: 1.5rem;
    padding: clamp(1.5rem, 6vw, 2.25rem);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-medium);
    box-shadow: var(--shadow-surface);
  }

  .login-page [hidden] {
    display: none !important;
  }

  .login-page__header {
    display: grid;
    justify-items: center;
    gap: 0.5rem;
    text-align: center;
  }

  .login-page__logo {
    width: 5rem;
    height: 5rem;
    margin-bottom: 0.25rem;
    object-fit: cover;
    background: #090909;
    border: 1px solid var(--color-border);
    border-radius: 0.875rem;
    box-shadow: var(--shadow-surface);
    animation: app-pop-enter var(--motion-duration-slow)
      var(--motion-ease-emphasized) 60ms backwards;
  }

  .login-page__header h1 {
    font-size: clamp(1.5rem, 6vw, 2rem);
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
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-small);
  }

  .login-field input:hover {
    border-color: var(--color-primary);
  }

  .login-field input:focus {
    border-color: var(--color-primary-strong);
    box-shadow: 0 0 0 0.1875rem var(--color-primary-soft);
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

  @media (hover: hover) and (pointer: fine) {
    .login-submit:hover:not(:disabled) {
      transform: translateY(-0.0625rem);
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
    <section class="login-page" aria-labelledby="login-title">
      <header class="login-page__header">
        <img
          class="login-page__logo"
          src="/src/assets/barbearia-distrito-logo.jpg"
          alt="Barbearia Distrito"
          width="150"
          height="150"
        />
        <h1 id="login-title">Acessar o Distrito</h1>
        <p>Entre para acessar o controle financeiro.</p>
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
            required
          />
        </label>

        <label class="login-field" for="login-password">
          Senha
          <input
            id="login-password"
            name="password"
            type="password"
            autocomplete="current-password"
            required
          />
        </label>

        <p class="login-error" role="alert" hidden></p>

        <button class="login-submit" type="submit">Entrar</button>
      </form>
    </section>
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
  const errorMessage = getRequiredElement<HTMLElement>(
    container,
    '.login-error',
  );
  const submitButton = getRequiredElement<HTMLButtonElement>(
    container,
    '.login-submit',
  );

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!form.reportValidity() || submitButton.disabled) return;

    submitButton.disabled = true;
    errorMessage.hidden = true;

    try {
      const authenticated = await login(
        emailInput.value,
        passwordInput.value,
      );

      if (authenticated) {
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
