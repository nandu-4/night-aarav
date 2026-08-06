import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { Badge, Empty, Ring } from '../ui';

export default function MyLearning() {
  const [courses, setCourses] = useState(null);
  useEffect(() => { api.courses().then(setCourses).catch(() => setCourses([])); }, []);

  if (!courses) return <div className="card">Loading…</div>;
  if (courses.length === 0) return <div className="card"><Empty text="No assigned programs yet — enrolment happens automatically when the Talent Nurturing Agent identifies a skill gap." /></div>;

  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
      {courses.map((c) => (
        <Link key={c.assignment_id} to={`/course/${c.assignment_id}`}>
          <div className="card" style={{ height: '100%', cursor: 'pointer' }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <Ring pct={c.progress.overall_pct} size={74} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontSize: 14.5 }}>{c.content.program_name}</b>
                <div className="sub" style={{ margin: '3px 0 7px' }}>🏅 {c.content.cert_name}</div>
                <Badge kind={c.status}>{c.status.replace('_', ' ')}</Badge>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              {[
                ['📖', 'Content', c.stages.content_done],
                ['🧠', 'Assessment', c.stages.assessment_done && c.stages.assessment_applicable],
                ['🛠️', 'Project', c.stages.project_done],
              ].map(([ic, name, done]) => (
                <div key={name} style={{
                  flex: 1, textAlign: 'center', padding: '9px 4px', borderRadius: 12, fontSize: 10.5,
                  background: done ? 'rgba(16,185,129,.12)' : 'var(--glass)',
                  border: `1px solid ${done ? 'rgba(16,185,129,.4)' : 'var(--border)'}`,
                  color: done ? 'var(--ok)' : 'var(--t3)', fontWeight: 600,
                }}>
                  {ic} {name} {done ? '✓' : ''}
                </div>
              ))}
            </div>
            <div className="sub" style={{ marginTop: 12 }}>
              ⏱ {c.hours_done}/{c.hours_total}h · due {c.deadline}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
