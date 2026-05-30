"use client";

import React, { useState, useEffect } from "react";
import { Brand, DailyFocus } from "@/types";
import { saveFocusHeading, saveFocusNote } from "@/lib/actions/focus";

interface HeroCardProps {
  activeBrand: Brand;
  date: string;
  focus: DailyFocus | null;
  totalTasks: number;
  completedTasks: number;
}

export default function HeroCard({
  activeBrand,
  date,
  focus,
  totalTasks,
  completedTasks
}: HeroCardProps) {
  const [heading, setHeading] = useState(focus?.heading || "Daily Focus");
  const [note, setNote] = useState(focus?.note || "");
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Sync state if focus changes
  useEffect(() => {
    setHeading(focus?.heading || "Daily Focus");
    setNote(focus?.note || "");
  }, [focus]);

  const handleBlurHeading = async (e: React.FocusEvent<HTMLDivElement>) => {
    const text = e.currentTarget.innerText.trim();
    const finalHeading = text || "Daily Focus";
    setHeading(finalHeading);
    try {
      await saveFocusHeading(activeBrand.id, date, finalHeading);
    } catch (err) {
      console.error(err);
    }
  };

  const handleBlurNote = async () => {
    setIsSavingNote(true);
    try {
      await saveFocusNote(activeBrand.id, date, note);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingNote(false);
    }
  };

  const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="hero-card">
      <div className="hero-top">
        <div>
          <div className="hero-date">Focus of the Day</div>
          <div className="hero-heading-wrap">
            <div
              className="hero-heading"
              contentEditable
              suppressContentEditableWarning
              spellCheck={false}
              data-ph="My Daily Focus"
              onBlur={handleBlurHeading}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
            >
              {heading}
            </div>
          </div>
          <div className="edit-hint">Click text to edit heading</div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: "28px", fontWeight: 800, lineHeight: 1 }}>
            {completedTasks}/{totalTasks}
          </div>
          <div style={{ fontSize: "11px", fontWeight: 600, opacity: 0.8, marginTop: "4px" }}>
            Tasks Done ({pct}%)
          </div>
        </div>
      </div>

      <div className="hero-note-area">
        <div className="hero-note-label">
          📝 Daily Note {isSavingNote && <span style={{ opacity: 0.6, fontSize: "10px" }}>(Saving...)</span>}
        </div>
        <textarea
          className="hero-note"
          rows={2}
          placeholder="Set your intention for the day, jot down thoughts, or anything on your mind…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={handleBlurNote}
        />
      </div>
    </div>
  );
}
