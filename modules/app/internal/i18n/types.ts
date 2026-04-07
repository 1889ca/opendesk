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

  // Print & PDF
  'toolbar.print': string;
  'toolbar.pdf': string;
  'toolbar.pageBreak': string;
  'print.title': string;
  'pdf.title': string;
  'pageBreak.title': string;

  // Template picker
  'templates.title': string;
  'templates.blank': string;
  'templates.blankDesc': string;
  'templates.meetingNotes': string;
  'templates.meetingNotesDesc': string;
  'templates.projectBrief': string;
  'templates.projectBriefDesc': string;
  'templates.report': string;
  'templates.reportDesc': string;
  'templates.selectTitle': string;
  'templates.loading': string;
  'templates.loadFailed': string;

  // Accessibility
  'a11y.skipToContent': string;
  'a11y.formattingToolbar': string;
  'a11y.boldLabel': string;
  'a11y.italicLabel': string;
  'a11y.strikeLabel': string;
  'a11y.codeLabel': string;
  'a11y.heading1Label': string;
  'a11y.heading2Label': string;
  'a11y.heading3Label': string;
  'a11y.bulletListLabel': string;
  'a11y.orderedListLabel': string;
  'a11y.blockquoteLabel': string;
  'a11y.codeBlockLabel': string;
  'a11y.horizontalRuleLabel': string;
  'a11y.tableLabel': string;
  'a11y.imageLabel': string;
  'a11y.findLabel': string;
  'a11y.commentLabel': string;
  'a11y.shortcutsLabel': string;
  'a11y.boldOn': string;
  'a11y.boldOff': string;
  'a11y.italicOn': string;
  'a11y.italicOff': string;
  'a11y.strikeOn': string;
  'a11y.strikeOff': string;
  'a11y.codeOn': string;
  'a11y.codeOff': string;
  'a11y.commentAdded': string;
  'a11y.searchMatches': string;
  'a11y.commentSidebar': string;
  'a11y.mainEditor': string;

  // Shortcut dialog
  'shortcuts.title': string;
  'shortcuts.close': string;
  'shortcuts.formatting': string;
  'shortcuts.navigation': string;
  'shortcuts.comments': string;
  'shortcuts.search': string;
  'shortcuts.document': string;
  'shortcuts.bold': string;
  'shortcuts.italic': string;
  'shortcuts.strikethrough': string;
  'shortcuts.code': string;
  'shortcuts.heading1': string;
  'shortcuts.heading2': string;
  'shortcuts.heading3': string;
  'shortcuts.bulletList': string;
  'shortcuts.orderedList': string;
  'shortcuts.blockquote': string;
  'shortcuts.codeBlock': string;
  'shortcuts.horizontalRule': string;
  'shortcuts.addComment': string;
  'shortcuts.find': string;
  'shortcuts.findReplace': string;
  'shortcuts.undo': string;
  'shortcuts.redo': string;
  'shortcuts.showShortcuts': string;
}

export type TranslationKey = keyof TranslationKeys;
export type Locale = 'en' | 'fr';
