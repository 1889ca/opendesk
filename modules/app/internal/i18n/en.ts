/** Contract: contracts/app/rules.md */
import type { TranslationKeys } from './types.ts';

export const en: TranslationKeys = {
  // Toolbar - formatting buttons
  'toolbar.bold': 'B',
  'toolbar.italic': 'I',
  'toolbar.strike': 'S',
  'toolbar.code': 'Code',
  'toolbar.heading1': 'H1',
  'toolbar.heading2': 'H2',
  'toolbar.heading3': 'H3',
  'toolbar.bulletList': 'List',
  'toolbar.orderedList': '1.',
  'toolbar.blockquote': 'Quote',
  'toolbar.codeBlock': '<>',
  'toolbar.horizontalRule': 'HR',

  // Editor status
  'status.connected': 'Connected',
  'status.disconnected': 'Disconnected',
  'status.connecting': 'Connecting...',

  // Editor chrome
  'editor.editors': 'Editors:',
  'editor.backToDocuments': 'Back to documents',
  'editor.loading': 'Loading...',
  'editor.untitled': 'Untitled',

  // Export
  'export.html': 'HTML',
  'export.text': 'Text',
  'export.htmlTitle': 'Export as HTML',
  'export.textTitle': 'Export as plain text',

  // Document list
  'docList.newDocument': 'New Document',
  'docList.loading': 'Loading documents...',
  'docList.noDocuments': 'No documents yet',
  'docList.noDocumentsSubtitle': 'Create your first document to get started.',
  'docList.delete': 'Delete',
  'docList.deleteConfirm': 'Delete "{name}"? This cannot be undone.',
  'docList.updated': 'Updated {time}',
  'docList.loadFailed': 'Failed to load documents',
  'docList.titlePrompt': 'Document title:',

  // Time ago
  'time.justNow': 'just now',
  'time.secondsAgo': '{n} seconds ago',
  'time.minuteAgo': '1 minute ago',
  'time.minutesAgo': '{n} minutes ago',
  'time.hourAgo': '1 hour ago',
  'time.hoursAgo': '{n} hours ago',
  'time.dayAgo': '1 day ago',
  'time.daysAgo': '{n} days ago',
  'time.monthAgo': '1 month ago',
  'time.monthsAgo': '{n} months ago',

  // Language switcher
  'lang.label': 'Language',
  'lang.en': 'English',
  'lang.fr': 'Français',
};
