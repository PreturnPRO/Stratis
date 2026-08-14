import type {
  FeatureKey,
  PlanDefinition,
  PlanId,
  PlanLimits,
  PlanStatus,
} from "@shared/types";

/**
 * The tier table. This file is the only place packaging is decided — routes ask
 * `hasFeature(plan, 'checkpoint')`, never `plan === 'pro'`.
 *
 * Prices are deliberately absent. Pricing is unvalidated; the marketing page
 * renders whatever the pricing copy says, and nothing in the runtime depends on
 * a number.
 */
export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    tagline: "Try Stratis on a few meetings a month.",
    limits: {
      // The free tier is a trial measured in listening, not in calendar
      // entries: 30 recorded minutes a month is two short meetings or one real
      // one, which is enough to find out whether the checkpoint is worth
      // anything. Meetings themselves are not capped — booking one costs us
      // nothing and blocking it teaches the team nothing.
      recordedMinutesPerMonth: 30,
      sessionMinutes: 45,
      retentionDays: 30,
    },
    /**
     * The room is the product, so the room is free.
     *
     * `session_invites` and `guest_access` were Pro when Stratis had a
     * workspace and participants were colleagues you added one by one. They are
     * now the only way anybody but the facilitator gets into a meeting — a code
     * read out loud, the way a Kahoot starts. Charging for that leaves the Free
     * tier as a single person talking to themselves, which demonstrates
     * nothing and converts nobody.
     *
     * What Pro sells is minutes, taking the record out (`transcript_export`)
     * and the workspace colour.
     */
    features: [
      "live_suggestions",
      "checkpoint",
      // The PM document is the thing Stratis is for. Walling it off would hide
      // the product behind the paywall rather than putting the paywall after
      // it. Taking the record *out* of Stratis is what Pro sells.
      "pm_document",
      "session_invites",
      "guest_access",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "Unlimited meetings for the whole workspace.",
    limits: {
      recordedMinutesPerMonth: null,
      // Unlimited meetings, ten projects. A workspace with more than ten live
      // projects is an organisation, and organisations are a different
      // conversation from a team subscription.
      sessionMinutes: 240,
      retentionDays: null,
    },
    features: [
      "live_suggestions",
      "checkpoint",
      "pm_document",
      "transcript_export",
      "session_invites",
      "guest_access",
      "custom_theme",
    ],
  },
  beta: {
    id: "beta",
    name: "Beta team",
    tagline: "Full access for invited beta workspaces.",
    internal: true,
    limits: {
      recordedMinutesPerMonth: null,
      sessionMinutes: 240,
      retentionDays: null,
    },
    features: [
      "live_suggestions",
      "checkpoint",
      "pm_document",
      "transcript_export",
      "session_invites",
      "guest_access",
      "custom_theme",
    ],
  },
};

export const PLAN_IDS = Object.keys(PLANS) as PlanId[];

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && PLAN_IDS.includes(value as PlanId);
}

export function getPlan(id: string | null | undefined): PlanDefinition {
  return isPlanId(id) ? PLANS[id] : PLANS.free;
}

/**
 * The plan actually served. A workspace whose subscription lapsed keeps `plan`
 * on record for the upgrade path but is entitled to Free until it is settled —
 * so the tier shown in the admin panel and the tier enforced never diverge.
 */
export function effectivePlan(
  plan: string | null,
  status: string | null,
  expiresAt?: string | Date | null,
): PlanDefinition {
  const wanted = getPlan(plan);
  const settled: PlanStatus[] = ["active"];
  if (!settled.includes((status ?? "active") as PlanStatus)) return PLANS.free;

  // A term that has run out is a lapsed subscription whether or not anyone has
  // got around to flipping plan_status. Without this the column was written by
  // the admin route and read by nothing, so a paid workspace kept its tier
  // forever — the plan expired on paper and never in the product.
  if (expiresAt) {
    const ends = expiresAt instanceof Date ? expiresAt.getTime() : Date.parse(expiresAt);
    if (Number.isFinite(ends) && ends <= Date.now()) return PLANS.free;
  }

  return wanted;
}

export function hasFeature(plan: PlanDefinition, feature: FeatureKey): boolean {
  return plan.features.includes(feature);
}

export function limitsOf(plan: PlanDefinition): PlanLimits {
  return plan.limits;
}
