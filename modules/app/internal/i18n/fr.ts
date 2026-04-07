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

  // État de l'éditeur
  'status.connected': 'Connecté',
  'status.disconnected': 'Déconnecté',
  'status.connecting': 'Connexion...',

  // Interface de l'éditeur
  'editor.editors': 'Éditeurs :',
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
  'docList.noDocumentsSubtitle': 'Créez votre premier document pour commencer.',
  'docList.delete': 'Supprimer',
  'docList.deleteConfirm': 'Supprimer « {name} » ? Cette action est irréversible.',
  'docList.updated': 'Modifié {time}',
  'docList.loadFailed': 'Impossible de charger les documents',
  'docList.titlePrompt': 'Titre du document :',

  // Temps écoulé
  'time.justNow': 'à l\u2019instant',
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
  'table.toggleHeaderRow': 'Ligne en-tête',
  'table.toggleHeaderColumn': 'Col en-tête',
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

  // S\u00e9lecteur de langue
  'lang.label': 'Langue',
  'lang.en': 'English',
  'lang.fr': 'Français',
};
