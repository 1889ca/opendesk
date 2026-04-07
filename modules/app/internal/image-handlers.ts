/** Contract: contracts/app/rules.md */

import type { Editor } from '@tiptap/core';
import { t } from './i18n/index.ts';
import { uploadImage, validateImageFile, extractImageFiles } from './image-upload.ts';
import { getDocumentId } from './identity.ts';

/** Open a native file picker and insert the chosen image. */
export function openImagePicker(editor: Editor): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/png,image/jpeg,image/gif,image/webp';
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) handleImageInsert(editor, file);
  });
  input.click();
}

/** Validate, upload, and insert an image into the editor. */
async function handleImageInsert(editor: Editor, file: File): Promise<void> {
  const error = validateImageFile(file);
  if (error) {
    alert(t(error as 'image.tooLarge'));
    return;
  }
  const documentId = getDocumentId();
  try {
    const result = await uploadImage(file, documentId);
    editor.chain().focus().setImage({ src: result.url }).run();
  } catch {
    alert(t('image.uploadFailed'));
  }
}

/** Attach drag-and-drop and paste handlers for image upload. */
export function setupImageHandlers(editor: Editor, el: HTMLElement): void {
  el.addEventListener('drop', (e) => {
    const files = e.dataTransfer ? extractImageFiles(e.dataTransfer) : [];
    if (files.length === 0) return;
    e.preventDefault();
    for (const file of files) handleImageInsert(editor, file);
  });

  el.addEventListener('paste', (e) => {
    const files = e.clipboardData ? extractImageFiles(e.clipboardData) : [];
    if (files.length === 0) return;
    e.preventDefault();
    for (const file of files) handleImageInsert(editor, file);
  });
}
