/** Contract: contracts/app/suggestions.md */
export { SuggestionInsertMark, SuggestionDeleteMark } from './suggestion-mark.ts';
export { isSuggesting, setSuggesting, setSuggestUser, createSuggestModePlugin } from './suggest-mode.ts';
export { acceptSuggestion, rejectSuggestion, acceptAllSuggestions, rejectAllSuggestions, collectSuggestions } from './suggestion-actions.ts';
export { setupSuggestionClickHandler, dismissSuggestionPopover } from './suggestion-controls.ts';
export { buildSuggestionSidebar, toggleSuggestionSidebar } from './suggestion-sidebar.ts';
export { buildSuggestionsBlock } from './suggestion-block.ts';
export type { SuggestionAttrs, SuggestionEntry } from './types.ts';
