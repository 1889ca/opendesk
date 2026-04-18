/** Contract: contracts/sheets-chart/rules.md */

export function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function svgOpen(width: number, height: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="system-ui, -apple-system, sans-serif">`;
}

export function svgClose(): string {
  return '</svg>';
}

export function rect(
  x: number, y: number, w: number, h: number,
  fill: string, extra?: string,
): string {
  const e = extra ? ` ${extra}` : '';
  return `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" fill="${esc(fill)}"${e}/>`;
}

export function line(
  x1: number, y1: number, x2: number, y2: number,
  stroke: string, strokeWidth = 1,
): string {
  return `<line x1="${r(x1)}" y1="${r(y1)}" x2="${r(x2)}" y2="${r(y2)}" stroke="${esc(stroke)}" stroke-width="${strokeWidth}"/>`;
}

export function polyline(points: { x: number; y: number }[], stroke: string, strokeWidth = 2): string {
  const pts = points.map((p) => `${r(p.x)},${r(p.y)}`).join(' ');
  return `<polyline points="${pts}" fill="none" stroke="${esc(stroke)}" stroke-width="${strokeWidth}" stroke-linejoin="round" stroke-linecap="round"/>`;
}

export function circle(cx: number, cy: number, radius: number, fill: string): string {
  return `<circle cx="${r(cx)}" cy="${r(cy)}" r="${radius}" fill="${esc(fill)}"/>`;
}

export function path(d: string, fill: string, stroke?: string): string {
  const s = stroke ? ` stroke="${esc(stroke)}" stroke-width="1"` : '';
  return `<path d="${d}" fill="${esc(fill)}"${s}/>`;
}

export function text(
  x: number, y: number, content: string,
  opts: { anchor?: string; fontSize?: number; fill?: string; rotate?: number } = {},
): string {
  const anchor = opts.anchor ?? 'middle';
  const size = opts.fontSize ?? 11;
  const fill = opts.fill ?? '#333';
  const transform = opts.rotate !== undefined
    ? ` transform="rotate(${opts.rotate}, ${r(x)}, ${r(y)})"`
    : '';
  return `<text x="${r(x)}" y="${r(y)}" text-anchor="${anchor}" font-size="${size}" fill="${esc(fill)}" dominant-baseline="middle"${transform}>${esc(content)}</text>`;
}

export function group(children: string[], transform?: string): string {
  const t = transform ? ` transform="${transform}"` : '';
  return `<g${t}>${children.join('')}</g>`;
}

function r(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
