"use client";

import React, { useState } from "react";
import { Task, Subtask } from "@/types";
import {
  toggleTask,
  updateTaskText,
  updateTaskNote,
  deleteTask,
  createSubtask,
  toggleSubtask,
  deleteSubtask
} from "@/lib/actions/tasks";

interface TaskItemProps {
  task: Task;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDrop: (e: React.DragEvent, id: string) => void;
  isDragging: boolean;
  onUpdate: () => void;
}

export default function TaskItem({
  task,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging,
  onUpdate
}: TaskItemProps) {
  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [isEditingText, setIsEditingText] = useState(false);
  const [taskText, setTaskText] = useState(task.text);
  const [taskNote, setTaskNote] = useState(task.note);
  const [newSubtaskText, setNewSubtaskText] = useState("");

  const handleToggle = async () => {
    try {
      await toggleTask(task.id, !task.isDone);
      onUpdate();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveText = async () => {
    if (!taskText.trim()) return;
    try {
      await updateTaskText(task.id, taskText.trim());
      setIsEditingText(false);
      onUpdate();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveNote = async () => {
    try {
      await updateTaskNote(task.id, taskNote);
      setShowNoteEditor(false);
      onUpdate();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (confirm("Delete this task?")) {
      try {
        await deleteTask(task.id);
        onUpdate();
      } catch (err) {
        console.error(err);
        alert("Failed to delete task: " + err);
        onUpdate(); // refresh to recover from stale state
      }
    }
  };

  // ── SUBTASK ACTIONS ──
  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskText.trim()) return;
    try {
      await createSubtask(task.id, newSubtaskText.trim());
      setNewSubtaskText("");
      onUpdate();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleSub = async (subId: string, done: boolean) => {
    try {
      await toggleSubtask(subId, done);
      onUpdate();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSub = async (subId: string) => {
    try {
      await deleteSubtask(subId);
      onUpdate();
    } catch (err) {
      console.error(err);
    }
  };

  const subtasks = task.subtasks || [];
  const subDone = subtasks.filter((s) => s.done).length;
  const subTotal = subtasks.length;
  const hasSubtasks = subTotal > 0;

  return (
    <div
      className={`ti${task.isDone ? " done" : ""}${task.recurType ? " recur" : ""}${isDragging ? " dragging" : ""}`}
      onDragOver={(e) => onDragOver(e, task.id)}
      onDrop={(e) => onDrop(e, task.id)}
    >
      <div className="ti-row">
        {/* Drag Handle */}
        <div
          className="drag-handle"
          draggable
          onDragStart={(e) => onDragStart(e, task.id)}
        >
          ⋮⋮
        </div>

        {/* Checkbox */}
        <div className="chk" onClick={handleToggle}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M2 6l3 3 5-6"
              stroke="#fff"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Task Body / Text */}
        <div className="tbody">
          {isEditingText ? (
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <input
                type="text"
                className="task-edit-input"
                value={taskText}
                onChange={(e) => setTaskText(e.target.value)}
                autoFocus
              />
              <div className="task-edit-actions">
                <button className="task-edit-save" onClick={handleSaveText}>
                  Save
                </button>
                <button
                  className="task-edit-cancel"
                  onClick={() => {
                    setTaskText(task.text);
                    setIsEditingText(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <span className="tt">{task.text}</span>
              {task.recurType && (
                <div className="rtag">
                  🔁 {task.recurType === "daily" ? "Daily" : "Weekly"}
                </div>
              )}
              {hasSubtasks && (
                <div>
                  <span className={`sub-progress${subDone === subTotal ? " done-all" : ""}`}>
                    {subDone === subTotal ? "✅ " : "⬜ "}
                    {subDone}/{subTotal} subtasks
                  </span>
                </div>
              )}
              {task.note && <div className="tnote">{task.note}</div>}
            </>
          )}
        </div>

        {/* Hover Action Toolbar */}
        <div className="tact">
          <button
            className="ib note-btn"
            onClick={() => setShowNoteEditor(!showNoteEditor)}
            title="Task Notes"
            style={showNoteEditor ? { background: "var(--accent-s)", color: "var(--accent)" } : {}}
          >
            📝
          </button>
          <button
            className="ib edit-btn"
            onClick={() => setIsEditingText(!isEditingText)}
            title="Edit Task"
            style={isEditingText ? { background: "var(--amber-s)", color: "var(--amber)" } : {}}
          >
            ✏️
          </button>
          <button
            className="ib sub-btn"
            onClick={() => setShowSubtasks(!showSubtasks)}
            title="Subtasks"
            style={showSubtasks ? { background: "var(--purple-s)", color: "var(--purple)" } : {}}
          >
            📥
          </button>
          <button className="ib del-btn" onClick={handleDelete} title="Delete Task">
            🗑
          </button>
        </div>
      </div>

      {/* Task Notes Editor Collapsible */}
      {showNoteEditor && (
        <div className="note-editor-wrap">
          <textarea
            className="note-editor"
            rows={2}
            value={taskNote}
            onChange={(e) => setTaskNote(e.target.value)}
            placeholder="Add detailed task notes here..."
          />
          <button className="note-save-btn" onClick={handleSaveNote}>
            Save Note
          </button>
        </div>
      )}

      {/* Subtasks Panel Collapsible */}
      {showSubtasks && (
        <div className="subtask-wrap">
          <div className="subtask-list">
            {subtasks.length === 0 ? (
              <div style={{ fontSize: "12px", color: "var(--muted)", padding: "4px 0 8px" }}>
                No subtasks yet.
              </div>
            ) : (
              subtasks.map((s) => (
                <div key={s.id} className={`subtask-item${s.done ? " sub-done" : ""}`}>
                  <div className="sub-chk" onClick={() => handleToggleSub(s.id, !s.done)}>
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                      <path
                        d="M2 6l3 3 5-6"
                        stroke="#fff"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <span className="sub-text">{s.text}</span>
                  <button className="sub-del" onClick={() => handleDeleteSub(s.id)}>
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
          <form className="subtask-add-row" onSubmit={handleAddSubtask}>
            <input
              type="text"
              className="sub-inp"
              placeholder="Add a subtask..."
              value={newSubtaskText}
              onChange={(e) => setNewSubtaskText(e.target.value)}
              maxLength={200}
              required
            />
            <button type="submit" className="sub-add-btn">
              + Add
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
