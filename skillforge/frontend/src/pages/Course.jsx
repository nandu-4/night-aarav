import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { Badge, Ring } from '../ui';

/* The 3-stage learning journey: Content → Assessment → Project.
   Stages unlock strictly in order; a program is complete only when all
   three are finished (enforced server-side and mirrored by TN's BR-005). */

export default function Course() {
  const { id } = useParams();
  const [c, setC] = useState(null);
  const [stage, setStage] = useState(null);
  const [err, setErr] = useState('');
  const [toast, setToast] = useState('');

  const load = () => api.course(id).then((data) => {
    setC(data);
    setStage((s) => s ?? Math.min(data.stages.current_stage, 3));
  }).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [id]);

  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 3200); };

  if (err) return <div className="card" style={{ color: 'var(--err)' }}>{err}</div>;
  if (!c) return <div className="card">Loading course…</div>;

  const s = c.stages;
  const locked2 = !s.content_done;
  const locked3 = !s.content_done || (s.assessment_applicable && !s.assessment_done);

  return (
    <div>
      <Link to="/learning" className="sub">← My Learning</Link>
      <div className="card" style={{ marginTop: 10, display: 'flex', gap: 22, alignItems: 'center' }}>
        <Ring pct={c.progress.overall_pct} size={92} />
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 20 }}>{c.content.program_name}</h2>
          <div className="sub" style={{ margin: '4px 0 8px' }}>
            🏅 {c.content.cert_name} · due {c.deadline} · {c.hours_done}/{c.hours_total}h
          </div>
          {c.content.rationale && <div className="sub" style={{ fontStyle: 'italic' }}>Why you: {c.content.rationale}</div>}
        </div>
        <Badge kind={c.status}>{c.status.replace('_', ' ')}</Badge>
      </div>

      {/* Stage rail */}
      <div className="stages">
        {[
          [1, '📖', 'Learning Content', s.content_done, false],
          [2, '🧠', 'Knowledge Assessment', s.assessment_done && s.assessment_applicable, locked2],
          [3, '🛠️', 'Hands-on Project', s.project_done, locked3],
        ].map(([n, ic, name, done, locked]) => (
          <div key={n}
            className={`stagechip ${stage === n ? 'on' : ''} ${done ? 'done' : ''} ${locked ? 'locked' : ''}`}
            onClick={() => !locked && setStage(n)}>
            <div className="stagenum">{done ? '✓' : n}</div>
            <div><b>{ic} {name}</b><span>{locked ? 'Locked — finish the previous stage' : done ? 'Completed' : stage === n ? 'In progress' : 'Open'}</span></div>
          </div>
        ))}
      </div>

      {s.complete && (
        <div className="card" style={{ borderColor: 'var(--teal)', marginBottom: 16 }}>
          🎉 <b>All three stages complete!</b> Your certificate is in <Link to="/certificates" style={{ color: 'var(--teal-bright)', fontWeight: 700 }}>Certificates</Link>.
          Final capability verification happens with the Talent Lead in the Talent Nurturing Agent.
        </div>
      )}

      {toast && <div className="card" style={{ borderColor: 'var(--purple)', marginBottom: 16 }}>{toast}</div>}

      {stage === 1 && <StageContent c={c} reload={load} flash={flash} />}
      {stage === 2 && <StageQuiz c={c} reload={load} flash={flash} />}
      {stage === 3 && <StageProject c={c} reload={load} flash={flash} />}
    </div>
  );
}

