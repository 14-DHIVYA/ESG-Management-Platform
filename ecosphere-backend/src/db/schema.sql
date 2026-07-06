-- ============================================================
-- EcoSphere ESG Management Platform — PostgreSQL Schema
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- CORE / AUTH
-- ============================================================

CREATE TABLE departments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(150) NOT NULL,
  code              VARCHAR(30) UNIQUE NOT NULL,
  head_employee_id  UUID, -- FK added after employees table exists
  parent_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  employee_count    INT DEFAULT 0,
  status            VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE employees (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(150) NOT NULL,
  email           VARCHAR(150) UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  role            VARCHAR(30) NOT NULL DEFAULT 'EMPLOYEE' CHECK (role IN ('ADMIN','MANAGER','EMPLOYEE','AUDITOR')),
  department_id   UUID REFERENCES departments(id) ON DELETE SET NULL,
  xp_points       INT DEFAULT 0,
  points_balance  INT DEFAULT 0, -- redeemable points
  status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE departments
  ADD CONSTRAINT fk_department_head FOREIGN KEY (head_employee_id) REFERENCES employees(id) ON DELETE SET NULL;

-- ============================================================
-- MASTER DATA
-- ============================================================

CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  type        VARCHAR(20) NOT NULL CHECK (type IN ('CSR_ACTIVITY','CHALLENGE')),
  status      VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(name, type)
);

