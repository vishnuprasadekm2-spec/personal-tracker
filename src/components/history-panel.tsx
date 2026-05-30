"use client";

import React, { useState, useEffect } from "react";
import { Brand, Task } from "@/types";
import { getHistoryDates, getHistoryDetailsByDate } from "@/lib/actions/history";
import { carryTaskToToday } from "@/lib/actions/tasks";
import { fmtDate } from "@/lib/utils";

interface HistoryPanelProps {
  activeBrand: Brand;
  todayDate: string;
  onUpdate: () => void;
}

export default function HistoryPanel({ activeBrand, todayDate, onUpdate }: HistoryPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [pastDates, setPastDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedFocus, setSelectedFocus] = useState<{ heading: string; note: string } | null>(null);
  const [selectedTasks, setSelectedTasks] = useState<Task[]>([]);

  const loadHistoryList = async () => {
    try {
      const dates = await getHistoryDates(activeBrand.id, todayDate);
      setPastDates(dates);
      if (dates.length > 0 && !selectedDate) {
        setSelectedDate(dates[0]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadDateDetails = async (date: string) => {
    if (!date) return;
    try {
      const { focus, tasks } = await getHistoryDetailsByDate(activeBrand.id, date);
      setSelectedFocus(focus ? { heading: focus.heading, note: focus.note } : null);
      setSelectedTasks(tasks);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadHistoryList();
  }, [activeBrand, todayDate]);

  useEffect(() => {
    if (selectedDate) loadDateDetails(selectedDate);
  }, [selectedDate, activeBrand]);

  const handleCarryForward = async (taskId: string) => {
    try {
      await carryTaskToToday(taskId, todayDate);
      // Reload current day and history list
      loadHistoryList();
      if (selectedDate) loadDateDetails(selectedDate);
      onUpdate();
    } catch (err) {
      console.error(err);
    }
  };

  const completed = selectedTasks.filter((t) => t.isDone).length;
  const total = selectedTasks.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="hist-panel" id="histPanel">
      <div className="hist-header" onClick={() => setIsCollapsed(!isCollapsed)}>
        <div className="hist-title">
          📅 Daily Records
          <span className="badge b-green">{pastDates.length} days</span>
        </div>
        <button
          style={{
            fontSize: "11px",
            fontWeight: 600,
            color: "var(--text2)",
            background: "var(--surface2)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            padding: "3px 10px",
            cursor: "pointer",
            fontFamily: "inherit",
            display: "flex",
            alignItems: "center",
            gap: "4px"
          }}
          onClick={(e) => {
            e.stopPropagation();
            setIsCollapsed(!isCollapsed);
          }}
        >
          <span style={{ transform: isCollapsed ? "rotate(0deg)" : "rotate(180deg)", transition: "transform .22s" }}>
            ▾
          </span>
          <span>{isCollapsed ? "Expand" : "Collapse"}</span>
        </button>
      </div>

      {!isCollapsed && (
        <div className="hist-body">
          {/* Controls */}
          <div className="hist-controls">
            <input
              type="date"
              className="hist-date-inp"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              title="Pick a date"
            />
            <div className="hist-date-chips">
              {pastDates.slice(0, 5).map((d) => (
                <button
                  key={d}
                  className={`hist-chip${d === selectedDate ? " active" : ""}`}
                  onClick={() => setSelectedDate(d)}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Details Content */}
          {selectedDate ? (
            <div className="hist-content">
              <div className="hist-day-header">
                <div className="hist-day-title">
                  {selectedFocus?.heading || "Daily Focus"}
                </div>
                <div className="hist-day-meta">{fmtDate(selectedDate)}</div>
              </div>

              {selectedFocus?.note && (
                <div className="hist-note-box">
                  {selectedFocus.note}
                </div>
              )}

              {/* Stats Summary */}
              <div className="hist-summary">
                <span className="hist-pill b-green">Completed: {completed}</span>
                <span className="hist-pill b-amber">Pending: {total - completed}</span>
                <span className="hist-pill b-accent">Success Rate: {pct}%</span>
              </div>

              {/* Tasks List */}
              <div style={{ marginTop: "14px" }}>
                {selectedTasks.length === 0 ? (
                  <div style={{ padding: "16px 0", color: "var(--muted)", fontSize: "13px", textAlign: "center" }}>
                    No tasks recorded on this day.
                  </div>
                ) : (
                  selectedTasks.map((t) => (
                    <div key={t.id} className="hist-task-row">
                      <span className="hist-task-icon">{t.isDone ? "✅" : "⏳"}</span>
                      <div className="hist-task-body">
                        <div className={`hist-task-text${t.isDone ? " done" : ""}`}>
                          {t.text}
                        </div>
                        {t.note && <div className="hist-task-note">{t.note}</div>}
                      </div>
                      {!t.isDone && (
                        <button
                          className="carry-btn"
                          onClick={() => handleCarryForward(t.id)}
                        >
                          Carry Forward
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="hist-empty">
              <span className="em">📅</span>
              No historical data loaded yet. Check back once you have days completed!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
