/** Contract: contracts/diagrams/rules.md */
export {
  ShapeKindSchema,
  PointSchema,
  ShapeSchema,
  ConnectorRoutingSchema,
  ConnectorSchema,
  LayerSchema,
  DiagramDefinitionSchema,
  MAX_SHAPES_PER_PAGE,
} from './contract.ts';

export type {
  ShapeKind,
  Point,
  Shape,
  ConnectorRouting,
  Connector,
  Layer,
  DiagramDefinition,
  DiagramStore,
  DiagramsModule,
} from './contract.ts';

export { createMemoryDiagramStore } from './internal/memory-store.ts';
export { validateConnectors } from './internal/validate.ts';
