/** Contract: contracts/app/rules.md */
import type { TranslationKeys } from './types.ts';

export const fr: TranslationKeys = {
  // Barre d'outils - boutons de formatage
  'toolbar.bold': 'G',
  'toolbar.italic': 'I',
  'toolbar.strike': 'B',
  'toolbar.code': 'Code',
  'toolbar.heading1': 'T1',
  'toolbar.heading2': 'T2',
  'toolbar.heading3': 'T3',
  'toolbar.bulletList': 'Liste',
  'toolbar.orderedList': '1.',
  'toolbar.blockquote': 'Citation',
  'toolbar.codeBlock': '<>',
  'toolbar.horizontalRule': 'Ligne',

  // \u00c9tat de l'\u00e9diteur
  'status.connected': 'Connect\u00e9',
  'status.disconnected': 'D\u00e9connect\u00e9',
  'status.connecting': 'Connexion...',

  // Interface de l'\u00e9diteur
  'editor.editors': '\u00c9diteurs :',
  'editor.backToDocuments': 'Retour aux documents',
  'editor.loading': 'Chargement...',
  'editor.untitled': 'Sans titre',

  // Exportation
  'export.html': 'HTML',
  'export.text': 'Texte',
  'export.htmlTitle': 'Exporter en HTML',
  'export.textTitle': 'Exporter en texte brut',

  // Liste des documents
  'docList.newDocument': 'Nouveau document',
  'docList.loading': 'Chargement des documents...',
  'docList.noDocuments': 'Aucun document',
  'docList.noDocumentsSubtitle': 'Cr\u00e9ez votre premier document pour commencer.',
  'docList.delete': 'Supprimer',
  'docList.deleteConfirm': 'Supprimer \u00ab {name} \u00bb ? Cette action est irr\u00e9versible.',
  'docList.updated': 'Modifi\u00e9 {time}',
  'docList.loadFailed': 'Impossible de charger les documents',
  'docList.titlePrompt': 'Titre du document :',

  // Temps \u00e9coul\u00e9
  'time.justNow': '\u00e0 l\u2019instant',
  'time.secondsAgo': 'il y a {n} secondes',
  'time.minuteAgo': 'il y a 1 minute',
  'time.minutesAgo': 'il y a {n} minutes',
  'time.hourAgo': 'il y a 1 heure',
  'time.hoursAgo': 'il y a {n} heures',
  'time.dayAgo': 'il y a 1 jour',
  'time.daysAgo': 'il y a {n} jours',
  'time.monthAgo': 'il y a 1 mois',
  'time.monthsAgo': 'il y a {n} mois',

  // Barre d'outils tableau
  'table.insert': 'Tableau',
  'table.addRowBefore': '+ Ligne dessus',
  'table.addRowAfter': '+ Ligne dessous',
  'table.deleteRow': '- Ligne',
  'table.addColumnBefore': '+ Col gauche',
  'table.addColumnAfter': '+ Col droite',
  'table.deleteColumn': '- Col',
  'table.mergeCells': 'Fusionner',
  'table.splitCell': 'Scinder',
  'table.toggleHeaderRow': 'Ligne en-t\u00eate',
  'table.toggleHeaderColumn': 'Col en-t\u00eate',
  'table.deleteTable': 'Supprimer tableau',

  // Images
  'toolbar.image': 'Image',
  'image.uploading': 'Envoi en cours...',
  'image.uploadFailed': '\u00c9chec de l\u2019envoi',
  'image.tooLarge': 'Fichier trop volumineux (max 10 Mo)',
  'image.unsupportedType': 'Type de fichier non pris en charge',
  'image.insertTitle': 'Ins\u00e9rer une image',

  // Recherche & Remplacement
  'search.find': 'Rechercher...',
  'search.replace': 'Remplacer...',
  'search.findNext': 'Suivant',
  'search.findPrev': 'Pr\u00e9c\u00e9dent',
  'search.replaceOne': 'Remplacer',
  'search.replaceAll': 'Tout remplacer',
  'search.caseSensitive': 'Respecter la casse',
  'search.useRegex': 'Expression r\u00e9guli\u00e8re',
  'search.matchCount': '{current} sur {total}',
  'search.noMatches': 'Aucun r\u00e9sultat',
  'search.close': 'Fermer la recherche',
  'toolbar.find': 'Rechercher',

  // Commentaires
  'toolbar.comment': 'Commenter',
  'comments.title': 'Commentaires',
  'comments.sidebarLabel': 'Commentaires du document',
  'comments.closeSidebar': 'Fermer les commentaires',
  'comments.noComments': 'Aucun commentaire',
  'comments.placeholder': 'Ajouter un commentaire...',
  'comments.replyPlaceholder': 'R\u00e9pondre...',
  'comments.add': 'Commenter',
  'comments.cancel': 'Annuler',
  'comments.reply': 'R\u00e9pondre',
  'comments.resolve': 'R\u00e9soudre',
  'comments.reopen': 'Rouvrir',
  'comments.delete': 'Supprimer',

  // Suggestions (suivi des modifications)
  'suggestions.title': 'Suggestions',
  'suggestions.sidebarLabel': 'Suggestions du document',
  'suggestions.suggesting': 'Suggestion',
  'suggestions.editing': '\u00c9dition',
  'suggestions.accept': 'Accepter',
  'suggestions.reject': 'Rejeter',
  'suggestions.acceptAll': 'Tout accepter',
  'suggestions.rejectAll': 'Tout rejeter',
  'suggestions.none': 'Aucune suggestion',
  'suggestions.inserted': 'Ins\u00e9r\u00e9',
  'suggestions.deleted': 'Supprim\u00e9',
  'suggestions.by': 'Suggestion de {name}',
  'toolbar.suggest': 'Sugg\u00e9rer',

  // S\u00e9lecteur de langue
  'lang.label': 'Langue',
  'lang.en': 'English',
  'lang.fr': 'Fran\u00e7ais',

  // S\u00e9lecteur de mod\u00e8les
  'templates.title': 'Choisir un mod\u00e8le',
  'templates.blank': 'Vierge',
  'templates.blankDesc': 'Commencer avec une page vide',
  'templates.meetingNotes': 'Notes de r\u00e9union',
  'templates.meetingNotesDesc': 'Participants, ordre du jour et actions \u00e0 suivre',
  'templates.projectBrief': 'Brief de projet',
  'templates.projectBriefDesc': 'Objectifs, p\u00e9rim\u00e8tre, calendrier et \u00e9quipe',
  'templates.report': 'Rapport',
  'templates.reportDesc': 'Rapport structur\u00e9 avec r\u00e9sum\u00e9 et conclusions',
  'templates.selectTitle': 'Nouveau document',
  'templates.loading': 'Chargement des mod\u00e8les...',
  'templates.loadFailed': 'Impossible de charger les mod\u00e8les',

  // Mobile / d\u00e9bordement
  'toolbar.moreOptions': 'Plus d\u2019options',
  'comments.dismissSheet': 'Fermer les commentaires',
};
