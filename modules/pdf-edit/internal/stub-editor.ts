/** Contract: contracts/pdf-edit/rules.md */

/**
 * Skeleton PdfEditor — stores the annotation layer in-memory and returns
 * a pointer to the original PDF on save. The real implementation will:
 *   - Parse the PDF via a sandboxed parser (pinned, deliberation required)
 *   - Apply incremental saves so pre-existing signatures survive
 *   - Remove content from the content stream for redactions (not cosmetic)
 *   - Strip embedded JavaScript on open
 *   - Delegate signature ceremonies to `esign`
 */

import {
  PdfAnnotationLayerSchema,
  type Annotation,
  type PdfAnnotationLayer,
  type PdfEditor,
  type Redaction,
} from '../contract.ts';

const NOT_IMPLEMENTED = 'pdf-edit: not implemented (skeleton)';

export function createStubPdfEditor(): PdfEditor {
  const layers = new Map<string, PdfAnnotationLayer>();

  function getOrInit(documentId: string): PdfAnnotationLayer {
    const existing = layers.get(documentId);
    if (existing) return existing;
    const fresh: PdfAnnotationLayer = PdfAnnotationLayerSchema.parse({
      document_id: documentId,
      pdf_storage_key: `stub/${documentId}.pdf`,
      annotations: [],
      redactions: [],
      form_fields: {},
      updated_at: new Date().toISOString(),
    });
    layers.set(documentId, fresh);
    return fresh;
  }

  return {
    async openLayer(documentId) {
      return getOrInit(documentId);
    },

    async applyAnnotation(documentId, annotation: Annotation) {
      const layer = getOrInit(documentId);
      layer.annotations.push(annotation);
      layer.updated_at = new Date().toISOString();
    },

    async applyRedaction(documentId, redaction: Redaction) {
      const layer = getOrInit(documentId);
      layer.redactions.push(redaction);
      layer.updated_at = new Date().toISOString();
    },

    async fillField(documentId, fieldName, value) {
      const layer = getOrInit(documentId);
      layer.form_fields[fieldName] = value;
      layer.updated_at = new Date().toISOString();
    },

    async save(_documentId, _opts) {
      throw new Error(NOT_IMPLEMENTED);
    },
  };
}
