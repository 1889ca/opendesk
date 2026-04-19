/** Contract: contracts/diagrams/rules.md */

import type { Connector, DiagramDefinition } from '../contract.ts';

/**
 * Return the subset of connectors whose source or target shape is missing.
 * These render as red dashed placeholders in the editor.
 */
export function validateConnectors(def: DiagramDefinition): Connector[] {
  const shapeIds = new Set(def.shapes.map((s) => s.id));
  return def.connectors.filter(
    (c) => !shapeIds.has(c.source_shape_id) || !shapeIds.has(c.target_shape_id),
  );
}
