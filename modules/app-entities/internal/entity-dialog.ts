/** Contract: contracts/app-entities/rules.md */
import { renderContentFields, readContentFields } from './content-fields.ts';
import { createEntityApi, updateEntityApi, type EntityRecord } from './entity-api.ts';

export type DialogCallback = () => void;

let onSaveCallback: DialogCallback | null = null;

/**
 * Initialize the create/edit entity dialog.
 * Call once on page load.
 */
export function initEntityDialog(onSave: DialogCallback): void {
  onSaveCallback = onSave;

  const overlay = document.getElementById('entity-dialog') as HTMLElement;
  const form = document.getElementById('entity-form') as HTMLFormElement;
  const closeBtn = document.getElementById('entity-dialog-close') as HTMLElement;
  const cancelBtn = document.getElementById('entity-cancel') as HTMLElement;
  const subtypeSelect = document.getElementById('entity-subtype') as HTMLSelectElement;
  const contentFields = document.getElementById('entity-content-fields') as HTMLElement;

  subtypeSelect.addEventListener('change', () => {
    renderContentFields(contentFields, subtypeSelect.value);
  });

  closeBtn.addEventListener('click', () => closeDialog());
  cancelBtn.addEventListener('click', () => closeDialog());

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeDialog();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSubmit().catch(console.error);
  });
}

/** Open dialog for creating a new entity. */
export function openCreateDialog(): void {
  const overlay = document.getElementById('entity-dialog') as HTMLElement;
  const title = document.getElementById('entity-dialog-title') as HTMLElement;
  const form = document.getElementById('entity-form') as HTMLFormElement;
  const contentFields = document.getElementById('entity-content-fields') as HTMLElement;

  title.textContent = 'New Entity';
  form.reset();
  form.dataset.entityId = '';
  renderContentFields(contentFields, 'person');
  overlay.hidden = false;
}

/** Open dialog for editing an existing entity. */
export function openEditDialog(entity: EntityRecord): void {
  const overlay = document.getElementById('entity-dialog') as HTMLElement;
  const title = document.getElementById('entity-dialog-title') as HTMLElement;
  const form = document.getElementById('entity-form') as HTMLFormElement;
  const nameInput = document.getElementById('entity-name') as HTMLInputElement;
  const subtypeSelect = document.getElementById('entity-subtype') as HTMLSelectElement;
  const tagsInput = document.getElementById('entity-tags') as HTMLInputElement;
  const contentFields = document.getElementById('entity-content-fields') as HTMLElement;

  title.textContent = 'Edit Entity';
  form.dataset.entityId = entity.id;
  nameInput.value = entity.name;
  subtypeSelect.value = entity.subtype;
  tagsInput.value = (entity.tags ?? []).join(', ');
  renderContentFields(contentFields, entity.subtype, entity.content);
  overlay.hidden = false;
}

function closeDialog(): void {
  const overlay = document.getElementById('entity-dialog') as HTMLElement;
  overlay.hidden = true;
}

async function handleSubmit(): Promise<void> {
  const form = document.getElementById('entity-form') as HTMLFormElement;
  const nameInput = document.getElementById('entity-name') as HTMLInputElement;
  const subtypeSelect = document.getElementById('entity-subtype') as HTMLSelectElement;
  const tagsInput = document.getElementById('entity-tags') as HTMLInputElement;
  const contentFields = document.getElementById('entity-content-fields') as HTMLElement;

  const name = nameInput.value.trim();
  const subtype = subtypeSelect.value;
  const tags = tagsInput.value
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  const content = readContentFields(contentFields, subtype);
  const entityId = form.dataset.entityId;

  try {
    if (entityId) {
      await updateEntityApi(entityId, { name, subtype, content, tags });
    } else {
      await createEntityApi({ name, subtype, content, tags });
    }
    closeDialog();
    onSaveCallback?.();
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Save failed');
  }
}
