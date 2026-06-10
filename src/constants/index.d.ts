export declare const COLORS: Record<string, string>;
export declare const NAV_ITEMS: { id: string; icon: string; label: string }[];
export declare const INITIAL_NODES: {
  id: string; x: number; y: number; w: number; h: number;
  label: string; age: string; borderColor: string;
  glow?: boolean;
  tag?: { label: string; color: string };
  tags?: { label: string; color: string }[];
}[];
export declare const ARROWS: {
  from: string; to: string; label?: string; dashed?: boolean;
}[];
export declare const PROJECTS: {
  id: number; name: string; owner: string; status: string;
  color: string; decisions: number; assumptions: number;
  risks: number; last: string | null;
}[];
export declare const MEETING_MESSAGES: {
  user: string; initials: string; color: string;
  time: string; text: string;
}[];
export declare const DECISIONS: {
  id: string; title: string; status: string;
  desc?: string; owner?: string; due?: string;
  options?: string[];
}[];
export declare const SIGNALS: {
  icon: string; iconBg: string; title: string;
  desc: string; tag: string; date: string; unread: boolean;
}[];