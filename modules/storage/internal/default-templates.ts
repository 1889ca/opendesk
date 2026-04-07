/** Contract: contracts/storage/rules.md */

/** ProseMirror JSON node helper */
function text(str: string) {
  return { type: 'text', text: str };
}

function heading(level: number, content: string) {
  return { type: 'heading', attrs: { level }, content: [text(content)] };
}

function paragraph(content?: string) {
  if (!content) return { type: 'paragraph' };
  return { type: 'paragraph', content: [text(content)] };
}

function bulletList(items: string[]) {
  return {
    type: 'bulletList',
    content: items.map((item) => ({
      type: 'listItem',
      content: [paragraph(item)],
    })),
  };
}

export interface DefaultTemplate {
  name: string;
  description: string;
  content: Record<string, unknown>;
}

export const defaultTemplates: DefaultTemplate[] = [
  {
    name: 'Blank',
    description: 'Start with a clean slate',
    content: {
      type: 'doc',
      content: [paragraph()],
    },
  },
  {
    name: 'Meeting Notes',
    description: 'Capture attendees, agenda, and action items',
    content: {
      type: 'doc',
      content: [
        heading(1, 'Meeting Notes'),
        heading(2, 'Date'),
        paragraph('[Date]'),
        heading(2, 'Attendees'),
        bulletList(['[Name]', '[Name]']),
        heading(2, 'Agenda'),
        bulletList(['[Topic 1]', '[Topic 2]']),
        heading(2, 'Discussion'),
        paragraph(),
        heading(2, 'Action Items'),
        bulletList(['[Action] — [Owner] — [Due date]']),
      ],
    },
  },
  {
    name: 'Project Brief',
    description: 'Outline goals, scope, timeline, and team',
    content: {
      type: 'doc',
      content: [
        heading(1, 'Project Brief'),
        heading(2, 'Overview'),
        paragraph('[High-level summary of the project]'),
        heading(2, 'Goals'),
        bulletList(['[Goal 1]', '[Goal 2]']),
        heading(2, 'Scope'),
        paragraph('[What is in and out of scope]'),
        heading(2, 'Timeline'),
        bulletList(['[Milestone 1] — [Date]', '[Milestone 2] — [Date]']),
        heading(2, 'Team'),
        bulletList(['[Role] — [Name]']),
      ],
    },
  },
  {
    name: 'Report',
    description: 'Structured report with executive summary and findings',
    content: {
      type: 'doc',
      content: [
        heading(1, 'Report Title'),
        heading(2, 'Executive Summary'),
        paragraph('[Brief summary of findings and recommendations]'),
        heading(2, 'Introduction'),
        paragraph('[Background and purpose of the report]'),
        heading(2, 'Methodology'),
        paragraph('[How the investigation or analysis was conducted]'),
        heading(2, 'Findings'),
        paragraph('[Key results and data]'),
        heading(2, 'Conclusion'),
        paragraph('[Summary and next steps]'),
      ],
    },
  },
];
