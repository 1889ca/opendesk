/** Contract: contracts/app/slides-element-types.md */

import { uploadImage, validateImageFile, extractImageFiles } from '../editor/image-upload.ts';

export type ImageInsertCallback = (url: string) => void;

/** Open file picker for image selection in the slide editor */
export function openSlideImagePicker(documentId: string, onInsert: ImageInsertCallback): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/png,image/jpeg,image/gif,image/webp';
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) handleSlideImageUpload(file, documentId, onInsert);
  });
  input.click();
}

/** Handle image upload for slide elements */
async function handleSlideImageUpload(
  file: File,
  documentId: string,
  onInsert: ImageInsertCallback,
): Promise<void> {
  const error = validateImageFile(file);
  if (error) {
    alert(error);
    return;
  }
  try {
    const result = await uploadImage(file, documentId);
    onInsert(result.url);
  } catch {
    alert('Image upload failed');
  }
}

/** Setup drag-and-drop image handling on the slide viewport */
export function setupSlideDragDrop(
  viewport: HTMLElement,
  documentId: string,
  onInsert: ImageInsertCallback,
): void {
  viewport.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  });

  viewport.addEventListener('drop', (e) => {
    const files = e.dataTransfer ? extractImageFiles(e.dataTransfer) : [];
    if (files.length === 0) return;
    e.preventDefault();
    for (const file of files) {
      handleSlideImageUpload(file, documentId, onInsert);
    }
  });
}
