-- ============================================================
-- Extra seed data — adds ~8 records each to HIL, Escalations, Certs
-- Safe to re-run (ON CONFLICT DO NOTHING)
-- ============================================================

DO $$
DECLARE
  -- New resource UUIDs
  r_priya    UUID;
  r_james    UUID;
  r_chen     UUID;
  r_amara    UUID;
  r_ravi     UUID;
  r_sofia    UUID;

  -- Re-fetch existing resources
  r_marcus   UUID;
  r_yemi     UUID;
  r_liwei    UUID;
  r_fatima   UUID;
  r_adaeze   UUID;
  r_nandini  UUID;

  -- RFP UUIDs
  rfp_058  UUID;
  rfp_062  UUID;
  rfp_065  UUID;
  rfp_068  UUID;
  rfp_071  UUID;
  rfp_074  UUID;

  -- Re-fetch existing RFPs
  rfp_041  UUID;
  rfp_044  UUID;
  rfp_047  UUID;
  rfp_051  UUID;
  rfp_053  UUID;

  -- Program UUIDs (re-fetch existing)
  prog_hipaa UUID;
  prog_iso   UUID;
  prog_nlp   UUID;
  prog_gdpr  UUID;
  prog_ml    UUID;

  -- New program UUIDs
  prog_cyber  UUID;
  prog_cloud  UUID;
  prog_ai     UUID;
  prog_agile  UUID;
  prog_data   UUID;
  prog_pmp    UUID;

  -- Assignment UUIDs
  a_priya   UUID;
  a_james   UUID;
  a_chen2   UUID;
  a_amara   UUID;
  a_ravi    UUID;
  a_sofia   UUID;
  a_fatima2 UUID;
  a_yemi2   UUID;

