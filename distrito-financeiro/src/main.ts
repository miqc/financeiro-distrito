import { isAuthenticated, logout } from './core/auth';
import { initDB } from './core/database';
import { renderCatalogPage } from './pages/catalog';
import { renderDashboard } from './pages/dashboard';
import { renderEntries } from './pages/entries';
import { renderLogin } from './pages/login';
import './styles/layout.css';

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
  catalog: {
    navigationLabel: 'Catálogo',
    pageTitle: 'Catálogo',
  },
} as const;

type RouteName = keyof typeof ROUTES;

const appContentElement = document.querySelector<HTMLElement>('#app-content');
const appNavigationElement =
  document.querySelector<HTMLElement>('.app-navigation');
const appHeaderElement = document.querySelector<HTMLElement>('.app-header');
const navigationLinks = Array.from(
  document.querySelectorAll<HTMLAnchorElement>('[data-route]'),
);
const logoutButton = document.querySelector<HTMLButtonElement>(
  '[data-action="logout"]',
);

if (!appContentElement) {
  throw new Error('A área principal da aplicação não foi encontrada.');
}

if (!appNavigationElement || !appHeaderElement) {
  throw new Error('A estrutura de navegação da aplicação não foi encontrada.');
}

const appContent = appContentElement;
const appNavigation = appNavigationElement;
const appHeader = appHeaderElement;

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
  appHeader.hidden = isLoginRoute;
  document.body.classList.toggle('auth-screen', isLoginRoute);
}

function renderRoute(requestedRoute: RouteName, moveFocus = false): void {
  const route = getAllowedRoute(requestedRoute);

  if (route !== requestedRoute) {
    window.history.replaceState({ route }, '', `#${route}`);
  }

  setLoginLayout(route === 'login');

  if (route === 'login') {
    renderLogin(appContent);
  } else if (route === 'dashboard') {
    void renderDashboard(appContent);
  } else if (route === 'entries') {
    void renderEntries(appContent);
  } else if (route === 'catalog') {
    void renderCatalogPage(appContent);
  }

  for (const link of navigationLinks) {
    const isCurrentRoute = link.dataset.route === route;

    if (isCurrentRoute) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  }

  document.title = `${ROUTES[route].navigationLabel} | Distrito Financeiro`;

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
      navigateTo(route);
    });
  }

  logoutButton?.addEventListener('click', () => {
    logout();
    window.location.hash = '#login';
  });

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
    const database = await initDB();
    database.close();
  } catch (error) {
    console.error(
      'Não foi possível iniciar o banco de dados local. Verifique as permissões do navegador.',
      error,
    );
  }
}

function bootstrap(): void {
  initializeRouter();
  void initializeDatabase();
}

bootstrap();
