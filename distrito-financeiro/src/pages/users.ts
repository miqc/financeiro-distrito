import {
  listUsers,
  type User,
  updateUserAccess,
} from '../core/auth';
const USERS_STYLE_ID = 'users-page-styles';
const usersStyles = `
  .users-page { display: grid; gap: clamp(1rem, 3vw, 1.5rem); }
  .users-page [hidden] { display: none !important; }
  .users-header, .users-records { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-medium); box-shadow: var(--shadow-surface); }
  .users-header { display: flex; align-items: center; padding: clamp(1.25rem, 4vw, 2rem); box-shadow: var(--shadow-monthly); }
  .users-header__content { display: grid; gap: .375rem; }
  .users-header__eyebrow { color: var(--color-text); font-size: .8125rem; font-weight: 650; }
  .users-header__content h2 { font-size: clamp(1.375rem, 4vw, 1.75rem); letter-spacing: -.025em; line-height: 1.2; }
  .users-header__description, .users-records__header p, .users-feedback { color: var(--color-text-muted); font-size: .9375rem; }
  .users-records { overflow: hidden; }
  .users-records__header { display: grid; gap: .25rem; padding: 1rem clamp(1rem, 4vw, 1.5rem); border-bottom: 1px solid var(--color-border); }
  .users-records__header h3 { font-size: 1rem; }
  .users-list { display: grid; }
  .users-list__item { display: grid; grid-template-columns: 1fr 12rem 7rem; align-items: end; gap: 1rem; padding: 1rem clamp(1rem, 4vw, 1.5rem); border-bottom: 1px solid var(--color-border); }
  .users-list__item small { display: block; margin-top: .25rem; color: var(--color-text-muted); font-size: .8125rem; }
  .users-list__item label { display: grid; gap: .5rem; color: var(--color-text-muted); font-size: .8125rem; font-weight: 600; }
  .users-list__item select, .users-list__item button { min-height: 2.5rem; padding: .5rem .75rem; color: var(--color-text); background: var(--color-surface); border: 1px solid var(--color-input-border); border-radius: var(--radius-small); }
  .users-list__item select:focus, .users-list__item button:focus-visible { border-color: var(--color-info-strong); box-shadow: 0 0 0 .1875rem var(--color-info-soft); outline: 0; }
  .users-list__item button { color: var(--color-on-action); background: var(--color-action); border: 0; cursor: pointer; font-weight: 700; }
  .users-list__item button:hover:not(:disabled) { background: var(--color-action-hover); }
  .users-list__item button:disabled, .users-list__item select:disabled { cursor: not-allowed; opacity: .55; }
  @media (max-width: 30rem) { .users-list__item { grid-template-columns: minmax(0, 1fr); } }
`;

function ensureUsersStyles(): void {
  if (document.querySelector(`#${USERS_STYLE_ID}`)) return;
  const style = document.createElement('style');
  style.id = USERS_STYLE_ID;
  style.textContent = usersStyles;
  document.head.append(style);
}

const roleLabels: Record<User['role'], string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  barber: 'Barbeiro',
  client: 'Cliente',
};

export async function renderUsersPage(container: HTMLElement): Promise<void> {
  ensureUsersStyles();
  container.innerHTML = `
    <section class="users-page" aria-labelledby="users-title">
      <header class="users-header">
        <div class="users-header__content">
          <p class="users-header__eyebrow">Controle de acesso</p>
          <h2 id="users-title">Usuários</h2>
          <p class="users-header__description">Controle os perfis e o acesso das contas cadastradas.</p>
        </div>
      </header>
      <section class="users-records" aria-labelledby="users-list-title">
        <header class="users-records__header">
          <h3 id="users-list-title">Contas cadastradas</h3>
          <p>Usuários criam suas próprias contas; altere aqui apenas o perfil e o status de acesso.</p>
        </header>
        <p class="users-feedback" role="status" aria-live="polite"></p>
        <div class="users-list" aria-live="polite">Carregando...</div>
      </section>
    </section>
  `;

  const feedback = container.querySelector<HTMLElement>('.users-feedback');
  const list = container.querySelector<HTMLElement>('.users-list');
  if (!feedback || !list) return;

  const renderList = (users: User[]): void => {
    list.innerHTML = users.map((user) => `
      <div class="users-list__item">
        <div><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(user.email)}</small></div>
        <label>Perfil<select data-user-role="${user.id}" ${user.role === 'owner' ? 'disabled' : ''}>
          ${(['admin', 'barber', 'client'] as const).map((role) => `<option value="${role}" ${role === user.role ? 'selected' : ''}>${roleLabels[role]}</option>`).join('')}
        </select></label>
        <button type="button" data-user-status="${user.id}" ${user.role === 'owner' ? 'disabled' : ''}>${user.status === 'active' ? 'Desativar' : 'Ativar'}</button>
      </div>
    `).join('');

    list.querySelectorAll<HTMLSelectElement>('[data-user-role]').forEach((select) => {
      select.addEventListener('change', () => void changeAccess(Number(select.dataset.userRole), select.value, users, false));
    });
    list.querySelectorAll<HTMLButtonElement>('[data-user-status]').forEach((button) => {
      button.addEventListener('click', () => void changeAccess(Number(button.dataset.userStatus), undefined, users, true));
    });
  };

  const load = async (): Promise<void> => renderList(await listUsers());

  const changeAccess = async (id: number, role: string | undefined, users: User[], toggleStatus: boolean): Promise<void> => {
    const current = users.find((user) => user.id === id);
    if (!current) return;
    try {
      const nextStatus = toggleStatus
        ? current.status === 'active' ? 'inactive' : 'active'
        : current.status;
      await updateUserAccess(id, (role ?? current.role) as Exclude<User['role'], 'owner'>, nextStatus);
      await load();
    } catch (error) {
      feedback.textContent = error instanceof Error ? error.message : 'Não foi possível atualizar o usuário.';
    }
  };

  try { await load(); } catch (error) { list.textContent = error instanceof Error ? error.message : 'Não foi possível carregar os usuários.'; }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);
}
