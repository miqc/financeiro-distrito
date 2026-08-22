export type AppTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'distrito_theme';

const THEME_COLORS: Record<AppTheme, string> = {
  light: '#f2f2f0',
  dark: '#0f1113',
};

function isAppTheme(value: string | null): value is AppTheme {
  return value === 'light' || value === 'dark';
}

export function getTheme(): AppTheme {
  try {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    return isAppTheme(storedTheme) ? storedTheme : 'light';
  } catch (error) {
    console.warn('Não foi possível ler a preferência de aparência.', error);
    return 'light';
  }
}

export function applyTheme(theme: AppTheme): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;

  const themeColor = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );

  themeColor?.setAttribute('content', THEME_COLORS[theme]);
}

export function setTheme(theme: AppTheme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (error) {
    console.warn('Não foi possível salvar a preferência de aparência.', error);
  }

  applyTheme(theme);
}

export function initializeTheme(): AppTheme {
  const theme = getTheme();
  applyTheme(theme);
  return theme;
}
