"use client";

import React, { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Brand, Task, DailyFocus } from "@/types";
import Topbar from "@/components/topbar";
import BrandBar from "@/components/brand-bar";
import HeroCard from "@/components/hero-card";
import StatsGrid from "@/components/stats-grid";
import ProgressBar from "@/components/progress-bar";
import TaskList from "@/components/task-list";
import NotepadPanel from "@/components/notepad";
import HistoryPanel from "@/components/history-panel";
import { createTask } from "@/lib/actions/tasks";
import { getLocalDateString } from "@/lib/utils";

interface DashboardClientProps {
  initialBrands: Brand[];
  initialActiveBrand: Brand;
  initialDate: string;
  initialFocus: DailyFocus | null;
  initialTasks: Task[];
  initialPendingFromPast: number;
}

export default function DashboardClient({
  initialBrands,
  initialActiveBrand,
  initialDate,
  initialFocus,
  initialTasks,
  initialPendingFromPast
}: DashboardClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [activeBrand, setActiveBrand] = useState<Brand>(initialActiveBrand);
  const [currentDate, setCurrentDate] = useState<string>(initialDate);

  // Form states
  const [taskText, setTaskText] = useState("");
  const [taskType, setTaskType] = useState<"one" | "rec">("one");
  const [taskDate, setTaskDate] = useState(initialDate);

  // Sync local state when server props change (after router.refresh)
  useEffect(() => {
    setActiveBrand(initialActiveBrand);
  }, [initialActiveBrand]);

  useEffect(() => {
    setCurrentDate(initialDate);
    setTaskDate(initialDate);
  }, [initialDate]);

  const handleUpdate = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  const handleSwitchBrand = (brandId: string) => {
    const nextBrand = initialBrands.find((b) => b.id === brandId) || initialBrands[0];
    setActiveBrand(nextBrand);
    startTransition(() => {
      router.push(`/?brandId=${brandId}&date=${currentDate}`);
    });
  };

  const handleSwitchDate = (dateStr: string) => {
    setCurrentDate(dateStr);
    setTaskDate(dateStr);
    startTransition(() => {
      router.push(`/?brandId=${activeBrand.id}&date=${dateStr}`);
    });
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskText.trim()) return;

    // For one-off tasks, use the user-picked taskDate; for recurring (which is
    // always created as a daily template here), seed for the currently viewed date.
    const targetDate = taskType === "one" ? taskDate : currentDate;

    try {
      await createTask(
        activeBrand.id,
        taskText.trim(),
        targetDate,
        taskType,
        taskType === "rec" ? "daily" : undefined
      );
      setTaskText("");
      handleUpdate();
    } catch (err) {
      alert("Error adding task: " + err);
    }
  };

  // Stats calculation
  const total = initialTasks.length;
  const completed = initialTasks.filter((t) => t.isDone).length;
  const recurringCount = initialTasks.filter((t) => t.recurType).length;

  return (
    <>
      {/* Topbar Layout */}
      <Topbar activeBrand={activeBrand} date={currentDate} />

      {/* Brand Tabs Layout */}
      <BrandBar
        brands={initialBrands}
        activeBrand={activeBrand}
        onSwitchBrand={handleSwitchBrand}
      />

      <div className="main">
        {/* Intention Hero Card */}
        <HeroCard
          activeBrand={activeBrand}
          date={currentDate}
          focus={initialFocus}
          totalTasks={total}
          completedTasks={completed}
        />

        {/* Counters & Progress indicators */}
        <StatsGrid
          total={total}
          completed={completed}
          recurring={recurringCount}
          pendingFromPast={initialPendingFromPast}
        />

        <ProgressBar total={total} completed={completed} />

        {/* Content Columns layout */}
        <div className="cgrid">
          {/* Left list details */}
          <div>
            <TaskList
              activeBrand={activeBrand}
              date={currentDate}
              tasks={initialTasks}
              onUpdate={handleUpdate}
            />

            {/* Quick Notes tabbed panel */}
            <NotepadPanel activeBrand={activeBrand} />

            {/* Collapsible Daily Records panel */}
            <HistoryPanel
              activeBrand={activeBrand}
              todayDate={currentDate}
              onUpdate={handleUpdate}
            />
          </div>

          {/* Right sidebar details */}
          <div>
            {/* Add Task panel */}
            <div className="sp">
              <div className="sh2">✍️ Add Task</div>
              <form onSubmit={handleAddTask} className="addform">
                <textarea
                  className="ainput"
                  placeholder={
                    taskType === "rec"
                      ? "E.g. Morning workout, Check emails…"
                      : "What needs to get done today?"
                  }
                  rows={2}
                  value={taskText}
                  onChange={(e) => setTaskText(e.target.value)}
                  maxLength={250}
                  required
                />

                {/* Task Type toggles */}
                <div className="ttoggle">
                  <button
                    type="button"
                    className={`tbtn one${taskType === "one" ? " active" : ""}`}
                    onClick={() => setTaskType("one")}
                  >
                    🎯 One-off
                  </button>
                  <button
                    type="button"
                    className={`tbtn rec${taskType === "rec" ? " active" : ""}`}
                    onClick={() => setTaskType("rec")}
                  >
                    🔁 Recurring
                  </button>
                </div>

                {/* Datepicker for One-offs */}
                {taskType === "one" && (
                  <div className="date-row" style={{ marginTop: "6px" }}>
                    <label>Schedule Date:</label>
                    <input
                      type="date"
                      className="date-inp"
                      value={taskDate}
                      onChange={(e) => setTaskDate(e.target.value)}
                    />
                    {taskDate !== getLocalDateString() && (
                      <span className="date-future-badge">Scheduled</span>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  className={`abtn ${taskType}`}
                  style={{ marginTop: "6px" }}
                >
                  <span style={{ fontSize: "14px" }}>+</span>{" "}
                  {taskType === "rec" ? "Add Recurring" : "Add Task"}
                </button>
              </form>
            </div>

            {/* Calendar / Date Navigation */}
            <div className="sp" style={{ padding: "14px 18px" }}>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  color: "var(--text2)",
                  marginBottom: "8px"
                }}
              >
                📅 Navigate Tracker Date
              </div>
              <input
                type="date"
                className="date-inp"
                style={{ width: "100%" }}
                value={currentDate}
                onChange={(e) => handleSwitchDate(e.target.value)}
              />
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--muted)",
                  marginTop: "6px",
                  textAlign: "center"
                }}
              >
                Change date to inspect or schedule tasks on past/future days.
              </div>
            </div>

            {/* Quick Tips statistics panel */}
            <div className="sp" style={{ padding: "14px 18px" }}>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  color: "var(--text2)",
                  marginBottom: "6px"
                }}
              >
                💡 Tracker Tips
              </div>
              <div style={{ fontSize: "12px", color: "var(--text2)", lineHeight: "1.6" }}>
                <p style={{ marginBottom: "6px" }}>
                  • Use **Brands** to keep side-gigs and life isolated.
                </p>
                <p style={{ marginBottom: "6px" }}>
                  • Check off tasks to watch the progress track grow.
                </p>
                <p>• Notepad notes auto-save in the background as you type.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
