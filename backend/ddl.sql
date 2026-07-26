-- ============================================================
-- TALENT NURTURING SYSTEM v2
-- DDL — Data Definition Language
-- Includes: Schema creation, Extensions, ENUMs, Tables, Indexes
--
-- Run order: ddl.sql FIRST, then dml.sql
-- Target DB : PostgreSQL 14+ (Supabase / Aiven / any cloud PG)
-- ============================================================


-- ============================================================
-- SECTION 1 — CREATE SCHEMA
-- ============================================================

-- Create a dedicated schema for the application.
-- All tables will live inside 'talent_nurturing'.
-- The search_path is set so queries work without schema prefix.

CREATE SCHEMA IF NOT EXISTS talent_nurturing;

SET search_path TO talent_nurturing, public;


-- ============================================================
-- SECTION 2 — EXTENSIONS
-- ============================================================

-- uuid-ossp provides uuid_generate_v4() used as default PKs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


-- ============================================================
-- SECTION 3 — ENUM TYPES
-- ============================================================
-- Drop and recreate safely using DO block so re-runs don't fail

DO $$
BEGIN

  -- Assignment lifecycle status
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignment_status') THEN
    CREATE TYPE talent_nurturing.assignment_status AS ENUM (
      'pending',
      'active',
      'at_risk',
      'overdue',
      'complete',
      'cancelled'
    );
  END IF;

  -- Individual component (content / test / case study) status
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'component_status') THEN
    CREATE TYPE talent_nurturing.component_status AS ENUM (
      'not_started',
      'in_progress',
      'complete',
      'failed'
    );
  END IF;

  -- Human-in-the-Loop queue status
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hil_status') THEN
    CREATE TYPE talent_nurturing.hil_status AS ENUM (
      'pending',
      'approved',
      'modified',
      'rejected'
    );
  END IF;

  -- Escalation resolution status
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'escalation_status') THEN
    CREATE TYPE talent_nurturing.escalation_status AS ENUM (
      'open',
      'resolved_extend',
      'resolved_replace',
      'resolved_accept_risk',
      'closed'
    );
  END IF;

  -- Certification lifecycle status
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cert_status') THEN
    CREATE TYPE talent_nurturing.cert_status AS ENUM (
      'pending',
      'verified',
      'registered'
    );
  END IF;

  -- Audit log severity level
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'log_level') THEN
    CREATE TYPE talent_nurturing.log_level AS ENUM (
      'info',
      'warning',
      'error',
      'action'
    );
  END IF;

END $$;


-- ============================================================
-- SECTION 4 — TABLES
-- ============================================================
-- Creation order respects FK dependencies:
--   resources, rfps, training_programs
--   → assignments
--   → hil_queue, escalations, certifications
--   audit_logs and metrics_snapshots are standalone


