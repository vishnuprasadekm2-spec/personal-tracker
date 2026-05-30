"use client";

import React, { useState, useEffect } from "react";
import { Task, Brand, RecurringTemplate } from "@/types";
import TaskItem from "./task-item";
import {
  createTask,
  getRecurringTemplates,
  deleteRecurringTemplate,
  updateTaskOrder
} from "@/lib/actions/tasks";

interface TaskListProps {
  activeBrand: Brand;
  date: string;
  tasks: Task[];
  onUpdate: () => void;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function TaskList({ activeBrand, date, tasks, onUpdate }: TaskListProps) {
  // Collapsed states
  const [secRecurCollapsed, setSecRecurCollapsed] = useState(false);
  const [secWeeklyCollapsed, setSecWeeklyCollapsed] = useState(false);
  const [secTodayCollapsed, setSecTodayCollapsed] = useState(false);

  // Modals
  const [showRecurModal, setShowRecurModal] = useState(false);
  const [showWeeklyModal, setShowWeeklyModal] = useState(false);

  // Template lists
  const [dailyTemplates, setDailyTemplates] = useState<RecurringTemplate[]>([]);
  const [weeklyTemplates, setWeeklyTemplates] = useState<RecurringTemplate[]>([]);

  // Add template fields
  const [newDailyText, setNewDailyText] = useState("");
  const [newWeeklyText, setNewWeeklyText] = useState("");
  const [selectedWeeklyDays, setSelectedWeeklyDays] = useState<string[]>([]);

  // Drag and drop state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);

  // Sync tasks when props change
  useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  // Load templates on modal open
  const loadDailyTemplates = async () => {
    try {
      const temps = await getRecurringTemplates(activeBrand.id);
      setDailyTemplates(temps.filter((t) => t.recurType === "daily"));
    } catch (err) {
      console.error(err);
    }
  };

  const loadWeeklyTemplates = async () => {
    try {
      const temps = await getRecurringTemplates(activeBrand.id);
      setWeeklyTemplates(temps.filter((t) => t.recurType === "weekly"));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (showRecurModal) loadDailyTemplates();
    else setDailyTemplates([]);
  }, [showRecurModal, activeBrand.id]);

  useEffect(() => {
    if (showWeeklyModal) loadWeeklyTemplates();
    else setWeeklyTemplates([]);
  }, [showWeeklyModal, activeBrand.id]);

  // ── ADD TEMPLATES ──
  const handleAddDailyTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDailyText.trim()) return;

    try {
      await createTask(activeBrand.id, newDailyText.trim(), date, "rec", "daily");
      setNewDailyText("");
      loadDailyTemplates();
      onUpdate();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddWeeklyTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWeeklyText.trim() || selectedWeeklyDays.length === 0) {
      alert("Please provide a name and select at least one weekday.");
      return;
    }

