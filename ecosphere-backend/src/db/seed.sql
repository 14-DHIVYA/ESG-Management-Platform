-- Minimal seed data to get the app usable immediately after schema creation.
-- Password for both seeded users is: Passw0rd!123  (bcrypt hash below)
-- Generate your own hash with: node -e "console.log(require('bcryptjs').hashSync('Passw0rd!123',10))"

INSERT INTO departments (id, name, code, employee_count, status)
VALUES
  (gen_random_uuid(), 'Operations', 'OPS', 12, 'ACTIVE'),
  (gen_random_uuid(), 'Human Resources', 'HR', 5, 'ACTIVE')
ON CONFLICT DO NOTHING;

-- NOTE: replace the password_hash below with your own bcrypt hash before using.
INSERT INTO employees (id, name, email, password_hash, role, department_id, xp_points, points_balance)
SELECT gen_random_uuid(), 'Admin User', 'admin@ecosphere.test',
       '$2a$10$MBYc5Dws/bx5/wnFn3qJtOrmI.vTOT45HCQFmoQh8rfebhNIjya16',
       'ADMIN', d.id, 0, 0
FROM departments d WHERE d.code = 'OPS'
ON CONFLICT DO NOTHING;

INSERT INTO categories (id, name, type, status) VALUES
  (gen_random_uuid(), 'Tree Plantation', 'CSR_ACTIVITY', 'ACTIVE'),
  (gen_random_uuid(), 'Waste Reduction', 'CHALLENGE', 'ACTIVE')
ON CONFLICT DO NOTHING;

INSERT INTO emission_factors (id, name, source_type, unit, co2_per_unit, status) VALUES
  (gen_random_uuid(), 'Diesel Fleet Fuel', 'FLEET', 'liter', 2.68, 'ACTIVE'),
  (gen_random_uuid(), 'Grid Electricity', 'MANUFACTURING', 'kWh', 0.82, 'ACTIVE')
ON CONFLICT DO NOTHING;

INSERT INTO badges (id, name, description, unlock_rule, status) VALUES
  (gen_random_uuid(), 'Green Starter', 'Earn your first 100 XP',
   '{"metric":"xp","operator":">=","value":100}', 'ACTIVE'),
  (gen_random_uuid(), 'Challenge Champion', 'Complete 5 challenges',
   '{"metric":"completed_challenges","operator":">=","value":5}', 'ACTIVE')
ON CONFLICT DO NOTHING;

INSERT INTO rewards (id, name, description, points_required, stock, status) VALUES
  (gen_random_uuid(), 'Eco Tumbler', 'Reusable insulated tumbler', 200, 50, 'ACTIVE'),
  (gen_random_uuid(), 'Extra Day Off', 'One paid day off', 2000, 10, 'ACTIVE')
ON CONFLICT DO NOTHING;

INSERT INTO esg_config (environmental_weight, social_weight, governance_weight)
VALUES (0.40, 0.30, 0.30)
ON CONFLICT DO NOTHING;
