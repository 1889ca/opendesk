/** Contract: contracts/ai/rules.md */

import type { OpenDeskManifest, AppContext } from '../core/manifest/contract.ts';
import type { AiModule } from './contract.ts';
import { createAi } from './internal/create-ai.ts';
import { createAiRoutes } from './internal/ai-routes.ts';

const AI_HANDLE = 'ai:module';

/**
 * AI module manifest.
 *
 * Contributes the `/api/ai` REST surface (semantic search, RAG
 * assistant, embedding ingestion) only when `config.ai.enabled` is
 * true.
 *
 * Unlike erasure/federation, the AI module owns a long-lived
 * background consumer (`startConsumer` / `stopConsumer`) that needs
 * a real lifecycle hook. The handle is created once in `onStart`,
 * registered into the AppContext under {@link AI_HANDLE} so the
 * route factory can read it without re-creating the module, and
 * stopped in `onShutdown` during graceful teardown.
 */
export const manifest: OpenDeskManifest = {
  name: 'ai',
  contract: 'contracts/ai/rules.md',
  enabled: (config) => config.ai.enabled,

  lifecycle: {
    onStart: (ctx: AppContext) => {
      const ai = createAi({
        pool: ctx.pool,
        config: ctx.config.ai,
        eventBus: ctx.eventBus,
      });
      ai.startConsumer();
      ctx.register(AI_HANDLE, ai);
      return ai;
    },
    onShutdown: (handle) => {
      (handle as AiModule).stopConsumer();
    },
  },

  apiRoutes: [
    {
      mount: '/api/ai',
      factory: (ctx) => {
        const ai = ctx.get<AiModule>(AI_HANDLE);
        if (!ai) {
          throw new Error(
            'ai manifest: route factory ran before onStart registered the AI handle ' +
              '— composition root must call runManifestStartHooks before mountManifestRoutes',
          );
        }
        return createAiRoutes({ ai, permissions: ctx.permissions });
      },
    },
  ],
};
