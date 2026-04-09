/** Contract: contracts/core/manifest/rules.md */

import type { OpenDeskManifest } from './contract.ts';
import { manifest as aiManifest } from '../../ai/manifest.ts';
import { manifest as auditManifest } from '../../audit/manifest.ts';
import { manifest as convertManifest } from '../../convert/manifest.ts';
import { manifest as documentManifest } from '../../document/manifest.ts';
import { manifest as erasureManifest } from '../../erasure/manifest.ts';
import { manifest as federationManifest } from '../../federation/manifest.ts';
import { manifest as kbManifest } from '../../kb/manifest.ts';
import { manifest as notificationsManifest } from '../../notifications/manifest.ts';
import { manifest as observabilityManifest } from '../../observability/manifest.ts';
import { manifest as referencesManifest } from '../../references/manifest.ts';
import { manifest as storageManifest } from '../../storage/manifest.ts';
import { manifest as workflowManifest } from '../../workflow/manifest.ts';

/**
 * Central registry of OpenDesk module manifests.
 *
 * Adding a new feature module is exactly two lines: create
 * `modules/<name>/manifest.ts`, then add one import line and one
 * array entry here. The composition root iterates this list to wire
 * API routes, frontend bundles, and lifecycle hooks — there is no
 * other place that knows the names of feature modules.
 *
 * Restricted-zone modules (auth, sharing, permissions per
 * CONSTITUTION.md) are deliberately NOT in this registry. They
 * remain hand-mounted in `modules/api/internal/create-routes.ts`
 * until a human maintainer signs off on migrating them.
 */
export const manifests: OpenDeskManifest[] = [
  aiManifest,
  auditManifest,
  convertManifest,
  documentManifest,
  erasureManifest,
  federationManifest,
  kbManifest,
  notificationsManifest,
  observabilityManifest,
  referencesManifest,
  storageManifest,
  workflowManifest,
];
