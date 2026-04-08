/** Contract: contracts/app/rules.md */

import { type KBEntryRecord, fetchDatasetRows } from './kb-api.ts';

/** Column definition from the dataset metadata. */
interface ColumnDef {
  name: string;
  type: string;
  description?: string;
}

function getColumns(entry: KBEntryRecord): ColumnDef[] {
  const cols = entry.metadata?.columns;
  if (!Array.isArray(cols)) return [];
  return cols as ColumnDef[];
}

/** Render dataset table preview into a container. Loads rows async. */
export async function renderDatasetPreview(
  container: HTMLElement,
  entry: KBEntryRecord,
): Promise<void> {
  const columns = getColumns(entry);
  if (columns.length === 0) {
    const p = document.createElement('p');
    p.className = 'kb-detail__empty';
    p.textContent = 'No columns defined for this dataset.';
    container.appendChild(p);
    return;
  }

  const loading = document.createElement('p');
  loading.className = 'kb-detail__loading';
  loading.textContent = 'Loading data\u2026';
  container.appendChild(loading);

  try {
    const { rows, total } = await fetchDatasetRows(entry.id, { limit: 50 });
    loading.remove();

    const table = document.createElement('table');
    table.className = 'kb-dataset-table';

    // Header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    for (const col of columns) {
      const th = document.createElement('th');
      th.textContent = col.name;
      if (col.description) th.title = col.description;
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body
    const tbody = document.createElement('tbody');
    for (const row of rows) {
      const tr = document.createElement('tr');
      for (const col of columns) {
        const td = document.createElement('td');
        const val = row.data[col.name];
        td.textContent = val === undefined || val === null ? '' : String(val);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    container.appendChild(table);

    // Row count footer
    if (total > rows.length) {
      const footer = document.createElement('p');
      footer.className = 'kb-dataset-table__footer';
      footer.textContent = `Showing ${rows.length} of ${total} rows`;
      container.appendChild(footer);
    } else if (total === 0) {
      const empty = document.createElement('p');
      empty.className = 'kb-detail__empty';
      empty.textContent = 'No data rows yet.';
      container.appendChild(empty);
    }
  } catch (err) {
    loading.textContent = 'Failed to load data rows.';
    console.error('Dataset preview error:', err);
  }
}
