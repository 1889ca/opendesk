/** Contract: contracts/workflow/rules.md */
import { initWorkflowEditor } from './workflow-editor.ts';

// Apply stored theme
const stored = localStorage.getItem('opendesk-theme');
const theme = stored === 'dark' ? 'dark'
  : stored === 'light' ? 'light'
  : (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
document.documentElement.setAttribute('data-theme', theme);

const root = document.getElementById('workflow-root');
if (root) {
  initWorkflowEditor(root);
}
