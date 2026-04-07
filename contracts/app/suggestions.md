# Suggestions (Track Changes) Contract

## Purpose
Provide track-changes-style suggestion mode where edits appear as proposed
insertions/deletions that collaborators can accept or reject.

## Rules
1. Two custom TipTap marks: `suggestionInsert` and `suggestionDelete`
2. Marks carry attrs: suggestionId, authorId, authorName, authorColor, createdAt
3. Marks sync via Yjs (part of document state)
4. Suggest mode toggle stored in editor state
5. Accept = apply change (keep insert text / remove delete text, remove mark)
6. Reject = revert change (remove insert text / restore delete text, remove mark)
7. Files must stay under 200 lines
8. No mock data
