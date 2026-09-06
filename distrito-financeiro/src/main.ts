import { getAccountEmail, getAccountName, getAccountProfile, getUserRole, initializeAuth, isAuthenticated, logout } from './core/auth';
import { initializeDataStore } from './core/database/operations';
import { initializeTheme } from './core/theme';
import { showConfirmDialog } from './components/confirm-dialog';
import { initializeFormValidation } from './components/form-validation';
import { renderCatalogPage } from './pages/catalog';
import { renderDashboard } from './pages/dashboard';
import { renderEntries } from './pages/entries';
import { renderExpensesPage } from './pages/expenses';
import { renderLogin } from './pages/login';
import { renderSettingsPage } from './pages/settings';
import { renderUsersPage } from './pages/users';
import { openProfileModal } from './components/profile-modal';
import './styles/layout.css';

initializeTheme();
initializeFormValidation();

const ROUTES = {
  login: {
    navigationLabel: 'Entrar',
    pageTitle: 'Acesso',
  },
  dashboard: {
    navigationLabel: 'Dashboard',
    pageTitle: 'Página de Resumo',
  },
  entries: {
    navigationLabel: 'Lançamentos',
    pageTitle: 'Lançamentos',
  },
  expenses: {
    navigationLabel: 'Despesas',
    pageTitle: 'Despesas',
  },
  catalog: {
    navigationLabel: 'Catálogo',
    pageTitle: 'Catálogo',
  },
  settings: {
    navigationLabel: 'Configurações',
    pageTitle: 'Configurações',
  },
  users: {
    navigationLabel: 'Usuários',
    pageTitle: 'Usuários',
  },
} as const;

type RouteName = keyof typeof ROUTES;

const appContentElement = document.querySelector<HTMLElement>('#app-content');
const appNavigationElement =
  document.querySelector<HTMLElement>('.app-navigation');
const navigationLinks = Array.from(
  document.querySelectorAll<HTMLAnchorElement>('[data-route]'),
);
const logoutButton = document.querySelector<HTMLButtonElement>(
  '[data-action="logout"]',
);
const profileMenuButton = document.querySelector<HTMLButtonElement>('[data-action="profile-menu"]');
const profileMenuOptions = document.querySelector<HTMLElement>('#profile-menu-options');
const openProfileButton = document.querySelector<HTMLButtonElement>('[data-action="open-profile"]');
const mobileNavigationToggle = document.querySelector<HTMLButtonElement>('[data-action="toggle-mobile-navigation"]');
const mobileNavigationBackdrop = document.querySelector<HTMLButtonElement>('[data-action="close-mobile-navigation"]');
const userNameElement = document.querySelector<HTMLElement>('[data-user-name]');
const userEmailElement = document.querySelector<HTMLElement>('[data-user-email]');
const userAvatarElement = document.querySelector<HTMLElement>('[data-user-avatar]');

async function confirmLogout(): Promise<void> {
  const confirmed = await showConfirmDialog(
    'Sair do sistema',
    'Tem certeza que deseja encerrar sua sessão?',
    'Sair',
  );
  if (!confirmed) return;
  await logout();
  window.location.hash = '#login';
}

function updateSidebarProfile(): void {
  const accountName = getAccountName();
  const accountProfile = getAccountProfile();
  const fullName = `${accountName.firstName} ${accountName.lastName}`.trim() || 'Usuário';
  if (userNameElement) userNameElement.textContent = fullName;
  if (userEmailElement) userEmailElement.textContent = getAccountEmail();
  if (userAvatarElement) {
    userAvatarElement.textContent = accountProfile.profilePhoto ? '' : fullName.charAt(0).toUpperCase();
    userAvatarElement.style.backgroundImage = accountProfile.profilePhoto ? `url("${accountProfile.profilePhoto}")` : '';
  }
}

if (!appContentElement) {
  throw new Error('A área principal da aplicação não foi encontrada.');
}

if (!appNavigationElement) {
  throw new Error('A estrutura de navegação da aplicação não foi encontrada.');
}

const appContent = appContentElement;
const appNavigation = appNavigationElement;

function hasAdministrativeAccess(): boolean {
  return isAuthenticated() && ['owner', 'admin'].includes(getUserRole());
}

function synchronizeSessionInterface(): void {
  updateSidebarProfile();
  const canAccessAdministration = hasAdministrativeAccess();
  for (const link of navigationLinks) {
    link.hidden = !canAccessAdministration;
  }
}

function renderClientAccessPage(container: HTMLElement): void {
  container.innerHTML = `
    <section class="client-access-page">
      <p class="client-access-page__eyebrow">Conta criada</p>
      <h1>Seu acesso está em preparação</h1>
      <p>Quando os recursos para clientes estiverem disponíveis, eles aparecerão aqui.</p>
    </section>
  `;
}

function isRouteName(value: string): value is RouteName {
  return Object.hasOwn(ROUTES, value);
}

function getRouteFromLocation(): RouteName {
  const route = window.location.hash.slice(1);
  return isRouteName(route) ? route : 'dashboard';
}

function getAllowedRoute(route: RouteName): RouteName {
  const authenticated = isAuthenticated();

  if (!authenticated && route !== 'login') return 'login';
  if (authenticated && route === 'login') return 'dashboard';

  return route;
}

