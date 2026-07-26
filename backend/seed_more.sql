-- ============================================================
-- seed_more.sql — adds 3 tracker, 2 HIL, 3 escalations, 5 certs
-- Safe to re-run (ON CONFLICT / unique checks)
-- ============================================================
DO $$
DECLARE
  r_daniel  UUID; r_nina UUID; r_kwame UUID;
  r_priya   UUID; r_james UUID; r_chen UUID; r_sofia UUID; r_ravi UUID;
  r_marcus  UUID; r_fatima UUID; r_adaeze UUID; r_nandini UUID; r_yemi UUID; r_liwei UUID; r_amara UUID;

  rfp_058 UUID; rfp_062 UUID; rfp_065 UUID; rfp_068 UUID; rfp_071 UUID; rfp_074 UUID;
  rfp_041 UUID; rfp_044 UUID; rfp_047 UUID; rfp_051 UUID; rfp_053 UUID;
  rfp_080 UUID; rfp_083 UUID; rfp_086 UUID;

  prog_hipaa UUID; prog_iso UUID; prog_nlp UUID; prog_gdpr UUID; prog_ml UUID;
  prog_cyber UUID; prog_cloud UUID; prog_ai UUID; prog_agile UUID; prog_data UUID; prog_pmp UUID;
  prog_risk UUID; prog_devops UUID; prog_pm UUID;

  a_daniel UUID; a_nina UUID; a_kwame UUID;
  a_priya UUID; a_james UUID; a_chen2 UUID; a_sofia UUID; a_ravi UUID;
  a_marcus UUID; a_fatima UUID; a_adaeze UUID; a_amara UUID; a_yemi UUID;