    try {
      await createTask(activeBrand.id, newWeeklyText.trim(), date, "rec", "weekly", selectedWeeklyDays);
      setNewWeeklyText("");
      setSelectedWeeklyDays([]);
      loadWeeklyTemplates();
      onUpdate();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTemplate = async (tempId: string, recurType: "daily" | "weekly") => {
    if (confirm("Delete this recurring task template? Existing tasks for today won't be deleted.")) {
      try {
        await deleteRecurringTemplate(tempId);
        if (recurType === "daily") await loadDailyTemplates();
        else await loadWeeklyTemplates();
        onUpdate();
      } catch (err) {
        console.error(err);
        alert("Failed to delete template: " + err);
      }
    }
  };

  const handleToggleWeeklyDay = (day: string) => {
    if (selectedWeeklyDays.includes(day)) {
      setSelectedWeeklyDays(selectedWeeklyDays.filter((d) => d !== day));
    } else {
      setSelectedWeeklyDays([...selectedWeeklyDays, day]);
    }
  };

  // ── DRAG AND DROP ──
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (draggingId === null || draggingId === targetId) return;

    // Rearrange locally for instantaneous feedback (Optimistic updates)
    const activeIndex = localTasks.findIndex((t) => t.id === draggingId);
    const overIndex = localTasks.findIndex((t) => t.id === targetId);

    if (activeIndex !== -1 && overIndex !== -1) {
      const nextTasks = [...localTasks];
      const [draggedItem] = nextTasks.splice(activeIndex, 1);
      nextTasks.splice(overIndex, 0, draggedItem);
      setLocalTasks(nextTasks);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDraggingId(null);
    try {
      const orderedIds = localTasks.map((t) => t.id);
      await updateTaskOrder(orderedIds);
      onUpdate();
    } catch (err) {
      console.error(err);
    }
  };

  // Divide current tasks for presentation
  const recurringDailyTasks = localTasks.filter((t) => t.recurType === "daily");
  const recurringWeeklyTasks = localTasks.filter((t) => t.recurType === "weekly");
  const standardTasks = localTasks.filter((t) => !t.recurType);

  return (
    <div>
      {/* 1. Recurring Daily Tasks Section */}
      <div className={`panel${secRecurCollapsed ? " sec-collapsed" : ""}`}>
        <div className="ph" onClick={() => setSecRecurCollapsed(!secRecurCollapsed)}>
          <div className="pt">
            🔁 Recurring Daily Tasks{" "}
            <span className="badge b-purple">{recurringDailyTasks.length}</span>
          </div>
          <div className="ph-right">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowRecurModal(true);
              }}
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--purple)",
                background: "var(--purple-s)",
                border: "none",
                borderRadius: "7px",
                padding: "5px 10px",
                cursor: "pointer",
                fontFamily: "inherit"
              }}
            >
              + Manage
            </button>
            <span className="sec-chevron">▾</span>
          </div>
        </div>
        {!secRecurCollapsed && (
          <div>
            {recurringDailyTasks.length === 0 ? (
              <div className="empty">
                <span className="em">🔁</span>No active daily recurring tasks.
              </div>
            ) : (
              recurringDailyTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  isDragging={draggingId === task.id}
                  onUpdate={onUpdate}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* 2. Weekly Recurring Tasks Section */}
      <div className={`panel${secWeeklyCollapsed ? " sec-collapsed" : ""}`}>
        <div className="ph" onClick={() => setSecWeeklyCollapsed(!secWeeklyCollapsed)}>
          <div className="pt">
            📅 Weekly Recurring Tasks{" "}
            <span className="badge b-accent">{recurringWeeklyTasks.length}</span>
          </div>
          <div className="ph-right">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowWeeklyModal(true);
              }}
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--accent)",
                background: "var(--accent-s)",
                border: "none",
                borderRadius: "7px",
                padding: "5px 10px",
                cursor: "pointer",
                fontFamily: "inherit"
              }}
            >
              + Manage
            </button>
            <span className="sec-chevron">▾</span>
          </div>
        </div>
        {!secWeeklyCollapsed && (
          <div>
            {recurringWeeklyTasks.length === 0 ? (
              <div className="empty">
                <span className="em">📅</span>No recurring tasks scheduled for today.
              </div>
            ) : (
              recurringWeeklyTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  isDragging={draggingId === task.id}
                  onUpdate={onUpdate}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* 3. One-off Tasks Section */}
      <div className={`panel${secTodayCollapsed ? " sec-collapsed" : ""}`}>
        <div className="ph" onClick={() => setSecTodayCollapsed(!secTodayCollapsed)}>
          <div className="pt">
            📋 One-off Tasks Today{" "}
            <span className="badge b-green">{standardTasks.length}</span>
          </div>
          <span className="sec-chevron">▾</span>
        </div>
        {!secTodayCollapsed && (
          <div>
            {standardTasks.length === 0 ? (
              <div className="empty">
                <span className="em">📋</span>Add one-off focus tasks to your list.
              </div>
            ) : (
              standardTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  isDragging={draggingId === task.id}
                  onUpdate={onUpdate}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* ── DAILY RECURRING MODAL ── */}
      {showRecurModal && (
        <div className="overlay" onClick={() => setShowRecurModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>🔁 Manage Daily Recurring Tasks</h2>
            <p style={{ marginBottom: "12px" }}>
              These tasks are automatically scheduled every day.
            </p>

            {/* List templates */}
            <div style={{ maxHeight: "200px", overflowY: "auto", marginBottom: "20px" }}>
              {dailyTemplates.length === 0 ? (
                <div style={{ fontSize: "13px", color: "var(--muted)", padding: "10px 0" }}>
                  No daily templates defined yet.
                </div>
              ) : (
                dailyTemplates.map((t) => (
                  <div key={t.id} className="manage-item">
                    <span style={{ fontSize: "14px", fontWeight: 600 }}>{t.text}</span>
                    <button
                      className="rem-btn"
                      onClick={() => handleDeleteTemplate(t.id, "daily")}
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Add template */}
            <form onSubmit={handleAddDailyTemplate} style={{ display: "flex", gap: "8px" }}>
              <input
                className="minput"
                type="text"
                placeholder="E.g. Check emails, Sync meeting"
                value={newDailyText}
                onChange={(e) => setNewDailyText(e.target.value)}
                style={{ marginBottom: 0 }}
                required
              />
              <button type="submit" className="mbtn confirm" style={{ flex: "none", width: "80px" }}>
                + Add
              </button>
            </form>
            <div className="mact" style={{ marginTop: "16px" }}>
              <button className="mbtn cancel" onClick={() => setShowRecurModal(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── WEEKLY RECURRING MODAL ── */}
      {showWeeklyModal && (
        <div className="overlay" onClick={() => setShowWeeklyModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>📅 Manage Weekly Recurring Tasks</h2>
            <p style={{ marginBottom: "12px" }}>
              These tasks are scheduled on specified days of the week.
            </p>

            {/* List templates */}
            <div style={{ maxHeight: "180px", overflowY: "auto", marginBottom: "20px" }}>
              {weeklyTemplates.length === 0 ? (
                <div style={{ fontSize: "13px", color: "var(--muted)", padding: "10px 0" }}>
                  No weekly templates defined yet.
                </div>
              ) : (
                weeklyTemplates.map((t) => {
                  let daysList: string[] = [];
                  try {
                    daysList = JSON.parse(t.recurDays);
                  } catch (e) {}
                  return (
                    <div key={t.id} className="manage-item" style={{ flexDirection: "column", alignItems: "flex-start", gap: "4px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                        <span style={{ fontSize: "14px", fontWeight: 600 }}>{t.text}</span>
                        <button
                          className="rem-btn"
                          onClick={() => handleDeleteTemplate(t.id, "weekly")}
                        >
                          Remove
                        </button>
                      </div>
                      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "2px" }}>
                        {daysList.map((d) => (
                          <span
                            key={d}
                            style={{
                              fontSize: "9px",
                              fontWeight: 700,
                              background: "var(--accent-s)",
                              color: "var(--accent)",
                              borderRadius: "99px",
                              padding: "1px 6px"
                            }}
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Add template */}
            <form onSubmit={handleAddWeeklyTemplate}>
              <input
                className="minput"
                type="text"
                placeholder="E.g. Code review, Weekly report"
                value={newWeeklyText}
                onChange={(e) => setNewWeeklyText(e.target.value)}
                required
              />

              {/* Day selection */}
              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "14px" }}>
                {WEEKDAYS.map((d) => {
                  const isSel = selectedWeeklyDays.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => handleToggleWeeklyDay(d)}
                      style={{
                        padding: "4px 8px",
                        fontSize: "11px",
                        fontWeight: 600,
                        border: "1.5px solid var(--border)",
                        borderRadius: "99px",
                        cursor: "pointer",
                        background: isSel ? "var(--accent)" : "#fff",
                        color: isSel ? "#fff" : "var(--text2)",
                        transition: "all .15s"
                      }}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  className="mbtn cancel"
                  onClick={() => setShowWeeklyModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="mbtn confirm">
                  Add Weekly
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