function setLoginLayout(isLoginRoute: boolean): void {
  appNavigation.hidden = isLoginRoute;
  document.body.classList.remove('mobile-navigation-open');
  if (mobileNavigationBackdrop) mobileNavigationBackdrop.hidden = true;
  mobileNavigationToggle?.setAttribute('aria-expanded', 'false');
  document.body.classList.toggle('auth-screen', isLoginRoute);
}

function setMobileNavigationOpen(isOpen: boolean): void {
  document.body.classList.toggle('mobile-navigation-open', isOpen);
  if (mobileNavigationBackdrop) mobileNavigationBackdrop.hidden = !isOpen;
  mobileNavigationToggle?.setAttribute('aria-expanded', String(isOpen));
}

function renderRoute(requestedRoute: RouteName, moveFocus = false): void {
  const route = getAllowedRoute(requestedRoute);
  const showClientAccessPage = route !== 'login' && !hasAdministrativeAccess();

  if (route !== requestedRoute) {
    window.history.replaceState({ route }, '', `#${route}`);
  }

  synchronizeSessionInterface();
  setLoginLayout(route === 'login');

  if (route === 'login') {
    renderLogin(appContent);
  } else if (showClientAccessPage) {
    renderClientAccessPage(appContent);
  } else if (route === 'dashboard') {
    void renderDashboard(appContent);
  } else if (route === 'entries') {
    void renderEntries(appContent);
  } else if (route === 'expenses') {
    void renderExpensesPage(appContent);
  } else if (route === 'catalog') {
    void renderCatalogPage(appContent);
  } else if (route === 'settings') {
    renderSettingsPage(appContent);
  } else if (route === 'users') {
    void renderUsersPage(appContent);
  }

  for (const link of navigationLinks) {
    const isCurrentRoute = !showClientAccessPage && link.dataset.route === route;

    if (isCurrentRoute) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  }

  document.title = showClientAccessPage ? 'Minha conta' : ROUTES[route].navigationLabel;

  if (moveFocus) {
    appContent.focus({ preventScroll: true });
  }
}

function navigateTo(route: RouteName): void {
  const nextHash = `#${route}`;

  if (window.location.hash !== nextHash) {
    window.history.pushState({ route }, '', nextHash);
  }

  renderRoute(route, true);
}

function initializeRouter(): void {
  for (const link of navigationLinks) {
    link.addEventListener('click', (event) => {
      const route = link.dataset.route;

      if (!route || !isRouteName(route)) return;

      event.preventDefault();
      setMobileNavigationOpen(false);
      navigateTo(route);
    });
  }

  profileMenuButton?.addEventListener('click', () => {
    const isOpen = !profileMenuOptions?.hidden;
    if (profileMenuOptions) profileMenuOptions.hidden = isOpen;
    profileMenuButton.setAttribute('aria-expanded', String(!isOpen));
  });
  openProfileButton?.addEventListener('click', () => {
    if (profileMenuOptions) profileMenuOptions.hidden = true;
    profileMenuButton?.setAttribute('aria-expanded', 'false');
    openProfileModal();
  });
  logoutButton?.addEventListener('click', () => {
    if (profileMenuOptions) profileMenuOptions.hidden = true;
    profileMenuButton?.setAttribute('aria-expanded', 'false');
    void confirmLogout();
  });
  mobileNavigationToggle?.addEventListener('click', () => {
    setMobileNavigationOpen(!document.body.classList.contains('mobile-navigation-open'));
  });
  mobileNavigationBackdrop?.addEventListener('click', () => setMobileNavigationOpen(false));
  window.addEventListener('distrito:profile-logout', () => void confirmLogout());
  /*
  logoutButton?.addEventListener('click', async () => {
    const confirmed = await showConfirmDialog(
      'Sair do sistema',
      'Tem certeza que deseja encerrar sua sessão?',
      'Sair',
    );

    if (!confirmed) return;

    await logout();
    window.location.hash = '#login';
  }); */

  window.addEventListener('hashchange', () => {
    renderRoute(getRouteFromLocation());
  });

  const initialRoute = getRouteFromLocation();

  if (!isRouteName(window.location.hash.slice(1))) {
    window.history.replaceState({ route: initialRoute }, '', `#${initialRoute}`);
  }

  renderRoute(initialRoute);
}

async function initializeDatabase(): Promise<void> {
  try {
    await initializeDataStore();
  } catch (error) {
    console.error(
      'Não foi possível preparar os dados no banco central.',
      error,
    );
  }
}

async function bootstrap(): Promise<void> {
  await initializeAuth();
  synchronizeSessionInterface();
  window.addEventListener('distrito:profile-updated', updateSidebarProfile);
  if (isAuthenticated()) await initializeDatabase();
  initializeRouter();
}

let authenticationRedirectInProgress = false;

window.addEventListener('distrito:authentication-required', () => {
  if (authenticationRedirectInProgress) return;
  authenticationRedirectInProgress = true;

  void logout().finally(() => {
    window.location.hash = '#login';
    authenticationRedirectInProgress = false;
  });
});

void bootstrap();
