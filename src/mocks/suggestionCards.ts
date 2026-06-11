// S1-T02-F — mock QuestionSuggestion blocks for AI suggestion display.
// Replace with live WebSocket payload in S1-T03-E.

import type { SuggestionCard } from '../components/SuggestionCardStack'

export const MOCK_SUGGESTION_CARDS: SuggestionCard[] = [
  {
    id: 'qs-001',
    question: 'Has the team confirmed engineering capacity for this sprint?',
    reason: 'A capacity assumption is unvalidated — blocking the timeline decision.',
    status: 'active',
    type: 'suggestion',
  },
  {
    id: 'qs-002',
    question: 'What is the fallback if the SMB segment rejects metered billing?',
    reason: 'No contingency has been stated for the pricing model switch.',
    status: 'active',
    type: 'suggestion',
  },
  {
    id: 'qs-003',
    question: 'Who owns the decision on pricing model — Sarah or the full exec team?',
    reason: 'Decision ownership is unclear. This will delay sign-off.',
    status: 'active',
    type: 'suggestion',
  },
  {
    id: 'qs-drift',
    question: 'The conversation has moved away from the pricing agenda.',
    reason: 'Agenda drift detected — original topic: Q2 pricing restructure.',
    status: 'active',
    type: 'drift',
  },
]