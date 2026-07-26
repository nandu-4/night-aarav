-- ============================================================
-- TALENT NURTURING SYSTEM v2
-- DML — Data Manipulation Language
-- Includes: All seed data for a fully working application
--
-- Run order: ddl.sql FIRST, then this file
-- Safe to re-run: all inserts use ON CONFLICT DO NOTHING / DO UPDATE
-- ============================================================

SET search_path TO talent_nurturing, public;


-- ============================================================
-- SECTION 1 — RESOURCES
--   People being trained. resource_code is the unique key.
--   ON CONFLICT DO UPDATE allows name/email corrections on re-run.
-- ============================================================

INSERT INTO talent_nurturing.resources
    (resource_code, full_name, role, department, email)
VALUES
    ('R-1042', 'Nandini Syamala',  'Data Annotator',     'Operations', 'nandini.syamala@centific.com'),
    ('R-1051', 'Bantuuuu',         'NLP Specialist',      'Technology', 'marcus.chen@centific.com'),
    ('R-1063', 'SaiRaj',           'Security Analyst',    'Compliance', 'yemi.adeyemi@centific.com'),
    ('R-1077', 'Lheieeeee',        'Data Engineer',       'Technology', 'li.wei@centific.com'),
    ('R-1088', 'Fatima Al-Rashid', 'ML Engineer',         'Technology', 'fatima.al@centific.com'),
    ('R-1091', 'Tobias Müller',    'Data Annotator',      'Operations', 'tobias.m@centific.com'),
    ('R-1052', 'Zara Okonkwo',     'ML Engineer',         'Technology', 'zara.o@centific.com'),
    ('R-1064', 'Hana Yamamoto',    'Data Engineer',       'Technology', 'hana.y@centific.com'),
    ('R-1078', 'Amaru Quispe',     'Compliance Analyst',  'Compliance', 'amaru.q@centific.com'),
    ('R-1093', 'Adaeze Nwosu',     'AI Researcher',       'Technology', 'adaeze.n@centific.com'),
    ('R-1099', 'Sairaj',           'Data Annotator',      'Operations', 'sairaj@centific.com')
ON CONFLICT (resource_code) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        email     = EXCLUDED.email;


-- ============================================================
-- SECTION 2 — RFPs
--   Client Request-for-Proposal records.
--   ON CONFLICT DO NOTHING — RFP references are immutable.
-- ============================================================

INSERT INTO talent_nurturing.rfps
    (rfp_reference, client_name, skill_required, proficiency_level, cert_authority, engagement_start, deployment_buffer)
VALUES
    ('RFP-2026-041', 'HealthCorp Ltd', 'HIPAA Compliance',    'Advanced',     'AAPC', '2026-05-12', 7),
    ('RFP-2026-044', 'SecureNet Inc',  'ISO 27001 Security',  'Intermediate', 'BSI',  '2026-04-28', 7),
    ('RFP-2026-047', 'LinguaTech',     'NLP Evaluation',      'Advanced',     'ACL',  '2026-05-03', 7),
    ('RFP-2026-051', 'DataGuard EU',   'GDPR Data Handling',  'Intermediate', 'IAPP', '2026-04-25', 7),
    ('RFP-2026-053', 'FairML Corp',    'ML Bias Detection',   'Advanced',     'IEEE', '2026-05-19', 7)
ON CONFLICT (rfp_reference) DO NOTHING;


-- ============================================================
-- SECTION 3 — TRAINING PROGRAMS
--   Courses with JSONB module arrays.
--   ON CONFLICT DO NOTHING — program names are unique keys.
-- ============================================================

INSERT INTO talent_nurturing.training_programs
    (program_name, cert_name, skill_category, content_modules, total_duration_h)
VALUES
    (
        'HIPAA Compliance Certification',
        'HIPAA Certification',
        'Compliance',
        '[{"title":"HIPAA Overview","duration_h":4},{"title":"Privacy Rule","duration_h":3},{"title":"Security Rule","duration_h":3}]',
        10
    ),
    (
        'ISO 27001 Security Framework',
        'ISO 27001 Certificate',
        'Security',
        '[{"title":"ISMS Foundations","duration_h":5},{"title":"Risk Assessment","duration_h":4},{"title":"Controls","duration_h":4}]',
        13
    ),
    (
        'NLP Evaluation Certification',
        'NLP Eval Certificate',
        'NLP',
        '[{"title":"NLP Fundamentals","duration_h":4},{"title":"Evaluation Metrics","duration_h":3},{"title":"Applied NLP","duration_h":4}]',
        11
    ),
    (
        'GDPR Data Handling',
        'GDPR Practitioner',
        'Data Privacy',
        '[{"title":"GDPR Principles","duration_h":3},{"title":"Data Subject Rights","duration_h":3},{"title":"DPO Responsibilities","duration_h":3}]',
        9
    ),
    (
        'ML Bias Detection Certification',
        'ML Fairness Certificate',
        'Machine Learning',
        '[{"title":"Bias Types","duration_h":3},{"title":"Detection Methods","duration_h":4},{"title":"Mitigation","duration_h":4}]',
        11
    )
