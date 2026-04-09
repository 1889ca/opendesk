/** Contract: contracts/core/manifest/rules.md */

import type { OpenDeskManifest } from './contract.ts';
import { manifest as auditManifest } from '../../audit/manifest.ts';
import { manifest as notificationsManifest } from '../../notifications/manifest.ts';
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
  auditManifest,
  notificationsManifest,
  workflowManifest,
];
