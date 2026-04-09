# Contract: AI (Model Zoo)

## Purpose

Sovereign-safe AI model management: curated model registry, Ollama integration, and per-workspace model selection.

## Inputs

- `ollamaBaseUrl`: `string` — Ollama API endpoint (default `http://localhost:11434`)
- `pool`: `pg.Pool` — PostgreSQL connection pool for persisting model config
- Model zoo entries from `model-zoo.json`

## Outputs

- `ModelZooEntry` — curated model metadata (name, provider tag, capabilities, license, hardware reqs)
- `ModelConfig` — per-workspace active model selection (embedding + generation)
- `OllamaStatus` — installed model list and pull progress

## Side Effects

- Triggers Ollama `/api/pull` to download models
- Triggers Ollama `/api/delete` to remove models
- Writes to `ai_model_config` table for workspace model preferences

## Invariants

- All zoo models must have permissive licenses (Apache 2.0, MIT, or open-weight)
- Only one embedding model and one generation model active per workspace at a time
- Custom models are tagged `custom` and stored alongside zoo entries in config
- Model pull/delete operations are proxied through Ollama REST API, never direct filesystem

## Dependencies

- `storage` — PostgreSQL pool for ai_model_config persistence
- `logger` — structured logging
- Ollama REST API — model management

## Boundary Rules

- MUST: Validate model IDs against zoo + custom registry before pull
- MUST: Return real Ollama download progress, not synthetic
- MUST NOT: Ship models that require proprietary licenses
- MUST NOT: Store model weights in PostgreSQL — Ollama manages storage

## Verification

- Zoo JSON validates against schema (all required fields present, licenses permissive)
- Config persistence round-trips (save then load returns same model selection)
- Pull/delete proxy calls hit correct Ollama endpoints
