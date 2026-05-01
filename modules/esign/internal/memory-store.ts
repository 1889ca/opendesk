/** Contract: contracts/esign/rules.md */

/**
 * Skeleton in-memory EsignStore. Hmac chaining is implemented with a
 * shared-secret placeholder; production will draw the HMAC key from the
 * same KMS path the `audit` module uses.
 *
 * The real implementation must:
 *   - Persist to Postgres with a per-packet hash chain table
 *   - Call a configured RFC 3161 TSA on every signature_applied step
 *   - Embed PKCS#7 signatures in the PDF via `pdf-edit`
 *   - Reject signature_applied steps without a preceding
 *     identity_challenge AND intent_affirmed within the same signer scope
 */

import { createHmac, randomUUID } from 'node:crypto';
import {
  SigningPacketSchema,
  CeremonyStepSchema,
  type CeremonyStep,
  type EsignStore,
  type SigningPacket,
} from '../contract.ts';

const PLACEHOLDER_KEY = Buffer.from('esign-skeleton-hmac-key', 'utf8');

function computeRowHmac(prev: string | null, payload: object): string {
  const h = createHmac('sha256', PLACEHOLDER_KEY);
  h.update(prev ?? '');
  h.update('|');
  h.update(JSON.stringify(payload));
  return h.digest('hex');
}

export function createMemoryEsignStore(): EsignStore {
  const packets = new Map<string, SigningPacket>();
  const trails = new Map<string, CeremonyStep[]>();

  return {
    async createPacket(input) {
      const packet: SigningPacket = SigningPacketSchema.parse({
        id: randomUUID(),
        status: 'draft',
        created_at: new Date().toISOString(),
        ...input,
      });
      packets.set(packet.id, packet);
      trails.set(packet.id, []);
      return packet;
    },

    async getPacket(id) {
      return packets.get(id) ?? null;
    },

    async recordCeremonyStep(input) {
      const trail = trails.get(input.packet_id);
      if (!trail) throw new Error(`packet not found: ${input.packet_id}`);

      const prev = trail.at(-1)?.row_hmac ?? null;
      const id = randomUUID();
      const created_at = new Date().toISOString();
      const payload = {
        id,
        packet_id: input.packet_id,
        signer_id: input.signer_id,
        type: input.type,
        ip: input.ip,
        user_agent: input.user_agent,
        payload_data: input.payload,
        created_at,
      };
      const row_hmac = computeRowHmac(prev, payload);

      const step: CeremonyStep = CeremonyStepSchema.parse({
        ...input,
        id,
        created_at,
        prev_hmac: prev,
        row_hmac,
      });

      trail.push(step);
      return step;
    },

    async getAuditTrail(packetId) {
      return trails.get(packetId) ?? [];
    },

    async markCompleted(id) {
      const packet = packets.get(id);
      if (!packet) throw new Error(`packet not found: ${id}`);
      packets.set(id, { ...packet, status: 'completed' });
    },

    async revoke(id, _by) {
      const packet = packets.get(id);
      if (!packet) throw new Error(`packet not found: ${id}`);
      packets.set(id, { ...packet, status: 'revoked' });
    },
  };
}
