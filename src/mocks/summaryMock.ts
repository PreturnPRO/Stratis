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
