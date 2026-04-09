/** Contract: contracts/app/rules.md */

export interface BuiltinTemplate {
  id: string;
  name: string;
  description: string;
  html: string;
}

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    id: 'builtin:meeting-notes',
    name: 'Meeting Notes',
    description: 'Agenda, attendees, action items',
    html: `<h1>Meeting Notes</h1>
<p><strong>Date:</strong> </p>
<p><strong>Attendees:</strong> </p>
<h2>Agenda</h2>
<ul><li></li></ul>
<h2>Discussion</h2>
<p></p>
<h2>Action Items</h2>
<ul><li><strong>Owner:</strong> — <strong>Due:</strong> </li></ul>`,
  },
  {
    id: 'builtin:business-letter',
    name: 'Business Letter',
    description: 'Formal letter with sender and recipient',
    html: `<p>[Your Name]<br>[Your Address]<br>[City, State ZIP]<br>[Date]</p>
<p>[Recipient Name]<br>[Company]<br>[Address]<br>[City, State ZIP]</p>
<p>Dear [Name],</p>
<p>I am writing to...</p>
<p>Sincerely,<br><br>[Your Name]</p>`,
  },
  {
    id: 'builtin:project-brief',
    name: 'Project Brief',
    description: 'Overview, goals, timeline, and stakeholders',
    html: `<h1>Project Brief</h1>
<h2>Overview</h2>
<p></p>
<h2>Goals</h2>
<ul><li></li></ul>
<h2>Scope</h2>
<p></p>
<h2>Timeline</h2>
<p><strong>Start:</strong> &nbsp;&nbsp;<strong>End:</strong> </p>
<h2>Stakeholders</h2>
<ul><li></li></ul>`,
  },
  {
    id: 'builtin:report',
    name: 'Report',
    description: 'Executive summary with sections and findings',
    html: `<h1>Report Title</h1>
<h2>Executive Summary</h2>
<p></p>
<h2>Background</h2>
<p></p>
<h2>Findings</h2>
<p></p>
<h2>Recommendations</h2>
<ol><li></li></ol>
<h2>Conclusion</h2>
<p></p>`,
  },
];