BEGIN

  -- ─────────────────────────────────────────────────────────
  -- Re-fetch existing resource IDs
  -- ─────────────────────────────────────────────────────────
  SELECT id INTO r_marcus  FROM resources WHERE resource_code = 'R-1051';
  SELECT id INTO r_yemi    FROM resources WHERE resource_code = 'R-1063';
  SELECT id INTO r_liwei   FROM resources WHERE resource_code = 'R-1077';
  SELECT id INTO r_fatima  FROM resources WHERE resource_code = 'R-1088';
  SELECT id INTO r_adaeze  FROM resources WHERE resource_code = 'R-1093';
  SELECT id INTO r_nandini FROM resources WHERE resource_code = 'R-1042';

  -- Re-fetch existing RFP IDs
  SELECT id INTO rfp_041 FROM rfps WHERE rfp_reference = 'RFP-2026-041';
  SELECT id INTO rfp_044 FROM rfps WHERE rfp_reference = 'RFP-2026-044';
  SELECT id INTO rfp_047 FROM rfps WHERE rfp_reference = 'RFP-2026-047';
  SELECT id INTO rfp_051 FROM rfps WHERE rfp_reference = 'RFP-2026-051';
  SELECT id INTO rfp_053 FROM rfps WHERE rfp_reference = 'RFP-2026-053';

  -- Re-fetch existing program IDs
  SELECT id INTO prog_hipaa FROM training_programs WHERE program_name = 'HIPAA Compliance Certification';
  SELECT id INTO prog_iso   FROM training_programs WHERE program_name = 'ISO 27001 Security Framework';
  SELECT id INTO prog_nlp   FROM training_programs WHERE program_name = 'NLP Evaluation Certification';
  SELECT id INTO prog_gdpr  FROM training_programs WHERE program_name = 'GDPR Data Handling';
  SELECT id INTO prog_ml    FROM training_programs WHERE program_name = 'ML Bias Detection Certification';

  -- ─────────────────────────────────────────────────────────
  -- 1. NEW RESOURCES
  -- ─────────────────────────────────────────────────────────
  INSERT INTO resources (resource_code, full_name, role, department, email)
  VALUES ('R-1101', 'Priya Sharma', 'Data Scientist', 'Technology', 'priya.sharma@centific.com')
  ON CONFLICT (resource_code) DO NOTHING;
  SELECT id INTO r_priya FROM resources WHERE resource_code = 'R-1101';

  INSERT INTO resources (resource_code, full_name, role, department, email)
  VALUES ('R-1104', 'James Okonkwo', 'Cloud Architect', 'Engineering', 'james.okonkwo@centific.com')
  ON CONFLICT (resource_code) DO NOTHING;
  SELECT id INTO r_james FROM resources WHERE resource_code = 'R-1104';

  INSERT INTO resources (resource_code, full_name, role, department, email)
  VALUES ('R-1108', 'Chen Wei', 'Cybersecurity Lead', 'Security', 'chen.wei@centific.com')
  ON CONFLICT (resource_code) DO NOTHING;
  SELECT id INTO r_chen FROM resources WHERE resource_code = 'R-1108';

  INSERT INTO resources (resource_code, full_name, role, department, email)
  VALUES ('R-1112', 'Amara Diallo', 'Product Manager', 'Operations', 'amara.diallo@centific.com')
  ON CONFLICT (resource_code) DO NOTHING;
  SELECT id INTO r_amara FROM resources WHERE resource_code = 'R-1112';

  INSERT INTO resources (resource_code, full_name, role, department, email)
  VALUES ('R-1117', 'Ravi Patel', 'AI Engineer', 'Technology', 'ravi.patel@centific.com')
  ON CONFLICT (resource_code) DO NOTHING;
  SELECT id INTO r_ravi FROM resources WHERE resource_code = 'R-1117';

  INSERT INTO resources (resource_code, full_name, role, department, email)
  VALUES ('R-1121', 'Sofia Martinez', 'Data Analyst', 'Analytics', 'sofia.martinez@centific.com')
  ON CONFLICT (resource_code) DO NOTHING;
  SELECT id INTO r_sofia FROM resources WHERE resource_code = 'R-1121';

  -- ─────────────────────────────────────────────────────────
  -- 2. NEW RFPs
  -- ─────────────────────────────────────────────────────────
  INSERT INTO rfps (rfp_reference, client_name, skill_required, proficiency_level, cert_authority, engagement_start, deployment_buffer)
  VALUES ('RFP-2026-058', 'CloudFirst Ltd', 'Cloud Security', 'Advanced', 'AWS', '2026-05-20', 7)
  ON CONFLICT (rfp_reference) DO NOTHING;
  SELECT id INTO rfp_058 FROM rfps WHERE rfp_reference = 'RFP-2026-058';

  INSERT INTO rfps (rfp_reference, client_name, skill_required, proficiency_level, cert_authority, engagement_start, deployment_buffer)
  VALUES ('RFP-2026-062', 'CyberShield AG', 'Cybersecurity', 'Advanced', 'ISC2', '2026-05-15', 7)
  ON CONFLICT (rfp_reference) DO NOTHING;
  SELECT id INTO rfp_062 FROM rfps WHERE rfp_reference = 'RFP-2026-062';

  INSERT INTO rfps (rfp_reference, client_name, skill_required, proficiency_level, cert_authority, engagement_start, deployment_buffer)
  VALUES ('RFP-2026-065', 'AgileWorks Co', 'Agile Project Mgmt', 'Intermediate', 'PMI', '2026-06-01', 7)
  ON CONFLICT (rfp_reference) DO NOTHING;
  SELECT id INTO rfp_065 FROM rfps WHERE rfp_reference = 'RFP-2026-065';

  INSERT INTO rfps (rfp_reference, client_name, skill_required, proficiency_level, cert_authority, engagement_start, deployment_buffer)
  VALUES ('RFP-2026-068', 'DataVault Inc', 'Data Governance', 'Intermediate', 'DAMA', '2026-05-28', 7)
  ON CONFLICT (rfp_reference) DO NOTHING;
  SELECT id INTO rfp_068 FROM rfps WHERE rfp_reference = 'RFP-2026-068';

  INSERT INTO rfps (rfp_reference, client_name, skill_required, proficiency_level, cert_authority, engagement_start, deployment_buffer)
  VALUES ('RFP-2026-071', 'AIVentures', 'AI Ethics & Safety', 'Advanced', 'IEEE', '2026-06-10', 7)
  ON CONFLICT (rfp_reference) DO NOTHING;
  SELECT id INTO rfp_071 FROM rfps WHERE rfp_reference = 'RFP-2026-071';

  INSERT INTO rfps (rfp_reference, client_name, skill_required, proficiency_level, cert_authority, engagement_start, deployment_buffer)
  VALUES ('RFP-2026-074', 'ProjectCo', 'PMP Certification', 'Advanced', 'PMI', '2026-06-15', 7)
  ON CONFLICT (rfp_reference) DO NOTHING;
  SELECT id INTO rfp_074 FROM rfps WHERE rfp_reference = 'RFP-2026-074';

  -- ─────────────────────────────────────────────────────────
  -- 3. NEW TRAINING PROGRAMS
  -- ─────────────────────────────────────────────────────────
  INSERT INTO training_programs (program_name, cert_name, skill_category, content_modules, total_duration_h)
  VALUES ('Cloud Security Fundamentals', 'AWS Cloud Practitioner', 'Cloud',
    '[{"title":"Cloud Basics","duration_h":4},{"title":"Security Controls","duration_h":4},{"title":"Compliance","duration_h":3}]', 11)
  ON CONFLICT DO NOTHING;
  SELECT id INTO prog_cloud FROM training_programs WHERE program_name = 'Cloud Security Fundamentals';

  INSERT INTO training_programs (program_name, cert_name, skill_category, content_modules, total_duration_h)
  VALUES ('Cybersecurity Professional', 'CISSP Associate', 'Security',
    '[{"title":"Threat Modeling","duration_h":5},{"title":"Incident Response","duration_h":4},{"title":"Forensics","duration_h":4}]', 13)
  ON CONFLICT DO NOTHING;
  SELECT id INTO prog_cyber FROM training_programs WHERE program_name = 'Cybersecurity Professional';

  INSERT INTO training_programs (program_name, cert_name, skill_category, content_modules, total_duration_h)
  VALUES ('AI Ethics & Safety', 'AI Safety Certificate', 'AI',
    '[{"title":"AI Principles","duration_h":3},{"title":"Bias & Fairness","duration_h":4},{"title":"Safety Frameworks","duration_h":4}]', 11)
  ON CONFLICT DO NOTHING;
  SELECT id INTO prog_ai FROM training_programs WHERE program_name = 'AI Ethics & Safety';

  INSERT INTO training_programs (program_name, cert_name, skill_category, content_modules, total_duration_h)
  VALUES ('Agile Project Management', 'PMI-ACP Certificate', 'Project Management',
    '[{"title":"Agile Fundamentals","duration_h":3},{"title":"Scrum & Kanban","duration_h":3},{"title":"Agile Leadership","duration_h":3}]', 9)
  ON CONFLICT DO NOTHING;
  SELECT id INTO prog_agile FROM training_programs WHERE program_name = 'Agile Project Management';

  INSERT INTO training_programs (program_name, cert_name, skill_category, content_modules, total_duration_h)
  VALUES ('Data Governance Certification', 'CDMP Associate', 'Data Governance',
    '[{"title":"Data Strategy","duration_h":3},{"title":"Data Quality","duration_h":3},{"title":"Stewardship","duration_h":3}]', 9)
  ON CONFLICT DO NOTHING;
  SELECT id INTO prog_data FROM training_programs WHERE program_name = 'Data Governance Certification';

  INSERT INTO training_programs (program_name, cert_name, skill_category, content_modules, total_duration_h)
  VALUES ('PMP Exam Prep', 'PMP Certification', 'Project Management',
    '[{"title":"Project Initiation","duration_h":4},{"title":"Planning","duration_h":5},{"title":"Execution & Close","duration_h":5}]', 14)
  ON CONFLICT DO NOTHING;
  SELECT id INTO prog_pmp FROM training_programs WHERE program_name = 'PMP Exam Prep';

  -- ─────────────────────────────────────────────────────────
  -- 4. NEW ASSIGNMENTS
  -- ─────────────────────────────────────────────────────────

  -- Priya Sharma — Cloud Security — AT RISK
  INSERT INTO assignments
    (resource_id, rfp_id, program_id, assigned_date, deadline,
     content_status, test_status, case_study_status,
     overall_progress, status, test_score, test_attempts)
  VALUES
    (r_priya, rfp_058, prog_cloud, '2026-04-14', '2026-05-10',
     'in_progress', 'not_started', 'not_started',
     22, 'at_risk', NULL, 0)
  RETURNING id INTO a_priya;

  -- James Okonkwo — Cybersecurity — OVERDUE
  INSERT INTO assignments
    (resource_id, rfp_id, program_id, assigned_date, deadline,
     content_status, test_status, case_study_status,
     overall_progress, status, test_score, test_attempts)
  VALUES
    (r_james, rfp_062, prog_cyber, '2026-04-02', '2026-04-22',
     'complete', 'in_progress', 'not_started',
     45, 'overdue', NULL, 1)
  RETURNING id INTO a_james;

  -- Chen Wei — AI Ethics — AT RISK
  INSERT INTO assignments
    (resource_id, rfp_id, program_id, assigned_date, deadline,
     content_status, test_status, case_study_status,
     overall_progress, status, test_score, test_attempts)
  VALUES
    (r_chen, rfp_071, prog_ai, '2026-04-18', '2026-05-15',
     'in_progress', 'not_started', 'not_started',
     18, 'at_risk', NULL, 0)
  RETURNING id INTO a_chen2;

  -- Amara Diallo — Agile — ACTIVE (HIL pending)
  INSERT INTO assignments
    (resource_id, rfp_id, program_id, assigned_date, deadline,
     content_status, test_status, case_study_status,
     overall_progress, status, test_score, test_attempts)
  VALUES
    (r_amara, rfp_065, prog_agile, '2026-04-20', '2026-05-25',
     'complete', 'in_progress', 'not_started',
     50, 'active', NULL, 0)
  RETURNING id INTO a_amara;

  -- Ravi Patel — Data Governance — ACTIVE (HIL pending)
  INSERT INTO assignments
    (resource_id, rfp_id, program_id, assigned_date, deadline,
     content_status, test_status, case_study_status,
     overall_progress, status, test_score, test_attempts)
  VALUES
    (r_ravi, rfp_068, prog_data, '2026-04-22', '2026-05-28',
     'in_progress', 'not_started', 'not_started',
     30, 'active', NULL, 0)
  RETURNING id INTO a_ravi;

  -- Sofia Martinez — PMP — OVERDUE (escalation)
  INSERT INTO assignments
    (resource_id, rfp_id, program_id, assigned_date, deadline,
     content_status, test_status, case_study_status,
     overall_progress, status, test_score, test_attempts)
  VALUES
    (r_sofia, rfp_074, prog_pmp, '2026-04-05', '2026-04-26',
     'in_progress', 'not_started', 'not_started',
     15, 'overdue', NULL, 0)
  RETURNING id INTO a_sofia;

  -- Fatima — second assignment for GDPR HIL
  INSERT INTO assignments
    (resource_id, rfp_id, program_id, assigned_date, deadline,
     content_status, test_status, case_study_status,
     overall_progress, status, test_score, test_attempts)
  VALUES
    (r_fatima, rfp_051, prog_gdpr, '2026-04-25', '2026-05-20',
     'complete', 'in_progress', 'not_started',
     60, 'active', NULL, 0)
  RETURNING id INTO a_fatima2;

  -- Yemi second assignment for Cyber HIL
  INSERT INTO assignments
    (resource_id, rfp_id, program_id, assigned_date, deadline,
     content_status, test_status, case_study_status,
     overall_progress, status, test_score, test_attempts)
  VALUES
    (r_yemi, rfp_062, prog_cyber, '2026-04-28', '2026-05-28',
     'complete', 'in_progress', 'not_started',
     58, 'active', NULL, 0)
  RETURNING id INTO a_yemi2;

  -- ─────────────────────────────────────────────────────────
  -- 5. ADDITIONAL HIL QUEUE ENTRIES (~8 total)
  -- ─────────────────────────────────────────────────────────
  INSERT INTO hil_queue (assignment_id, recommended_by, status, proposed_program)
  VALUES (
    a_priya, 'system', 'pending',
    '{"program": "Cloud Security Fundamentals", "modules": 3, "est_hours": 11, "deadline": "2026-05-10"}'
  ) ON CONFLICT DO NOTHING;

  INSERT INTO hil_queue (assignment_id, recommended_by, status, proposed_program)
  VALUES (
    a_amara, 'system', 'pending',
    '{"program": "Agile Project Management", "modules": 3, "est_hours": 9, "deadline": "2026-05-25"}'
  ) ON CONFLICT DO NOTHING;

  INSERT INTO hil_queue (assignment_id, recommended_by, status, proposed_program)
  VALUES (
    a_ravi, 'system', 'pending',
    '{"program": "Data Governance Certification", "modules": 3, "est_hours": 9, "deadline": "2026-05-28"}'
  ) ON CONFLICT DO NOTHING;

  INSERT INTO hil_queue (assignment_id, recommended_by, status, proposed_program)
  VALUES (
    a_fatima2, 'system', 'pending',
    '{"program": "GDPR Data Handling", "modules": 3, "est_hours": 9, "deadline": "2026-05-20"}'
  ) ON CONFLICT DO NOTHING;

  INSERT INTO hil_queue (assignment_id, recommended_by, status, proposed_program)
  VALUES (
    a_yemi2, 'system', 'approved',
    '{"program": "Cybersecurity Professional", "modules": 3, "est_hours": 13, "deadline": "2026-05-28"}'
  ) ON CONFLICT DO NOTHING;

  INSERT INTO hil_queue (assignment_id, recommended_by, status, proposed_program)
  VALUES (
    a_chen2, 'system', 'pending',
    '{"program": "AI Ethics & Safety", "modules": 3, "est_hours": 11, "deadline": "2026-05-15"}'
  ) ON CONFLICT DO NOTHING;

  -- ─────────────────────────────────────────────────────────
  -- 6. ADDITIONAL ESCALATIONS (~8 total)
  -- ─────────────────────────────────────────────────────────
  INSERT INTO escalations (assignment_id, reason, status, progress_snapshot)
  VALUES (
    a_priya,
    'Progress at 22% with 10 days remaining. Threshold requires 60%.',
    'open',
    '{"content": 22, "test": 0, "case_study": 0, "overall": 22, "days_remaining": 10}'
  ) ON CONFLICT DO NOTHING;

  INSERT INTO escalations (assignment_id, reason, status, progress_snapshot)
  VALUES (
    a_james,
    'Assignment overdue. Test incomplete, case study not started.',
    'open',
    '{"content": 100, "test": 45, "case_study": 0, "overall": 45, "days_remaining": -6}'
  ) ON CONFLICT DO NOTHING;

  INSERT INTO escalations (assignment_id, reason, status, progress_snapshot)
  VALUES (
    a_chen2,
    'Progress at 18% with 16 days remaining. High risk of missing deadline.',
    'open',
    '{"content": 18, "test": 0, "case_study": 0, "overall": 18, "days_remaining": 16}'
  ) ON CONFLICT DO NOTHING;

  INSERT INTO escalations (assignment_id, reason, status, progress_snapshot)
  VALUES (
    a_sofia,
    'Assignment overdue. Only 15% complete as of deadline.',
    'open',
    '{"content": 15, "test": 0, "case_study": 0, "overall": 15, "days_remaining": -3}'
  ) ON CONFLICT DO NOTHING;

  INSERT INTO escalations (assignment_id, reason, status, progress_snapshot)
  VALUES (
    a_ravi,
    'Deadline extended after manager review.',
    'resolved_extend',
    '{"content": 30, "test": 0, "case_study": 0, "overall": 30, "days_remaining": 29}'
  ) ON CONFLICT DO NOTHING;

  INSERT INTO escalations (assignment_id, reason, status, progress_snapshot)
  VALUES (
    a_amara,
    'Risk accepted — resource attending external course in parallel.',
    'resolved_accept_risk',
    '{"content": 100, "test": 50, "case_study": 0, "overall": 50, "days_remaining": 26}'
  ) ON CONFLICT DO NOTHING;

  -- ─────────────────────────────────────────────────────────
  -- 7. ADDITIONAL CERTIFICATIONS (~8 total)
  -- ─────────────────────────────────────────────────────────

  -- Marcus Chen — NLP (verified, pending capability register)
  INSERT INTO certifications
    (assignment_id, resource_id, program_id, cert_name, verified_date,
     capability_updated, deployment_clearance, status)
  SELECT a.id, r_marcus, prog_nlp, 'NLP Eval Certificate', '2026-04-25', FALSE, NULL, 'verified'
  FROM assignments a WHERE a.resource_id = r_marcus AND a.program_id = prog_nlp
  LIMIT 1
  ON CONFLICT DO NOTHING;

  -- Fatima Al-Rashid — ML Fairness (registered)
  INSERT INTO certifications
    (assignment_id, resource_id, program_id, cert_name, verified_date,
     capability_updated, capability_update_ts, deployment_clearance, status)
  SELECT a.id, r_fatima, prog_ml, 'ML Fairness Certificate', '2026-04-22', TRUE, NOW(), '2026-04-29', 'registered'
  FROM assignments a WHERE a.resource_id = r_fatima AND a.program_id = prog_ml
  LIMIT 1
  ON CONFLICT DO NOTHING;

  -- James Okonkwo — Cybersecurity (verified)
  INSERT INTO certifications
    (assignment_id, resource_id, program_id, cert_name, verified_date,
     capability_updated, deployment_clearance, status)
  VALUES
    (a_james, r_james, prog_cyber, 'CISSP Associate',
     '2026-04-28', FALSE, NULL, 'verified')
  ON CONFLICT DO NOTHING;

  -- Priya Sharma — Cloud (pending)
  INSERT INTO certifications
    (assignment_id, resource_id, program_id, cert_name, verified_date,
     capability_updated, deployment_clearance, status)
  VALUES
    (a_priya, r_priya, prog_cloud, 'AWS Cloud Practitioner',
     NULL, FALSE, NULL, 'pending')
  ON CONFLICT DO NOTHING;

  -- Ravi Patel — Data Governance (pending)
  INSERT INTO certifications
    (assignment_id, resource_id, program_id, cert_name, verified_date,
     capability_updated, deployment_clearance, status)
  VALUES
    (a_ravi, r_ravi, prog_data, 'CDMP Associate',
     NULL, FALSE, NULL, 'pending')
  ON CONFLICT DO NOTHING;

  -- Sofia Martinez — PMP (pending)
  INSERT INTO certifications
    (assignment_id, resource_id, program_id, cert_name, verified_date,
     capability_updated, deployment_clearance, status)
  VALUES
    (a_sofia, r_sofia, prog_pmp, 'PMP Certification',
     NULL, FALSE, NULL, 'pending')
  ON CONFLICT DO NOTHING;

  -- Additional audit logs for new records
  INSERT INTO audit_logs (rfp_ref, resource_id, action_type, actor, level, message) VALUES
    ('RFP-2026-058', 'R-1101', 'at_risk_detected',   'system', 'warning', 'At-risk alert: Priya Sharma 22% with 10 days remaining'),
    ('RFP-2026-062', 'R-1104', 'overdue_detected',   'system', 'error',   'Assignment overdue: James Okonkwo — Cybersecurity deadline missed'),
    ('RFP-2026-062', 'R-1104', 'escalation_raised',  'system', 'error',   'Escalation raised for James Okonkwo — overdue'),
    ('RFP-2026-071', 'R-1108', 'at_risk_detected',   'system', 'warning', 'At-risk alert: Chen Wei 18% with 16 days remaining'),
    ('RFP-2026-065', 'R-1112', 'hil_pending',        'system', 'info',    'HIL review pending — Amara Diallo, Agile PM program'),
    ('RFP-2026-068', 'R-1117', 'hil_pending',        'system', 'info',    'HIL review pending — Ravi Patel, Data Governance'),
    ('RFP-2026-074', 'R-1121', 'overdue_detected',   'system', 'error',   'Assignment overdue: Sofia Martinez — PMP deadline missed'),
    ('RFP-2026-058', 'R-1101', 'cert_pending',       'system', 'info',    'Certification pending: Priya Sharma — AWS Cloud Practitioner');

  RAISE NOTICE '✅ Extra seed complete — 6 new HIL, 6 escalations, 6 certifications added';

END $$;
