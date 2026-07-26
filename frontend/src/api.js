const BASE = '/api';

const get = (path) =>
  fetch(BASE + path).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

const post = (path, body) =>
  fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

const patch = (path, body) =>
  fetch(BASE + path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

const upload = (path, formData) =>
  fetch(BASE + path, { method: 'POST', body: formData }).then(async (r) => {
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.detail || `HTTP ${r.status}`);
    return data;
  });

export const api = {
  health: () => get('/health'),

  uploadGapDocument: (file, { rfpReference, uploadedBy } = {}) => {
    const fd = new FormData();
    fd.append('file', file);
    if (rfpReference) fd.append('rfp_reference', rfpReference);
    fd.append('uploaded_by', uploadedBy || 'talent_lead_01');
    return upload('/intake/upload', fd);
  },

  assignments: (status) =>
    get('/assignments' + (status && status !== 'all' ? `?status=${status}` : '')),
  updateAssignment: (id, body) => patch(`/assignments/${id}`, body),

  hil: (status) =>
    get('/hil-queue' + (status ? `?status=${status}` : '')),
  hilAction: (id, body) => post(`/hil-queue/${id}/action`, body),

  escalations: () => get('/escalations'),
  resolveEscalation: (id, body) => post(`/escalations/${id}/action`, body),

  certifications: () => get('/certifications'),

  auditLogs: (level, page = 1) => {
    const p = new URLSearchParams({ page, page_size: 100 });
    if (level) p.set('level', level);
    return get(`/audit-logs?${p}`);
  },
  createLog: (body) => post('/audit-logs', body),

  metrics: () => get('/analytics/metrics'),
  statusBreakdown: () => get('/analytics/status-breakdown'),
  rfpProgress: () => get('/analytics/rfp-progress'),

  // ── Program Studio (Training Coordinator) ──
  catalogue: () => get('/programs/catalogue'),
  drafts: () => get('/programs/drafts'),
  createDraft: (body) => post('/programs/drafts', body),
  updateDraft: (hilId, body) => patch(`/programs/drafts/${hilId}`, body),
  submitDraft: (hilId) => post(`/programs/drafts/${hilId}/submit?submitted_by=coordinator_01`, {}),

  // ── Avathar (voice) ──
  avatharCommand: (transcript, history = []) => post('/avathar/command', { transcript, history }),
  avatharExecute: (action) => post('/avathar/execute', action),
  meetings: () => get('/meetings'),
  startMeeting: (meet_url) => post('/meetings/start', { meet_url }),
  presentState: () => get('/meetings/present-state'),

  // ── Learning platform (Resource) ──
  learners: () => get('/learning/resources'),
  myCourses: (resourceId) => get(`/learning/${resourceId}/courses`),
  moduleComplete: (assignmentId, moduleIndex, done = true) =>
    post(`/learning/assignments/${assignmentId}/module-complete`, { module_index: moduleIndex, done }),
  testSubmit: (assignmentId, answers) =>
    post(`/learning/assignments/${assignmentId}/test-submit`, { answers }),
  caseSubmit: (assignmentId, submissionText) =>
    post(`/learning/assignments/${assignmentId}/case-submit`, { submission_text: submissionText }),
};
