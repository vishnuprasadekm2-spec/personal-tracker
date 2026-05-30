import React from "react";

interface StatsGridProps {
  total: number;
  completed: number;
  recurring: number;
  pendingFromPast: number;
}

export default function StatsGrid({
  total,
  completed,
  recurring,
  pendingFromPast
}: StatsGridProps) {
  return (
    <div className="stats-grid">
      <div className="stat-card">
        <div className="stat-icon" style={{ background: "var(--accent-s)" }}>📋</div>
        <div>
          <div className="stat-val">{total}</div>
          <div className="stat-lbl">Total Today</div>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-icon" style={{ background: "var(--green-s)" }}>✅</div>
        <div>
          <div className="stat-val">{completed}</div>
          <div className="stat-lbl">Completed</div>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-icon" style={{ background: "var(--purple-s)" }}>🔁</div>
        <div>
          <div className="stat-val">{recurring}</div>
          <div className="stat-lbl">Recurring</div>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-icon" style={{ background: "var(--amber-s)" }}>⏳</div>
        <div>
          <div className="stat-val">{pendingFromPast}</div>
          <div className="stat-lbl">Pending Past</div>
        </div>
      </div>
    </div>
  );
}
