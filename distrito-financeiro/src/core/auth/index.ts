import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';

const SESSION_KEY = 'distrito_is_logged_in';
const AUTHENTICATED_VALUE = 'true';
const CREDENTIALS_STORAGE_KEY = 'distrito_auth_credentials';
const PASSWORD_HASH_ITERATIONS = 210_000;
const SALT_BYTE_LENGTH = 16;

const DEFAULT_CREDENTIALS = Object.freeze({
  email: 'admin@distrito.com',
  password: 'admin',
});

interface StoredCredentials {
  version: 1;
  email: string;
  passwordHash: string;
  salt: string;
  iterations: number;
}

export interface UpdateCredentialsInput {
  email: string;
  currentPassword: string;
  newPassword?: string;
}

const textEncoder = new TextEncoder();

function getSessionStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch (error) {
    console.error('O armazenamento da sessão não está disponível.', error);
    return null;
  }
}

function getCredentialsStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch (error) {
    console.error('O armazenamento das credenciais não está disponível.', error);
    return null;
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isStoredCredentials(value: unknown): value is StoredCredentials {
  if (!value || typeof value !== 'object') return false;

  const credentials = value as Partial<StoredCredentials>;

  return (
    credentials.version === 1 &&
    typeof credentials.email === 'string' &&
    isValidEmail(credentials.email) &&
    typeof credentials.passwordHash === 'string' &&
    credentials.passwordHash.length > 0 &&
    typeof credentials.salt === 'string' &&
    credentials.salt.length > 0 &&
    Number.isInteger(credentials.iterations) &&
    (credentials.iterations ?? 0) > 0
  );
}

function readStoredCredentials(): StoredCredentials | undefined {
  const storage = getCredentialsStorage();

  if (!storage) return undefined;

  try {
    const serializedCredentials = storage.getItem(CREDENTIALS_STORAGE_KEY);

    if (!serializedCredentials) return undefined;

    const credentials: unknown = JSON.parse(serializedCredentials);

    if (!isStoredCredentials(credentials)) {
      console.error('Os dados locais de acesso estão em um formato inválido.');
      return undefined;
    }

    return credentials;
  } catch (error) {
    console.error('Não foi possível ler as credenciais locais.', error);
    return undefined;
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return window.btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function derivePasswordHash(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<string> {
  const derivedBytes = await pbkdf2Async(
    sha256,
    textEncoder.encode(password),
    salt,
    {
      c: iterations,
      dkLen: 32,
    },
  );

  return bytesToBase64(derivedBytes);
}

async function createStoredCredentials(
  email: string,
  password: string,
): Promise<StoredCredentials> {
  const salt = window.crypto.getRandomValues(
    new Uint8Array(SALT_BYTE_LENGTH),
  );
  const passwordHash = await derivePasswordHash(
    password,
    salt,
    PASSWORD_HASH_ITERATIONS,
  );

  return {
    version: 1,
    email: normalizeEmail(email),
    passwordHash,
    salt: bytesToBase64(salt),
    iterations: PASSWORD_HASH_ITERATIONS,
  };
}

function persistCredentials(credentials: StoredCredentials): void {
  const storage = getCredentialsStorage();

  if (!storage) {
    throw new Error('O armazenamento local não está disponível.');
  }

  storage.setItem(CREDENTIALS_STORAGE_KEY, JSON.stringify(credentials));
}

async function isPasswordValid(
  password: string,
  credentials?: StoredCredentials,
): Promise<boolean> {
  if (!credentials) return password === DEFAULT_CREDENTIALS.password;

  const passwordHash = await derivePasswordHash(
    password,
    base64ToBytes(credentials.salt),
    credentials.iterations,
  );

  if (passwordHash.length !== credentials.passwordHash.length) return false;

  let difference = 0;

  for (let index = 0; index < passwordHash.length; index += 1) {
    difference |=
      passwordHash.charCodeAt(index) ^
      credentials.passwordHash.charCodeAt(index);
  }

  return difference === 0;
}

function saveAuthenticatedSession(): boolean {
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

export function getAccountEmail(): string {
  return readStoredCredentials()?.email ?? DEFAULT_CREDENTIALS.email;
}

export async function login(email: string, password: string): Promise<boolean> {
  const normalizedEmail = normalizeEmail(email);
  const storedCredentials = readStoredCredentials();
  const expectedEmail =
    storedCredentials?.email ?? DEFAULT_CREDENTIALS.email;

  if (normalizedEmail !== expectedEmail) return false;

  const credentialsAreValid = await isPasswordValid(
    password,
    storedCredentials,
  );

  if (!credentialsAreValid) return false;

  if (!storedCredentials) {
    try {
      const initialCredentials = await createStoredCredentials(
        DEFAULT_CREDENTIALS.email,
        DEFAULT_CREDENTIALS.password,
      );
      persistCredentials(initialCredentials);
    } catch (error) {
      console.warn('Não foi possível proteger a credencial inicial.', error);
    }
  }

  return saveAuthenticatedSession();
}

export async function updateCredentials(
  input: UpdateCredentialsInput,
): Promise<boolean> {
  const normalizedEmail = normalizeEmail(input.email);

  if (!isValidEmail(normalizedEmail)) {
    throw new TypeError('Informe um e-mail válido.');
  }

  if (input.newPassword !== undefined && input.newPassword.length < 8) {
    throw new RangeError('A nova senha deve ter pelo menos 8 caracteres.');
  }

  const storedCredentials = readStoredCredentials();
  const currentPasswordIsValid = await isPasswordValid(
    input.currentPassword,
    storedCredentials,
  );

  if (!currentPasswordIsValid) return false;

  const nextPassword = input.newPassword ?? input.currentPassword;
  const nextCredentials = await createStoredCredentials(
    normalizedEmail,
    nextPassword,
  );
  persistCredentials(nextCredentials);

  return true;
}

export function logout(): void {
  const storage = getSessionStorage();

  if (!storage) return;

  try {
    storage.removeItem(SESSION_KEY);
  } catch (error) {
    console.error('Não foi possível encerrar a sessão de acesso.', error);
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
