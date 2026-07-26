import type { DecisionStatus } from "../../shared/types";

/**
 * The status a decision lands on when the facilitator toggles "Deliberately
 * open". Parking a decision must be reversible: an open row toggled back
 * rejoins the completeness count, dated or not. Without the inverse, "open" is
 * a one-way door and the completeness rate can never be corrected.
 */
export function toggleOpenStatus(
  status: DecisionStatus,
  dueDate: string | null,
): DecisionStatus {
  if (status !== "open") return "open";
  return dueDate ? "complete" : "incomplete";
}