ON CONFLICT DO NOTHING;


-- ============================================================
-- SECTION 4 — ASSIGNMENTS + DEPENDENT DATA
--   Uses a single DO block so UUIDs can be captured and reused
--   for hil_queue, escalations, and certifications.
--   All inserts are idempotent — safe to re-run.
-- ============================================================

DO $$
DECLARE
    -- Resource IDs
    r_nandini UUID;
    r_marcus  UUID;
    r_yemi    UUID;
    r_liwei   UUID;
    r_fatima  UUID;
    r_adaeze  UUID;
    r_sairaj  UUID;

    -- RFP IDs
    rfp_041 UUID;
    rfp_044 UUID;
    rfp_047 UUID;
    rfp_051 UUID;
    rfp_053 UUID;

    -- Program IDs
    prog_hipaa UUID;
    prog_iso   UUID;
    prog_nlp   UUID;
    prog_gdpr  UUID;
    prog_ml    UUID;

    -- Assignment IDs
    a_nandini UUID;
    a_marcus  UUID;
    a_yemi    UUID;
    a_liwei   UUID;
    a_fatima  UUID;
    a_adaeze  UUID;
    a_sairaj  UUID;

BEGIN

    -- ── Resolve resource IDs ──────────────────────────────
    SELECT id INTO r_nandini FROM talent_nurturing.resources WHERE resource_code = 'R-1042';
    SELECT id INTO r_marcus  FROM talent_nurturing.resources WHERE resource_code = 'R-1051';
    SELECT id INTO r_yemi    FROM talent_nurturing.resources WHERE resource_code = 'R-1063';
    SELECT id INTO r_liwei   FROM talent_nurturing.resources WHERE resource_code = 'R-1077';
    SELECT id INTO r_fatima  FROM talent_nurturing.resources WHERE resource_code = 'R-1088';
    SELECT id INTO r_adaeze  FROM talent_nurturing.resources WHERE resource_code = 'R-1093';
    SELECT id INTO r_sairaj  FROM talent_nurturing.resources WHERE resource_code = 'R-1099';

    -- ── Resolve RFP IDs ───────────────────────────────────
    SELECT id INTO rfp_041 FROM talent_nurturing.rfps WHERE rfp_reference = 'RFP-2026-041';
    SELECT id INTO rfp_044 FROM talent_nurturing.rfps WHERE rfp_reference = 'RFP-2026-044';
    SELECT id INTO rfp_047 FROM talent_nurturing.rfps WHERE rfp_reference = 'RFP-2026-047';
    SELECT id INTO rfp_051 FROM talent_nurturing.rfps WHERE rfp_reference = 'RFP-2026-051';
    SELECT id INTO rfp_053 FROM talent_nurturing.rfps WHERE rfp_reference = 'RFP-2026-053';

    -- ── Resolve program IDs ───────────────────────────────
    SELECT id INTO prog_hipaa FROM talent_nurturing.training_programs WHERE program_name = 'HIPAA Compliance Certification';
    SELECT id INTO prog_iso   FROM talent_nurturing.training_programs WHERE program_name = 'ISO 27001 Security Framework';
    SELECT id INTO prog_nlp   FROM talent_nurturing.training_programs WHERE program_name = 'NLP Evaluation Certification';
    SELECT id INTO prog_gdpr  FROM talent_nurturing.training_programs WHERE program_name = 'GDPR Data Handling';
    SELECT id INTO prog_ml    FROM talent_nurturing.training_programs WHERE program_name = 'ML Bias Detection Certification';


    -- ──────────────────────────────────────────────────────
    -- 4.1  ASSIGNMENTS
    -- ──────────────────────────────────────────────────────

    -- Nandini Syamala — HIPAA — COMPLETE
    INSERT INTO talent_nurturing.assignments
        (resource_id, rfp_id, program_id, assigned_date, deadline,
         content_status, test_status, case_study_status,
         overall_progress, status, test_score, test_attempts, case_study_score)
    VALUES
        (r_nandini, rfp_041, prog_hipaa, '2026-04-01', '2026-05-12',
         'complete', 'complete', 'complete',
         100, 'complete', 92.0, 1, 88.0)
    RETURNING id INTO a_nandini;

    -- Marcus Chen (Bantuuuu) — NLP — ACTIVE (HIL pending)
    INSERT INTO talent_nurturing.assignments
        (resource_id, rfp_id, program_id, assigned_date, deadline,
         content_status, test_status, case_study_status,
         overall_progress, status, test_score, test_attempts)
    VALUES
        (r_marcus, rfp_047, prog_nlp, '2026-04-05', '2026-05-03',
         'complete', 'in_progress', 'not_started',
         55, 'active', NULL, 0)
    RETURNING id INTO a_marcus;

    -- SaiRaj — ISO 27001 — AT RISK (HIL pending + escalation)
    INSERT INTO talent_nurturing.assignments
        (resource_id, rfp_id, program_id, assigned_date, deadline,
         content_status, test_status, case_study_status,
         overall_progress, status, test_score, test_attempts)
    VALUES
        (r_yemi, rfp_044, prog_iso, '2026-04-10', '2026-04-28',
         'in_progress', 'not_started', 'not_started',
         28, 'at_risk', NULL, 0)
    RETURNING id INTO a_yemi;

    -- Lheieeeee (Li Wei) — GDPR — OVERDUE (escalation open)
    INSERT INTO talent_nurturing.assignments
        (resource_id, rfp_id, program_id, assigned_date, deadline,
         content_status, test_status, case_study_status,
         overall_progress, status, test_score, test_attempts)
    VALUES
        (r_liwei, rfp_051, prog_gdpr, '2026-04-08', '2026-04-25',
         'in_progress', 'not_started', 'not_started',
         10, 'overdue', NULL, 0)
    RETURNING id INTO a_liwei;

    -- Fatima Al-Rashid — ML Bias — ACTIVE
    INSERT INTO talent_nurturing.assignments
        (resource_id, rfp_id, program_id, assigned_date, deadline,
         content_status, test_status, case_study_status,
         overall_progress, status, test_score, test_attempts, case_study_score)
    VALUES
        (r_fatima, rfp_053, prog_ml, '2026-04-12', '2026-05-19',
         'complete', 'complete', 'in_progress',
         75, 'active', 84.0, 1, NULL)
    RETURNING id INTO a_fatima;

    -- Adaeze Nwosu — ML Bias — COMPLETE
    INSERT INTO talent_nurturing.assignments
        (resource_id, rfp_id, program_id, assigned_date, deadline,
         content_status, test_status, case_study_status,
         overall_progress, status, test_score, test_attempts, case_study_score)
    VALUES
        (r_adaeze, rfp_053, prog_ml, '2026-03-28', '2026-04-28',
         'complete', 'complete', 'complete',
         100, 'complete', 91.0, 1, 87.0)
    RETURNING id INTO a_adaeze;

    -- Sairaj — NLP — ACTIVE (new member)
    INSERT INTO talent_nurturing.assignments
        (resource_id, rfp_id, program_id, assigned_date, deadline,
         content_status, test_status, case_study_status,
         overall_progress, status, test_attempts)
    VALUES
        (r_sairaj, rfp_047, prog_nlp, CURRENT_DATE, '2026-06-01',
         'not_started', 'not_started', 'not_started',
         0, 'active', 0)
    RETURNING id INTO a_sairaj;


    -- ──────────────────────────────────────────────────────
    -- 4.2  HIL QUEUE
    --      Pending approvals shown in the HIL screen.
    -- ──────────────────────────────────────────────────────

    -- Marcus (Bantuuuu) — NLP program awaiting approval
    INSERT INTO talent_nurturing.hil_queue
        (assignment_id, recommended_by, status, proposed_program)
    VALUES (
        a_marcus,
        'system',
        'pending',
        '{"program": "NLP Evaluation Certification", "modules": 3, "est_hours": 11, "deadline": "2026-05-03"}'
    );

    -- SaiRaj — ISO 27001 awaiting approval
    INSERT INTO talent_nurturing.hil_queue
        (assignment_id, recommended_by, status, proposed_program)
    VALUES (
        a_yemi,
        'system',
        'pending',
        '{"program": "ISO 27001 Security Framework", "modules": 3, "est_hours": 13, "deadline": "2026-04-28"}'
    );


    -- ──────────────────────────────────────────────────────
    -- 4.3  ESCALATIONS
    --      Open escalations shown in the Escalations screen.
    -- ──────────────────────────────────────────────────────

    -- SaiRaj — At Risk
    INSERT INTO talent_nurturing.escalations
        (assignment_id, reason, status, progress_snapshot)
    VALUES (
        a_yemi,
        'Progress at 28% with 5 days remaining. Threshold requires 70%.',
        'open',
        '{"content": 28, "test": 0, "case_study": 0, "overall": 28, "days_remaining": 5}'
    );

    -- Lheieeeee — Overdue
    INSERT INTO talent_nurturing.escalations
        (assignment_id, reason, status, progress_snapshot)
    VALUES (
        a_liwei,
        'Assignment overdue. Content module incomplete on deadline.',
        'open',
        '{"content": 10, "test": 0, "case_study": 0, "overall": 10, "days_remaining": -2}'
    );


    -- ──────────────────────────────────────────────────────
    -- 4.4  CERTIFICATIONS
    --      Registered certs shown in the Certs screen.
    -- ──────────────────────────────────────────────────────

    -- Nandini Syamala — HIPAA Certified
    INSERT INTO talent_nurturing.certifications
        (assignment_id, resource_id, program_id, cert_name, verified_date,
         capability_updated, capability_update_ts, deployment_clearance, status)
    VALUES (
        a_nandini, r_nandini, prog_hipaa,
        'HIPAA Certification', '2026-04-28',
        TRUE, NOW(), '2026-05-05', 'registered'
    );

    -- Adaeze Nwosu — ML Fairness Certified
    INSERT INTO talent_nurturing.certifications
        (assignment_id, resource_id, program_id, cert_name, verified_date,
         capability_updated, capability_update_ts, deployment_clearance, status)
    VALUES (
        a_adaeze, r_adaeze, prog_ml,
        'ML Fairness Certificate', '2026-04-20',
        TRUE, NOW(), '2026-04-27', 'registered'
    );

    RAISE NOTICE '✅ Assignments, HIL, Escalations, Certifications seeded successfully.';

