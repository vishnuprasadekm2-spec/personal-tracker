import React from "react";

interface ProgressBarProps {
  total: number;
  completed: number;
}

export default function ProgressBar({ total, completed }: ProgressBarProps) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  let message = "Add your first task to get started.";
  if (total > 0) {
    if (pct === 100) {
      message = "🎉 Amazing! You've completed all tasks for today!";
    } else if (pct >= 75) {
      message = "🚀 Almost there! Just a couple of tasks left.";
    } else if (pct >= 40) {
      message = "💪 Great progress! Keep it up!";
    } else if (pct > 0) {
      message = "👍 Good start! Let's cross off some more tasks.";
    } else {
      message = "⏳ Ready to start? Tick off tasks as you complete them.";
    }
  }

  return (
    <div className="prog-card">
      <div className="prog-head">
        <h3>Today's Progress</h3>
        <span className="prog-pct">{pct}%</span>
      </div>
      <div className="prog-track">
        <div className="prog-fill" style={{ width: `${pct}%` }}></div>
      </div>
      <div className="prog-sub">{message}</div>
    </div>
  );
}
