/** Contract: contracts/convert/rules.md */

/**
 * Parse HTML output from Collabora (converted from .pptx/.odp)
 * into the PresentationDocumentSnapshot content structure.
 *
 * Collabora converts presentations to HTML with page-break divs
 * representing individual slides. Each slide contains positioned
 * elements (text boxes, shapes, images).
 */

import { randomUUID } from 'node:crypto';
import type {
  PresentationContent,
  Slide,
  SlideElement,
  SlideLayout,
} from '../../document/contract/index.ts';

/** Parse Collabora HTML into PresentationContent */
export function htmlToSlides(html: string): PresentationContent {
  const slides = extractSlideBlocks(html);
  if (slides.length === 0) {
    return { slides: [createDefaultSlide()] };
  }
  return { slides };
}

/** Extract slide blocks from the HTML string */
function extractSlideBlocks(html: string): Slide[] {
  const slideChunks = splitByPageBreaks(html);
  return slideChunks.map(parseSlideChunk);
}

/**
 * Split HTML by Collabora's page-break markers.
 * Collabora uses either <div style="page-break-before:always">
 * or <hr class="break"> style separators between slides.
 */
function splitByPageBreaks(html: string): string[] {
  const pattern = /(?:<div[^>]*style="[^"]*page-break[^"]*"[^>]*>|<hr[^>]*class="break"[^>]*\/?>)/gi;
  const chunks = html.split(pattern).filter((c) => c.trim().length > 0);
  return chunks.length > 0 ? chunks : [html];
}

/** Parse a single slide chunk into a Slide */
function parseSlideChunk(chunk: string): Slide {
  const elements = extractElements(chunk);
  const layout = inferLayout(elements);
  return { layout, elements };
}

/** Extract text/shape/image elements from a slide HTML chunk */
function extractElements(chunk: string): SlideElement[] {
  const elements: SlideElement[] = [];
  const textBlocks = extractTextBlocks(chunk);

  for (let i = 0; i < textBlocks.length; i++) {
    const block = textBlocks[i];
    const position = estimatePosition(i, textBlocks.length);
    elements.push({
      id: randomUUID(),
      type: 'text',
      x: position.x,
      y: position.y,
      width: position.width,
      height: position.height,
      content: block,
    });
  }

  const images = extractImageRefs(chunk);
  for (let i = 0; i < images.length; i++) {
    elements.push({
      id: randomUUID(),
      type: 'image',
      x: 10,
      y: 50 + i * 20,
      width: 80,
      height: 30,
      content: images[i],
    });
  }

  return elements;
}

/** Extract text content blocks from HTML, stripping tags */
function extractTextBlocks(html: string): string[] {
  const blocks: string[] = [];
  const tagPattern = /<(?:p|h[1-6]|div|li|td|th)[^>]*>([\s\S]*?)<\/(?:p|h[1-6]|div|li|td|th)>/gi;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(html)) !== null) {
    const text = stripTags(match[1]).trim();
    if (text.length > 0) {
      blocks.push(text);
    }
  }

  return blocks;
}

/** Extract image src references */
function extractImageRefs(html: string): string[] {
  const refs: string[] = [];
  const imgPattern = /<img[^>]*src="([^"]+)"[^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = imgPattern.exec(html)) !== null) {
    refs.push(match[1]);
  }

  return refs;
}

/** Strip HTML tags from a string */
function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

/** Estimate element position based on index in the slide */
function estimatePosition(
  index: number,
  total: number,
): { x: number; y: number; width: number; height: number } {
  if (total === 0) return { x: 10, y: 10, width: 80, height: 20 };

  // Title element gets top placement
  if (index === 0) {
    return { x: 10, y: 5, width: 80, height: 15 };
  }

  // Remaining elements distributed vertically
  const yStart = 25;
  const availableHeight = 70;
  const elementHeight = Math.min(20, availableHeight / (total - 1));
  const y = yStart + (index - 1) * elementHeight;

  return { x: 10, y, width: 80, height: elementHeight };
}

/** Infer layout from element count/structure */
function inferLayout(elements: SlideElement[]): SlideLayout {
  if (elements.length === 0) return 'blank';
  if (elements.length === 1) return 'title';
  return 'content';
}

/** Create a default empty slide */
function createDefaultSlide(): Slide {
  return {
    layout: 'blank',
    elements: [{
      id: randomUUID(),
      type: 'text',
      x: 10,
      y: 10,
      width: 80,
      height: 20,
      content: 'Imported slide',
    }],
  };
}
