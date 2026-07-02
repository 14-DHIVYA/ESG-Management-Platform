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
