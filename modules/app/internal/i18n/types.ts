/** Contract: contracts/app/rules.md */
/**
 * All translation keys used in the app.
 * Both en.ts and fr.ts must implement this type fully.
 */
export interface TranslationKeys {
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
  'status.connected': string;
  'status.disconnected': string;
  'status.connecting': string;
  'editor.editors': string;
  'editor.backToDocuments': string;
  'editor.loading': string;
  'editor.untitled': string;
  'export.html': string;
  'export.text': string;
  'export.htmlTitle': string;
  'export.textTitle': string;
  'docList.newDocument': string;
  'docList.loading': string;
  'docList.noDocuments': string;
  'docList.noDocumentsSubtitle': string;
  'docList.delete': string;
  'docList.deleteConfirm': string;
  'docList.updated': string;
  'docList.loadFailed': string;
  'docList.titlePrompt': string;
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
  'toolbar.image': string;
  'image.uploading': string;
  'image.uploadFailed': string;
  'image.tooLarge': string;
  'image.unsupportedType': string;
  'image.insertTitle': string;
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

  // Suggestions (track changes)
  'suggestions.title': string;
  'suggestions.sidebarLabel': string;
  'suggestions.suggesting': string;
  'suggestions.editing': string;
  'suggestions.accept': string;
  'suggestions.reject': string;
  'suggestions.acceptAll': string;
  'suggestions.rejectAll': string;
  'suggestions.none': string;
  'suggestions.inserted': string;
  'suggestions.deleted': string;
  'suggestions.by': string;
  'toolbar.suggest': string;

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

  // Mobile / overflow
  'toolbar.moreOptions': string;
  'comments.dismissSheet': string;

  // Document statistics
  'stats.words': string;
  'stats.characters': string;
  'stats.paragraphs': string;
  'stats.readingTime': string;
  'stats.selected': string;
  'stats.minRead': string;

  // Version history
  'versions.title': string;
  'versions.save': string;
  'versions.restore': string;
  'versions.delete': string;
  'versions.current': string;
  'versions.preview': string;
  'versions.restoreConfirm': string;
  'versions.autoSaved': string;
  'versions.noVersions': string;
  'versions.versionNumber': string;
  'versions.close': string;
  'toolbar.versions': string;

  // Table of contents
  'toolbar.toc': string;
  'toc.title': string;
  'toc.noHeadings': string;
  'toc.heading': string;

  // Folders
  'folders.new': string;
  'folders.rename': string;
  'folders.delete': string;
  'folders.moveTo': string;
  'folders.root': string;
  'folders.breadcrumb': string;
  'folders.empty': string;
  'folders.deleteConfirm': string;
  'folders.renamePrompt': string;
  'folders.namePrompt': string;

  // Theme
  'toolbar.theme': string;
  'theme.light': string;
  'theme.dark': string;
  'theme.system': string;

  // Global search
  'search.global': string;
  'search.placeholder': string;
  'search.noResults': string;
  'search.searching': string;
  'search.resultCount': string;
}

export type TranslationKey = keyof TranslationKeys;
export type Locale = 'en' | 'fr';
