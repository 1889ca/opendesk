/** Contract: contracts/ediscovery/rules.md */

import type { Pool } from 'pg';
import type { EDiscoveryModule, SarRequest, FoiaRequest, ExportFormat, SarExportResult, FoiaExportResult, ExportBundle } from '../contract.ts';
import { executeSarExport } from './sar-engine.ts';
import { executeFoiaExport } from './foia-engine.ts';
import { formatExport } from './export-formatter.ts';

export type EDiscoveryDependencies = {
  pool: Pool;
};

/** Factory: creates the eDiscovery module. */
export function createEDiscovery(deps: EDiscoveryDependencies): EDiscoveryModule {
  const { pool } = deps;

  return {
    async sarExport(request: SarRequest): Promise<SarExportResult> {
      return executeSarExport(pool, request);
    },

    async foiaExport(request: FoiaRequest): Promise<FoiaExportResult> {
      return executeFoiaExport(pool, request);
    },

    formatExport(
      result: SarExportResult | FoiaExportResult,
      format: ExportFormat,
      type: 'sar' | 'foia',
    ): ExportBundle {
      return formatExport(result, format, type);
    },
  };
}
