import React, { useEffect, useState } from 'react';
import { api } from '../../api';

/*
 * My Learning — the Resource-facing platform.
 *
 * Coursera-style: pick who you are (no login), see your approved courses as
 * cards with progress, open one, work through modules, take the online test
 * (graded server-side), submit the sandbox / case-study task. When all three
 * are done the assignment completes and a certification goes to the registry.
 */

const LS_KEY = 'tn_learner';

const LearnScreen = ({ showToast, pushLog }) => {
  const [learners, setLearners] = useState([]);
  const [me, setMe] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || null; } catch { return null; }
  });
  const [courses, setCourses] = useState([]);
  const [open, setOpen] = useState(null);          // assignment_id of the open course
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.learners().then(setLearners).catch(() => showToast('⚠ Could not load learners')).finally(() => setLoading(false));
  }, []);

  const loadCourses = async (learner) => {
    setLoading(true);
    try { setCourses(await api.myCourses(learner.id)); }
    catch { showToast('⚠ Could not load your courses'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (me) loadCourses(me); }, [me?.id]);

  const pickMe = (l) => { localStorage.setItem(LS_KEY, JSON.stringify(l)); setMe(l); setOpen(null); };
  const signOut = () => { localStorage.removeItem(LS_KEY); setMe(null); setCourses([]); setOpen(null); };

  const patchCourse = (updated) => {
    setCourses(prev => prev.map(c => c.assignment_id === updated.assignment_id ? updated : c));
  };

  // ── identity picker ──
  if (!me) {
    return (
      <div className="screen active" style={{ overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '30px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ fontSize: '34px' }}>🎓</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--n1)', marginTop: '6px' }}>Who's learning?</div>
            <div style={{ fontSize: '12px', color: 'var(--n5)', marginTop: '4px' }}>
              Pick your name to open your training. Only people with an approved program appear here.
            </div>
          </div>
          {loading && <div style={{ textAlign: 'center', color: 'var(--n5)', fontSize: '13px' }}>Loading…</div>}
          {!loading && learners.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--n5)', fontSize: '13px', lineHeight: 1.7 }}>
              Nobody has an approved training program yet.<br />Programs appear here after Talent Lead approval.
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', maxWidth: '760px', margin: '0 auto' }}>
            {learners.map(l => (
              <button
                key={l.id}
                id={`learner-${l.resource_code}-btn`}
                onClick={() => pickMe(l)}
                style={{
                  width: '170px', padding: '16px 12px', textAlign: 'center', cursor: 'pointer',
                  border: '1.5px solid var(--n7)', borderRadius: '12px', background: 'var(--card, #fff)',
                  fontFamily: 'Poppins, sans-serif', transition: 'transform .12s ease, border-color .12s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--p)'; e.currentTarget.style.transform = 'translateY(-3px)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--n7)'; e.currentTarget.style.transform = 'none'; }}
              >
                <div style={{
                  width: '46px', height: '46px', borderRadius: '50%', margin: '0 auto 8px',
                  background: 'linear-gradient(145deg,#0E7490,#22D3EE)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', fontWeight: 800,
                }}>
                  {l.full_name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--n1)' }}>{l.full_name}</div>
                <div style={{ fontSize: '10.5px', color: 'var(--n5)', marginTop: '2px' }}>{l.role || 'Resource'} · {l.resource_code}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const openCourse = courses.find(c => c.assignment_id === open);

  return (
    <div className="screen active" style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, padding: '14px 20px 16px', overflow: 'hidden' }}>

        {/* learner header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', flexShrink: 0 }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(145deg,#0E7490,#22D3EE)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 800,
          }}>
            {me.full_name.split(' ').map(w => w[0]).slice(0, 2).join('')}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--n1)' }}>{me.full_name}</div>
            <div style={{ fontSize: '10.5px', color: 'var(--n5)' }}>{me.role || 'Resource'} · {me.resource_code}</div>
          </div>
          {openCourse && (
            <button id="learn-back-btn" className="btn btn-gh" style={{ fontSize: '11.5px', padding: '6px 12px' }} onClick={() => setOpen(null)}>← My learning</button>
          )}
          <button id="learn-switch-btn" className="btn btn-gh" style={{ fontSize: '11.5px', padding: '6px 12px' }} onClick={signOut}>Switch learner</button>
        </div>

        {!openCourse ? (
          /* ── course cards ── */
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {loading && <div style={{ textAlign: 'center', color: 'var(--n5)', fontSize: '13px', padding: '30px' }}>Loading…</div>}
            {!loading && courses.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--n5)', fontSize: '13px', padding: '40px' }}>
                No approved training yet — your program may still be waiting for Talent Lead approval.
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
              {courses.map(c => (
                <div key={c.assignment_id} className="card" style={{ width: '300px', marginBottom: 0, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--n1)', lineHeight: 1.35 }}>{c.content.program_name}</div>
                    {c.progress.complete
                      ? <span className="badge b-ok" style={{ flexShrink: 0 }}>Completed</span>
                      : c.status === 'overdue'
                        ? <span className="badge b-er" style={{ flexShrink: 0 }}>Overdue</span>
                        : <span className="badge b-pp" style={{ flexShrink: 0 }}>In progress</span>}
                  </div>
                  {c.content.cert_name && (
                    <div style={{ fontSize: '11px', color: 'var(--pk)', fontWeight: 700 }}>🏅 {c.content.cert_name}</div>
                  )}
                  <div style={{ fontSize: '11.5px', color: 'var(--n4)', lineHeight: 1.5, minHeight: '32px' }}>
                    {(c.content.rationale || '').slice(0, 110) || `${c.content.modules.length} modules · test · case study`}
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: 'var(--n5)', marginBottom: '3px' }}>
                      <span>{c.progress.overall_pct}% complete</span>
                      <span>due {c.deadline}</span>
                    </div>
                    <div style={{ height: '7px', borderRadius: '4px', background: 'var(--n7)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${c.progress.overall_pct}%`, borderRadius: '4px', background: c.progress.complete ? 'var(--ok)' : 'linear-gradient(90deg,#5929d0,#A855F7)', transition: 'width .4s ease' }} />
                    </div>
                  </div>
                  <button id={`course-${c.assignment_id}-open`} className="btn btn-p" style={{ fontSize: '12px', padding: '7px 12px', marginTop: '4px' }} onClick={() => setOpen(c.assignment_id)}>
                    {c.progress.complete ? 'Review course' : c.progress.overall_pct > 0 ? 'Continue learning' : 'Start course'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <CourseDetail course={openCourse} onUpdate={patchCourse} showToast={showToast} pushLog={pushLog} />
        )}
      </div>
    </div>
  );
};

/* ── one open course: modules · test · sandbox ── */
const CourseDetail = ({ course, onUpdate, showToast, pushLog }) => {
  const [tab, setTab] = useState('modules');
  const [busy, setBusy] = useState(false);
  const [answers, setAnswers] = useState({});
  const [lastResult, setLastResult] = useState(null);
  const [caseText, setCaseText] = useState(course.progress.case_submission || '');

  const c = course.content;
  const p = course.progress;

  const toggleModule = async (i) => {
    const done = p.modules_done.includes(i);
    setBusy(true);
    try {
      const updated = await api.moduleComplete(course.assignment_id, i, !done);
      onUpdate(updated);
      if (updated.progress.complete && !p.complete) celebrate(updated);
    } catch (e) { showToast(`⚠ ${e.message}`); }
    finally { setBusy(false); }
  };

  const submitTest = async () => {
    const qs = c.test.questions;
    const chosen = qs.map((_, i) => answers[i]);
    if (chosen.some(a => a === undefined)) { showToast('⚠ Answer every question first'); return; }
    setBusy(true);
    try {
      const res = await api.testSubmit(course.assignment_id, chosen);
      setLastResult(res);
      onUpdate(res.course);
      showToast(res.passed ? `🎉 Passed — ${res.score}%` : `📚 ${res.score}% — pass mark is ${res.pass_pct}%. Review and retake.`);
      if (res.course.progress.complete && !p.complete) celebrate(res.course);
    } catch (e) { showToast(`⚠ ${e.message}`); }
    finally { setBusy(false); }
  };

  const submitCase = async () => {
    setBusy(true);
    try {
      const updated = await api.caseSubmit(course.assignment_id, caseText);
      onUpdate(updated);
      showToast('📤 Case study submitted');
      if (updated.progress.complete && !p.complete) celebrate(updated);
    } catch (e) { showToast(`⚠ ${e.message}`); }
    finally { setBusy(false); }
  };

  const celebrate = (updated) => {
    showToast(`🏆 Course complete! ${updated.content.cert_name || updated.content.program_name} sent to the certification registry.`);
    pushLog({ level: 'action', message: `Training completed: ${updated.content.program_name}`, action_type: 'completion_verified', actor: 'learner' });
  };

  const tabs = [
    { key: 'modules', label: `📚 Modules (${p.modules_done.length}/${c.modules.length})` },
    { key: 'test', label: `📝 Test${p.test_passed ? ' ✓' : p.test_available ? '' : ' 🔒'}` },
    { key: 'case', label: `🧪 Sandbox${p.case_submitted ? ' ✓' : ''}` },
  ];

  return (
    <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, marginBottom: 0 }}>
      {/* course header */}
      <div style={{ padding: '13px 18px 10px', borderBottom: '1px solid var(--n7)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--n1)' }}>{c.program_name}</div>
            {c.cert_name && <div style={{ fontSize: '11.5px', color: 'var(--pk)', fontWeight: 700, marginTop: '2px' }}>🏅 Leads to: {c.cert_name}</div>}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '19px', fontWeight: 800, color: p.complete ? 'var(--okd)' : 'var(--p)' }}>{p.overall_pct}%</div>
            <div style={{ fontSize: '10px', color: 'var(--n5)' }}>due {course.deadline}</div>
          </div>
        </div>
        {c.rationale && (
          <div style={{ fontSize: '11.5px', color: 'var(--n4)', marginTop: '7px', lineHeight: 1.55, background: 'rgba(124,92,252,0.05)', borderRadius: '8px', padding: '8px 11px' }}>
            <strong style={{ color: 'var(--n2)' }}>Why you're taking this:</strong> {c.rationale}
          </div>
        )}
        {p.complete && (
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--okd)', marginTop: '8px', background: 'var(--okl)', borderRadius: '8px', padding: '8px 11px' }}>
            🏆 Completed! Your certification is in the registry, pending verification.
          </div>
        )}
        <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
          {tabs.map(t => (
            <button
              key={t.key}
              id={`course-tab-${t.key}`}
              onClick={() => setTab(t.key)}
              className={`btn ${tab === t.key ? 'btn-p' : 'btn-gh'}`}
              style={{ fontSize: '11.5px', padding: '6px 13px' }}
            >{t.label}</button>
          ))}
        </div>
      </div>

      {/* tab body */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '14px 18px 22px' }}>
        {tab === 'modules' && (
          <>
            {c.modules.length === 0 && <div style={{ color: 'var(--n5)', fontSize: '12.5px' }}>No modules published yet.</div>}
            {c.modules.map((m, i) => {
              const done = p.modules_done.includes(i);
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 13px', marginBottom: '8px',
                  border: `1.5px solid ${done ? 'var(--ok)' : 'var(--n7)'}`, borderRadius: '10px',
                  background: done ? 'var(--okl)' : 'transparent', transition: 'all .15s ease',
                }}>
                  <div style={{
                    width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
                    background: done ? 'var(--ok)' : 'var(--n7)', color: done ? '#fff' : 'var(--n4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800,
                  }}>{done ? '✓' : i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--n1)', textDecoration: done ? 'line-through' : 'none' }}>{m.title}</div>
                    <div style={{ fontSize: '11px', color: 'var(--n5)' }}>{m.hours}h{m.objective ? ` · ${m.objective}` : ''}</div>
                  </div>
                  <button
                    id={`module-${i}-toggle`}
                    className={`btn ${done ? 'btn-gh' : 'btn-ok'}`}
                    disabled={busy || p.complete}
                    style={{ fontSize: '11px', padding: '5px 11px', flexShrink: 0 }}
                    onClick={() => toggleModule(i)}
                  >{done ? 'Undo' : 'Mark complete'}</button>
                </div>
              );
            })}
          </>
        )}

        {tab === 'test' && (
          !p.test_available ? (
            <div style={{ color: 'var(--n5)', fontSize: '12.5px', textAlign: 'center', padding: '30px', lineHeight: 1.7 }}>
              🔒 The online test hasn't been published for this program yet.<br />Check back once your coordinator adds it.
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ fontSize: '12px', color: 'var(--n4)' }}>
                  {c.test.questions.length} questions · pass mark {c.test.pass_pct}% · attempts so far: {p.test_attempts}
                  {p.test_score != null && <> · last score <strong style={{ color: p.test_passed ? 'var(--okd)' : 'var(--er)' }}>{p.test_score}%</strong></>}
                </div>
                {p.test_passed && <span className="badge b-ok">Passed ✓</span>}
              </div>
              {c.test.questions.map((q, qi) => {
                const feedback = lastResult?.results?.[qi];
                return (
                  <div key={qi} style={{ border: '1px solid var(--n7)', borderRadius: '10px', padding: '12px 14px', marginBottom: '10px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--n1)', marginBottom: '8px' }}>
                      {qi + 1}. {q.question}
                      {feedback && (
                        <span style={{ marginLeft: '8px', fontSize: '11px', fontWeight: 700, color: feedback.correct ? 'var(--okd)' : 'var(--er)' }}>
                          {feedback.correct ? '✓ correct' : '✗ incorrect'}
                        </span>
                      )}
                    </div>
                    {q.options.map((o, oi) => (
                      <label key={oi} style={{
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 9px', borderRadius: '7px',
                        cursor: p.complete ? 'default' : 'pointer', fontSize: '12.5px', color: 'var(--n2)',
                        background: answers[qi] === oi ? 'rgba(124,92,252,0.08)' : 'transparent',
                      }}>
                        <input
                          id={`test-q${qi}-o${oi}`}
                          type="radio"
                          name={`test-q${qi}`}
                          disabled={busy || p.complete}
                          checked={answers[qi] === oi}
                          onChange={() => setAnswers(prev => ({ ...prev, [qi]: oi }))}
                        />
                        {o}
                      </label>
                    ))}
                  </div>
                );
              })}
              {!p.complete && (
                <button id="test-submit-btn" className="btn btn-p" disabled={busy} style={{ fontSize: '12.5px', padding: '8px 18px' }} onClick={submitTest}>
                  {busy ? 'Grading…' : p.test_attempts > 0 && !p.test_passed ? 'Retake test' : 'Submit test'}
                </button>
              )}
            </>
          )
        )}

        {tab === 'case' && (
          <>
            <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--n1)' }}>{c.case_study.title}</div>
            <div style={{ fontSize: '12.5px', color: 'var(--n3, var(--n2))', lineHeight: 1.65, marginTop: '6px', background: 'rgba(14,116,144,0.06)', borderRadius: '8px', padding: '10px 13px' }}>
              {c.case_study.brief}
            </div>
            {p.case_submitted ? (
              <div style={{ marginTop: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--okd)', marginBottom: '6px' }}>✓ Submitted</div>
                <div style={{ fontSize: '12.5px', color: 'var(--n2)', whiteSpace: 'pre-wrap', border: '1px solid var(--n7)', borderRadius: '8px', padding: '11px 13px' }}>
                  {p.case_submission}
                </div>
              </div>
            ) : (
              <>
                <textarea
                  id="case-text"
                  style={{
                    width: '100%', minHeight: '150px', resize: 'vertical', marginTop: '14px',
                    border: '1.5px solid var(--n6)', borderRadius: '10px', padding: '11px 13px',
                    fontFamily: 'Poppins, sans-serif', fontSize: '12.5px', outline: 'none',
                    background: 'var(--card, #fff)', color: 'var(--n1, #1E293B)',
                  }}
                  placeholder="Describe your work: what you built or did, decisions you made, and the result. Paste links to artifacts if you have them."
                  value={caseText}
                  onChange={e => setCaseText(e.target.value)}
                />
                <button id="case-submit-btn" className="btn btn-p" disabled={busy || caseText.trim().length < 30} style={{ fontSize: '12.5px', padding: '8px 18px', marginTop: '8px' }} onClick={submitCase}>
                  {busy ? 'Submitting…' : 'Submit case study'}
                </button>
                <div style={{ fontSize: '10.5px', color: 'var(--n5)', marginTop: '5px' }}>Minimum a few sentences — this is your applied, real-world work.</div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default LearnScreen;
