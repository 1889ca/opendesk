/** Contract: contracts/app/charts.md */
import type { ChartType, ChartRange } from './chart-types.ts';
import type { ChartManager } from './chart-manager.ts';

export interface SelectionProvider {
  getSelection(): ChartRange | null;
}

export function createChartToolbar(
  manager: ChartManager,
  selectionProvider: SelectionProvider,
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'chart-toolbar';

  const btn = document.createElement('button');
  btn.className = 'chart-insert-btn';
  btn.textContent = 'Insert Chart';
  btn.title = 'Insert a chart from selected cells';

  const dropdown = document.createElement('div');
  dropdown.className = 'chart-type-dropdown';
  dropdown.style.display = 'none';

  const types: { type: ChartType; label: string; icon: string }[] = [
    { type: 'bar', label: 'Bar Chart', icon: '\u2587\u2585\u2583' },
    { type: 'line', label: 'Line Chart', icon: '\u2571\u2572\u2571' },
    { type: 'pie', label: 'Pie Chart', icon: '\u25d4' },
  ];

  for (const t of types) {
    const item = document.createElement('button');
    item.className = 'chart-type-option';
    item.innerHTML = `<span class="chart-type-icon">${t.icon}</span> ${t.label}`;
    item.addEventListener('click', () => {
      dropdown.style.display = 'none';
      insertChart(t.type, manager, selectionProvider);
    });
    dropdown.appendChild(item);
  }

  btn.addEventListener('click', () => {
    const visible = dropdown.style.display !== 'none';
    dropdown.style.display = visible ? 'none' : 'flex';
  });

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target as Node)) {
      dropdown.style.display = 'none';
    }
  });

  wrapper.appendChild(btn);
  wrapper.appendChild(dropdown);

  return wrapper;
}

function insertChart(
  type: ChartType,
  manager: ChartManager,
  selectionProvider: SelectionProvider,
): void {
  const range = selectionProvider.getSelection();
  if (!range) {
    // Default: use first 5 rows x 3 cols
    manager.insertChart(type, {
      startRow: 0, startCol: 0,
      endRow: 4, endCol: 2,
    });
    return;
  }
  manager.insertChart(type, range);
}