/* ── Stage 1 · Learning Content ─────────────────────────── */
function StageContent({ c, reload, flash }) {
  const [open, setOpen] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');

  const toggle = async (i, done) => {
    await api.moduleComplete(c.assignment_id, i, done);
    flash(done ? 'Module marked complete — synced to the Talent Nurturing Agent ✅' : 'Module reopened.');
    reload();
  };

  return (
    <div className="grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
      <div className="card">
        <h3>📖 Modules · {c.progress.modules_done.length}/{c.content.modules.length} complete</h3>
        {c.content.modules.map((m, i) => {
          const done = c.progress.modules_done.includes(i);
          const marked = c.bookmarks.includes(i);
          return (
            <div key={i}>
              <div className="module">
                <div className={`module__tick ${done ? 'done' : ''}`} title={done ? 'Mark as not done' : 'Mark complete'}
                  onClick={() => toggle(i, !done)}>{done ? '✓' : ''}</div>
                <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => { setOpen(open === i ? null : i); setNoteDraft(c.notes[String(i)] || ''); }}>
                  <b>{m.title}</b>
                  <div className="meta">🎬 video lesson · 📄 reading & references · ⏱ {m.hours}h</div>
                </div>
                <button className="iconbtn" title="Bookmark" style={{ width: 32, height: 32 }}
                  onClick={() => api.bookmark(c.assignment_id, i, !marked).then(reload)}>
                  {marked ? '🔖' : '🏷️'}
                </button>
              </div>
              {open === i && (
                <div className="card" style={{ margin: '0 0 12px', background: 'var(--grad-soft)' }}>
                  <b style={{ fontSize: 13 }}>What you'll learn</b>
                  <p className="sub" style={{ margin: '6px 0 12px', lineHeight: 1.6 }}>
                    {m.objective || 'Work through the lesson video and reading material, then mark the module complete.'}
                  </p>
                  <b style={{ fontSize: 13 }}>💡 AI explanation</b>
                  <p className="sub" style={{ margin: '6px 0 12px', lineHeight: 1.6 }}>
                    Focus on how “{m.title}” applies to your day-to-day role — the assessment scenarios and the
                    hands-on project both draw directly from this module's objective.
                  </p>
                  <b style={{ fontSize: 13 }}>📝 My notes</b>
                  <textarea className="input" rows={3} style={{ marginTop: 6 }} value={noteDraft}
                    placeholder="Write your takeaways…" onChange={(e) => setNoteDraft(e.target.value)} />
                  <button className="btn btn--sm" style={{ marginTop: 8 }}
                    onClick={() => api.saveNote(c.assignment_id, i, noteDraft).then(() => { flash('Note saved 📝'); reload(); })}>
                    Save note
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="card">
          <h3>🔖 Bookmarked</h3>
          {c.bookmarks.length === 0 && <div className="sub">Tag modules you want to revisit.</div>}
          {c.bookmarks.map((i) => <div key={i} className="sub" style={{ padding: '4px 0' }}>• {c.content.modules[i]?.title}</div>)}
        </div>
        <div className="card">
          <h3>🧭 Stage guide</h3>
          <div className="sub" style={{ lineHeight: 1.7 }}>
            Complete every module to unlock <b>Stage 2 — Knowledge Assessment</b>.
            Each completion syncs instantly to the Talent Nurturing Agent and moves your readiness score.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Stage 2 · Knowledge Assessment ─────────────────────── */
function StageQuiz({ c, reload, flash }) {
  const qs = c.content.test.questions;
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!c.stages.assessment_applicable) {
    return <div className="card">This program has no formal assessment — Stage 2 is auto-passed. Head to the project. ✅</div>;
  }

  const submit = async () => {
    setBusy(true);
    try {
      const res = await api.quizSubmit(c.assignment_id, qs.map((_, i) => answers[i] ?? -1));
      setResult(res);
      flash(res.passed ? `Passed with ${res.score}% 🎉` : `Scored ${res.score}% — pass mark ${res.pass_pct}%. You can retake.`);
      reload();
    } catch (e) { flash(e.message); }
    setBusy(false);
  };

  return (
    <div className="grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
      <div className="card">
        <h3>🧠 Assessment · {qs.length} questions · pass mark {c.content.test.pass_pct}%</h3>
        {qs.map((q, qi) => {
          const verdict = result?.results?.find((r) => r.question_index === qi);
          return (
            <div className="quizq" key={qi}>
              <p>{qi + 1}. {q.question || q.text}</p>
              {(q.options || []).map((opt, oi) => {
                let cls = answers[qi] === oi ? 'sel' : '';
                if (verdict) {
                  if (oi === verdict.correct_index) cls = 'correct';
                  else if (answers[qi] === oi && !verdict.correct) cls = 'wrong';
                }
                return (
                  <div key={oi} className={`quizopt ${cls}`} onClick={() => !result && setAnswers({ ...answers, [qi]: oi })}>
                    <span style={{ fontWeight: 700, fontSize: 11 }}>{String.fromCharCode(65 + oi)}</span> {opt}
                  </div>
                );
              })}
            </div>
          );
        })}
        {!result ? (
          <button className="btn" disabled={busy || Object.keys(answers).length < qs.length} onClick={submit}>
            {busy ? 'Grading…' : `Submit answers (${Object.keys(answers).length}/${qs.length})`}
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Ring pct={result.score} size={72} tealAt={c.content.test.pass_pct} />
            <div>
              <b style={{ fontFamily: 'Sora', fontSize: 16 }}>{result.passed ? 'Passed 🎉' : 'Not passed yet'}</b>
              <div className="sub">Graded by the Talent Nurturing Agent · instant feedback above</div>
              {!result.passed && <button className="btn btn--sm btn--ghost" style={{ marginTop: 8 }}
                onClick={() => { setResult(null); setAnswers({}); }}>Retake</button>}
            </div>
          </div>
        )}
      </div>
      <div className="card" style={{ alignSelf: 'start' }}>
        <h3>📈 Score history</h3>
        {c.quiz_history.length === 0 && <div className="sub">No attempts yet — you've got this.</div>}
        {c.quiz_history.map((h, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
            <span className="sub">{new Date(h.ts).toLocaleString()}</span>
            <Badge kind={h.passed ? 'passed' : 'failed'}>{h.score}%</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Stage 3 · Hands-on Project ─────────────────────────── */
function StageProject({ c, reload, flash }) {
  const [text, setText] = useState('');
  const [github, setGithub] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const cs = c.content.case_study;
  const sub = c.submission;

  const submit = async () => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('text', text);
      if (github) fd.append('github_url', github);
      if (file) fd.append('file', file);
      const res = await api.projectSubmit(c.assignment_id, fd);
      flash(res.certificate
        ? `Project submitted — program complete! Certificate ${res.certificate.verify_id} issued 🎓`
        : 'Project submitted — synced to the Talent Nurturing Agent ✅');
      reload();
    } catch (e) { flash(e.message); }
    setBusy(false);
  };

  return (
    <div className="grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
      <div className="card">
        <h3>🛠️ {cs.title || 'Hands-on Practical Project'}</h3>
        <p className="sub" style={{ lineHeight: 1.7, marginBottom: 16 }}>{cs.brief}</p>

        {sub ? (
          <div>
            <div className="card" style={{ background: 'var(--grad-soft)' }}>
              <b>Your submission · {new Date(sub.ts).toLocaleString()}</b>
              <p className="sub" style={{ margin: '8px 0', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{sub.text}</p>
              {sub.github_url && <div className="sub">🔗 {sub.github_url}</div>}
              {sub.file_name && <div className="sub">📎 {sub.file_name}</div>}
            </div>
            <div className="card" style={{ marginTop: 12 }}>
              <b>🤖 Automated pre-review</b>
              <p className="sub" style={{ marginTop: 6, lineHeight: 1.6 }}>{sub.ai_review}</p>
            </div>
            <div className="card" style={{ marginTop: 12 }}>
              <b>🧑‍🏫 Mentor review</b>
              {sub.mentor_review ? (
                <div style={{ marginTop: 6 }}>
                  <Badge kind={sub.mentor_review.verdict === 'approved' ? 'approved' : 'needs_work'}>
                    {sub.mentor_review.verdict.replace('_', ' ')}
                  </Badge>
                  <p className="sub" style={{ marginTop: 6, lineHeight: 1.6 }}>
                    {sub.mentor_review.comment} — <b>{sub.mentor_review.by}</b>
                  </p>
                </div>
              ) : (
                <p className="sub" style={{ marginTop: 6 }}>Waiting for your Training Manager's review.</p>
              )}
            </div>
          </div>
        ) : (
          <div>
            <label className="lbl">Describe your work — approach, decisions, results (min ~30 chars)</label>
            <textarea id="project-text" className="input" rows={7} value={text} onChange={(e) => setText(e.target.value)}
              placeholder="What did you build, how did you approach it, what would you improve…" />
            <label className="lbl">GitHub repository (optional)</label>
            <input className="input" value={github} onChange={(e) => setGithub(e.target.value)}
              placeholder="https://github.com/you/project" />
            <label className="lbl">Attach a file (optional)</label>
            <input type="file" className="input" onChange={(e) => setFile(e.target.files[0])} />
            <button id="project-submit" className="btn btn--teal" style={{ marginTop: 16 }}
              disabled={busy || text.trim().length < 30} onClick={submit}>
              {busy ? 'Submitting…' : 'Submit project'}
            </button>
          </div>
        )}
      </div>
      <div className="card" style={{ alignSelf: 'start' }}>
        <h3>🧭 What happens next</h3>
        <div className="timeline" style={{ marginTop: 6 }}>
          <div className="tl-item"><b>Automated pre-review</b><span>instant structural check</span></div>
          <div className="tl-item"><b>Talent Nurturing sync</b><span>submission recorded; completion rolls up</span></div>
          <div className="tl-item"><b>Mentor review</b><span>Training Manager feedback</span></div>
          <div className="tl-item"><b>Certificate</b><span>issued automatically on completion</span></div>
          <div className="tl-item"><b>Talent Lead verification</b><span>capability & deployment — in the TN Agent (HIL)</span></div>
        </div>
      </div>
    </div>
  );
}
