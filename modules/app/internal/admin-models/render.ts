/** Contract: contracts/app/rules.md */
import type { ModelListItem, ModelConfig } from './api.ts';
import { pullModel, deleteModel, setActiveModel, deleteCustomModel } from './api.ts';

/** Render the active config display. */
export function renderConfig(config: ModelConfig, models: ModelListItem[]): void {
  const embEl = document.getElementById('active-embedding');
  const genEl = document.getElementById('active-generation');
  if (embEl) {
    const m = models.find((x) => x.id === config.embeddingModel);
    embEl.textContent = m ? m.name : (config.embeddingModel || 'Not configured');
  }
  if (genEl) {
    const m = models.find((x) => x.id === config.generationModel);
    genEl.textContent = m ? m.name : (config.generationModel || 'Not configured');
  }
}

type Filters = {
  capability: string;
  tier: string;
  usecase: string;
  status: string;
};

/** Filter models by current filter selections. */
export function filterModels(models: ModelListItem[], f: Filters): ModelListItem[] {
  return models.filter((m) => {
    if (f.capability && m.capability !== f.capability) return false;
    if (f.tier && m.tier !== f.tier) return false;
    if (f.usecase && !(m.useCases ?? []).includes(f.usecase)) return false;
    if (f.status === 'installed' && !m.installed) return false;
    if (f.status === 'available' && m.installed) return false;
    return true;
  });
}

/** Render a single model card. */
export function renderCard(
  model: ModelListItem,
  config: ModelConfig,
  onRefresh: () => void,
): HTMLElement {
  const card = document.createElement('div');
  card.className = `model-card${model.installed ? ' installed' : ''}`;
  card.dataset.id = model.id;

  const header = document.createElement('div');
  header.className = 'model-card-header';
  const h3 = document.createElement('h3');
  h3.textContent = model.name;
  const meta = document.createElement('span');
  meta.className = 'model-card-meta';
  meta.textContent = model.sizeGb ? `${model.sizeGb} GB` : '';
  header.append(h3, meta);

  const badges = document.createElement('div');
  badges.className = 'badges';
  if (model.isCustom) badges.append(makeBadge('custom', 'badge-custom'));
  if (model.installed) badges.append(makeBadge('installed', 'badge-installed'));
  if (model.license) badges.append(makeBadge(shortLicense(model.license), 'badge-license'));
  if (model.tier) badges.append(makeBadge(model.tier, `badge-tier-${model.tier}`));
  badges.append(makeBadge(model.capability, 'badge-capability'));
  for (const uc of model.useCases ?? []) badges.append(makeBadge(uc, 'badge-usecase'));

  card.append(header, badges);

  if (model.description) {
    const desc = document.createElement('p');
    desc.className = 'model-description';
    desc.textContent = model.description;
    card.append(desc);
  }

  if (model.hardware) {
    const hw = document.createElement('p');
    hw.className = 'model-hardware';
    hw.textContent = `RAM: ${model.hardware.ramGb} GB | VRAM: ${model.hardware.vramGb} GB`;
    card.append(hw);
  }

  card.append(buildActions(model, config, onRefresh));
  return card;
}

function makeBadge(text: string, cls: string): HTMLSpanElement {
  const el = document.createElement('span');
  el.className = `badge ${cls}`;
  el.textContent = text;
  return el;
}

function shortLicense(license: string): string {
  if (license.includes('Apache')) return 'Apache 2.0';
  if (license.includes('MIT')) return 'MIT';
  if (license.includes('open-weight')) return 'Open Weight';
  return license.slice(0, 20);
}

function buildActions(
  model: ModelListItem,
  config: ModelConfig,
  onRefresh: () => void,
): HTMLElement {
  const actions = document.createElement('div');
  actions.className = 'model-actions';

  if (!model.installed) {
    const pullBtn = document.createElement('button');
    pullBtn.className = 'btn btn-primary';
    pullBtn.textContent = 'Install';
    pullBtn.onclick = () => handlePull(model, pullBtn, onRefresh);
    actions.append(pullBtn);
  } else {
    if (model.capability === 'embed' || model.capability === 'both') {
      const embBtn = document.createElement('button');
      embBtn.className = config.embeddingModel === model.id ? 'btn btn-secondary' : 'btn btn-primary';
      embBtn.textContent = config.embeddingModel === model.id ? 'Active (Embed)' : 'Set Embed';
      embBtn.disabled = config.embeddingModel === model.id;
      embBtn.onclick = async () => { await setActiveModel('embedding', model.id); onRefresh(); };
      actions.append(embBtn);
    }
    if (model.capability === 'generate' || model.capability === 'both') {
      const genBtn = document.createElement('button');
      genBtn.className = config.generationModel === model.id ? 'btn btn-secondary' : 'btn btn-primary';
      genBtn.textContent = config.generationModel === model.id ? 'Active (Gen)' : 'Set Generate';
      genBtn.disabled = config.generationModel === model.id;
      genBtn.onclick = async () => { await setActiveModel('generation', model.id); onRefresh(); };
      actions.append(genBtn);
    }
    const rmBtn = document.createElement('button');
    rmBtn.className = 'btn btn-danger';
    rmBtn.textContent = 'Remove';
    rmBtn.onclick = async () => { await deleteModel(model.id); onRefresh(); };
    actions.append(rmBtn);
  }

  if (model.isCustom) {
    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-danger';
    delBtn.textContent = 'Unregister';
    delBtn.onclick = async () => { await deleteCustomModel(model.id); onRefresh(); };
    actions.append(delBtn);
  }

  return actions;
}

async function handlePull(
  model: ModelListItem,
  btn: HTMLButtonElement,
  onRefresh: () => void,
): Promise<void> {
  const card = btn.closest('.model-card')!;
  btn.disabled = true;
  btn.textContent = 'Pulling...';

  const progressBar = document.createElement('div');
  progressBar.className = 'pull-progress';
  const bar = document.createElement('div');
  bar.className = 'pull-progress-bar';
  bar.style.width = '0%';
  progressBar.append(bar);

  const status = document.createElement('span');
  status.className = 'pull-status';
  card.append(progressBar, status);

  await pullModel(model.id, (data) => {
    status.textContent = data.status;
    if (data.total && data.completed) {
      const pct = Math.round((data.completed / data.total) * 100);
      bar.style.width = `${pct}%`;
    }
  });

  onRefresh();
}
