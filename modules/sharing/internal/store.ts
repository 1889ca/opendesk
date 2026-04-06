/** Contract: contracts/sharing/rules.md */

import type { ShareLink } from '../contract.ts';

/**
 * Storage interface for share links.
 * Implementations must be swappable (in-memory, PostgreSQL, etc.).
 */
export interface ShareLinkStore {
  save(link: ShareLink): Promise<void>;
  findByToken(token: string): Promise<ShareLink | null>;
  update(token: string, patch: Partial<ShareLink>): Promise<void>;
  listByDoc(docId: string): Promise<ShareLink[]>;
}

/**
 * In-memory implementation of ShareLinkStore.
 * Suitable for development and testing only.
 */
export function createInMemoryShareLinkStore(): ShareLinkStore {
  const links = new Map<string, ShareLink>();

  return {
    async save(link) {
      links.set(link.token, { ...link });
    },

    async findByToken(token) {
      const link = links.get(token);
      return link ? { ...link } : null;
    },

    async update(token, patch) {
      const existing = links.get(token);
      if (!existing) return;
      links.set(token, { ...existing, ...patch });
    },

    async listByDoc(docId) {
      return [...links.values()].filter((l) => l.docId === docId);
    },
  };
}