BEGIN
  -- Re-fetch existing
  SELECT id INTO r_marcus  FROM resources WHERE resource_code='R-1051';
  SELECT id INTO r_yemi    FROM resources WHERE resource_code='R-1063';
  SELECT id INTO r_liwei   FROM resources WHERE resource_code='R-1077';
  SELECT id INTO r_fatima  FROM resources WHERE resource_code='R-1088';
  SELECT id INTO r_adaeze  FROM resources WHERE resource_code='R-1093';
  SELECT id INTO r_nandini FROM resources WHERE resource_code='R-1042';
  SELECT id INTO r_priya   FROM resources WHERE resource_code='R-1101';
  SELECT id INTO r_james   FROM resources WHERE resource_code='R-1104';
  SELECT id INTO r_chen    FROM resources WHERE resource_code='R-1108';
  SELECT id INTO r_amara   FROM resources WHERE resource_code='R-1112';
  SELECT id INTO r_ravi    FROM resources WHERE resource_code='R-1117';
  SELECT id INTO r_sofia   FROM resources WHERE resource_code='R-1121';

  SELECT id INTO rfp_041 FROM rfps WHERE rfp_reference='RFP-2026-041';
  SELECT id INTO rfp_044 FROM rfps WHERE rfp_reference='RFP-2026-044';
  SELECT id INTO rfp_047 FROM rfps WHERE rfp_reference='RFP-2026-047';
  SELECT id INTO rfp_051 FROM rfps WHERE rfp_reference='RFP-2026-051';
  SELECT id INTO rfp_053 FROM rfps WHERE rfp_reference='RFP-2026-053';
  SELECT id INTO rfp_058 FROM rfps WHERE rfp_reference='RFP-2026-058';
  SELECT id INTO rfp_062 FROM rfps WHERE rfp_reference='RFP-2026-062';
  SELECT id INTO rfp_065 FROM rfps WHERE rfp_reference='RFP-2026-065';
  SELECT id INTO rfp_068 FROM rfps WHERE rfp_reference='RFP-2026-068';
  SELECT id INTO rfp_071 FROM rfps WHERE rfp_reference='RFP-2026-071';
  SELECT id INTO rfp_074 FROM rfps WHERE rfp_reference='RFP-2026-074';

  SELECT id INTO prog_hipaa FROM training_programs WHERE program_name='HIPAA Compliance Certification';
  SELECT id INTO prog_iso   FROM training_programs WHERE program_name='ISO 27001 Security Framework';
  SELECT id INTO prog_nlp   FROM training_programs WHERE program_name='NLP Evaluation Certification';
  SELECT id INTO prog_gdpr  FROM training_programs WHERE program_name='GDPR Data Handling';
  SELECT id INTO prog_ml    FROM training_programs WHERE program_name='ML Bias Detection Certification';
  SELECT id INTO prog_cloud FROM training_programs WHERE program_name='Cloud Security Fundamentals';
  SELECT id INTO prog_cyber FROM training_programs WHERE program_name='Cybersecurity Professional';
  SELECT id INTO prog_ai    FROM training_programs WHERE program_name='AI Ethics & Safety';
  SELECT id INTO prog_agile FROM training_programs WHERE program_name='Agile Project Management';
  SELECT id INTO prog_data  FROM training_programs WHERE program_name='Data Governance Certification';
  SELECT id INTO prog_pmp   FROM training_programs WHERE program_name='PMP Exam Prep';

  -- Re-fetch existing assignment IDs
  SELECT id INTO a_marcus FROM assignments WHERE resource_id=r_marcus AND program_id=prog_nlp LIMIT 1;
  SELECT id INTO a_fatima FROM assignments WHERE resource_id=r_fatima AND program_id=prog_ml  LIMIT 1;
  SELECT id INTO a_adaeze FROM assignments WHERE resource_id=r_adaeze AND program_id=prog_ml  LIMIT 1;
  SELECT id INTO a_priya  FROM assignments WHERE resource_id=r_priya  AND program_id=prog_cloud LIMIT 1;
  SELECT id INTO a_james  FROM assignments WHERE resource_id=r_james  AND program_id=prog_cyber LIMIT 1;
  SELECT id INTO a_chen2  FROM assignments WHERE resource_id=r_chen   AND program_id=prog_ai   LIMIT 1;
  SELECT id INTO a_amara  FROM assignments WHERE resource_id=r_amara  AND program_id=prog_agile LIMIT 1;
  SELECT id INTO a_ravi   FROM assignments WHERE resource_id=r_ravi   AND program_id=prog_data LIMIT 1;
  SELECT id INTO a_sofia  FROM assignments WHERE resource_id=r_sofia  AND program_id=prog_pmp  LIMIT 1;
  SELECT id INTO a_yemi   FROM assignments WHERE resource_id=r_yemi   AND program_id=prog_iso  LIMIT 1;

  -- ─────────────────────────────────────────────────────────
  -- NEW RESOURCES + RFPs + PROGRAMS for tracker additions
  -- ─────────────────────────────────────────────────────────
  INSERT INTO resources (resource_code, full_name, role, department, email)
  VALUES ('R-1125', 'Daniel Osei', 'Compliance Officer', 'Compliance', 'daniel.osei@centific.com')
  ON CONFLICT (resource_code) DO NOTHING;
  SELECT id INTO r_daniel FROM resources WHERE resource_code='R-1125';

  INSERT INTO resources (resource_code, full_name, role, department, email)
  VALUES ('R-1129', 'Nina Kovač', 'Data Privacy Lead', 'Legal', 'nina.kovac@centific.com')
  ON CONFLICT (resource_code) DO NOTHING;
  SELECT id INTO r_nina FROM resources WHERE resource_code='R-1129';

  INSERT INTO resources (resource_code, full_name, role, department, email)
  VALUES ('R-1133', 'Kwame Asante', 'DevOps Engineer', 'Engineering', 'kwame.asante@centific.com')
  ON CONFLICT (resource_code) DO NOTHING;
  SELECT id INTO r_kwame FROM resources WHERE resource_code='R-1133';

  INSERT INTO rfps (rfp_reference, client_name, skill_required, proficiency_level, cert_authority, engagement_start, deployment_buffer)
  VALUES ('RFP-2026-080', 'RiskFirst Ltd', 'Risk Management', 'Advanced', 'IRM', '2026-06-05', 7)
  ON CONFLICT (rfp_reference) DO NOTHING;
  SELECT id INTO rfp_080 FROM rfps WHERE rfp_reference='RFP-2026-080';

  INSERT INTO rfps (rfp_reference, client_name, skill_required, proficiency_level, cert_authority, engagement_start, deployment_buffer)
  VALUES ('RFP-2026-083', 'PrivaCo', 'Data Privacy', 'Intermediate', 'IAPP', '2026-06-12', 7)
  ON CONFLICT (rfp_reference) DO NOTHING;
  SELECT id INTO rfp_083 FROM rfps WHERE rfp_reference='RFP-2026-083';

  INSERT INTO rfps (rfp_reference, client_name, skill_required, proficiency_level, cert_authority, engagement_start, deployment_buffer)
  VALUES ('RFP-2026-086', 'DevStream Inc', 'DevOps Practices', 'Advanced', 'LF', '2026-06-20', 7)
  ON CONFLICT (rfp_reference) DO NOTHING;
  SELECT id INTO rfp_086 FROM rfps WHERE rfp_reference='RFP-2026-086';

  INSERT INTO training_programs (program_name, cert_name, skill_category, content_modules, total_duration_h)
  VALUES ('Risk Management Fundamentals', 'IRM Certificate', 'Risk',
    '[{"title":"Risk Frameworks","duration_h":4},{"title":"Assessment Methods","duration_h":4},{"title":"Mitigation","duration_h":3}]', 11)
  ON CONFLICT DO NOTHING;
  SELECT id INTO prog_risk FROM training_programs WHERE program_name='Risk Management Fundamentals';

  INSERT INTO training_programs (program_name, cert_name, skill_category, content_modules, total_duration_h)
  VALUES ('Data Privacy Practitioner', 'CIPP/E Certificate', 'Data Privacy',
    '[{"title":"Privacy Laws","duration_h":4},{"title":"Cross-Border Transfers","duration_h":3},{"title":"DPO Role","duration_h":3}]', 10)
  ON CONFLICT DO NOTHING;
  SELECT id INTO prog_pm FROM training_programs WHERE program_name='Data Privacy Practitioner';

  INSERT INTO training_programs (program_name, cert_name, skill_category, content_modules, total_duration_h)
  VALUES ('DevOps Foundations', 'LF DevOps Certificate', 'Engineering',
    '[{"title":"CI/CD Pipelines","duration_h":4},{"title":"Containerisation","duration_h":4},{"title":"Monitoring","duration_h":3}]', 11)
  ON CONFLICT DO NOTHING;
  SELECT id INTO prog_devops FROM training_programs WHERE program_name='DevOps Foundations';

  -- ─────────────────────────────────────────────────────────
  -- 3 NEW TRACKER ASSIGNMENTS
  -- ─────────────────────────────────────────────────────────
  INSERT INTO assignments
    (resource_id, rfp_id, program_id, assigned_date, deadline,
     content_status, test_status, case_study_status, overall_progress, status, test_score, test_attempts)
  VALUES (r_daniel, rfp_080, prog_risk, '2026-04-28', '2026-05-30',
    'in_progress', 'not_started', 'not_started', 35, 'active', NULL, 0)
  RETURNING id INTO a_daniel;

  INSERT INTO assignments
    (resource_id, rfp_id, program_id, assigned_date, deadline,
     content_status, test_status, case_study_status, overall_progress, status, test_score, test_attempts)
  VALUES (r_nina, rfp_083, prog_pm, '2026-04-25', '2026-05-28',
    'complete', 'in_progress', 'not_started', 62, 'active', NULL, 0)
  RETURNING id INTO a_nina;

  INSERT INTO assignments
    (resource_id, rfp_id, program_id, assigned_date, deadline,
     content_status, test_status, case_study_status, overall_progress, status, test_score, test_attempts)
  VALUES (r_kwame, rfp_086, prog_devops, '2026-04-10', '2026-04-30',
    'in_progress', 'not_started', 'not_started', 20, 'at_risk', NULL, 0)
  RETURNING id INTO a_kwame;

  -- ─────────────────────────────────────────────────────────
  -- 2 MORE HIL QUEUE ENTRIES
  -- ─────────────────────────────────────────────────────────
  INSERT INTO hil_queue (assignment_id, recommended_by, status, proposed_program)
  VALUES (a_nina, 'system', 'pending',
    '{"program": "Data Privacy Practitioner", "modules": 3, "est_hours": 10, "deadline": "2026-05-28"}')
  ON CONFLICT DO NOTHING;

  INSERT INTO hil_queue (assignment_id, recommended_by, status, proposed_program)
  VALUES (a_kwame, 'system', 'pending',
    '{"program": "DevOps Foundations", "modules": 3, "est_hours": 11, "deadline": "2026-04-30"}')
  ON CONFLICT DO NOTHING;

  -- ─────────────────────────────────────────────────────────
  -- 3 MORE ESCALATIONS
  -- ─────────────────────────────────────────────────────────
  INSERT INTO escalations (assignment_id, reason, status, progress_snapshot)
  VALUES (a_kwame,
    'Only 20% complete with 1 day remaining. Immediate intervention required.',
    'open',
    '{"content": 20, "test": 0, "case_study": 0, "overall": 20, "days_remaining": 1}')
  ON CONFLICT DO NOTHING;

  INSERT INTO escalations (assignment_id, reason, status, progress_snapshot)
  VALUES (a_nina,
    'Test module stalled, 62% overall with 29 days left.',
    'open',
    '{"content": 100, "test": 25, "case_study": 0, "overall": 62, "days_remaining": 29}')
  ON CONFLICT DO NOTHING;

  INSERT INTO escalations (assignment_id, reason, status, progress_snapshot)
  VALUES (a_daniel,
    'Replaced resource after capability mismatch identified.',
    'resolved_replace',
    '{"content": 35, "test": 0, "case_study": 0, "overall": 35, "days_remaining": 31}')
  ON CONFLICT DO NOTHING;

  -- ─────────────────────────────────────────────────────────
  -- 5 MORE CERTIFICATIONS
  -- ─────────────────────────────────────────────────────────
  -- Amara Diallo — Agile (verified)
  INSERT INTO certifications
    (assignment_id, resource_id, program_id, cert_name, verified_date, capability_updated, deployment_clearance, status)
  VALUES (a_amara, r_amara, prog_agile, 'PMI-ACP Certificate', '2026-04-30', FALSE, NULL, 'verified')
  ON CONFLICT DO NOTHING;

  -- Chen Wei — AI Ethics (pending)
  INSERT INTO certifications
    (assignment_id, resource_id, program_id, cert_name, verified_date, capability_updated, deployment_clearance, status)
  VALUES (a_chen2, r_chen, prog_ai, 'AI Safety Certificate', NULL, FALSE, NULL, 'pending')
  ON CONFLICT DO NOTHING;

  -- Daniel Osei — Risk Management (pending)
  INSERT INTO certifications
    (assignment_id, resource_id, program_id, cert_name, verified_date, capability_updated, deployment_clearance, status)
  VALUES (a_daniel, r_daniel, prog_risk, 'IRM Certificate', NULL, FALSE, NULL, 'pending')
  ON CONFLICT DO NOTHING;

  -- Nina Kovač — Data Privacy (verified)
  INSERT INTO certifications
    (assignment_id, resource_id, program_id, cert_name, verified_date, capability_updated, deployment_clearance, status)
  VALUES (a_nina, r_nina, prog_pm, 'CIPP/E Certificate', '2026-04-29', FALSE, NULL, 'verified')
  ON CONFLICT DO NOTHING;

  -- Kwame Asante — DevOps (pending)
  INSERT INTO certifications
    (assignment_id, resource_id, program_id, cert_name, verified_date, capability_updated, deployment_clearance, status)
  VALUES (a_kwame, r_kwame, prog_devops, 'LF DevOps Certificate', NULL, FALSE, NULL, 'pending')
  ON CONFLICT DO NOTHING;

  -- Audit logs for new entries
  INSERT INTO audit_logs (rfp_ref, resource_id, action_type, actor, level, message) VALUES
    ('RFP-2026-086', 'R-1133', 'at_risk_detected',  'system', 'warning', 'At-risk alert: Kwame Asante — 20% with 1 day remaining'),
    ('RFP-2026-083', 'R-1129', 'hil_pending',        'system', 'info',    'HIL review pending — Nina Kovač, Data Privacy'),
    ('RFP-2026-086', 'R-1133', 'hil_pending',        'system', 'info',    'HIL review pending — Kwame Asante, DevOps'),
    ('RFP-2026-080', 'R-1125', 'escalation_resolved','talent_lead_01', 'action', 'Escalation resolved (replace): Daniel Osei');

  RAISE NOTICE '✅ seed_more complete';
END $$;
