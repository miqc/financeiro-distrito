import {
  getAccountEmail,
  getAccountName,
  getAccountProfile,
  updateCredentials,
} from '../core/auth';
import { ensureSettingsStyles } from '../pages/settings';

const PROFILE_STYLE_ID = 'profile-modal-styles';

export function openProfileModal(): void {
  ensureSettingsStyles();
  if (document.querySelector('.profile-modal')) return;

  const style = document.createElement('style');
  style.id = PROFILE_STYLE_ID;
  style.textContent = `
    .profile-modal:not([open]) { display: none !important; }
    .profile-modal { inset: 0; width: 100%; max-width: none; height: 100%; max-height: none; margin: 0; padding: 0; overflow: hidden; color: var(--color-text); background: transparent; border: 0; }
    .profile-modal::backdrop { background: var(--color-overlay); backdrop-filter: blur(2px); }
    .profile-modal[open]::backdrop { animation: app-backdrop-enter var(--motion-duration-normal) var(--motion-ease-standard) both; }
    .profile-modal[open] { display: flex; align-items: center; justify-content: center; }
    .profile-modal:focus { outline: none; }
    .profile-modal__panel { width: min(38rem, calc(100% - 2rem)); max-height: min(90vh, 46rem); max-height: min(90dvh, 46rem); overflow: auto; background: var(--color-surface); border-radius: var(--radius-medium); box-shadow: var(--shadow-dialog); }
    .profile-modal[open] > .profile-modal__panel { animation: profile-modal-enter var(--motion-duration-normal) var(--motion-ease-emphasized); }
    .profile-modal__header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--color-border); }
    .profile-modal__header p { margin-top: .25rem; color: var(--color-text-muted); font-size: .8125rem; }
    .profile-modal__close { display: grid; width: 2.75rem; min-height: 2.75rem; padding: 0; place-items: center; color: var(--color-text-muted); background: var(--color-surface-muted); border: 0; border-radius: var(--radius-small); cursor: pointer; font: inherit; font-size: 1.25rem; font-weight: 750; line-height: 1; }
    .profile-modal__close:hover { color: var(--color-text); }
    .profile-modal form { display: grid; gap: 1rem; padding: 1.5rem; }
    .profile-modal__photo { display: grid; width: fit-content; margin: -.5rem auto .5rem; cursor: pointer; }
    .profile-modal__photo input { position: absolute; width: 1px; height: 1px; overflow: hidden; opacity: 0; }
    .profile-modal__photo-preview { display: grid; width: 5.5rem; height: 5.5rem; place-items: center; color: var(--color-text-muted); background: var(--color-surface-muted); background-position: center; background-size: cover; border: 1px solid var(--color-border); border-radius: 50%; }
    .profile-modal__photo:hover .profile-modal__photo-preview { border-color: var(--color-action); }
    .profile-modal__photo-preview svg { width: 2.25rem; height: 2.25rem; }
    .profile-modal__photo-preview svg[hidden] { display: none; }
    .profile-modal__photo-caption { margin-top: .5rem; color: var(--color-text-muted); font-size: .75rem; font-weight: 650; text-align: center; }
    .profile-modal .settings-account-fields { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .profile-modal__actions { display: flex; justify-content: space-between; gap: 1rem; }
    .profile-modal__logout { color: var(--color-danger); background: transparent; border: 0; cursor: pointer; font: inherit; font-weight: 700; }
    @keyframes profile-modal-enter { from { opacity: 0; transform: translateY(.5rem) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
    @keyframes profile-drawer-enter { from { transform: translateY(100%); } to { transform: translateY(0); } }
    @media (hover: hover) and (pointer: fine) { .profile-modal .settings-account-submit:hover:not(:disabled) { transform: translateY(-.0625rem); } }
    @media (max-width: 40rem) { .profile-modal[open] { align-items: flex-end; } .profile-modal .profile-modal__panel { width: 100%; max-width: 100%; max-height: calc(100dvh - .75rem); margin: auto 0 0; border-radius: 1rem 1rem 0 0; } .profile-modal[open] > .profile-modal__panel { animation: profile-drawer-enter var(--motion-duration-normal) var(--motion-ease-emphasized); } .profile-modal .settings-account-fields { grid-template-columns: minmax(0, 1fr); } .profile-modal form { gap: 1.125rem; padding-bottom: calc(1.25rem + env(safe-area-inset-bottom)); } .profile-modal__actions { flex-direction: column-reverse; } }
    @media (prefers-reduced-motion: reduce) { .profile-modal[open] > .profile-modal__panel { animation: none; } }
  `;
  document.head.append(style);

  const dialog = document.createElement('dialog');
  dialog.className = 'profile-modal';
  dialog.innerHTML = `
    <section class="profile-modal__panel">
    <header class="profile-modal__header">
      <div><h2>Meu perfil</h2><p>Atualize seus dados pessoais e de acesso.</p></div>
      <button class="profile-modal__close" type="button" aria-label="Fechar">×</button>
    </header>
    <form>
      <label class="profile-modal__photo" aria-label="Alterar foto de perfil">
        <input name="photo" type="file" accept="image/png,image/jpeg,image/webp" />
        <span class="profile-modal__photo-preview" data-profile-photo-preview>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="7" r="4" /></svg>
        </span>
        <span class="profile-modal__photo-caption">Alterar foto</span>
      </label>
      <div class="settings-account-fields">
        <label class="settings-field">Nome<input name="firstName" autocomplete="given-name" required /></label>
        <label class="settings-field">Sobrenome<input name="lastName" autocomplete="family-name" required /></label>
        <label class="settings-field">Telefone<input name="phone" type="tel" maxlength="30" autocomplete="tel" /></label>
        <label class="settings-field">E-mail<input name="email" type="email" autocomplete="username" required /></label>
        <label class="settings-field">Senha atual <small>Necessária para alterar e-mail ou senha.</small><input name="currentPassword" type="password" autocomplete="current-password" /></label>
        <label class="settings-field">Nova senha<input name="newPassword" type="password" minlength="8" autocomplete="new-password" /></label>
      </div>
      <p class="settings-account-feedback" hidden></p>
      <div class="profile-modal__actions">
        <button class="profile-modal__logout" type="button">Sair da conta</button>
        <button class="settings-account-submit" type="submit">Salvar alterações</button>
      </div>
    </form>
    </section>
  `;
  document.body.append(dialog);

  const form = dialog.querySelector<HTMLFormElement>('form')!;
  const name = getAccountName();
  const profile = getAccountProfile();
  (form.elements.namedItem('firstName') as HTMLInputElement).value = name.firstName;
  (form.elements.namedItem('lastName') as HTMLInputElement).value = name.lastName;
  (form.elements.namedItem('phone') as HTMLInputElement).value = profile.phone;
  (form.elements.namedItem('email') as HTMLInputElement).value = getAccountEmail();
  let profilePhoto = profile.profilePhoto;
  const photoInput = form.elements.namedItem('photo') as HTMLInputElement;
  const photoPreview = dialog.querySelector<HTMLElement>('[data-profile-photo-preview]')!;
  const updatePhotoPreview = (): void => {
    photoPreview.style.backgroundImage = profilePhoto ? `url("${profilePhoto}")` : '';
    photoPreview.querySelector('svg')?.toggleAttribute('hidden', Boolean(profilePhoto));
  };
  updatePhotoPreview();
  photoInput.addEventListener('change', () => {
    const file = photoInput.files?.[0];
    if (!file) return;
    if (file.size > 1_500_000) { photoInput.setCustomValidity('A foto deve ter no máximo 1,5 MB.'); return; }
    photoInput.setCustomValidity('');
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      profilePhoto = typeof reader.result === 'string' ? reader.result : '';
      updatePhotoPreview();
    });
    reader.readAsDataURL(file);
  });
  dialog.querySelector('.profile-modal__close')?.addEventListener('click', () => dialog.close());
  dialog.querySelector('.profile-modal__logout')?.addEventListener('click', () => {
    window.dispatchEvent(new Event('distrito:profile-logout'));
    dialog.close();
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const currentPassword = form.elements.namedItem('currentPassword') as HTMLInputElement;
    const newPassword = form.elements.namedItem('newPassword') as HTMLInputElement;
    const feedback = dialog.querySelector<HTMLElement>('.settings-account-feedback')!;
    if (!form.reportValidity()) return;
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    submit.disabled = true;
    try {
      const updated = await updateCredentials({
        firstName: (form.elements.namedItem('firstName') as HTMLInputElement).value,
        lastName: (form.elements.namedItem('lastName') as HTMLInputElement).value,
        phone: (form.elements.namedItem('phone') as HTMLInputElement).value,
        profilePhoto,
        email: (form.elements.namedItem('email') as HTMLInputElement).value,
        currentPassword: currentPassword.value,
        newPassword: newPassword.value || undefined,
      });
      if (!updated) throw new Error('A senha atual está incorreta.');
      feedback.textContent = 'Perfil atualizado com sucesso.';
      feedback.hidden = false;
      currentPassword.value = '';
      newPassword.value = '';
      window.dispatchEvent(new Event('distrito:profile-updated'));
    } catch (error) {
      feedback.textContent = error instanceof Error ? error.message : 'Não foi possível atualizar o perfil.';
      feedback.hidden = false;
    } finally { submit.disabled = false; }
  });
  dialog.addEventListener('close', () => { dialog.remove(); style.remove(); });
  dialog.showModal();
}
