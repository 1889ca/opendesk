/** Contract: contracts/app/shell.md */

/**
 * SPA entry point. Replaces separate HTML page entry points
 * (editor.ts, doc-list.ts) with a unified shell that handles
 * client-side routing and dynamic module loading.
 */

import { initShell } from './shell.ts';

document.addEventListener('DOMContentLoaded', initShell);
