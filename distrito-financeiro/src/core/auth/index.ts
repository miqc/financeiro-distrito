const API_BASE_URL = String(import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const LEGACY_CREDENTIALS_KEY = 'distrito_auth_credentials';
const LEGACY_SESSION_KEY = 'distrito_is_logged_in';
const DEFAULT_ACCOUNT_EMAIL = 'admin@distrito.com';

interface SessionState {
  authenticated: boolean;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  profilePhoto: string;
  role: string;
}

interface SessionResponse {
  authenticated: boolean;
  user?: {
    id: number;
    name: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    profilePhoto?: string;
    email: string;
    role: string;
  };
}

interface AccountResponse {
  updated: boolean;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  profilePhoto: string;
}

interface ApiErrorResponse {
  error?: string;
}

export interface UpdateCredentialsInput {
  firstName: string;
  lastName: string;
  phone: string;
  profilePhoto: string;
  email: string;
  currentPassword: string;
  newPassword?: string;
}

export interface User {
  id: number;
  name: string;
  firstName: string;
  lastName: string;
  phone: string;
  profilePhoto: string;
  email: string;
  role: 'owner' | 'admin' | 'barber' | 'client';
  status: 'active' | 'inactive';
  createdAt: number;
}

export interface CreateUserInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: Exclude<User['role'], 'owner'>;
}

let sessionState: SessionState = {
  authenticated: false,
  email: '',
  firstName: '',
  lastName: '',
  phone: '',
  profilePhoto: '',
  role: 'client',
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
      email: session.user?.email ?? '',
      firstName: session.user?.firstName ?? session.user?.name.split(' ')[0] ?? '',
      lastName: session.user?.lastName ?? session.user?.name.split(' ').slice(1).join(' ') ?? '',
      phone: session.user?.phone ?? '',
      profilePhoto: session.user?.profilePhoto ?? '',
      role: session.user?.role ?? 'client',
    };
  } catch (error) {
    sessionState = {
      authenticated: false,
      email: '',
      firstName: '',
      lastName: '',
      phone: '',
      profilePhoto: '',
      role: 'client',
    };
    console.error('Não foi possível consultar a sessão no servidor.', error);
  }
}

export function getAccountEmail(): string {
  return sessionState.email;
}

export function getAccountName(): { firstName: string; lastName: string } {
  return { firstName: sessionState.firstName, lastName: sessionState.lastName };
}

export function getAccountProfile(): { phone: string; profilePhoto: string } {
  return { phone: sessionState.phone, profilePhoto: sessionState.profilePhoto };
}

export function getUserRole(): string {
  return sessionState.role;
}

export async function listUsers(): Promise<User[]> {
  const response = await fetch(apiUrl('/users'), {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Falha ao listar usuários: ${response.status}`);
  const payload = (await readJson<{ users: User[] }>(response));
  return payload.users;
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const response = await fetch(apiUrl('/users'), {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await readJson<ApiErrorResponse>(response).catch(
      () => ({} as ApiErrorResponse),
    );
    if (error.error === 'email_already_exists') throw new Error('Este e-mail já está cadastrado.');
    if (error.error === 'password_too_short') throw new Error('A senha deve ter pelo menos 8 caracteres.');
    throw new Error(`Falha ao criar usuário: ${response.status}`);
  }
  return (await readJson<{ user: User }>(response)).user;
}

export async function updateUserAccess(
  id: number,
  role: Exclude<User['role'], 'owner'>,
  status: User['status'],
): Promise<User> {
  const response = await fetch(apiUrl(`/users/${id}`), {
    method: 'PUT',
    credentials: 'include',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, status }),
  });
  if (!response.ok) throw new Error(`Falha ao atualizar usuário: ${response.status}`);
  return (await readJson<{ user: User }>(response)).user;
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
    email: session.user?.email ?? email.trim().toLowerCase(),
    firstName: session.user?.firstName ?? session.user?.name.split(' ')[0] ?? '',
    lastName: session.user?.lastName ?? session.user?.name.split(' ').slice(1).join(' ') ?? '',
    phone: session.user?.phone ?? '',
    profilePhoto: session.user?.profilePhoto ?? '',
    role: session.user?.role ?? 'client',
  };
  return sessionState.authenticated;
}

export async function register(input: Omit<CreateUserInput, 'role'>): Promise<void> {
  const response = await fetch(apiUrl('/auth/register'), {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await readJson<ApiErrorResponse>(response).catch(
      () => ({} as ApiErrorResponse),
    );
    if (error.error === 'email_already_exists') throw new Error('Este e-mail já está cadastrado.');
    if (error.error === 'password_too_short') throw new Error('A senha deve ter pelo menos 8 caracteres.');
    throw new Error(`Falha ao criar conta: ${response.status}`);
  }
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

    if (error.error === 'invalid_name') {
      throw new TypeError('Informe nome e sobrenome válidos.');
    }

    if (response.status === 401) sessionState.authenticated = false;
    throw new Error(`Falha ao atualizar a conta: ${response.status}`);
  }

  const account = await readJson<AccountResponse>(response);
  sessionState.email = account.email;
  sessionState.firstName = account.firstName;
  sessionState.lastName = account.lastName;
  sessionState.phone = account.phone;
  sessionState.profilePhoto = account.profilePhoto;
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
