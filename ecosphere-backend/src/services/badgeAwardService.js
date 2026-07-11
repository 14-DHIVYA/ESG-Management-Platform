const { query } = require('../config/db');
const { notify } = require('./notificationService');

/**
 * Evaluates every ACTIVE badge's unlock_rule against the employee's current
 * stats and awards any newly-qualifying badges. Call this after any action
 * that changes XP or completed-challenge count (challenge approval, etc).
 *
 * unlock_rule shape: { "metric": "xp" | "completed_challenges", "operator": ">=", "value": number }
 */
async function evaluateAndAwardBadges(employeeId) {
  const configResult = await query('SELECT badge_auto_award_enabled FROM esg_config LIMIT 1');
  const enabled = configResult.rows[0]?.badge_auto_award_enabled ?? true;
  if (!enabled) return [];

  const empResult = await query('SELECT xp_points FROM employees WHERE id = $1', [employeeId]);
  const xp = empResult.rows[0]?.xp_points || 0;

  const completedResult = await query(
    `SELECT COUNT(*) FROM challenge_participations WHERE employee_id = $1 AND approval_status = 'APPROVED'`,
    [employeeId]
  );
  const completedChallenges = parseInt(completedResult.rows[0].count);

  const stats = { xp, completed_challenges: completedChallenges };

  const badgesResult = await query(
    `SELECT b.* FROM badges b
     WHERE b.status = 'ACTIVE'
       AND b.id NOT IN (SELECT badge_id FROM employee_badges WHERE employee_id = $1)`,
    [employeeId]
  );

  const awarded = [];
  for (const badge of badgesResult.rows) {
    const rule = badge.unlock_rule;
    const actual = stats[rule.metric];
    if (actual === undefined) continue;

    const passes =
      (rule.operator === '>=' && actual >= rule.value) ||
      (rule.operator === '>' && actual > rule.value) ||
      (rule.operator === '==' && actual === rule.value);

    if (passes) {
      await query('INSERT INTO employee_badges (employee_id, badge_id) VALUES ($1, $2)', [employeeId, badge.id]);
      await notify(employeeId, 'BADGE_UNLOCK', `You unlocked the "${badge.name}" badge!`);
      awarded.push(badge);
    }
  }
  return awarded;
}

module.exports = { evaluateAndAwardBadges };
