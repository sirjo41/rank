// ─── Score Breakdown Type ──────────────────────────────────────
export interface ScoreBreakdown {
  // Auto period items (first 30s — base × 2 for auto bonus)
  boxes_low_auto: number;       // 5 × 2 = 10 pts each
  boxes_high_auto: number;      // 5 × 2 × 2 = 20 pts each
  triangles_low_auto: number;   // 7 × 2 = 14 pts each
  triangles_high_auto: number;  // 7 × 2 × 2 = 28 pts each
  circles_low_auto: number;     // 10 × 2 = 20 pts each
  circles_high_auto: number;    // 10 × 2 × 2 = 40 pts each

  // TeleOp period items (after auto; base points)
  boxes_low_teleop: number;       // 5 pts each
  boxes_high_teleop: number;      // 5 × 2 = 10 pts each
  triangles_low_teleop: number;   // 7 pts each
  triangles_high_teleop: number;  // 7 × 2 = 14 pts each
  circles_low_teleop: number;     // 10 pts each
  circles_high_teleop: number;    // 10 × 2 = 20 pts each

  // Special
  special_orders: number;       // 35 pts each (any period)

  // Bonuses (per alliance)
  back_to_place_auto: boolean;  // +30 pts
  back_to_place_match: boolean; // +20 pts
}

export const EMPTY_BREAKDOWN: ScoreBreakdown = {
  boxes_low_auto: 0,      boxes_high_auto: 0,
  triangles_low_auto: 0,  triangles_high_auto: 0,
  circles_low_auto: 0,    circles_high_auto: 0,
  boxes_low_teleop: 0,    boxes_high_teleop: 0,
  triangles_low_teleop: 0, triangles_high_teleop: 0,
  circles_low_teleop: 0,  circles_high_teleop: 0,
  special_orders: 0,
  back_to_place_auto: false,
  back_to_place_match: false,
};

// ─── Point Values ──────────────────────────────────────────────
export const POINTS = {
  box_low: 5,        box_high: 10,       // high = 2× base
  triangle_low: 7,   triangle_high: 14,
  circle_low: 10,    circle_high: 20,
  // Auto doubles all the above
  box_low_auto: 10,      box_high_auto: 20,
  triangle_low_auto: 14, triangle_high_auto: 28,
  circle_low_auto: 20,   circle_high_auto: 40,
  special_order: 35,
  back_to_place_auto: 30,
  back_to_place_match: 20,
  minor_foul_to_opponent: 5,
  major_foul_to_opponent: 10,
} as const;

// ─── Compute alliance base score from breakdown ────────────────
export function computeAllianceScore(breakdown: Partial<ScoreBreakdown>): number {
  const b = { ...EMPTY_BREAKDOWN, ...breakdown };
  let total = 0;

  // Auto items
  total += b.boxes_low_auto      * POINTS.box_low_auto;
  total += b.boxes_high_auto     * POINTS.box_high_auto;
  total += b.triangles_low_auto  * POINTS.triangle_low_auto;
  total += b.triangles_high_auto * POINTS.triangle_high_auto;
  total += b.circles_low_auto    * POINTS.circle_low_auto;
  total += b.circles_high_auto   * POINTS.circle_high_auto;

  // TeleOp items
  total += b.boxes_low_teleop      * POINTS.box_low;
  total += b.boxes_high_teleop     * POINTS.box_high;
  total += b.triangles_low_teleop  * POINTS.triangle_low;
  total += b.triangles_high_teleop * POINTS.triangle_high;
  total += b.circles_low_teleop    * POINTS.circle_low;
  total += b.circles_high_teleop   * POINTS.circle_high;

  // Special orders
  total += b.special_orders * POINTS.special_order;

  // Bonuses
  if (b.back_to_place_auto)  total += POINTS.back_to_place_auto;
  if (b.back_to_place_match) total += POINTS.back_to_place_match;

  return total;
}

// ─── Compute final match totals (with opponent foul penalties) ─
export function computeMatchTotals(
  redBreakdown: Partial<ScoreBreakdown>,
  blueBreakdown: Partial<ScoreBreakdown>,
  foulsMinorRed: number, foulsMajorRed: number,
  foulsMinorBlue: number, foulsMajorBlue: number,
) {
  const redBase  = computeAllianceScore(redBreakdown);
  const blueBase = computeAllianceScore(blueBreakdown);

  const redTotal  = redBase  + (foulsMinorBlue * POINTS.minor_foul_to_opponent) + (foulsMajorBlue * POINTS.major_foul_to_opponent);
  const blueTotal = blueBase + (foulsMinorRed  * POINTS.minor_foul_to_opponent) + (foulsMajorRed  * POINTS.major_foul_to_opponent);

  return { redBase, blueBase, redTotal, blueTotal };
}

// ─── Timer helpers ─────────────────────────────────────────────
// Match clock = 2:30 (150s) = 30s auto + 120s teleop only.
// 8s pickup is extra wall time: timer is paused — it does NOT count down the 150s.
// Wall time per match: 30 + 8 + 120 = 158s.
export const AUTO_DURATION = 30;
export const TELEOP_DURATION = 120; // remainder of the 150s countdown after auto
export const PICKUP_DURATION = 8;
export const MATCH_DURATION = AUTO_DURATION + TELEOP_DURATION; // 150
/** Remaining seconds when auto ends (pickup overlay; clock stays here for 8s wall). */
export const AUTO_END_REMAINING = MATCH_DURATION - AUTO_DURATION; // 120

export function getTimerFromSettings(settings: any): number {
  if (!settings?.timer_running || !settings?.timer_started_at) {
    return settings?.timer_paused_remaining ?? MATCH_DURATION;
  }
  const elapsed = Math.floor((Date.now() - new Date(settings.timer_started_at).getTime()) / 1000);
  return Math.max(0, MATCH_DURATION - elapsed);
}

export function isAutoPeriod(timeLeft: number): boolean {
  return timeLeft > AUTO_END_REMAINING;
}
