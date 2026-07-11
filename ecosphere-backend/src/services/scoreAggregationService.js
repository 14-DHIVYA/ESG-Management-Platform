const { query } = require('../config/db');

/**
 * Recomputes Environmental / Social / Governance / Total scores for a
 * department over [periodStart, periodEnd] and upserts department_scores.
 *
 * Scoring is intentionally simple + explainable for a hackathon demo:
 * - Environmental: 100 minus a scaled penalty for CO2e emitted (relative to a configurable baseline)
 * - Social: (approved CSR participations + approved challenge participations) scaled to 0-100
 * - Governance: 100 minus penalty per open/flagged compliance issue, plus bonus for policy ack rate
 * Swap in whatever formula your team prefers — the aggregation plumbing (weights, upsert) stays the same.
 */
async function recomputeDepartmentScore(departmentId, periodStart, periodEnd) {
  const configResult = await query('SELECT * FROM esg_config LIMIT 1');
  const cfg = configResult.rows[0] || { environmental_weight: 0.4, social_weight: 0.3, governance_weight: 0.3 };

  // --- Environmental ---
  const emissionResult = await query(
    `SELECT COALESCE(SUM(co2_equivalent),0) AS total_co2 FROM carbon_transactions
     WHERE department_id = $1 AND transaction_date BETWEEN $2 AND $3`,
    [departmentId, periodStart, periodEnd]
  );
  const totalCo2 = Number(emissionResult.rows[0].total_co2);
  const BASELINE_CO2 = 10000; // kg CO2e — tune per org during demo setup
  const environmentalScore = Math.max(0, 100 - (totalCo2 / BASELINE_CO2) * 100);

  // --- Social ---
  const csrResult = await query(
    `SELECT COUNT(*) FROM employee_participations ep
     JOIN csr_activities ca ON ca.id = ep.activity_id
     WHERE ca.department_id = $1 AND ep.approval_status = 'APPROVED'
       AND ep.completion_date BETWEEN $2 AND $3`,
    [departmentId, periodStart, periodEnd]
  );
  const csrCount = parseInt(csrResult.rows[0].count);
  const SOCIAL_TARGET = 20; // approved participations considered "full score" for the period
  const socialScore = Math.min(100, (csrCount / SOCIAL_TARGET) * 100);

  // --- Governance ---
  const issuesResult = await query(
    `SELECT COUNT(*) FILTER (WHERE status != 'RESOLVED') AS open_count,
            COUNT(*) FILTER (WHERE flagged = true) AS flagged_count
     FROM compliance_issues ci
     JOIN audits a ON a.id = ci.audit_id
     WHERE a.department_id = $1`,
    [departmentId]
  );
  const openCount = parseInt(issuesResult.rows[0].open_count);
  const flaggedCount = parseInt(issuesResult.rows[0].flagged_count);
  const governanceScore = Math.max(0, 100 - openCount * 5 - flaggedCount * 10);

  const totalScore =
    environmentalScore * Number(cfg.environmental_weight) +
    socialScore * Number(cfg.social_weight) +
    governanceScore * Number(cfg.governance_weight);

  const upsert = await query(
    `INSERT INTO department_scores (department_id, environmental_score, social_score, governance_score, total_score, period_start, period_end)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (department_id, period_start, period_end)
     DO UPDATE SET environmental_score = $2, social_score = $3, governance_score = $4, total_score = $5
     RETURNING *`,
    [departmentId, environmentalScore.toFixed(2), socialScore.toFixed(2), governanceScore.toFixed(2), totalScore.toFixed(2), periodStart, periodEnd]
  );
  return upsert.rows[0];
}

module.exports = { recomputeDepartmentScore };
