-- ============================================================
-- Talent Nurturing — PostgreSQL Schema for Aiven Cloud
-- Run this in your Aiven defaultdb via psql or pgAdmin
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE assignment_status  AS ENUM ('pending','active','at_risk','overdue','complete','cancelled');
CREATE TYPE component_status   AS ENUM ('not_started','in_progress','complete','failed');
CREATE TYPE hil_status         AS ENUM ('pending','approved','modified','rejected');
CREATE TYPE escalation_status  AS ENUM ('open','resolved_extend','resolved_replace','resolved_accept_risk','closed');
CREATE TYPE cert_status        AS ENUM ('pending','verified','registered');
CREATE TYPE log_level          AS ENUM ('info','warning','error','action');

CREATE TABLE resources (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resource_code VARCHAR(20) UNIQUE NOT NULL,
    full_name     VARCHAR(120) NOT NULL,
    role          VARCHAR(100),
    department    VARCHAR(100),
    email         VARCHAR(200),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE rfps (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rfp_reference      VARCHAR(50) UNIQUE NOT NULL,
    client_name        VARCHAR(200),
    skill_required     VARCHAR(200),
    proficiency_level  VARCHAR(50),
    cert_authority     VARCHAR(200),
    engagement_start   DATE,
    deployment_buffer  INTEGER DEFAULT 7,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE training_programs (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_name     VARCHAR(200) NOT NULL,
    cert_name        VARCHAR(200),
    skill_category   VARCHAR(100),
    content_modules  JSONB,
    total_duration_h INTEGER,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE assignments (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resource_id       UUID NOT NULL REFERENCES resources(id),
    rfp_id            UUID NOT NULL REFERENCES rfps(id),
    program_id        UUID NOT NULL REFERENCES training_programs(id),
    assigned_date     DATE,
    deadline          DATE NOT NULL,
    content_status    component_status NOT NULL DEFAULT 'not_started',
    test_status       component_status NOT NULL DEFAULT 'not_started',
    case_study_status component_status NOT NULL DEFAULT 'not_started',
    overall_progress  INTEGER NOT NULL DEFAULT 0,
    status            assignment_status NOT NULL DEFAULT 'pending',
    test_score        NUMERIC(5,2),
    test_attempts     INTEGER DEFAULT 0,
    case_study_score  NUMERIC(5,2),
    notes             TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE hil_queue (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id    UUID NOT NULL REFERENCES assignments(id),
    recommended_by   VARCHAR(100) DEFAULT 'system',
    reviewer_id      VARCHAR(100),
    status           hil_status NOT NULL DEFAULT 'pending',
    proposed_program JSONB,
    reviewer_notes   TEXT,
    decision_ts      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE escalations (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id     UUID NOT NULL REFERENCES assignments(id),
    escalation_ts     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason            TEXT,
    progress_snapshot JSONB,
    status            escalation_status NOT NULL DEFAULT 'open',
    resolved_by       VARCHAR(100),
    resolution_notes  TEXT,
    new_deadline      DATE,
    resolved_ts       TIMESTAMPTZ
);

CREATE TABLE certifications (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id        UUID NOT NULL REFERENCES assignments(id),
    resource_id          UUID NOT NULL REFERENCES resources(id),
    program_id           UUID NOT NULL REFERENCES training_programs(id),
    cert_name            VARCHAR(200),
    verified_date        DATE,
    capability_updated   BOOLEAN DEFAULT FALSE,
    capability_update_ts TIMESTAMPTZ,
    deployment_clearance DATE,
    status               cert_status NOT NULL DEFAULT 'pending',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_logs (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ts           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rfp_ref      VARCHAR(50),
    resource_id  VARCHAR(100),
    action_type  VARCHAR(100) NOT NULL,
    entity_type  VARCHAR(50),
    entity_id    UUID,
    original_val TEXT,
    new_val      TEXT,
    actor        VARCHAR(100) DEFAULT 'system',
    level        log_level NOT NULL DEFAULT 'info',
    message      TEXT NOT NULL
);

CREATE TABLE metrics_snapshots (
    id                         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    snapshot_date              DATE NOT NULL DEFAULT CURRENT_DATE,
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

-- Sample Data
INSERT INTO resources (resource_code,full_name,role,department,email) VALUES
  ('R-1042','Nandini','Data Annotator','Operations','aisha.bello@oneforma.com'),
  ('R-1051','Marcus Chen','NLP Specialist','Technology','marcus.chen@oneforma.com'),
  ('R-1063','Yemi Adeyemi','Security Analyst','Compliance','yemi.adeyemi@oneforma.com'),
  ('R-1077','Li Wei','Data Engineer','Technology','li.wei@oneforma.com'),
  ('R-1088','Fatima Al-Rashid','ML Engineer','Technology','fatima.al@oneforma.com'),
  ('R-1091','Tobias Müller','Data Annotator','Operations','tobias.m@oneforma.com'),
  ('R-1052','Zara Okonkwo','ML Engineer','Technology','zara.o@oneforma.com'),
  ('R-1064','Hana Yamamoto','Data Engineer','Technology','hana.y@oneforma.com'),
  ('R-1078','Amaru Quispe','Compliance Analyst','Compliance','amaru.q@oneforma.com'),
  ('R-1093','Adaeze Nwosu','AI Researcher','Technology','adaeze.n@oneforma.com');

INSERT INTO rfps (rfp_reference,client_name,skill_required,proficiency_level,cert_authority,engagement_start,deployment_buffer) VALUES
  ('RFP-2026-041','HealthCorp Ltd','HIPAA Compliance','Advanced','AAPC','2026-05-12',7),
  ('RFP-2026-044','SecureNet Inc','ISO 27001 Security','Intermediate','BSI','2026-04-28',7),
  ('RFP-2026-047','LinguaTech','NLP Evaluation','Advanced','ACL','2026-05-03',7),
  ('RFP-2026-051','DataGuard EU','GDPR Data Handling','Intermediate','IAPP','2026-04-25',7),
  ('RFP-2026-053','FairML Corp','ML Bias Detection','Advanced','IEEE','2026-05-19',7);

INSERT INTO training_programs (program_name,cert_name,skill_category,content_modules,total_duration_h) VALUES
  ('HIPAA Compliance Certification','HIPAA Certification','Compliance','[{"title":"HIPAA Overview","duration_h":4},{"title":"Privacy Rule","duration_h":3},{"title":"Security Rule","duration_h":3}]',10),
  ('ISO 27001 Security Framework','ISO 27001 Certificate','Security','[{"title":"ISMS Foundations","duration_h":5},{"title":"Risk Assessment","duration_h":4},{"title":"Controls","duration_h":4}]',13),
  ('NLP Evaluation Certification','NLP Eval Certificate','NLP','[{"title":"NLP Fundamentals","duration_h":4},{"title":"Evaluation Metrics","duration_h":3},{"title":"Applied NLP","duration_h":4}]',11),
  ('GDPR Data Handling','GDPR Practitioner','Data Privacy','[{"title":"GDPR Principles","duration_h":3},{"title":"Data Subject Rights","duration_h":3},{"title":"DPO Responsibilities","duration_h":3}]',9),
  ('ML Bias Detection Certification','ML Fairness Certificate','Machine Learning','[{"title":"Bias Types","duration_h":3},{"title":"Detection Methods","duration_h":4},{"title":"Mitigation","duration_h":4}]',11);

INSERT INTO metrics_snapshots (assignment_rate_pct,completion_rate_pct,assessment_pass_rate_pct,overdue_rate_pct,cert_compliance_rate_pct,hil_override_rate_pct,capability_update_rate_pct,avg_time_to_assignment_h)
VALUES (94.0,78.0,71.0,6.0,89.0,12.0,100.0,1.4);
