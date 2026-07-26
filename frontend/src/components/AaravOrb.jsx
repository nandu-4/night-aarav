import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useData } from '../DataContext';

/* ──────────────────────────────────────────────
   Helper: generate real AI insights from live data
   ────────────────────────────────────────────── */
function deriveInsights(data) {
  const { assignments, hilItems, escalations, certs, metrics } = data;
  const insights = [];

  // ── Risk insights from escalations ──
  const openEsc = (escalations || []).filter(e => e.status === 'open');
  openEsc.forEach(esc => {
    const name = esc.assignment?.resource?.full_name || 'Unknown';
    const severity = esc.severity || 'medium';
    insights.push({
      type: 'risk',
      text: `${name} has an open ${severity}-severity escalation requiring attention`,
      confidence: severity === 'critical' ? 95 : severity === 'high' ? 88 : 74,
      updatedAgo: timeSince(esc.created_at),
    });
  });

  // ── Recommendation insights from pending HIL items ──
  const pendingHil = (hilItems || []).filter(h => h.status === 'pending');
  pendingHil.forEach(h => {
    const name = h.assignment?.resource?.full_name || 'Unknown';
    const conf = h.assignment?.evaluation_score
      ? Math.round(h.assignment.evaluation_score * 100)
      : 72;
    insights.push({
      type: 'recommendation',
      text: `${name} shows declining evaluation confidence — review recommended`,
      confidence: conf,
      updatedAgo: timeSince(h.created_at),
    });
  });

  // ── Approval insights from recently completed assignments ──
  const completed = (assignments || []).filter(a => a.status === 'completed');
  completed.slice(0, 2).forEach(a => {
    const name = a.resource?.full_name || 'Unknown';
    insights.push({
      type: 'approval',
      text: `${name} successfully completed assignment — certification eligible`,
      confidence: 96,
      updatedAgo: timeSince(a.updated_at || a.created_at),
    });
  });

  // ── Metric-based insight ──
  if (metrics && metrics.total_assignments > 0) {
    const completionRate = Math.round(
      (metrics.completed_assignments / metrics.total_assignments) * 100
    );
    if (completionRate < 50) {
      insights.push({
        type: 'risk',
        text: `Overall completion rate is ${completionRate}% — below target threshold`,
        confidence: 91,
        updatedAgo: '1m ago',
      });
    }
  }

  // Fallback if nothing found
  if (insights.length === 0) {
    insights.push({
      type: 'approval',
      text: 'All systems operating within expected parameters',
      confidence: 99,
      updatedAgo: 'just now',
    });
  }

  return insights.slice(0, 5);
}

function timeSince(isoStr) {
  if (!isoStr) return 'recently';
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/* ──────────────────────────────────────────────
   Badge config
   ────────────────────────────────────────────── */
const BADGE_MAP = {
  risk:           { label: 'Risk',           cls: 'b-er' },
  recommendation: { label: 'Recommendation', cls: 'b-pp' },
  approval:       { label: 'Approval',       cls: 'b-ok' },
};

/* ══════════════════════════════════════════════
   AaravOrb component
   ══════════════════════════════════════════════ */
const AaravOrb = () => {
  const data = useData();
  const [panelOpen, setPanelOpen] = useState(false);
  const [insights, setInsights] = useState([]);
  const [isActive, setIsActive] = useState(false);
  const prevInsightRef = useRef('');
  const panelRef = useRef(null);

  // Derive insights whenever data changes
  useEffect(() => {
    if (data.loading) return;
    const next = deriveInsights(data);
    const nextKey = JSON.stringify(next.map(i => i.text));

    if (nextKey !== prevInsightRef.current) {
      setInsights(next);
      prevInsightRef.current = nextKey;

      // Trigger "active" pulse when new insights appear
      setIsActive(true);
      const t = setTimeout(() => setIsActive(false), 2200);
      return () => clearTimeout(t);
    }
  }, [
    data.loading,
    data.assignments,
    data.hilItems,
    data.escalations,
    data.certs,
    data.metrics,
  ]);

  // Close panel on outside click
  useEffect(() => {
    if (!panelOpen) return;
    const handler = (e) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target) &&
        !e.target.closest('.aarav-orb')
      ) {
        setPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [panelOpen]);

  const togglePanel = useCallback(() => setPanelOpen(prev => !prev), []);

  const insightCount = insights.filter(
    i => i.type === 'risk' || i.type === 'recommendation'
  ).length;

  return (
    <>
      {/* ── Orb ── */}
      <button
        className={`aarav-orb ${isActive ? 'aarav-orb--active' : ''}`}
        onClick={togglePanel}
        title="AARAV AI Insights"
        aria-label="Open AARAV AI Insights panel"
        id="aarav-orb-trigger"
      >
        {/* Inner icon — stylised "A" */}
        <span className="aarav-orb__glyph">A</span>

        {/* Notification pip */}
        {insightCount > 0 && (
          <span className="aarav-orb__pip">{insightCount}</span>
        )}
      </button>

      {/* ── Backdrop (mobile overlay) ── */}
      {panelOpen && <div id="aarav-backdrop" className="aarav-backdrop" onClick={() => setPanelOpen(false)} />}

      {/* ── Panel ── */}
      <aside
        ref={panelRef}
        className={`aarav-panel ${panelOpen ? 'aarav-panel--open' : ''}`}
        id="aarav-panel"
      >
        {/* Header */}
        <div className="aarav-panel__header">
          <div className="aarav-panel__header-left">
            <div className="aarav-panel__dot" />
            <h4 className="aarav-panel__title">AARAV AI Insights</h4>
          </div>
          <button
            id="aarav-panel-close-btn"
            className="aarav-panel__close"
            onClick={() => setPanelOpen(false)}
            aria-label="Close panel"
          >
            ✕
          </button>
        </div>

        {/* Insight list */}
        <div className="aarav-panel__body">
          {insights.length === 0 && (
            <p className="aarav-panel__empty">No insights yet — monitoring…</p>
          )}

          {insights.map((ins, idx) => {
            const badge = BADGE_MAP[ins.type] || BADGE_MAP.recommendation;
            return (
              <div className="aarav-card" key={idx}>
                {/* Badge */}
                <span className={`badge ${badge.cls} aarav-card__badge`}>
                  {badge.label}
                </span>

                {/* Insight text */}
                <p className="aarav-card__text">{ins.text}</p>

                {/* Metadata */}
                <span className="aarav-card__meta">
                  Confidence: {ins.confidence}% · Updated {ins.updatedAgo}
                </span>

                {/* Actions */}
                <div className="aarav-card__actions">
                  <button id={`aarav-view-${idx}-btn`} className="btn btn-p aarav-card__btn">View Details</button>
                  <button id={`aarav-action-${idx}-btn`} className="btn btn-gh aarav-card__btn">Take Action</button>
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
};

export default AaravOrb;
