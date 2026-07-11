const { query } = require('../config/db');
const ApiError = require('../utils/ApiError');

/**
 * Computes co2_equivalent = quantity * emission_factor.co2_per_unit
 * and inserts a carbon_transactions row. Used both by the manual entry
 * endpoint and by auto-calculation hooks from Purchase/Manufacturing/
 * Expense/Fleet records.
 */
async function calculateAndRecordEmission({
  departmentId,
  sourceType,
  sourceReferenceId,
  emissionFactorId,
  quantity,
  transactionDate,
  autoCalculated,
  createdBy,
}) {
  const factorResult = await query(
    'SELECT * FROM emission_factors WHERE id = $1 AND status = $2',
    [emissionFactorId, 'ACTIVE']
  );
  const factor = factorResult.rows[0];
  if (!factor) throw new ApiError(400, 'Emission factor not found or inactive');

  const co2Equivalent = Number(quantity) * Number(factor.co2_per_unit);

  const result = await query(
    `INSERT INTO carbon_transactions
       (department_id, source_type, source_reference_id, emission_factor_id, quantity, co2_equivalent, transaction_date, auto_calculated, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7, CURRENT_DATE),$8,$9)
     RETURNING *`,
    [departmentId, sourceType, sourceReferenceId || null, emissionFactorId, quantity, co2Equivalent, transactionDate, !!autoCalculated, createdBy || null]
  );
  return result.rows[0];
}

module.exports = { calculateAndRecordEmission };
