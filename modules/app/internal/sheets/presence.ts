/** Contract: contracts/app/rules.md */
import type { HocuspocusProvider } from '@hocuspocus/provider';

/** Set up presence tracking: sets local user and updates user list on awareness changes. */
export function setupPresence(
  provider: HocuspocusProvider,
  user: { name: string; color?: string },
  usersEl: HTMLElement | null,
): void {
  function updateUsers() {
    if (!usersEl || !provider.awareness) return;
    const names: string[] = [];
    provider.awareness.getStates().forEach((state: { user?: { name?: string } }) => {
      if (state.user?.name) names.push(state.user.name);
    });
    usersEl.textContent = names.join(', ') || '-';
  }

  provider.awareness?.setLocalStateField('user', user);
  provider.awareness?.on('change', updateUsers);
  updateUsers();
}
