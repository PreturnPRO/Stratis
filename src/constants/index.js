// Palette lives in one place — see src/tokens/colors.ts. Re-exported here so the
// many `import { COLORS } from "../constants"` call sites stay valid.
export { COLORS } from "../tokens/colors";

export const NAV_ITEMS = [
  { id: "dashboard", icon: "LayoutDashboard", label: "Dashboard" },
  { id: "projects",  icon: "FolderKanban",    label: "Projects" },
  { id: "meeting",   icon: "Video",            label: "Meeting" },
  { id: "document",  icon: "FileText",         label: "Document" },
];

export const INITIAL_NODES = [
  { id: "q2",          x: 60,  y: 300, w: 220, h: 90,  label: "Q2 revenue miss",           age: "45d", borderColor: "#1a8c6e", glow: true },
  { id: "restructure", x: 360, y: 300, w: 220, h: 90,  label: "Restructure pricing tier...", age: "14d", borderColor: "#e8a020", glow: true },
  { id: "seat",        x: 660, y: 160, w: 200, h: 90,  label: "Seat-based + overages",      age: "14d", borderColor: "#1a8c6e", tag: { label: "Safe",        color: "#e8520a" } },
  { id: "usage",       x: 660, y: 295, w: 200, h: 95,  label: "Pure usage-based",           age: "14d", borderColor: "#1a8c6e", tags: [{ label: "AI recommended", color: "#1a8c6e" }, { label: "Validated", color: "#444444" }] },
  { id: "value",       x: 660, y: 430, w: 200, h: 90,  label: "Value-based pricing",        age: "14d", borderColor: "#1a8c6e", tag: { label: "High effort", color: "#e8520a" } },
  { id: "smb",         x: 930, y: 120, w: 200, h: 85,  label: "SMB accepts metered bill...", age: "94d", borderColor: "#e8a020" },
  { id: "engship",     x: 930, y: 280, w: 200, h: 75,  label: "Engineering ships in 6 w...", age: "8d",  borderColor: "#c0392b" },
  { id: "engcap",      x: 930, y: 390, w: 200, h: 75,  label: "Engineering capacity con...", age: "8d",  borderColor: "#c0392b" },
];

export const ARROWS = [
  { from: "q2",          to: "restructure", label: "triggers" },
  { from: "restructure", to: "seat" },
  { from: "restructure", to: "usage" },
  { from: "restructure", to: "value" },
  { from: "seat",        to: "smb",     label: "depends on" },
  { from: "usage",       to: "engship" },
  { from: "engcap",      to: "engship", label: "blocked by", dashed: true },
];

export const PROJECTS = [
  { id: 1, name: "Pricing v2",     owner: "Sarah K.", status: "In progress", color: "#c0392b", decisions: 6, assumptions: 4, risks: 3, last: "Strategy map" },
  { id: 2, name: "Mobile launch",  owner: "Mike R.",  status: "Explore",     color: "#c0392b", decisions: 3, assumptions: 5, risks: 2, last: "Meeting" },
  { id: 3, name: "Enterprise GTM", owner: "Alex T.",  status: "Align",       color: "#e8520a", decisions: 4, assumptions: 6, risks: 4, last: "Document" },
  { id: 4, name: "Q3 OKRs",        owner: "Sarah K.", status: "Draft",       color: "#444444", decisions: 1, assumptions: 2, risks: 1, last: null },
];

export const MEETING_MESSAGES = [
  {
    user: "Sarah K.",
    initials: "SK",
    color: "#c0392b",
    time: "00:00",
    text: "Okay, let's look at the Q2 numbers. We missed by 12%, and I think the root cause is clear — our enterprise pricing is misaligned with value delivery.",
  },
  {
    user: "Mike R.",
    initials: "MR",
    color: "#2e86c1",
    time: "00:41",
    text: "I agree the miss is real, but I'm not convinced pricing is the only factor. Sales cycle lengthening and competitive pressure played a role too.",
  },
  {
    user: "Alex T.",
    initials: "AT",
    color: "#1a7a4a",
    time: "01:12",
    text: "The data from the churn interviews is pretty clear though — 8 of 12 churned customers cited pricing as a top-3 reason. That's signal, not noise.",
  },
  {
    user: "Sarah K.",
    initials: "SK",
    color: "#c0392b",
    time: "01:48",
    text: "Exactly. So the core decision is: how do we restructure pricing? I've mapped three options on the canvas.",
  },
  {
    user: "Mike R.",
    initials: "MR",
    color: "#2e86c1",
    time: "02:05",
    text: "Option A — seat-based with overages — feels safest. It's closest to what we have now and engineering can implement it faster.",
  },
  {
    user: "Alex T.",
    initials: "AT",
    color: "#1a7a4a",
    time: "03:38",
    text: "But Option B, pure usage-based, is what the AI model flagged as highest-confidence. And the Intercom 2022 pattern matches — they saw 23% uplift switching to usage.",
  },
  {
    user: "Sarah K.",
    initials: "SK",
    color: "#c0392b",
    time: "01:48",
    text: "The Intercom data is compelling, but we need to validate that our SMB segment accepts metered billing. That's a big assumption.",
  },
  {
    user: "Mike R.",
    initials: "MR",
    color: "#2e86c1",
    time: "04:21",
    text: "I'll flag that — the assumption about engineering shipping in 6 weeks is looking shaky. Mobile launch is taking more capacity than planned.",
  },
];

export const DECISIONS = [
  {
    id: "RO-14", title: "Pricing model restructuring", status: "Needs input",
    desc: "Choose the core pricing model for the next fiscal year. This is the highest-impact decision on the map.",
    owner: "Sarah K.", due: "2026-06-15", options: ["30 days", "12 months"],
  },
  { id: "RO-13", title: "Pilot scope for usage-based tier",  status: "Needs input" },
  { id: "RO-19", title: "Engineering capacity allocation",    status: "Blocked" },
];

export const SIGNALS = [
  {
    icon: "AI",
    iconBg: "#1a1a6a",
    title: "Intercom 2022 pricing switch analysis",
    desc: "Intercom saw 23% revenue uplift after switching to usage-based pricing. Pattern confidence: 78%.",
    tag: "historical",
    date: "2026-07-25",
    unread: true,
  },
  {
    icon: "S",
    iconBg: "#2c1060",
    title: "Slack: #pricing-discuss — churn interview notes",
    desc: "8 of 12 churned customers cited pricing as a top-3 reason for leaving.",
    tag: "signal",
    date: "2026-05-24",
    unread: true,
  },
  {
    icon: "!",
    iconBg: "#6a1a1a",
    title: "Risk flag: Engineering capacity at 95%",
    desc: "Engineering team operating at 95% capacity. Mobile launch blocking pricing work.",
    tag: "risk",
    date: "2026-05-23",
    unread: true,
  },
  {
    icon: "N",
    iconBg: "#1a3a2a",
    title: "Notion: Product strategy doc — pricing options",
    desc: "Document outlines 3 pricing options with pros/cons analysis.",
    tag: "doc",
    date: "2026-07-22",
    unread: false,
  },
  {
    icon: "C",
    iconBg: "#1a2a4a",
    title: "Calendar: Executive review scheduled",
    desc: "Board review of pricing decision scheduled for June 10.",
    tag: "signal",
    date: "2026-07-21",
    unread: false,
  },
  {
    icon: "J",
    iconBg: "#2a1a0a",
    title: "Jira: PRICE-24 — billing infrastructure",
    desc: "Billing infrastructure ticket moved to In Progress. ETA: 4 weeks.",
    tag: "signal",
    date: "2026-05-28",
    unread: true,
  },
];
