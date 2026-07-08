const { query } = require('../config/db');
const ApiError = require('./ApiError');
const asyncHandler = require('./asyncHandler');

/**
 * Generic CRUD factory for straightforward master-data tables.
 * For tables with business logic (auto-calc, XP, badge awards, etc.)
 * write a dedicated controller instead of using this factory.
 *
 * @param {string} table - exact table name in Postgres
 * @param {string[]} allowedFields - columns that may be set via create/update
 * @param {string} orderBy - default ORDER BY clause (defaults to created_at DESC)
 */
function crudFactory(table, allowedFields, orderBy = 'created_at DESC') {
  const list = asyncHandler(async (req, res) => {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;

    // Simple equality filters on allowed fields, e.g. ?status=ACTIVE&department_id=uuid
    const filterKeys = Object.keys(req.query).filter((k) => allowedFields.includes(k));
    const whereClauses = filterKeys.map((k, i) => `${k} = $${i + 1}`);
    const values = filterKeys.map((k) => req.query[k]);

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const countResult = await query(`SELECT COUNT(*) FROM ${table} ${whereSql}`, values);
    const rows = await query(
      `SELECT * FROM ${table} ${whereSql} ORDER BY ${orderBy} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset]
    );

    res.json({
      success: true,
      data: rows.rows,
      pagination: { page, limit, total: parseInt(countResult.rows[0].count) },
    });
  });

  const getById = asyncHandler(async (req, res) => {
    const result = await query(`SELECT * FROM ${table} WHERE id = $1`, [req.params.id]);
    if (!result.rows[0]) throw new ApiError(404, `${table} record not found`);
    res.json({ success: true, data: result.rows[0] });
  });

  const create = asyncHandler(async (req, res) => {
    const fields = allowedFields.filter((f) => req.body[f] !== undefined);
    if (!fields.length) throw new ApiError(400, 'No valid fields provided');
    const values = fields.map((f) => req.body[f]);
    const placeholders = fields.map((_, i) => `$${i + 1}`);
    const result = await query(
      `INSERT INTO ${table} (${fields.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      values
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  });

  const update = asyncHandler(async (req, res) => {
    const fields = allowedFields.filter((f) => req.body[f] !== undefined);
    if (!fields.length) throw new ApiError(400, 'No valid fields provided');
    const setSql = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    const values = fields.map((f) => req.body[f]);
    const result = await query(
      `UPDATE ${table} SET ${setSql} WHERE id = $${fields.length + 1} RETURNING *`,
      [...values, req.params.id]
    );
    if (!result.rows[0]) throw new ApiError(404, `${table} record not found`);
    res.json({ success: true, data: result.rows[0] });
  });

  const remove = asyncHandler(async (req, res) => {
    const result = await query(`DELETE FROM ${table} WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!result.rows[0]) throw new ApiError(404, `${table} record not found`);
    res.json({ success: true, message: `${table} record deleted` });
  });

  return { list, getById, create, update, remove };
}

module.exports = crudFactory;