CREATE TABLE emission_factors (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(150) NOT NULL,
  source_type   VARCHAR(30) NOT NULL CHECK (source_type IN ('PURCHASE','MANUFACTURING','EXPENSE','FLEET')),
  unit          VARCHAR(30) NOT NULL,          -- e.g. kg, liter, kWh, km
  co2_per_unit  NUMERIC(14,6) NOT NULL,         -- kg CO2e per unit
  valid_from    DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_to      DATE,
  status        VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(150) NOT NULL,
  sku         VARCHAR(60) UNIQUE NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE product_esg_profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id          UUID REFERENCES products(id) ON DELETE CASCADE,
  carbon_footprint    NUMERIC(14,4),
  sustainability_score NUMERIC(5,2),
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE environmental_goals (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id  UUID REFERENCES departments(id) ON DELETE CASCADE,
  title          VARCHAR(150) NOT NULL,
  target_metric  VARCHAR(100) NOT NULL,  -- e.g. "CO2e Reduction"
  target_value   NUMERIC(14,4) NOT NULL,
  current_value  NUMERIC(14,4) DEFAULT 0,
  unit           VARCHAR(30),
  deadline       DATE,
  status         VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS','ACHIEVED','MISSED')),
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE esg_policies (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title          VARCHAR(150) NOT NULL,
  description    TEXT,
  category       VARCHAR(20) NOT NULL DEFAULT 'GOVERNANCE',
  version        VARCHAR(20) NOT NULL DEFAULT '1.0',
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status         VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','ARCHIVED')),
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE badges (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(100) NOT NULL,
  description  TEXT,
  unlock_rule  JSONB NOT NULL, -- e.g. {"metric":"xp","operator":">=","value":500}
                                --      {"metric":"completed_challenges","operator":">=","value":5}
  icon_url     VARCHAR(255),
  status       VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE rewards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(150) NOT NULL,
  description     TEXT,
  points_required INT NOT NULL,
  stock           INT NOT NULL DEFAULT 0,
  status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TRANSACTIONAL DATA
-- ============================================================

CREATE TABLE carbon_transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id     UUID REFERENCES departments(id) ON DELETE CASCADE,
  source_type       VARCHAR(30) NOT NULL CHECK (source_type IN ('PURCHASE','MANUFACTURING','EXPENSE','FLEET')),
  source_reference_id UUID, -- points to originating ERP record (external/simulated)
  emission_factor_id UUID REFERENCES emission_factors(id),
  quantity          NUMERIC(14,4) NOT NULL,
  co2_equivalent    NUMERIC(14,4) NOT NULL, -- quantity * emission_factor.co2_per_unit
  transaction_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  auto_calculated   BOOLEAN NOT NULL DEFAULT false,
  created_by        UUID REFERENCES employees(id),
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE csr_activities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         VARCHAR(150) NOT NULL,
  category_id   UUID REFERENCES categories(id),
  department_id UUID REFERENCES departments(id),
  description   TEXT,
  start_date    DATE,
  end_date      DATE,
  status        VARCHAR(20) NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED','ONGOING','COMPLETED','CANCELLED')),
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE employee_participations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       UUID REFERENCES employees(id) ON DELETE CASCADE,
  activity_id       UUID REFERENCES csr_activities(id) ON DELETE CASCADE,
  proof_url         VARCHAR(255),
  approval_status   VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (approval_status IN ('PENDING','APPROVED','REJECTED')),
  points_earned     INT DEFAULT 0,
  completion_date   DATE,
  approved_by       UUID REFERENCES employees(id),
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, activity_id)
);

CREATE TABLE challenges (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title              VARCHAR(150) NOT NULL,
  category_id        UUID REFERENCES categories(id),
  description        TEXT,
  xp                 INT NOT NULL DEFAULT 0,
  difficulty         VARCHAR(20) NOT NULL DEFAULT 'EASY' CHECK (difficulty IN ('EASY','MEDIUM','HARD')),
  evidence_required  BOOLEAN NOT NULL DEFAULT false,
  deadline           DATE,
  status             VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ACTIVE','UNDER_REVIEW','COMPLETED','ARCHIVED')),
  created_at         TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE challenge_participations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id    UUID REFERENCES challenges(id) ON DELETE CASCADE,
  employee_id     UUID REFERENCES employees(id) ON DELETE CASCADE,
  progress        INT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  proof_url       VARCHAR(255),
  approval_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (approval_status IN ('PENDING','APPROVED','REJECTED')),
  xp_awarded      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(challenge_id, employee_id)
);

CREATE TABLE policy_acknowledgements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id      UUID REFERENCES esg_policies(id) ON DELETE CASCADE,
  employee_id    UUID REFERENCES employees(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(policy_id, employee_id)
);

CREATE TABLE audits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         VARCHAR(150) NOT NULL,
  department_id UUID REFERENCES departments(id),
  audit_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  auditor       VARCHAR(150),
  scope         TEXT,
  status        VARCHAR(20) NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED','IN_PROGRESS','COMPLETED')),
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE compliance_issues (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id     UUID REFERENCES audits(id) ON DELETE CASCADE,
  severity     VARCHAR(20) NOT NULL CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  description  TEXT NOT NULL,
  owner_id     UUID NOT NULL REFERENCES employees(id),
  due_date     DATE NOT NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_PROGRESS','RESOLVED')),
  flagged      BOOLEAN NOT NULL DEFAULT false, -- true when overdue & still open
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE department_scores (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id      UUID REFERENCES departments(id) ON DELETE CASCADE,
  environmental_score NUMERIC(5,2) DEFAULT 0,
  social_score        NUMERIC(5,2) DEFAULT 0,
  governance_score    NUMERIC(5,2) DEFAULT 0,
  total_score          NUMERIC(5,2) DEFAULT 0,
  period_start        DATE NOT NULL,
  period_end          DATE NOT NULL,
  created_at           TIMESTAMPTZ DEFAULT now(),
  UNIQUE(department_id, period_start, period_end)
);

CREATE TABLE diversity_metrics (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id  UUID REFERENCES departments(id) ON DELETE CASCADE,
  period_start   DATE NOT NULL,
  period_end     DATE NOT NULL,
  gender_male    INT DEFAULT 0,
  gender_female  INT DEFAULT 0,
  gender_other   INT DEFAULT 0,
  age_group_data JSONB,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE training_completions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id    UUID REFERENCES employees(id) ON DELETE CASCADE,
  training_name  VARCHAR(150) NOT NULL,
  completed_date DATE,
  status         VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','COMPLETED','OVERDUE')),
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE employee_badges (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID REFERENCES employees(id) ON DELETE CASCADE,
  badge_id     UUID REFERENCES badges(id) ON DELETE CASCADE,
  awarded_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, badge_id)
);

CREATE TABLE reward_redemptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID REFERENCES employees(id) ON DELETE CASCADE,
  reward_id       UUID REFERENCES rewards(id),
  points_deducted INT NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED','CANCELLED')),
  redeemed_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  type        VARCHAR(50) NOT NULL, -- COMPLIANCE_ISSUE, APPROVAL_DECISION, POLICY_REMINDER, BADGE_UNLOCK
  message     TEXT NOT NULL,
  is_read     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE notification_settings (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id               UUID REFERENCES employees(id) ON DELETE CASCADE UNIQUE,
  compliance_alerts         BOOLEAN NOT NULL DEFAULT true,
  approval_decisions        BOOLEAN NOT NULL DEFAULT true,
  policy_reminders          BOOLEAN NOT NULL DEFAULT true,
  badge_unlocks             BOOLEAN NOT NULL DEFAULT true,
  email_enabled             BOOLEAN NOT NULL DEFAULT true,
  in_app_enabled            BOOLEAN NOT NULL DEFAULT true
);
