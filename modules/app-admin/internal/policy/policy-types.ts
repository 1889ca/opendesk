/** Contract: contracts/app-admin/policy.md */

/**
 * Client-side type mirror of the server's WorkspacePolicy. The server is
 * the source of truth; this file re-declares the shape for the admin UI
 * only. Breaking changes here MUST be coordinated with the server schema.
 */

export type ExportFormat = 'pdf' | 'docx' | 'odt' | 'xlsx' | 'ods' | 'pptx' | 'odp';

export interface SensitivityLabel {
  id: string;
  name: string;
  color: string;
  export_blocked: boolean;
}

export interface WorkspacePolicy {
  workspace_id: string;
  retention: {
    documents_days: number | null;
    audit_days: number | null;
    erasure_grace_days: number;
  };
  export: {
    allowed_formats: ExportFormat[];
    require_approval_over_mb: number | null;
  };
  dlp: {
    blocked_keywords: string[];
    blocked_regex: string[];
    action: 'warn' | 'block';
  };
  watermark: {
    enabled: boolean;
    text_template: string;
    opacity: number;
  };
  sensitivity_labels: SensitivityLabel[];
  branding: {
    logo_url: string | null;
    accent_hex: string | null;
    product_name_override: string | null;
  };
  updated_at: string;
}

export const DEFAULT_POLICY: Omit<WorkspacePolicy, 'workspace_id' | 'updated_at'> = {
  retention: {
    documents_days: null,
    audit_days: 365,
    erasure_grace_days: 30,
  },
  export: {
    allowed_formats: ['pdf', 'docx', 'odt', 'xlsx', 'ods', 'pptx', 'odp'],
    require_approval_over_mb: null,
  },
  dlp: {
    blocked_keywords: [],
    blocked_regex: [],
    action: 'warn',
  },
  watermark: {
    enabled: false,
    text_template: '{user} — {date}',
    opacity: 0.15,
  },
  sensitivity_labels: [],
  branding: {
    logo_url: null,
    accent_hex: null,
    product_name_override: null,
  },
};
