import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../api';

/*
 * Program Studio — the Training Coordinator's workspace.
 *
 * Left: the gap list (draft programs — from AI document intake or created by
 * hand). Right: the program editor — content modules, online test builder,
 * and the case-study / sandbox task. "Send to HIL" hands the finished program
 * to the Talent Lead; nothing is ever assigned from this screen.
 */

const emptyContent = {
  program_name: '', cert_name: '', modules: [],
  test_pass_pct: 70, test_questions: [],
  case_study_title: '', case_study_brief: '', est_hours: 0, rationale: '',
};

// proposed_program JSON (any historical shape) → editor content
const jsonToContent = (p = {}, fallbackProgram = {}) => ({
  program_name: p.program_name || p.program || fallbackProgram.program_name || '',
  cert_name: p.cert_name || fallbackProgram.cert_name || '',
  modules: (p.module_list || (p.recommended?.modules) || []).map(m => ({
    title: m.title || '', hours: m.hours || 2, objective: m.objective || '',
  })),
  test_pass_pct: p.test?.pass_pct ?? 70,
  test_questions: (p.test?.questions || []).map(q => ({
    question: q.question || '', options: q.options || ['', '', '', ''], correct_index: q.correct_index ?? 0,
  })),
  case_study_title: p.case_study?.title || p.recommended?.case_study_title || '',
  case_study_brief: p.case_study?.brief || p.recommended?.case_study_brief || '',
  est_hours: p.est_hours || 0,
  rationale: p.rationale || p.gap_explanation || '',
});

