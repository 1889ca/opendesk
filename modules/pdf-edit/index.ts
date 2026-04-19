/** Contract: contracts/pdf-edit/rules.md */
export {
  AnnotationTypeSchema,
  RectSchema,
  AnnotationSchema,
  RedactionSchema,
  PdfAnnotationLayerSchema,
} from './contract.ts';

export type {
  AnnotationType,
  Rect,
  Annotation,
  Redaction,
  PdfAnnotationLayer,
  PdfEditor,
  PdfEditModule,
} from './contract.ts';

export { createStubPdfEditor } from './internal/stub-editor.ts';
