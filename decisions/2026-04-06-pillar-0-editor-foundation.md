# Decision #006: Pillar 0 — Editor Foundation

**Date:** 2026-04-06
**Status:** Accepted
**Context:** The hivemind deliberation on strategic pillars (#004, #005) produced 6 sovereignty-focused pillars but completely overlooked the foundational requirement: the editor itself must be excellent. No amount of cryptographic audit trails or zero-knowledge clean rooms matters if the editing experience is mediocre.

## Pillar 0: Editor Foundation

### What it encompasses
Everything that makes the document editor competitive with Google Docs/Word for daily use:
- Rich text editing quality (formatting, styles, tables, images, embeds)
- Collaboration UX (cursors, presence, comments, suggestions, track changes)
- Document management (templates, folders, search, recent documents)
- Performance (large documents, many collaborators, mobile)
- Accessibility (WCAG 2.1 AA, keyboard navigation, screen readers)
- Offline support (edit while disconnected, sync on reconnect)
- Print/export fidelity (what you see is what you print)

### Who it serves
Every user. This is the foundation everything else builds on. A compliance officer won't use the audit trail if the editor is painful to type in.

### Why it's strategic
- **Table stakes**: Users compare against Google Docs daily. If basic editing feels worse, nothing else matters.
- **Retention driver**: People adopt for compliance but stay for productivity.
- **Platform credibility**: Enterprise buyers evaluate the editor first, compliance features second.
- **CRDT complexity**: Collaborative editing has deep edge cases (cursor jumping, merge conflicts, undo in shared sessions) that require dedicated investment.

### First milestones

1. **Comments & Suggestions** — Inline comments with threads, suggest-mode edits (accept/reject). This is the #1 missing collaboration feature.

2. **Tables** — Resizable columns, merged cells, header rows, formula basics. TipTap has table extensions but they need configuration and styling.

3. **Image & Media** — Drag-and-drop image upload to S3, inline image display, image resize handles, basic media embeds (video links).

4. **Document Templates** — Create-from-template, template library, org-level template management.

5. **Find & Replace** — In-document search with regex support, find-and-replace across formatting.

6. **Print/PDF fidelity** — CSS print stylesheet, page break controls, header/footer support. Export to PDF should look identical to the editor.

7. **Keyboard shortcuts & Accessibility** — Full keyboard navigation, ARIA labels, screen reader compatibility, customizable shortcuts.

8. **Performance** — Handle 100+ page documents without lag, support 20+ simultaneous collaborators, lazy-load document content.

9. **Offline editing** — Service worker for offline access, queue changes, sync on reconnect with conflict resolution UI.

10. **Mobile responsive** — Touch-friendly toolbar, responsive layout, mobile-optimized collaboration.

### Relationship to other pillars
- Pillar 0 is a **prerequisite** for all other pillars. AI assistance (Pillar 1) needs a good editor to assist *in*. Audit trails (Pillar 2) need documents worth auditing. Federation (Pillar 5) needs an editor worth federating.
- Pillar 0 work should run **continuously in parallel** with other pillars, not be "finished" before starting them.
- Budget: ~30-40% of engineering effort should go here permanently.

### Why the hivemind missed this
The deliberation prompt asked about "strategic directions" and the models optimized for differentiation (what makes OpenDesk *unique*). But uniqueness without utility is irrelevant. This pillar is intentionally unglamorous — it's the work that makes the glamorous pillars matter.

## Decision
Pillar 0 (Editor Foundation) is added as a permanent, parallel workstream alongside the 6 sovereignty pillars. It is not sequenced — it runs continuously. First priority: comments & suggestions, then tables, then images.