const inp = {
  width: '100%', border: '1.5px solid var(--n6)', borderRadius: '8px',
  padding: '7px 10px', fontFamily: 'Poppins, sans-serif', fontSize: '12.5px',
  outline: 'none', background: 'var(--card, #fff)', color: 'var(--n1, #1E293B)',
};
const label = { fontSize: '10.5px', fontWeight: 700, color: 'var(--n4)', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', margin: '10px 0 4px' };

const StudioScreen = ({ showModal, showToast, pushLog }) => {
  const [drafts, setDrafts] = useState([]);
  const [catalogue, setCatalogue] = useState([]);
  const [selected, setSelected] = useState(null);     // hil_id
  const [content, setContent] = useState(emptyContent);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const refresh = async () => {
    try {
      const [d, c] = await Promise.all([api.drafts(), api.catalogue()]);
      setDrafts(d);
      setCatalogue(c);
      return d;
    } catch { showToast('⚠ Could not load Studio data'); return []; }
    finally { setLoading(false); }
  };

  useEffect(() => { refresh(); }, []);

  const currentDraft = drafts.find(d => d.hil_id === selected);

  const openDraft = (d) => {
    setSelected(d.hil_id);
    setContent(jsonToContent(d.proposed_program, d.catalogue_program || {}));
    setDirty(false);
  };

  const patch = (part) => { setContent(prev => ({ ...prev, ...part })); setDirty(true); };

  // ── modules ──
  const setModule = (i, part) => patch({ modules: content.modules.map((m, j) => j === i ? { ...m, ...part } : m) });
  const addModule = () => patch({ modules: [...content.modules, { title: '', hours: 2, objective: '' }] });
  const rmModule = (i) => patch({ modules: content.modules.filter((_, j) => j !== i) });

  // ── test questions ──
  const setQ = (i, part) => patch({ test_questions: content.test_questions.map((q, j) => j === i ? { ...q, ...part } : q) });
  const setOpt = (qi, oi, val) => setQ(qi, { options: content.test_questions[qi].options.map((o, j) => j === oi ? val : o) });
  const addQ = () => patch({ test_questions: [...content.test_questions, { question: '', options: ['', '', '', ''], correct_index: 0 }] });
  const rmQ = (i) => patch({ test_questions: content.test_questions.filter((_, j) => j !== i) });

  const save = async () => {
    if (!selected) return null;
    setBusy(true);
    try {
      const cleaned = {
        ...content,
        modules: content.modules.filter(m => m.title.trim()),
        test_questions: content.test_questions
          .filter(q => q.question.trim())
          .map(q => ({ ...q, options: q.options.filter(o => o.trim()) }))
          .filter(q => q.options.length >= 2),
      };
      const updated = await api.updateDraft(selected, { content: cleaned, updated_by: 'coordinator_01' });
      setDrafts(prev => prev.map(d => d.hil_id === selected ? updated : d));
      setContent(jsonToContent(updated.proposed_program, updated.catalogue_program || {}));
      setDirty(false);
      showToast('💾 Draft saved');
      return updated;
    } catch (e) { showToast(`⚠ ${e.message}`); return null; }
    finally { setBusy(false); }
  };

  const sendToHil = async () => {
    if (!selected) return;
    const saved = dirty ? await save() : currentDraft;
    if (!saved) return;
    setBusy(true);
    try {
      await api.submitDraft(selected);
      showToast('📨 Sent to Talent Lead for HIL approval');
      pushLog({ level: 'action', message: `Program sent to HIL: ${content.program_name} — ${currentDraft?.resource?.full_name}`, action_type: 'program_sent_to_hil', actor: 'coordinator_01' });
      setSelected(null);
      setContent(emptyContent);
      refresh();
    } catch (e) { showToast(`⚠ ${e.message}`); }
    finally { setBusy(false); }
  };

  // ── AI document intake (moved here from the HIL screen) ──
  const onFilePicked = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    showToast(`📄 Analysing ${file.name}…`);
    try {
      const res = await api.uploadGapDocument(file);
      const n = res.entries?.length || 0;
      showToast(`🤖 ${n} draft program${n === 1 ? '' : 's'} created — refine & send to HIL`);
      pushLog({ level: 'info', message: `AI intake: ${n} draft(s) from ${file.name}`, action_type: 'intake_processed', actor: 'coordinator_01' });
      refresh();
    } catch (err) { showToast(`⚠ ${err.message}`); }
    finally { setUploading(false); }
  };

  // ── manual "new draft" modal ──
  const openNewDraft = () => {
    showModal(
      <NewDraftModal
        catalogue={catalogue}
        onClose={() => showModal(null)}
        onCreated={(draft) => {
          showModal(null);
          showToast('🆕 Draft created');
          setDrafts(prev => [draft, ...prev]);
          openDraft(draft);
        }}
        showToast={showToast}
      />
    );
  };

  const qCount = content.test_questions.filter(q => q.question.trim()).length;

  return (
    <div className="screen active" style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, padding: '14px 20px 16px', overflow: 'hidden' }}>

        {/* Intake bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, marginBottom: '12px',
          padding: '9px 14px', border: '1.5px dashed var(--n6)', borderRadius: '10px', background: 'rgba(124,92,252,0.04)',
        }}>
          <span style={{ fontSize: '17px' }}>📄</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--n2)' }}>Skill-gap intake</div>
            <div style={{ fontSize: '10.5px', color: 'var(--n5)' }}>
              Upload a PDF / Excel / CSV — AI drafts a personalised program per person, or create one by hand.
            </div>
          </div>
          <input ref={fileInputRef} id="studio-file-input" type="file" accept=".pdf,.xlsx,.xls,.csv,.txt,.md" style={{ display: 'none' }} onChange={onFilePicked} />
          <button id="studio-upload-btn" className="btn btn-p" disabled={uploading} style={{ fontSize: '11.5px', padding: '6px 12px' }} onClick={() => fileInputRef.current?.click()}>
            {uploading ? 'Analysing…' : '📄 Upload document'}
          </button>
          <button id="studio-new-draft-btn" className="btn btn-gh" style={{ fontSize: '11.5px', padding: '6px 12px' }} onClick={openNewDraft}>
            ＋ New draft
          </button>
        </div>

        <div style={{ display: 'flex', gap: '14px', flex: 1, minHeight: 0 }}>

          {/* ── Left: gap list ── */}
          <div className="card" style={{ width: '295px', flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0, marginBottom: 0 }}>
            <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid var(--n7)', fontSize: '12px', fontWeight: 700, color: 'var(--n2)', flexShrink: 0 }}>
              People with skill gaps · {drafts.length} draft{drafts.length === 1 ? '' : 's'}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '8px' }}>
              {loading && <div style={{ padding: '18px', textAlign: 'center', color: 'var(--n5)', fontSize: '12px' }}>Loading…</div>}
              {!loading && drafts.length === 0 && (
                <div style={{ padding: '22px 14px', textAlign: 'center', color: 'var(--n5)', fontSize: '12px', lineHeight: 1.6 }}>
                  No drafts yet.<br />Upload a skill-gap document or create one by hand.
                </div>
              )}
              {drafts.map(d => (
                <button
                  key={d.hil_id}
                  id={`draft-${d.hil_id}-btn`}
                  onClick={() => openDraft(d)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                    border: `1.5px solid ${selected === d.hil_id ? 'var(--p)' : 'var(--n7)'}`,
                    background: selected === d.hil_id ? 'rgba(124,92,252,0.07)' : 'transparent',
                    borderRadius: '9px', padding: '9px 11px', marginBottom: '7px', fontFamily: 'Poppins, sans-serif',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--n1)' }}>{d.resource?.full_name}</span>
                    <span className="id-chip" style={{ flexShrink: 0 }}>{d.resource?.resource_code}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--n4)', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.gap_description || d.proposed_program?.gap_explanation || 'Skill gap'}
                  </div>
                  <div style={{ fontSize: '10.5px', color: 'var(--p)', fontWeight: 600, marginTop: '3px' }}>
                    {d.proposed_program?.program_name || d.proposed_program?.program || 'No program yet'}
                    {d.recommended_by?.startsWith('ai:') && <span style={{ color: 'var(--n5)', fontWeight: 500 }}> · 🤖 AI draft</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Right: editor ── */}
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, marginBottom: 0 }}>
            {!currentDraft ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--n5)', fontSize: '13px', textAlign: 'center', padding: '30px', lineHeight: 1.8 }}>
                ← Pick a person to build their program.<br />
                Author the modules, the online test and the sandbox task, then send it for HIL approval.
              </div>
            ) : (
              <>
                {/* editor header */}
                <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--n7)', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--n1)' }}>
                      {currentDraft.resource?.full_name}
                      <span style={{ fontWeight: 500, color: 'var(--n5)', fontSize: '11.5px' }}> · {currentDraft.resource?.role || 'Resource'} · deadline {currentDraft.deadline}</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--n4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Gap: {currentDraft.gap_description || currentDraft.proposed_program?.gap_explanation || '—'}
                    </div>
                  </div>
                  <button id="studio-save-btn" className="btn btn-gh" disabled={busy || !dirty} style={{ fontSize: '11.5px', padding: '6px 13px' }} onClick={save}>
                    {busy ? '…' : dirty ? '💾 Save draft' : 'Saved ✓'}
                  </button>
                  <button id="studio-send-hil-btn" className="btn btn-ok" disabled={busy || content.modules.filter(m => m.title.trim()).length === 0} style={{ fontSize: '11.5px', padding: '6px 13px' }} onClick={sendToHil}>
                    📨 Send to HIL
                  </button>
                </div>

                {/* editor body */}
                <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '12px 16px 20px' }}>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 2 }}>
                      <span style={label}>Program name</span>
                      <input id="studio-prog-name" style={inp} value={content.program_name} onChange={e => patch({ program_name: e.target.value })} />
                    </div>
                    <div style={{ flex: 2 }}>
                      <span style={label}>Certification</span>
                      <input id="studio-cert-name" style={inp} value={content.cert_name} onChange={e => patch({ cert_name: e.target.value })} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={label}>Pass mark %</span>
                      <input id="studio-pass-pct" style={inp} type="number" min="1" max="100" value={content.test_pass_pct} onChange={e => patch({ test_pass_pct: Math.max(1, Math.min(100, +e.target.value || 70)) })} />
                    </div>
                  </div>

                  <span style={label}>Why this program (shown to the Talent Lead and the learner)</span>
                  <textarea id="studio-rationale" style={{ ...inp, minHeight: '48px', resize: 'vertical' }} value={content.rationale} onChange={e => patch({ rationale: e.target.value })} />

                  {/* modules */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '14px' }}>
                    <span style={{ ...label, margin: 0 }}>📚 Content modules ({content.modules.length})</span>
                    <button id="studio-add-module-btn" className="btn btn-gh" style={{ fontSize: '11px', padding: '4px 10px' }} onClick={addModule}>＋ Module</button>
                  </div>
                  {content.modules.map((m, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginTop: '7px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--n5)', fontWeight: 700, paddingTop: '9px', width: '18px', flexShrink: 0 }}>{i + 1}.</span>
                      <input id={`studio-mod-${i}-title`} style={{ ...inp, flex: 2 }} placeholder="Module title" value={m.title} onChange={e => setModule(i, { title: e.target.value })} />
                      <input id={`studio-mod-${i}-hours`} style={{ ...inp, width: '62px', flex: 'none' }} type="number" min="1" title="Hours" value={m.hours} onChange={e => setModule(i, { hours: +e.target.value || 1 })} />
                      <input id={`studio-mod-${i}-obj`} style={{ ...inp, flex: 3 }} placeholder="Learning objective" value={m.objective} onChange={e => setModule(i, { objective: e.target.value })} />
                      <button id={`studio-mod-${i}-rm`} className="btn btn-gh" style={{ fontSize: '11px', padding: '6px 9px', flexShrink: 0 }} onClick={() => rmModule(i)}>✕</button>
                    </div>
                  ))}

                  {/* test builder */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '18px' }}>
                    <span style={{ ...label, margin: 0 }}>📝 Online test ({qCount} question{qCount === 1 ? '' : 's'})</span>
                    <button id="studio-add-q-btn" className="btn btn-gh" style={{ fontSize: '11px', padding: '4px 10px' }} onClick={addQ}>＋ Question</button>
                  </div>
                  {content.test_questions.length === 0 && (
                    <div style={{ fontSize: '11.5px', color: 'var(--n5)', marginTop: '6px' }}>
                      No questions yet — the learner's test tab stays locked until you publish at least one.
                    </div>
                  )}
                  {content.test_questions.map((q, qi) => (
                    <div key={qi} style={{ border: '1px solid var(--n7)', borderRadius: '9px', padding: '10px 12px', marginTop: '8px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input id={`studio-q-${qi}`} style={{ ...inp, flex: 1 }} placeholder={`Question ${qi + 1}`} value={q.question} onChange={e => setQ(qi, { question: e.target.value })} />
                        <button id={`studio-q-${qi}-rm`} className="btn btn-gh" style={{ fontSize: '11px', padding: '6px 9px', flexShrink: 0 }} onClick={() => rmQ(qi)}>✕</button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '7px' }}>
                        {q.options.map((o, oi) => (
                          <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                              id={`studio-q-${qi}-correct-${oi}`}
                              type="radio"
                              name={`q-${qi}-correct`}
                              checked={q.correct_index === oi}
                              onChange={() => setQ(qi, { correct_index: oi })}
                              title="Correct answer"
                            />
                            <input id={`studio-q-${qi}-opt-${oi}`} style={{ ...inp, flex: 1 }} placeholder={`Option ${oi + 1}`} value={o} onChange={e => setOpt(qi, oi, e.target.value)} />
                          </div>
                        ))}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--n5)', marginTop: '5px' }}>Radio = correct answer</div>
                    </div>
                  ))}

                  {/* sandbox / case study */}
                  <span style={{ ...label, marginTop: '18px' }}>🧪 Sandbox · case study (real application work)</span>
                  <input id="studio-cs-title" style={inp} placeholder="Task title — e.g. 'Annotate a sample PHI dataset'" value={content.case_study_title} onChange={e => patch({ case_study_title: e.target.value })} />
                  <textarea
                    id="studio-cs-brief"
                    style={{ ...inp, minHeight: '64px', resize: 'vertical', marginTop: '7px' }}
                    placeholder="Brief — what must the learner build / do / submit?"
                    value={content.case_study_brief}
                    onChange={e => patch({ case_study_brief: e.target.value })}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* Manual draft creation — small modal (fits the 500px modal shell) */
