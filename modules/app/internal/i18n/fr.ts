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

  // Sélecteur de langue
  'lang.label': 'Langue',
  'lang.en': 'English',
  'lang.fr': 'Français',
};