-- ------------------------------------------------------------
-- 4.1  resources
--      People being trained. Each has a unique resource_code.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS talent_nurturing.resources (
    id            UUID         PRIMARY KEY DEFAULT public.uuid_generate_v4(),
    resource_code VARCHAR(20)  UNIQUE NOT NULL,
    full_name     VARCHAR(120) NOT NULL,
    role          VARCHAR(100),
    department    VARCHAR(100),
    email         VARCHAR(200),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  talent_nurturing.resources              IS 'People enrolled in training programs';
COMMENT ON COLUMN talent_nurturing.resources.resource_code IS 'Unique human-readable ID e.g. R-1042';


-- ------------------------------------------------------------
-- 4.2  rfps
--      Client Request-for-Proposal records that define the
--      skill gap and certification requirement.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS talent_nurturing.rfps (
    id                 UUID         PRIMARY KEY DEFAULT public.uuid_generate_v4(),
    rfp_reference      VARCHAR(50)  UNIQUE NOT NULL,
    client_name        VARCHAR(200),
    skill_required     VARCHAR(200),
    proficiency_level  VARCHAR(50),
    cert_authority     VARCHAR(200),
    engagement_start   DATE,
    deployment_buffer  INTEGER      DEFAULT 7,   -- days before engagement start
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  talent_nurturing.rfps                   IS 'Client RFP records defining skill and cert requirements';
COMMENT ON COLUMN talent_nurturing.rfps.deployment_buffer IS 'Days before engagement_start that resource must be certified';


-- ------------------------------------------------------------
-- 4.3  training_programs
--      Courses that map to an RFP skill requirement.
--      content_modules is a JSONB array of module objects.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS talent_nurturing.training_programs (
    id               UUID         PRIMARY KEY DEFAULT public.uuid_generate_v4(),
    program_name     VARCHAR(200) NOT NULL,
    cert_name        VARCHAR(200),
    skill_category   VARCHAR(100),
    content_modules  JSONB,       -- [{"title":"...", "duration_h": N}, ...]
    total_duration_h INTEGER,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  talent_nurturing.training_programs                IS 'Training courses with modules and certification details';
COMMENT ON COLUMN talent_nurturing.training_programs.content_modules IS 'JSON array: [{title, duration_h}]';


-- ------------------------------------------------------------
-- 4.4  assignments
--      Core table. Links a resource to an RFP + program.
--      Tracks three components: content, test, case study.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS talent_nurturing.assignments (
    id                UUID              PRIMARY KEY DEFAULT public.uuid_generate_v4(),
    resource_id       UUID              NOT NULL REFERENCES talent_nurturing.resources(id),
    rfp_id            UUID              NOT NULL REFERENCES talent_nurturing.rfps(id),
    program_id        UUID              NOT NULL REFERENCES talent_nurturing.training_programs(id),
    assigned_date     DATE,
    deadline          DATE              NOT NULL,
    content_status    talent_nurturing.component_status   NOT NULL DEFAULT 'not_started',
    test_status       talent_nurturing.component_status   NOT NULL DEFAULT 'not_started',
    case_study_status talent_nurturing.component_status   NOT NULL DEFAULT 'not_started',
    overall_progress  INTEGER           NOT NULL DEFAULT 0 CHECK (overall_progress BETWEEN 0 AND 100),
    status            talent_nurturing.assignment_status  NOT NULL DEFAULT 'pending',
    test_score        NUMERIC(5,2)      CHECK (test_score BETWEEN 0 AND 100),
    test_attempts     INTEGER           DEFAULT 0,
    case_study_score  NUMERIC(5,2)      CHECK (case_study_score BETWEEN 0 AND 100),
    notes             TEXT,
    created_at        TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  talent_nurturing.assignments                  IS 'Training assignments linking resource → RFP → program';
COMMENT ON COLUMN talent_nurturing.assignments.overall_progress IS '0–100 integer combining content, test, case study progress';
COMMENT ON COLUMN talent_nurturing.assignments.status           IS 'Lifecycle: pending → active → complete | at_risk | overdue';


-- ------------------------------------------------------------
-- 4.5  hil_queue
--      Human-in-the-Loop approval queue.
--      Every training recommendation must be approved before
--      the assignment becomes active (BR-006).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS talent_nurturing.hil_queue (
    id               UUID                        PRIMARY KEY DEFAULT public.uuid_generate_v4(),
    assignment_id    UUID                        NOT NULL REFERENCES talent_nurturing.assignments(id),
    recommended_by   VARCHAR(100)                DEFAULT 'system',
    reviewer_id      VARCHAR(100),
    status           talent_nurturing.hil_status NOT NULL DEFAULT 'pending',
    proposed_program JSONB,   -- snapshot of the proposed program at time of recommendation
    reviewer_notes   TEXT,
    decision_ts      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ                 NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  talent_nurturing.hil_queue                  IS 'HIL approval queue — no training starts without approval';
COMMENT ON COLUMN talent_nurturing.hil_queue.proposed_program IS 'JSON snapshot: {program, modules, est_hours, deadline}';


-- ------------------------------------------------------------
-- 4.6  escalations
--      Raised when an assignment is at_risk or overdue.
--      Talent Lead resolves via extend / replace / accept_risk.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS talent_nurturing.escalations (
    id                UUID                              PRIMARY KEY DEFAULT public.uuid_generate_v4(),
    assignment_id     UUID                              NOT NULL REFERENCES talent_nurturing.assignments(id),
    escalation_ts     TIMESTAMPTZ                       NOT NULL DEFAULT NOW(),
    reason            TEXT,
    progress_snapshot JSONB,   -- {content, test, case_study, overall, days_remaining}
    status            talent_nurturing.escalation_status NOT NULL DEFAULT 'open',
    resolved_by       VARCHAR(100),
    resolution_notes  TEXT,
    new_deadline      DATE,
    resolved_ts       TIMESTAMPTZ
);

COMMENT ON TABLE  talent_nurturing.escalations                   IS 'At-risk and overdue assignment escalations';
COMMENT ON COLUMN talent_nurturing.escalations.progress_snapshot IS 'JSON snapshot of progress at time of escalation';


-- ------------------------------------------------------------
-- 4.7  certifications
--      Issued when an assignment reaches 100% and all
--      components are complete. Updates capability register.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS talent_nurturing.certifications (
    id                   UUID                        PRIMARY KEY DEFAULT public.uuid_generate_v4(),
    assignment_id        UUID                        NOT NULL REFERENCES talent_nurturing.assignments(id),
    resource_id          UUID                        NOT NULL REFERENCES talent_nurturing.resources(id),
    program_id           UUID                        NOT NULL REFERENCES talent_nurturing.training_programs(id),
    cert_name            VARCHAR(200),
    verified_date        DATE,
    capability_updated   BOOLEAN                     DEFAULT FALSE,
    capability_update_ts TIMESTAMPTZ,
    deployment_clearance DATE,
    status               talent_nurturing.cert_status NOT NULL DEFAULT 'pending',
    created_at           TIMESTAMPTZ                 NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  talent_nurturing.certifications                    IS 'Issued certifications with deployment clearance dates';
COMMENT ON COLUMN talent_nurturing.certifications.capability_updated IS 'TRUE once capability register has been updated';


-- ------------------------------------------------------------
-- 4.8  audit_logs
--      Append-only event log. Never updated or deleted.
--      Every system and user action is recorded here (BR-007).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS talent_nurturing.audit_logs (
    id           UUID                       PRIMARY KEY DEFAULT public.uuid_generate_v4(),
    ts           TIMESTAMPTZ                NOT NULL DEFAULT NOW(),
    rfp_ref      VARCHAR(50),
    resource_id  VARCHAR(100),
    action_type  VARCHAR(100)               NOT NULL,
    entity_type  VARCHAR(50),
    entity_id    UUID,
    original_val TEXT,
    new_val      TEXT,
    actor        VARCHAR(100)               DEFAULT 'system',
    level        talent_nurturing.log_level NOT NULL DEFAULT 'info',
    message      TEXT                       NOT NULL
);

COMMENT ON TABLE talent_nurturing.audit_logs IS 'Append-only audit trail — never UPDATE or DELETE rows here';


-- ------------------------------------------------------------
-- 4.9  metrics_snapshots
--      Periodic KPI snapshots consumed by the Analytics screen.
--      The latest row by snapshot_date is used for dashboard KPIs.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS talent_nurturing.metrics_snapshots (
    id                         UUID        PRIMARY KEY DEFAULT public.uuid_generate_v4(),
    snapshot_date              DATE        NOT NULL DEFAULT CURRENT_DATE,
    assignment_rate_pct        NUMERIC(5,2),
    completion_rate_pct        NUMERIC(5,2),
    assessment_pass_rate_pct   NUMERIC(5,2),
    overdue_rate_pct           NUMERIC(5,2),
    cert_compliance_rate_pct   NUMERIC(5,2),
    hil_override_rate_pct      NUMERIC(5,2),
    capability_update_rate_pct NUMERIC(5,2),
    avg_time_to_assignment_h   NUMERIC(8,2),
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE talent_nurturing.metrics_snapshots IS 'KPI snapshots — latest row drives the Analytics dashboard';


-- ============================================================
-- SECTION 5 — INDEXES
-- ============================================================
-- Covering the most common query patterns used by the API

-- assignments — filtered by status (Tracker screen filter buttons)
CREATE INDEX IF NOT EXISTS idx_assignments_status
    ON talent_nurturing.assignments (status);

-- assignments — filtered by resource (resource profile lookups)
CREATE INDEX IF NOT EXISTS idx_assignments_resource_id
    ON talent_nurturing.assignments (resource_id);

-- assignments — filtered by rfp (RFP compliance chart)
CREATE INDEX IF NOT EXISTS idx_assignments_rfp_id
    ON talent_nurturing.assignments (rfp_id);

-- hil_queue — pending items (HIL screen badge count + list)
CREATE INDEX IF NOT EXISTS idx_hil_queue_status
    ON talent_nurturing.hil_queue (status);

-- escalations — open items (Escalations screen badge count + list)
CREATE INDEX IF NOT EXISTS idx_escalations_status
    ON talent_nurturing.escalations (status);

-- escalations — by assignment (join from assignments)
CREATE INDEX IF NOT EXISTS idx_escalations_assignment_id
    ON talent_nurturing.escalations (assignment_id);

-- certifications — by resource (resource cert history)
CREATE INDEX IF NOT EXISTS idx_certifications_resource_id
    ON talent_nurturing.certifications (resource_id);

-- audit_logs — by timestamp descending (default sort in Audit screen)
CREATE INDEX IF NOT EXISTS idx_audit_logs_ts
    ON talent_nurturing.audit_logs (ts DESC);

-- audit_logs — by level (filter buttons: info / warning / error / action)
CREATE INDEX IF NOT EXISTS idx_audit_logs_level
    ON talent_nurturing.audit_logs (level);

-- metrics_snapshots — latest snapshot lookup
CREATE INDEX IF NOT EXISTS idx_metrics_snapshots_date
    ON talent_nurturing.metrics_snapshots (snapshot_date DESC);


-- ============================================================
-- END OF DDL
-- ============================================================
-- Next step: run dml.sql to load seed data
-- ============================================================
