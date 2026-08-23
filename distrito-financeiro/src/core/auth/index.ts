const API_BASE_URL = String(import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const LEGACY_CREDENTIALS_KEY = 'distrito_auth_credentials';
const LEGACY_SESSION_KEY = 'distrito_is_logged_in';
const DEFAULT_ACCOUNT_EMAIL = 'admin@distrito.com';

interface SessionState {
  authenticated: boolean;
  email: string;
}

interface SessionResponse {
  authenticated: boolean;
  email?: string;
}

interface AccountResponse {
  updated: boolean;
  email: string;
}

interface ApiErrorResponse {
  error?: string;
}

export interface UpdateCredentialsInput {
  email: string;
  currentPassword: string;
  newPassword?: string;
}

let sessionState: SessionState = {
  authenticated: false,
  email: DEFAULT_ACCOUNT_EMAIL,
};

function apiUrl(path: string): string {
  return `${API_BASE_URL}/api${path}`;
}

function clearLegacyAuthentication(): void {
  try {
    window.localStorage.removeItem(LEGACY_CREDENTIALS_KEY);
    window.sessionStorage.removeItem(LEGACY_SESSION_KEY);
  } catch (error) {
    console.warn('Não foi possível remover os dados de acesso antigos.', error);
  }
}

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export async function initializeAuth(): Promise<void> {
  clearLegacyAuthentication();

  try {
    const response = await fetch(apiUrl('/auth/session'), {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Falha ao consultar sessão: ${response.status}`);
    }

    const session = await readJson<SessionResponse>(response);
    sessionState = {
      authenticated: session.authenticated,
      email: session.email ?? DEFAULT_ACCOUNT_EMAIL,
    };
  } catch (error) {
    sessionState = {
      authenticated: false,
      email: DEFAULT_ACCOUNT_EMAIL,
    };
    console.error('Não foi possível consultar a sessão no servidor.', error);
  }
}

export function getAccountEmail(): string {
  return sessionState.email;
}

export async function login(email: string, password: string): Promise<boolean> {
  const response = await fetch(apiUrl('/auth/login'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  if (response.status === 401) return false;
  if (!response.ok) throw new Error(`Falha ao autenticar: ${response.status}`);

  const session = await readJson<SessionResponse>(response);
  sessionState = {
    authenticated: session.authenticated,
    email: session.email ?? email.trim().toLowerCase(),
  };
  return sessionState.authenticated;
}

export async function updateCredentials(
  input: UpdateCredentialsInput,
): Promise<boolean> {
  const response = await fetch(apiUrl('/account'), {
    method: 'PUT',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (response.status === 403) return false;

  if (!response.ok) {
    const error: ApiErrorResponse = await readJson<ApiErrorResponse>(
      response,
    ).catch(() => ({}));

    if (error.error === 'invalid_email') {
      throw new TypeError('Informe um e-mail válido.');
    }

    if (error.error === 'password_too_short') {
      throw new RangeError('A nova senha deve ter pelo menos 8 caracteres.');
    }

    if (response.status === 401) sessionState.authenticated = false;
    throw new Error(`Falha ao atualizar a conta: ${response.status}`);
  }

  const account = await readJson<AccountResponse>(response);
  sessionState.email = account.email;
  return account.updated;
}

export async function logout(): Promise<void> {
  try {
    await fetch(apiUrl('/auth/logout'), {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
  } catch (error) {
    console.error('Não foi possível encerrar a sessão no servidor.', error);
  } finally {
    sessionState.authenticated = false;
  }
}

export function isAuthenticated(): boolean {
  return sessionState.authenticated;
}
