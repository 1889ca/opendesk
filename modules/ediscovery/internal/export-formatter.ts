/** Contract: contracts/ediscovery/rules.md */

import type {
  SarExportResult,
  FoiaExportResult,
  ExportFormat,
  ExportBundle,
} from '../contract.ts';

/** Convert an export result to JSON format. */
function toJson(
  result: SarExportResult | FoiaExportResult,
  type: 'sar' | 'foia',
): ExportBundle {
  const filename = type === 'sar'
    ? `sar-export-${(result as SarExportResult).userId}.json`
    : `foia-export-${(result as FoiaExportResult).documentId}.json`;

  return {
    format: 'json',
    filename,
    contentType: 'application/json',
    data: JSON.stringify(result, null, 2),
  };
}

/** Convert audit events to CSV format. */
function toCsv(
  result: SarExportResult | FoiaExportResult,
  type: 'sar' | 'foia',
): ExportBundle {
  const events = type === 'sar'
    ? (result as SarExportResult).auditEvents
    : (result as FoiaExportResult).auditTrail;

  const headers = [
    'id', 'eventId', 'documentId', 'actorId', 'actorType', 'action', 'occurredAt',
  ];
  const rows = events.map((evt: Record<string, unknown>) =>
    headers.map((h) => escapeCsvField(String(evt[h] ?? ''))).join(','),
  );

  const csv = [headers.join(','), ...rows].join('\n');

  const filename = type === 'sar'
    ? `sar-export-${(result as SarExportResult).userId}.csv`
    : `foia-export-${(result as FoiaExportResult).documentId}.csv`;

  return {
    format: 'csv',
    filename,
    contentType: 'text/csv',
    data: csv,
  };
}

/** Convert to a human-readable PDF-like text report. */
function toPdfText(
  result: SarExportResult | FoiaExportResult,
  type: 'sar' | 'foia',
): ExportBundle {
  const lines: string[] = [];

  if (type === 'sar') {
    const sar = result as SarExportResult;
    lines.push('SUBJECT ACCESS REQUEST EXPORT');
    lines.push('='.repeat(40));
    lines.push(`User ID: ${sar.userId}`);
    lines.push(`Exported At: ${sar.exportedAt}`);
    lines.push(`Documents Found: ${sar.documents.length}`);
    lines.push(`Audit Events: ${sar.auditEvents.length}`);
    lines.push(`Signed Updates: ${sar.signatureCount}`);
    lines.push('');
    lines.push('DOCUMENTS');
    lines.push('-'.repeat(30));
    for (const doc of sar.documents) {
      lines.push(`  ${doc.id} | ${doc.title} | ${doc.documentType} | role: ${doc.role}`);
    }
    lines.push('');
    lines.push('AUDIT EVENTS');
    lines.push('-'.repeat(30));
    for (const evt of sar.auditEvents) {
      const e = evt as Record<string, unknown>;
      lines.push(`  ${e.occurredAt} | ${e.action} | doc: ${e.documentId}`);
    }
  } else {
    const foia = result as FoiaExportResult;
    lines.push('FOIA DOCUMENT HISTORY EXPORT');
    lines.push('='.repeat(40));
    lines.push(`Document ID: ${foia.documentId}`);
    lines.push(`Date Range: ${foia.dateRange.start} to ${foia.dateRange.end}`);
    lines.push(`Exported At: ${foia.exportedAt}`);
    lines.push(`Audit Events: ${foia.auditTrail.length}`);
    lines.push(`Versions: ${foia.versions.length}`);
    if (foia.signatureVerification) {
      const sv = foia.signatureVerification as Record<string, unknown>;
      lines.push(`Signature Verification: ${sv.verified ? 'PASSED' : 'FAILED'}`);
    }
    lines.push('');
    lines.push('VERSION HISTORY');
    lines.push('-'.repeat(30));
    for (const v of foia.versions) {
      lines.push(`  #${v.versionNumber} | ${v.title} | by ${v.createdBy} | ${v.createdAt}`);
    }
    lines.push('');
    lines.push('AUDIT TRAIL');
    lines.push('-'.repeat(30));
    for (const evt of foia.auditTrail) {
      const e = evt as Record<string, unknown>;
      lines.push(`  ${e.occurredAt} | ${e.action} | actor: ${e.actorId}`);
    }
  }

  const text = lines.join('\n');
  const filename = type === 'sar'
    ? `sar-export-${(result as SarExportResult).userId}.txt`
    : `foia-export-${(result as FoiaExportResult).documentId}.txt`;

  return {
    format: 'pdf',
    filename,
    contentType: 'text/plain',
    data: text,
  };
}

/** Format an export result into the requested format. */
export function formatExport(
  result: SarExportResult | FoiaExportResult,
  format: ExportFormat,
  type: 'sar' | 'foia',
): ExportBundle {
  switch (format) {
    case 'json': return toJson(result, type);
    case 'csv': return toCsv(result, type);
    case 'pdf': return toPdfText(result, type);
  }
}

function escapeCsvField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}
