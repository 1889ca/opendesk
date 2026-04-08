/** Contract: contracts/convert/rules.md */

/**
 * Export pipeline for presentations.
 * Converts PresentationContent to HTML, then sends to Collabora
 * for conversion to the target format (pdf, pptx, odp).
 */

import type { ExportFormat } from '../contract.ts';
import type {
  PresentationContent,
  Slide,
  SlideElement,
} from '../../document/contract/index.ts';
import { convertFile } from './libreoffice.ts';
import { getDocument } from '../../storage/index.ts';
import { createLogger } from '../../logger/index.ts';

const log = createLogger('convert:slides');

export interface SlideExportResult {
  documentId: string;
  format: ExportFormat;
  stale: boolean;
  fileBuffer: Buffer;
  exportedAt: string;
}

/**
 * Export presentation content to a binary file format.
 * Renders slides to HTML, then converts via Collabora.
 */
export async function exportPresentation(
  documentId: string,
  format: ExportFormat,
  content: PresentationContent,
): Promise<SlideExportResult> {
  const doc = await getDocument(documentId);
  const title = doc?.title || 'presentation';
  const html = slidesToHtml(content, title);
  const htmlBuffer = Buffer.from(html, 'utf-8');
  const filename = `${title}.html`;

  log.info('exporting presentation', { documentId, format, slideCount: content.slides.length });
  const fileBuffer = await convertFile(htmlBuffer, filename, format);

  return {
    documentId,
    format,
    stale: true,
    fileBuffer,
    exportedAt: new Date().toISOString(),
  };
}

/** Render PresentationContent to a full HTML document for Collabora */
export function slidesToHtml(
  content: PresentationContent,
  title: string = 'Presentation',
): string {
  const slideHtml = content.slides
    .map((slide, i) => renderSlide(slide, i))
    .join('\n');

  return [
    '<!DOCTYPE html>',
    '<html><head>',
    `<meta charset="UTF-8"><title>${escapeHtml(title)}</title>`,
    '<style>',
    slideStyles(),
    '</style>',
    '</head><body>',
    slideHtml,
    '</body></html>',
  ].join('\n');
}

/** CSS for slides in export HTML */
function slideStyles(): string {
  return `
    .slide { width: 960px; height: 540px; position: relative;
      page-break-after: always; background: #fff; overflow: hidden; }
    .slide-element { position: absolute; }
    .slide-element[data-type="text"] { font-family: sans-serif; }
    .slide-element[data-type="image"] img { max-width: 100%; max-height: 100%; }
  `.trim();
}

/** Render a single slide to HTML */
function renderSlide(slide: Slide, index: number): string {
  const elements = slide.elements
    .map(renderElement)
    .join('\n');

  return `<div class="slide" data-slide="${index}" data-layout="${slide.layout}">
${elements}
</div>`;
}

/** Render a single element to HTML */
function renderElement(el: SlideElement): string {
  const style = [
    `left:${el.x}%`,
    `top:${el.y}%`,
    `width:${el.width}%`,
    `height:${el.height}%`,
  ].join(';');

  if (el.type === 'image') {
    return `<div class="slide-element" data-type="image" style="${style}">
  <img src="${escapeHtml(el.content)}" alt="" />
</div>`;
  }

  return `<div class="slide-element" data-type="${el.type}" style="${style}">
  ${escapeHtml(el.content)}
</div>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
