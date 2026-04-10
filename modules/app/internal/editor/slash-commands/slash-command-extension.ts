/** Contract: contracts/app/rules.md */
import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { filterCommands } from './slash-commands-data.ts';
import { slashCommandSuggestionRender } from './slash-command-list.ts';

/**
 * TipTap extension that activates a slash command menu when the user
 * types '/' in the editor. On selection, deletes the '/' and any typed
 * query text, then runs the chosen command's action.
 */
export const SlashCommandExtension = Extension.create({
  name: 'slashCommand',

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: '/',
        allowSpaces: false,
        startOfLine: false,
        items: ({ query }) => filterCommands(query),
        render: slashCommandSuggestionRender,
        command: ({ editor, range, props }) => {
          // Delete the slash trigger + typed query text, then run the action.
          editor.chain().focus().deleteRange(range).run();
          props.action(editor);
        },
      }),
    ];
  },
});
