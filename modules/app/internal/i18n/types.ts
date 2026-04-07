/** Contract: contracts/app/rules.md */

/**
 * All translation keys used in the app.
 * Both en.ts and fr.ts must implement this type fully.
 */
export interface TranslationKeys {
  // Toolbar - formatting buttons
  'toolbar.bold': string;
  'toolbar.italic': string;
  'toolbar.strike': string;
  'toolbar.code': string;
  'toolbar.heading1': string;
  'toolbar.heading2': string;
  'toolbar.heading3': string;
  'toolbar.bulletList': string;
  'toolbar.orderedList': string;
  'toolbar.blockquote': string;
  'toolbar.codeBlock': string;
  'toolbar.horizontalRule': string;

  // Editor status
  'status.connected': string;
  'status.disconnected': string;
  'status.connecting': string;

  // Editor chrome
  'editor.editors': string;
  'editor.backToDocuments': string;
  'editor.loading': string;
  'editor.untitled': string;

  // Export
  'export.html': string;
  'export.text': string;
  'export.htmlTitle': string;
  'export.textTitle': string;

  // Document list
  'docList.newDocument': string;
  'docList.loading': string;
  'docList.noDocuments': string;
  'docList.noDocumentsSubtitle': string;
  'docList.delete': string;
  'docList.deleteConfirm': string;
  'docList.updated': string;
  'docList.loadFailed': string;
  'docList.titlePrompt': string;

  // Time ago
  'time.justNow': string;
  'time.secondsAgo': string;
  'time.minuteAgo': string;
  'time.minutesAgo': string;
  'time.hourAgo': string;
  'time.hoursAgo': string;
  'time.dayAgo': string;
  'time.daysAgo': string;
  'time.monthAgo': string;
  'time.monthsAgo': string;

  // Images
  'toolbar.image': string;
  'image.uploading': string;
  'image.uploadFailed': string;
  'image.tooLarge': string;
  'image.unsupportedType': string;
  'image.insertTitle': string;

  // Language switcher
  'lang.label': string;
  'lang.en': string;
  'lang.fr': string;
}

export type TranslationKey = keyof TranslationKeys;
export type Locale = 'en' | 'fr';
