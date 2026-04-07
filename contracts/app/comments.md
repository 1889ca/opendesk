# Contract: app/comments

## Purpose

Provide a collaborative comments and annotations system for the OpenDesk editor, allowing users to highlight text, attach threaded comments, resolve discussions, and sync comment state across collaborators via Yjs.

## Inputs

- User interactions: text selection, comment text entry, resolve/reopen/reply/delete actions
- Yjs shared document (`Y.Doc`): source of truth for comment data via `Y.Array`
- Editor state: current selection, active marks, document content
- User identity: `{ name, color }` from `getUserIdentity()`

## Outputs

- Comment marks applied to editor content (highlight spans with `commentId` attribute)
- Comment sidebar UI: list of comments with author, timestamp, content, thread replies, resolve/reply controls
- Comment input popover near text selection for new comment entry
- Yjs `Y.Array` mutations that sync to all collaborators

## Side Effects

- Mutates Yjs shared `Y.Array<CommentData>` which syncs via WebSocket to other collaborators
- Applies/removes TipTap marks on editor content
- Toggles sidebar visibility in the DOM

## Invariants

1. Every comment mark in the editor has a corresponding entry in the Yjs comment array
2. Resolving a comment does not remove its mark; it visually dims it
3. Deleting a comment removes both the Yjs entry and the editor mark
4. Comment data syncs in real-time across all connected collaborators
5. Thread replies reference their parent via `parentId`

## Dependencies

- `@tiptap/core` — Mark extension API
- `yjs` — shared data types for collaborative sync
- `i18n` — translation keys for all user-visible strings

## Boundary Rules

- MUST: Store all comment data in Yjs shared types for real-time sync
- MUST: Use TipTap Mark API for text annotations
- MUST: Support threaded replies (one level deep)
- MUST NOT: Persist comments outside of Yjs (no HTTP calls for comment CRUD)
- MUST NOT: Exceed 200 lines per file

## Verification

- Invariant 1: Unit test asserting mark application creates Yjs entry
- Invariant 2: Unit test asserting resolved comments retain marks with dimmed class
- Invariant 3: Unit test asserting delete removes both mark and array entry
- Invariant 4: Integration test with two Yjs docs syncing
- Invariant 5: Unit test asserting reply `parentId` matches parent `id`