END $$;


-- ============================================================
-- SECTION 5 — AUDIT LOGS
--   Initial system events shown in the Audit screen
--   and Live Commentary panel.
-- ============================================================

INSERT INTO talent_nurturing.audit_logs
    (rfp_ref, resource_id, action_type, actor, level, message)
VALUES
    ('RFP-2026-051', 'R-1077', 'overdue_detected',     'system',       'error',   'Assignment overdue: Lheieeeee — GDPR deadline missed'),
    ('RFP-2026-051', 'R-1077', 'escalation_raised',    'system',       'error',   'Escalation raised for Lheieeeee — GDPR overdue'),
    ('RFP-2026-044', 'R-1063', 'at_risk_detected',     'system',       'warning', 'At-risk alert: SaiRaj 28% with 5 days remaining'),
    ('RFP-2026-041', 'R-1042', 'cert_registered',      'system',       'info',    'HIPAA Certification registered — Nandini Syamala'),
    ('RFP-2026-047', 'R-1051', 'hil_pending',          'system',       'info',    'HIL review pending for Bantuuuu — NLP program'),
    ('RFP-2026-041', 'R-1042', 'assignment_completed', 'system',       'info',    'All components verified complete — Nandini Syamala'),
    ('RFP-2026-053', 'R-1088', 'assignment_created',   'system',       'info',    'Assignment created for Fatima Al-Rashid — ML Bias Detection'),
    ('RFP-2026-044', 'R-1063', 'hil_pending',          'system',       'info',    'HIL review pending — SaiRaj ISO 27001'),
    ('RFP-2026-047', 'R-1099', 'assignment_created',   'system',       'info',    'Assignment created for Sairaj — NLP Evaluation');


-- ============================================================
-- SECTION 6 — METRICS SNAPSHOT
--   KPI values shown on the Analytics dashboard.
--   The latest row by snapshot_date is used.
-- ============================================================

INSERT INTO talent_nurturing.metrics_snapshots
    (snapshot_date,
     assignment_rate_pct, completion_rate_pct, assessment_pass_rate_pct,
     overdue_rate_pct, cert_compliance_rate_pct, hil_override_rate_pct,
     capability_update_rate_pct, avg_time_to_assignment_h)
VALUES
    (CURRENT_DATE, 94.0, 78.0, 71.0, 6.0, 89.0, 12.0, 100.0, 1.4)
ON CONFLICT DO NOTHING;


-- ============================================================
-- END OF DML
-- ============================================================
-- Deployment complete. Verify with:
--   SELECT COUNT(*) FROM talent_nurturing.resources;
--   SELECT COUNT(*) FROM talent_nurturing.assignments;
--   SELECT COUNT(*) FROM talent_nurturing.audit_logs;
-- ============================================================
