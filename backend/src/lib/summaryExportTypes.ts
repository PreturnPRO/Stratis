/**
 * The shape the exporter needs, which is a subset of what the summary route
 * already assembles. Kept separate so the markdown builder does not depend on
 * the route module and can be tested on its own.
 */
export interface SummaryForExport {
  summary_title: string;
  summary_subtitle: string;
  participants: string[];
  duration_minutes: number;
  summary_blocks: Array<{
    title: string;
    content: string;
    visible_to_participants: boolean;
  }>;
  action_items: Array<{
    task: string;
    owner: string;
    due_date: string | null;
    done: boolean;
  }>;
}
