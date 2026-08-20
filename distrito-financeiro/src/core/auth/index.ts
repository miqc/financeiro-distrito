const SESSION_KEY = 'distrito_is_logged_in';
const AUTHENTICATED_VALUE = 'true';

export const DEVELOPMENT_CREDENTIALS = Object.freeze({
  email: 'admin@distrito.com',
  password: 'admin',
});

function getSessionStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch (error) {
    console.error('O armazenamento da sessão não está disponível.', error);
    return null;
  }
}

export function login(email: string, password: string): boolean {
  const normalizedEmail = email.trim().toLowerCase();
  const credentialsAreValid =
    normalizedEmail === DEVELOPMENT_CREDENTIALS.email &&
    password === DEVELOPMENT_CREDENTIALS.password;

  if (!credentialsAreValid) return false;

  const storage = getSessionStorage();

  if (!storage) return false;

  try {
    storage.setItem(SESSION_KEY, AUTHENTICATED_VALUE);
    return true;
  } catch (error) {
    console.error('Não foi possível salvar a sessão de acesso.', error);
    return false;
  }
}

export function logout(): void {
  const storage = getSessionStorage();

  if (!storage) return;

  try {
    storage.removeItem(SESSION_KEY);
  } catch (error) {
    console.error('Não foi possível encerrar a sessão.', error);
  }
}

export function isAuthenticated(): boolean {
  const storage = getSessionStorage();

  if (!storage) return false;

  try {
    return storage.getItem(SESSION_KEY) === AUTHENTICATED_VALUE;
  } catch (error) {
    console.error('Não foi possível verificar a sessão de acesso.', error);
    return false;
  }
}

