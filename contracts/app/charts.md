# Contract: app/charts

## Purpose

Provide chart visualization for the spreadsheet editor. Users can insert bar, line, and pie charts from selected cell ranges. Charts render as Canvas 2D overlays on the spreadsheet grid, support drag/resize, update live when underlying data changes, and sync between collaborators via Yjs.

## Inputs

- User selection: current cell range from the spreadsheet grid
- Cell data: values read from Yjs `Y.Array<Y.Array<string>>` sheet data
- Chart definitions: stored in a Yjs `Y.Map` (`charts-0`) keyed by chart ID
- User interactions: drag to move, resize handles, chart type picker

## Outputs

- Canvas 2D rendered charts (bar, line, pie) overlaid on the spreadsheet grid
- Chart definitions synced to Yjs for real-time collaboration
- Toolbar UI for inserting and configuring charts

## Side Effects

- Reads and writes to Yjs shared document (`charts-0` Y.Map)
- Creates and manages Canvas elements in the DOM
- Attaches mouse event listeners for drag/resize

## Invariants

1. **Charts reference valid ranges.** A chart's data range must reference existing rows/columns in the sheet.
2. **Live updates.** When cell data within a chart's range changes, the chart re-renders automatically.
3. **Collaborative sync.** Chart creation, movement, resize, and deletion sync via Yjs to all connected peers.
4. **No external libraries.** Charts use Canvas 2D API only. No chart libraries (Chart.js, D3, etc.).
5. **File size limits.** Each source file stays under 200 lines.

## Dependencies

- Yjs (`Y.Doc`, `Y.Map`) for chart data storage and sync
- Spreadsheet editor DOM for overlay positioning

## Boundary Rules

### MUST

- Store chart definitions in Yjs for real-time sync
- Use Canvas 2D for all chart rendering
- Support bar, line, and pie chart types
- Re-render when source data changes (observe Yjs sheet data)
- Keep all files under 200 lines
- Include contract header in every source file

### MUST NOT

- Import external charting libraries
- Use SVG (Canvas 2D for consistency with existing patterns)
- Store chart data outside Yjs
- Implement business logic (pure rendering and interaction layer)

## File Structure

```
modules/app/internal/charts/
  chart-types.ts       -- Type definitions for chart data model
  chart-data.ts        -- Extract numeric data from cell ranges
  chart-manager.ts     -- Yjs integration, chart CRUD, observation
  chart-overlay.ts     -- DOM overlay, drag/resize, Canvas lifecycle
  bar-chart.ts         -- Bar chart Canvas 2D renderer
  line-chart.ts        -- Line chart Canvas 2D renderer
  pie-chart.ts         -- Pie chart Canvas 2D renderer
  chart-toolbar.ts     -- Insert Chart button and type picker UI
```
