const BASE = '/api';

const token = () => localStorage.getItem('sf_token');

async function call(method, path, body, isForm = false) {
  const headers = {};
  if (token()) headers.Authorization = `Bearer ${token()}`;
  if (body && !isForm) headers['Content-Type'] = 'application/json';
  const r = await fetch(BASE + path, {
    method, headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && !path.startsWith('/auth/login')) {
    localStorage.removeItem('sf_token');
    localStorage.removeItem('sf_user');
    window.location.href = '/login';
    throw new Error('Session expired');
  }
  if (!r.ok) throw new Error(data.detail || `HTTP ${r.status}`);
  return data;
}

export const api = {
  login: (email, password) => call('POST', '/auth/login', { email, password }),
  me: () => call('GET', '/auth/me'),
  changePassword: (current_password, new_password) => call('POST', '/auth/change-password', { current_password, new_password }),

  dashboard: () => call('GET', '/employee/dashboard'),
  courses: () => call('GET', '/employee/courses'),
  course: (id) => call('GET', `/employee/courses/${id}`),
  moduleComplete: (id, module_index, done = true) => call('POST', `/employee/courses/${id}/module-complete`, { module_index, done }),
  quizSubmit: (id, answers) => call('POST', `/employee/courses/${id}/quiz`, { answers }),
  projectSubmit: (id, formData) => call('POST', `/employee/courses/${id}/project`, formData, true),
  saveNote: (id, module_index, text) => call('POST', `/employee/courses/${id}/notes`, { module_index, text }),
  bookmark: (id, module_index, on) => call('POST', `/employee/courses/${id}/bookmark`, { module_index, on }),
  activity: () => call('GET', '/employee/activity'),

  myCerts: () => call('GET', '/certs/mine'),
  verifyCert: (vid) => call('GET', `/certs/verify/${vid}`),

  notifications: () => call('GET', '/notifications'),
  readAll: () => call('POST', '/notifications/read-all'),
  announcements: () => call('GET', '/announcements'),
  postAnnouncement: (title, body) => call('POST', '/announcements', { title, body }),

  employees: () => call('GET', '/manage/employees'),
  submissions: () => call('GET', '/manage/submissions'),
  review: (submission_id, verdict, comment) => call('POST', '/manage/submissions/review', { submission_id, verdict, comment }),
  usersList: () => call('GET', '/manage/users'),
  resetPassword: (email) => call('POST', '/manage/users/reset-password', { email }),
  syncEmployees: () => call('POST', '/manage/sync-employees'),

  analytics: () => call('GET', '/analytics/overview'),
  leaderboard: () => call('GET', '/analytics/leaderboard'),
};
