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

  // Table toolbar
  'table.insert': string;
  'table.addRowBefore': string;
  'table.addRowAfter': string;
  'table.deleteRow': string;
  'table.addColumnBefore': string;
  'table.addColumnAfter': string;
  'table.deleteColumn': string;
  'table.mergeCells': string;
  'table.splitCell': string;
  'table.toggleHeaderRow': string;
  'table.toggleHeaderColumn': string;
  'table.deleteTable': string;

  // Images
  'toolbar.image': string;
  'image.uploading': string;
  'image.uploadFailed': string;
  'image.tooLarge': string;
  'image.unsupportedType': string;
  'image.insertTitle': string;

  // Search & Replace
  'search.find': string;
  'search.replace': string;
  'search.findNext': string;
  'search.findPrev': string;
  'search.replaceOne': string;
  'search.replaceAll': string;
  'search.caseSensitive': string;
  'search.useRegex': string;
  'search.matchCount': string;
  'search.noMatches': string;
  'search.close': string;
  'toolbar.find': string;

  // Comments
  'toolbar.comment': string;
  'comments.title': string;
  'comments.sidebarLabel': string;
  'comments.closeSidebar': string;
  'comments.noComments': string;
  'comments.placeholder': string;
  'comments.replyPlaceholder': string;
  'comments.add': string;
  'comments.cancel': string;
  'comments.reply': string;
  'comments.resolve': string;
  'comments.reopen': string;
  'comments.delete': string;

  // Language switcher
  'lang.label': string;
  'lang.en': string;
  'lang.fr': string;
}

export type TranslationKey = keyof TranslationKeys;
export type Locale = 'en' | 'fr';
