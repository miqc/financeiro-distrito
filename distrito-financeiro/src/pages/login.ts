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
    display: grid;
    min-width: 0;
    align-content: center;
    gap: 1.75rem;
    padding: clamp(2rem, 5vw, 3.5rem);
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
          <p class="login-page__eyebrow">Distrito Financeiro</p>
          <h2>Painel de Finanças do Distrito</h2>
          <p>Acompanhe atendimentos, despesas e resultados em um só lugar.</p>
        </div>

        <img
          class="login-page__illustration"
          src="/src/assets/finance-cuate.svg"
          alt=""
          width="500"
          height="500"
        />
      </div>

      <div class="login-page__access">
        <header class="login-page__header">
          <img
            class="login-page__logo"
            src="/src/assets/barbearia-distrito-logo.jpg"
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
              placeholder="seu@email.com"
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
              placeholder="Digite sua senha"
              required
            />
          </label>

          <p class="login-error" role="alert" hidden></p>

          <button class="login-submit" type="submit">Entrar no sistema</button>
        </form>
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
