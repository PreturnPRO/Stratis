export interface SummaryBlock {
  block_type:
    | 'OVERVIEW'
    | 'WHAT_CHANGED'
    | 'DECISIONS'
    | 'OPEN_ITEMS'
    | 'ASSUMPTIONS'
    | 'RISKS'
    | 'ACTION_ITEMS'
    | 'NEXT_STEPS';
  title: string;
  content: string;
  visible_to_participants: boolean;
}

export interface ActionItem {
  task: string;
  owner: string;
  due_date: string | null;
}

export interface ParticipantSummaryOutput {
  output_type: 'participant_summary_output';
  session_id: string;
  summary_title: string;
  summary_subtitle: string;
  participants: string[];
  duration_minutes: number;
  summary_blocks: SummaryBlock[];
  action_items: ActionItem[];
}

const SUMMARY_S1: ParticipantSummaryOutput = {
  output_type: 'participant_summary_output',
  session_id: 's1',
  summary_title: 'Pricing Strategy Session',
  summary_subtitle: 'Jun 10 · 38 min · 4 participants',
  participants: ['Nick', 'Owen', 'Sara', 'James'],
  duration_minutes: 38,
  summary_blocks: [
    {
      block_type: 'OVERVIEW',
      title: 'Overview',
      content: 'Team reviewed Q3 pricing tiers and competitive positioning. Two pricing models compared — per-seat vs workspace-flat. Workspace-flat selected as primary direction.',
      visible_to_participants: true,
    },
    {
      block_type: 'DECISIONS',
      title: 'Decisions',
      content:
        'Workspace-flat pricing adopted — one price covers the whole team\nEarly supporter tier locked at ฿350/month for beta cohort',
      visible_to_participants: true,
    },
    {
      block_type: 'OPEN_ITEMS',
      title: 'Open items',
      content:
        'What happens to early supporter pricing after beta ends?\nEnterprise tier scope not yet defined — defer to Sprint 4\nRefund policy for annual plans not discussed',
      visible_to_participants: true,
    },
    {
      block_type: 'ASSUMPTIONS',
      title: 'Assumptions',
      content:
        'SME teams in Chiang Mai will accept ฿490/month if ROI case is clear\nOne prevented repeated meeting per month justifies the cost',
      visible_to_participants: false,
    },
    {
      block_type: 'NEXT_STEPS',
      title: 'Next steps',
      content: 'Owen to draft pricing page copy. Nick to update Landing.tsx with final tier breakdown. Reconvene before beta launch.',
      visible_to_participants: true,
    },
  ],
  action_items: [
    { task: 'Draft pricing page copy', owner: 'Owen', due_date: null },
    { task: 'Update Landing.tsx pricing tiers', owner: 'Nick', due_date: null },
  ],
};

const SUMMARY_S2: ParticipantSummaryOutput = {
  output_type: 'participant_summary_output',
  session_id: 's2',
  summary_title: 'Mobile Sprint Planning',
  summary_subtitle: 'Jun 9 · 52 min · 3 participants',
  participants: ['Nick', 'Windsurf', 'Owen'],
  duration_minutes: 52,
  summary_blocks: [
    {
      block_type: 'OVERVIEW',
      title: 'Overview',
      content: 'Sprint scope for mobile launch defined. Focused on suggestion card behaviour on small screens and touch interaction for the facilitator stack.',
      visible_to_participants: true,
    },
    {
      block_type: 'DECISIONS',
      title: 'Decisions',
      content: 'Suggestion cards collapse to icon-only on viewports under 400px',
      visible_to_participants: true,
    },
    {
      block_type: 'OPEN_ITEMS',
      title: 'Open items',
      content:
        'Swipe-to-dismiss gesture — native feel vs accessibility tradeoff unresolved\nAndroid WebView audio capture not yet tested',
      visible_to_participants: true,
    },
    {
      block_type: 'ASSUMPTIONS',
      title: 'Assumptions',
      content: 'Most facilitators will use desktop — mobile is secondary surface for participants only',
      visible_to_participants: false,
    },
    {
      block_type: 'NEXT_STEPS',
      title: 'Next steps',
      content: 'Nick to test suggestion stack on 390px viewport. Windsurf to confirm audio capture on Android Chrome.',
      visible_to_participants: true,
    },
  ],
  action_items: [
    { task: 'Test suggestion stack at 390px', owner: 'Nick', due_date: null },
    { task: 'Confirm Android Chrome audio capture', owner: 'Windsurf', due_date: null },
  ],
};

const SUMMARY_S3: ParticipantSummaryOutput = {
  output_type: 'participant_summary_output',
  session_id: 's3',
  summary_title: 'GTM Kickoff',
  summary_subtitle: 'Jun 7 · 61 min · 5 participants',
  participants: ['Nick', 'Windsurf', 'Owen', 'Sara', 'James'],
  duration_minutes: 61,
  summary_blocks: [
    {
      block_type: 'OVERVIEW',
      title: 'Overview',
      content: 'First GTM planning session for Northern Thailand beta. Beachhead market confirmed as Chiang Mai SMEs and public sector orgs. 10-team beta cohort target set.',
      visible_to_participants: true,
    },
    {
      block_type: 'DECISIONS',
      title: 'Decisions',
      content:
        'Beachhead market: Chiang Mai SMEs and local startups\n10 beta teams targeted for 3-month free trial\nSuccess metric: one prevented repeated meeting per team per month',
      visible_to_participants: true,
    },
    {
      block_type: 'OPEN_ITEMS',
      title: 'Open items',
      content:
        'Outreach channel not decided — warm intros vs cold vs events\nPDPA consent flow not scoped yet — blocks beta sign-up\nNo onboarding flow designed for non-technical facilitators\nPartner referral programme — shelved but not closed\nBeta NDA requirement unclear',
      visible_to_participants: true,
    },
    {
      block_type: 'ASSUMPTIONS',
      title: 'Assumptions',
      content:
        'Thai SME founders attend regular weekly syncs already\nEnglish-language UI acceptable for Chiang Mai beta cohort',
      visible_to_participants: false,
    },
    {
      block_type: 'NEXT_STEPS',
      title: 'Next steps',
      content: 'Owen to identify first 3 beta candidates. Sara to draft outreach message. PDPA consent flow to be scoped in Sprint 4.',
      visible_to_participants: true,
    },
  ],
  action_items: [
    { task: 'Identify first 3 beta candidates', owner: 'Owen', due_date: null },
    { task: 'Draft beta outreach message', owner: 'Sara', due_date: null },
    { task: 'Scope PDPA consent flow', owner: 'Windsurf', due_date: null },
  ],
};

export const MOCK_SUMMARIES_MAP: Record<string, ParticipantSummaryOutput> = {
  s1: SUMMARY_S1,
  s2: SUMMARY_S2,
  s3: SUMMARY_S3,
};

export const MOCK_SUMMARY = SUMMARY_S1;