const NewDraftModal = ({ catalogue, onClose, onCreated, showToast }) => {
  const [form, setForm] = useState({ full_name: '', resource_code: '', role: '', gap_description: '', rfp_reference: '', catalogue_program_id: catalogue[0]?.id || '' });
  const [busy, setBusy] = useState(false);
  const set = (part) => setForm(prev => ({ ...prev, ...part }));

  const create = async () => {
    if (!form.full_name.trim() && !form.resource_code.trim()) { showToast('⚠ Give a name or a resource code'); return; }
    if (!form.catalogue_program_id) { showToast('⚠ Pick a catalogue program'); return; }
    setBusy(true);
    try {
      const cat = catalogue.find(c => c.id === form.catalogue_program_id) || {};
      const modules = Array.isArray(cat.content_modules)
        ? cat.content_modules.map(m => ({ title: String(m), hours: 2, objective: '' }))
        : [];
      const draft = await api.createDraft({
        ...form,
        content: {
          program_name: cat.program_name || 'Training Program',
          cert_name: cat.cert_name || '',
          modules,
          test_pass_pct: 70,
          test_questions: [],
          case_study_title: '',
          case_study_brief: '',
          est_hours: cat.total_duration_h || 0,
          rationale: form.gap_description,
        },
      });
      onCreated(draft);
    } catch (e) { showToast(`⚠ ${e.message}`); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <div className="modal-head">
        <div className="modal-htitle">New program draft</div>
        <button id="new-draft-close-btn" className="modal-close" onClick={onClose}>✕</button>
      </div>
      <div className="modal-body">
        <span style={label}>Learner name</span>
        <input id="nd-name" style={inp} value={form.full_name} onChange={e => set({ full_name: e.target.value })} placeholder="Full name (new or existing)" />
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ flex: 1 }}>
            <span style={label}>Resource code (optional)</span>
            <input id="nd-code" style={inp} value={form.resource_code} onChange={e => set({ resource_code: e.target.value })} placeholder="R-1042" />
          </div>
          <div style={{ flex: 1 }}>
            <span style={label}>Role (optional)</span>
            <input id="nd-role" style={inp} value={form.role} onChange={e => set({ role: e.target.value })} placeholder="Data Annotator" />
          </div>
        </div>
        <span style={label}>Skill gap</span>
        <textarea id="nd-gap" style={{ ...inp, minHeight: '52px', resize: 'vertical' }} value={form.gap_description} onChange={e => set({ gap_description: e.target.value })} placeholder="What can't they do yet, and why does it matter?" />
        <span style={label}>Base program (approved catalogue)</span>
        <select id="nd-program" style={inp} value={form.catalogue_program_id} onChange={e => set({ catalogue_program_id: e.target.value })}>
          {catalogue.map(c => <option key={c.id} value={c.id}>{c.program_name}{c.cert_name ? ` — ${c.cert_name}` : ''}</option>)}
        </select>
        <span style={label}>RFP reference (optional)</span>
        <input id="nd-rfp" style={inp} value={form.rfp_reference} onChange={e => set({ rfp_reference: e.target.value })} placeholder="RFP-2026-041" />
        <div className="mactions" style={{ marginTop: '14px' }}>
          <button id="nd-create-btn" className="btn btn-p" disabled={busy} onClick={create}>{busy ? 'Creating…' : 'Create draft'}</button>
          <button id="nd-cancel-btn" className="btn btn-gh" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default StudioScreen;
