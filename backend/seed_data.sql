-- ============================================================
-- Talent Nurturing — Full Seed Data (run AFTER schema.sql)
-- Includes Nandini Syamala test data + full pipeline rows
-- ============================================================

DO $$
DECLARE
  -- Resource UUIDs
  r_nandini  UUID;
  r_marcus   UUID;
  r_yemi     UUID;
  r_liwei    UUID;
  r_fatima   UUID;
  r_adaeze   UUID;

  -- RFP UUIDs
  rfp_041 UUID;
  rfp_044 UUID;
  rfp_047 UUID;
  rfp_051 UUID;
  rfp_053 UUID;

  -- Program UUIDs
  prog_hipaa UUID;
  prog_iso   UUID;
  prog_nlp   UUID;
  prog_gdpr  UUID;
  prog_ml    UUID;

  -- Assignment UUIDs
  a_nandini  UUID;
  a_marcus   UUID;
  a_yemi     UUID;
  a_liwei    UUID;
  a_fatima   UUID;
  a_adaeze   UUID;

BEGIN

  -- ─────────────────────────────────────────────────────────
  -- 1. UPSERT RESOURCES
  -- ─────────────────────────────────────────────────────────
  INSERT INTO resources (resource_code, full_name, role, department, email)
  VALUES ('R-1042', 'Nandini Syamala', 'Data Annotator', 'Operations', 'nandini.syamala@centific.com')
  ON CONFLICT (resource_code) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        email     = EXCLUDED.email;
  SELECT id INTO r_nandini FROM resources WHERE resource_code = 'R-1042';

  INSERT INTO resources (resource_code, full_name, role, department, email)
  VALUES ('R-1051', 'Bantuuuu', 'NLP Specialist', 'Technology', 'marcus.chen@centific.com')
  ON CONFLICT (resource_code) DO NOTHING;
  SELECT id INTO r_marcus FROM resources WHERE resource_code = 'R-1051';

  INSERT INTO resources (resource_code, full_name, role, department, email)
  VALUES ('R-1063', 'SaiRaj', 'Security Analyst', 'Compliance', 'yemi.adeyemi@centific.com')
  ON CONFLICT (resource_code) DO NOTHING;
  SELECT id INTO r_yemi FROM resources WHERE resource_code = 'R-1063';

  INSERT INTO resources (resource_code, full_name, role, department, email)
  VALUES ('R-1077', 'Lheieeeee', 'Data Engineer', 'Technology', 'li.wei@centific.com')
  ON CONFLICT (resource_code) DO NOTHING;
  SELECT id INTO r_liwei FROM resources WHERE resource_code = 'R-1077';

  INSERT INTO resources (resource_code, full_name, role, department, email)
  VALUES ('R-1088', 'Fatima Al-Rashi', 'ML Engineer', 'Technology', 'fatima.al@centific.com')
  ON CONFLICT (resource_code) DO NOTHING;
  SELECT id INTO r_fatima FROM resources WHERE resource_code = 'R-1088';

  INSERT INTO resources (resource_code, full_name, role, department, email)
  VALUES ('R-1093', 'Adaeze Nwosu', 'AI Researcher', 'Technology', 'adaeze.n@centific.com')
  ON CONFLICT (resource_code) DO NOTHING;
  SELECT id INTO r_adaeze FROM resources WHERE resource_code = 'R-1093';

  -- ─────────────────────────────────────────────────────────
  -- 2. UPSERT RFPs
  -- ─────────────────────────────────────────────────────────
  INSERT INTO rfps (rfp_reference, client_name, skill_required, proficiency_level, cert_authority, engagement_start, deployment_buffer)
  VALUES ('RFP-2026-041', 'HealthCorp Ltd', 'HIPAA Compliance', 'Advanced', 'AAPC', '2026-05-12', 7)
  ON CONFLICT (rfp_reference) DO NOTHING;
  SELECT id INTO rfp_041 FROM rfps WHERE rfp_reference = 'RFP-2026-041';

  INSERT INTO rfps (rfp_reference, client_name, skill_required, proficiency_level, cert_authority, engagement_start, deployment_buffer)
  VALUES ('RFP-2026-044', 'SecureNet Inc', 'ISO 27001 Security', 'Intermediate', 'BSI', '2026-04-28', 7)
  ON CONFLICT (rfp_reference) DO NOTHING;
  SELECT id INTO rfp_044 FROM rfps WHERE rfp_reference = 'RFP-2026-044';

  INSERT INTO rfps (rfp_reference, client_name, skill_required, proficiency_level, cert_authority, engagement_start, deployment_buffer)
  VALUES ('RFP-2026-047', 'LinguaTech', 'NLP Evaluation', 'Advanced', 'ACL', '2026-05-03', 7)
  ON CONFLICT (rfp_reference) DO NOTHING;
  SELECT id INTO rfp_047 FROM rfps WHERE rfp_reference = 'RFP-2026-047';

  INSERT INTO rfps (rfp_reference, client_name, skill_required, proficiency_level, cert_authority, engagement_start, deployment_buffer)
  VALUES ('RFP-2026-051', 'DataGuard EU', 'GDPR Data Handling', 'Intermediate', 'IAPP', '2026-04-25', 7)
  ON CONFLICT (rfp_reference) DO NOTHING;
  SELECT id INTO rfp_051 FROM rfps WHERE rfp_reference = 'RFP-2026-051';

  INSERT INTO rfps (rfp_reference, client_name, skill_required, proficiency_level, cert_authority, engagement_start, deployment_buffer)
  VALUES ('RFP-2026-053', 'FairML Corp', 'ML Bias Detection', 'Advanced', 'IEEE', '2026-05-19', 7)
  ON CONFLICT (rfp_reference) DO NOTHING;
  SELECT id INTO rfp_053 FROM rfps WHERE rfp_reference = 'RFP-2026-053';

  -- ─────────────────────────────────────────────────────────
  -- 3. UPSERT TRAINING PROGRAMS
  -- ─────────────────────────────────────────────────────────
  INSERT INTO training_programs (program_name, cert_name, skill_category, content_modules, total_duration_h)
  VALUES ('HIPAA Compliance Certification', 'HIPAA Certification', 'Compliance',
    '[{"title":"HIPAA Overview","duration_h":4},{"title":"Privacy Rule","duration_h":3},{"title":"Security Rule","duration_h":3}]', 10)
  ON CONFLICT DO NOTHING;
  SELECT id INTO prog_hipaa FROM training_programs WHERE program_name = 'HIPAA Compliance Certification';

  INSERT INTO training_programs (program_name, cert_name, skill_category, content_modules, total_duration_h)
  VALUES ('ISO 27001 Security Framework', 'ISO 27001 Certificate', 'Security',
    '[{"title":"ISMS Foundations","duration_h":5},{"title":"Risk Assessment","duration_h":4},{"title":"Controls","duration_h":4}]', 13)
  ON CONFLICT DO NOTHING;
  SELECT id INTO prog_iso FROM training_programs WHERE program_name = 'ISO 27001 Security Framework';

  INSERT INTO training_programs (program_name, cert_name, skill_category, content_modules, total_duration_h)
  VALUES ('NLP Evaluation Certification', 'NLP Eval Certificate', 'NLP',
    '[{"title":"NLP Fundamentals","duration_h":4},{"title":"Evaluation Metrics","duration_h":3},{"title":"Applied NLP","duration_h":4}]', 11)
  ON CONFLICT DO NOTHING;
  SELECT id INTO prog_nlp FROM training_programs WHERE program_name = 'NLP Evaluation Certification';

  INSERT INTO training_programs (program_name, cert_name, skill_category, content_modules, total_duration_h)
  VALUES ('GDPR Data Handling', 'GDPR Practitioner', 'Data Privacy',
    '[{"title":"GDPR Principles","duration_h":3},{"title":"Data Subject Rights","duration_h":3},{"title":"DPO Responsibilities","duration_h":3}]', 9)
  ON CONFLICT DO NOTHING;
  SELECT id INTO prog_gdpr FROM training_programs WHERE program_name = 'GDPR Data Handling';

  INSERT INTO training_programs (program_name, cert_name, skill_category, content_modules, total_duration_h)
  VALUES ('ML Bias Detection Certification', 'ML Fairness Certificate', 'Machine Learning',
    '[{"title":"Bias Types","duration_h":3},{"title":"Detection Methods","duration_h":4},{"title":"Mitigation","duration_h":4}]', 11)
  ON CONFLICT DO NOTHING;
  SELECT id INTO prog_ml FROM training_programs WHERE program_name = 'ML Bias Detection Certification';

  -- ─────────────────────────────────────────────────────────
  -- 4. ASSIGNMENTS
  -- ─────────────────────────────────────────────────────────

  -- Nandini Syamala — HIPAA — COMPLETE (your name is here!)
  INSERT INTO assignments
    (resource_id, rfp_id, program_id, assigned_date, deadline,
     content_status, test_status, case_study_status,
     overall_progress, status, test_score, test_attempts, case_study_score)
  VALUES
    (r_nandini, rfp_041, prog_hipaa, '2026-04-01', '2026-05-12',
     'complete', 'complete', 'complete',
     100, 'complete', 92.0, 1, 88.0)
  RETURNING id INTO a_nandini;

  -- Marcus Chen — NLP — ACTIVE (HIL pending)
  INSERT INTO assignments
    (resource_id, rfp_id, program_id, assigned_date, deadline,
     content_status, test_status, case_study_status,
     overall_progress, status, test_score, test_attempts)
  VALUES
    (r_marcus, rfp_047, prog_nlp, '2026-04-05', '2026-05-03',
     'complete', 'in_progress', 'not_started',
     55, 'active', NULL, 0)
  RETURNING id INTO a_marcus;

  -- Yemi Adeyemi — ISO 27001 — AT RISK (HIL pending + escalation)
  INSERT INTO assignments
    (resource_id, rfp_id, program_id, assigned_date, deadline,
     content_status, test_status, case_study_status,
     overall_progress, status, test_score, test_attempts)
  VALUES
    (r_yemi, rfp_044, prog_iso, '2026-04-10', '2026-04-28',
     'in_progress', 'not_started', 'not_started',
     28, 'at_risk', NULL, 0)
  RETURNING id INTO a_yemi;

  -- Li Wei — GDPR — OVERDUE (escalation open)
  INSERT INTO assignments
    (resource_id, rfp_id, program_id, assigned_date, deadline,
     content_status, test_status, case_study_status,
     overall_progress, status, test_score, test_attempts)
  VALUES
    (r_liwei, rfp_051, prog_gdpr, '2026-04-08', '2026-04-25',
     'in_progress', 'not_started', 'not_started',
     10, 'overdue', NULL, 0)
  RETURNING id INTO a_liwei;

  -- Fatima Al-Rashid — ML Bias — ACTIVE
  INSERT INTO assignments
    (resource_id, rfp_id, program_id, assigned_date, deadline,
     content_status, test_status, case_study_status,
     overall_progress, status, test_score, test_attempts, case_study_score)
  VALUES
    (r_fatima, rfp_053, prog_ml, '2026-04-12', '2026-05-19',
     'complete', 'complete', 'in_progress',
     75, 'active', 84.0, 1, NULL)
  RETURNING id INTO a_fatima;

  -- Adaeze Nwosu — ML Bias — COMPLETE
  INSERT INTO assignments
    (resource_id, rfp_id, program_id, assigned_date, deadline,
     content_status, test_status, case_study_status,
     overall_progress, status, test_score, test_attempts, case_study_score)
  VALUES
    (r_adaeze, rfp_053, prog_ml, '2026-03-28', '2026-04-28',
     'complete', 'complete', 'complete',
     100, 'complete', 91.0, 1, 87.0)
  RETURNING id INTO a_adaeze;

  -- ─────────────────────────────────────────────────────────
  -- 5. HIL QUEUE (pending — these show up in HIL screen)
  -- ─────────────────────────────────────────────────────────

  -- Marcus Chen — NLP program awaiting approval
  INSERT INTO hil_queue (assignment_id, recommended_by, status, proposed_program)
  VALUES (
    a_marcus, 'system', 'pending',
    '{"program": "NLP Evaluation Certification", "modules": 3, "est_hours": 11, "deadline": "2026-05-03"}'
  );

  -- Yemi Adeyemi — ISO 27001 awaiting approval
  INSERT INTO hil_queue (assignment_id, recommended_by, status, proposed_program)
  VALUES (
    a_yemi, 'system', 'pending',
    '{"program": "ISO 27001 Security Framework", "modules": 3, "est_hours": 13, "deadline": "2026-04-28"}'
  );

  -- ─────────────────────────────────────────────────────────
  -- 6. ESCALATIONS (open — these show up in Escalations screen)
  -- ─────────────────────────────────────────────────────────

  -- Yemi Adeyemi — At Risk
  INSERT INTO escalations (assignment_id, reason, status, progress_snapshot)
  VALUES (
    a_yemi,
    'Progress at 28% with 5 days remaining. Threshold requires 70%.',
    'open',
    '{"content": 28, "test": 0, "case_study": 0, "overall": 28, "days_remaining": 5}'
  );

  -- Li Wei — Overdue
  INSERT INTO escalations (assignment_id, reason, status, progress_snapshot)
  VALUES (
    a_liwei,
    'Assignment overdue. Content module incomplete on deadline.',
    'open',
    '{"content": 10, "test": 0, "case_study": 0, "overall": 10, "days_remaining": -2}'
  );

  -- ─────────────────────────────────────────────────────────
  -- 7. CERTIFICATIONS (show up in Certs screen)
  -- ─────────────────────────────────────────────────────────

  -- Nandini Syamala — HIPAA certified (your name!)
  INSERT INTO certifications
    (assignment_id, resource_id, program_id, cert_name, verified_date,
     capability_updated, capability_update_ts, deployment_clearance, status)
  VALUES
    (a_nandini, r_nandini, prog_hipaa, 'HIPAA Certification',
     '2026-04-28', TRUE, NOW(), '2026-05-05', 'registered');

  -- Adaeze Nwosu — ML Fairness certified
  INSERT INTO certifications
    (assignment_id, resource_id, program_id, cert_name, verified_date,
     capability_updated, capability_update_ts, deployment_clearance, status)
  VALUES
    (a_adaeze, r_adaeze, prog_ml, 'ML Fairness Certificate',
     '2026-04-20', TRUE, NOW(), '2026-04-27', 'registered');

  -- ─────────────────────────────────────────────────────────
  -- 8. AUDIT LOGS (show up in Audit screen)
  -- ─────────────────────────────────────────────────────────

  INSERT INTO audit_logs (rfp_ref, resource_id, action_type, actor, level, message) VALUES
    ('RFP-2026-051', 'R-1077', 'overdue_detected',      'system',         'error',   'Assignment overdue: Li Wei — GDPR deadline missed'),
    ('RFP-2026-051', 'R-1077', 'escalation_raised',     'system',         'error',   'Escalation raised for Li Wei — GDPR overdue'),
    ('RFP-2026-044', 'R-1063', 'at_risk_detected',      'system',         'warning', 'At-risk alert: Yemi Adeyemi 28% with 5 days remaining'),
    ('RFP-2026-041', 'R-1042', 'cert_registered',       'system',         'info',    'HIPAA Certification registered — Nandini Syamala'),
    ('RFP-2026-047', 'R-1051', 'hil_pending',           'system',         'info',    'HIL review pending for Marcus Chen — NLP program'),
    ('RFP-2026-041', 'R-1042', 'assignment_completed',  'system',         'info',    'All components verified complete — Nandini Syamala'),
    ('RFP-2026-053', 'R-1088', 'assignment_created',    'system',         'info',    'Assignment created for Fatima Al-Rashid — ML Bias Detection'),
    ('RFP-2026-044', 'R-1063', 'hil_pending',           'system',         'info',    'HIL review pending — Yemi Adeyemi ISO 27001');

  -- ─────────────────────────────────────────────────────────
  -- 9. METRICS SNAPSHOT (Analytics screen KPIs)
  -- ─────────────────────────────────────────────────────────
  INSERT INTO metrics_snapshots
    (assignment_rate_pct, completion_rate_pct, assessment_pass_rate_pct,
     overdue_rate_pct, cert_compliance_rate_pct, hil_override_rate_pct,
     capability_update_rate_pct, avg_time_to_assignment_h)
  VALUES (94.0, 78.0, 71.0, 6.0, 89.0, 12.0, 100.0, 1.4)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE '✅ Seed complete — Nandini Syamala data loaded successfully!';

END $$;
