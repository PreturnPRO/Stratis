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
      meetingsPerMonth: 5,
      seats: 3,
      sessionMinutes: 45,
      retentionDays: 30,
    },
    features: ["live_suggestions", "checkpoint"],
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "Unlimited meetings for the whole workspace.",
    limits: {
      meetingsPerMonth: null,
      seats: null,
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
    ],
  },
  beta: {
    id: "beta",
    name: "Beta team",
    tagline: "Full access for invited beta workspaces.",
    internal: true,
    limits: {
      meetingsPerMonth: null,
      seats: 25,
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
      "analytics_dashboard",
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
export function effectivePlan(plan: string | null, status: string | null): PlanDefinition {
  const wanted = getPlan(plan);
  const settled: PlanStatus[] = ["active"];
  if (!settled.includes((status ?? "active") as PlanStatus)) return PLANS.free;
  return wanted;
}

export function hasFeature(plan: PlanDefinition, feature: FeatureKey): boolean {
  return plan.features.includes(feature);
}

export function limitsOf(plan: PlanDefinition): PlanLimits {
  return plan.limits;
}
