/*
 * DEPRECATED — auto-complete of awaiting_end_confirmation has been removed.
 *
 * MVP Rule: BrandName has no hardware-backed charger telemetry. Session energy
 * and cost are derived from application events rather than physical meter
 * readings. Therefore, any session stuck in awaiting_end_confirmation cannot be
 * safely auto-completed and is placed into a manual review queue for resolution.
 * This rule should be revisited if/when OCPP or smart-meter telemetry is added
 * in a future version.
 *
 * Callers previously importing runAutoCompleteEndSweep should import
 * runFlagForReviewSweep from './flag-for-review' instead.
 */
export { runFlagForReviewSweep as runAutoCompleteEndSweep } from './flag-for-review';
