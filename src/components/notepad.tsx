"use client";

import React, { useState, useEffect, useRef } from "react";
import { Brand, NotepadTab } from "@/types";
import {
  getNotepadTabs,
  createNotepadTab,
  updateNotepadTab,
  deleteNotepadTab,
  getNotepadHistoryDates,
  getNotepadHistoryByDate,
  restoreNotepadHistoryDay,
  deleteNotepadHistoryDay
} from "@/lib/actions/notepad";

interface NotepadPanelProps {
  activeBrand: Brand;
}

const SWATCHES = [
  "#111827", // charcoal
  "#6b7280", // gray
  "#3b82f6", // blue
  "#10b981", // green
  "#f59e0b", // yellow
  "#ef4444", // red
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#ffffff"  // white
];

export default function NotepadPanel({ activeBrand }: NotepadPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [tabs, setTabs] = useState<NotepadTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // Formatting colors picker
  const [showFgPicker, setShowFgPicker] = useState(false);
  const [showHlPicker, setShowHlPicker] = useState(false);

  // History panel
  const [showHistory, setShowHistory] = useState(false);
  const [historyDates, setHistoryDates] = useState<string[]>([]);
  const [historyNotes, setHistoryNotes] = useState<{ [date: string]: NotepadTab[] }>({});

  const [wordCount, setWordCount] = useState(0);
  const [saveStatus, setSaveStatus] = useState("Auto-saved");

  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  // ── LOAD TABS ──
  const loadTabs = async () => {
    try {
      const activeTabs = await getNotepadTabs(activeBrand.id);
      setTabs(activeTabs);
      if (activeTabs.length > 0) {
        // Retain selection if valid, else select first
        if (!activeTabId || !activeTabs.some((t) => t.id === activeTabId)) {
          setActiveTabId(activeTabs[0].id);
        }
      } else {
        setActiveTabId(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadTabs();
    if (showHistory) loadHistory();
  }, [activeBrand]);

  // Load editor content when tab changes
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = activeTab?.content || "";
      updateWordCount();
    }
  }, [activeTabId]);

  // ── AUTOSAVE TRIGGER ──
  const handleEditorInput = () => {
    updateWordCount();
    setSaveStatus("Saving...");

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(async () => {
      if (!activeTabId || !editorRef.current) return;
      const title = activeTab?.title || "Today's Notes";
      const content = editorRef.current.innerHTML;

      try {
        await updateNotepadTab(activeTabId, title, content);
        setTabs(tabs.map((t) => (t.id === activeTabId ? { ...t, content } : t)));
        setSaveStatus("Auto-saved");
      } catch (err) {
        console.error(err);
        setSaveStatus("Error saving");
      }
    }, 1500); // 1.5 second debounce delay
  };

  const updateWordCount = () => {
    if (!editorRef.current) return;
    const text = editorRef.current.innerText || "";
    const cleanText = text.trim();
    if (!cleanText) setWordCount(0);
    else setWordCount(cleanText.split(/\s+/).length);
  };

  // ── ADD TAB ──
  const handleAddTab = async () => {
    try {
      const tab = await createNotepadTab(activeBrand.id, "New Tab");
      await loadTabs();
      setActiveTabId(tab.id);
    } catch (err) {
      console.error(err);
    }
  };

  // ── RENAME TAB ──
  const handleRenameTab = async (tabId: string, newTitle: string) => {
    const finalTitle = newTitle.trim() || "Notes";
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;

    try {
      await updateNotepadTab(tabId, finalTitle, tab.content);
      setTabs(tabs.map((t) => (t.id === tabId ? { ...t, title: finalTitle } : t)));
    } catch (err) {
      console.error(err);
    }
  };

  // ── DELETE TAB ──
  const handleDeleteTab = async () => {
    if (!activeTabId) return;
    if (confirm("Permanently delete this notepad tab?")) {
      try {
        await deleteNotepadTab(activeTabId);
        await loadTabs();
      } catch (err) {
        console.error(err);
      }
    }
  };

  // ── FORMATTING HANDLERS ──
  const format = (cmd: string, val = "") => {
    document.execCommand(cmd, false, val);
    if (editorRef.current) handleEditorInput();
  };

  const npInsertQuote = () => {
    format("formatBlock", "blockquote");
  };

  const npInsertCode = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const code = document.createElement("code");
    code.textContent = range.toString() || "code";
    range.deleteContents();
    range.insertNode(code);
    if (editorRef.current) handleEditorInput();
  };

  // ── HISTORY STUFF ──
  const loadHistory = async () => {
    try {
      const dates = await getNotepadHistoryDates(activeBrand.id);
      setHistoryDates(dates);

      const notesMap: { [date: string]: NotepadTab[] } = {};
      for (const d of dates) {
        const histTabs = await getNotepadHistoryByDate(activeBrand.id, d);
        notesMap[d] = histTabs;
      }
      setHistoryNotes(notesMap);
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleHistory = () => {
    const nextVal = !showHistory;
    setShowHistory(nextVal);
    if (nextVal) loadHistory();
  };

  const handleRestoreDay = async (date: string) => {
    try {
      await restoreNotepadHistoryDay(activeBrand.id, date);
      setShowHistory(false);
      await loadTabs();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteHistoryDay = async (date: string) => {
    if (confirm(`Remove archived notes for ${date}?`)) {
      try {
        await deleteNotepadHistoryDay(activeBrand.id, date);
        await loadHistory();
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="notepad-panel" id="notepadPanel">
      <div className="notepad-header">
        <div className="notepad-title" onClick={() => setIsCollapsed(!isCollapsed)}>
          📓 <span>Quick Notes</span>
          <span className="badge b-accent">{tabs.length}</span>
        </div>
        <button className="notepad-toggle-btn" onClick={() => setIsCollapsed(!isCollapsed)}>
          <span className="np-arrow">{isCollapsed ? "▾" : "▴"}</span>
          <span>{isCollapsed ? "Expand" : "Collapse"}</span>
        </button>
      </div>

      {!isCollapsed && (
        <div className="notepad-body">
          {/* Tabs header */}
          <div className="notepad-tabs">
            {tabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              return (
                <div
                  key={tab.id}
                  className={`np-tab${isActive ? " active" : ""}`}
                  onClick={() => setActiveTabId(tab.id)}
                >
                  <span
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => handleRenameTab(tab.id, e.currentTarget.innerText)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.currentTarget.blur();
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    style={{ outline: "none", cursor: "text" }}
                  >
                    {tab.title}
                  </span>
                </div>
              );
            })}
            <button className="np-tab-add" onClick={handleAddTab}>
              +
            </button>
          </div>

          {/* Editor Toolbar */}
          <div className="np-toolbar">
            <select
              className="np-select"
              title="Font size"
              onChange={(e) => {
                format("fontSize", e.target.value);
                e.target.value = "";
              }}
            >
              <option value="">Size</option>
              <option value="1">Small</option>
              <option value="3">Normal</option>
              <option value="4">Large</option>
              <option value="5">Heading</option>
            </select>
            <div className="nfmt-sep" />

            <button className="nfmt" onClick={() => format("bold")} title="Bold">
              <b>B</b>
            </button>
            <button className="nfmt" onClick={() => format("italic")} title="Italic">
              <i>I</i>
            </button>
            <button className="nfmt" onClick={() => format("underline")} title="Underline">
              <u>U</u>
            </button>
            <button className="nfmt" onClick={() => format("strikeThrough")} title="Strikethrough">
              <s>S</s>
            </button>
            <div className="nfmt-sep" />

            {/* ForeColor Picker */}
            <div className="np-color-wrap">
              <button
                className="nfmt np-color-btn"
                onClick={() => {
                  setShowFgPicker(!showFgPicker);
                  setShowHlPicker(false);
                }}
                title="Text Color"
              >
                <b>A</b>
                <div className="np-color-indicator" style={{ background: "#111827" }} />
              </button>
              {showFgPicker && (
                <div className="np-color-picker">
                  <div className="np-cp-label">Text Color</div>
                  <div className="np-swatches">
                    {SWATCHES.map((color) => (
                      <div
                        key={color}
                        className="np-swatch"
                        style={{ background: color }}
                        onClick={() => {
                          format("foreColor", color);
                          setShowFgPicker(false);
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* BackColor (Highlight) Picker */}
            <div className="np-color-wrap">
              <button
                className="nfmt np-color-btn"
                onClick={() => {
                  setShowHlPicker(!showHlPicker);
                  setShowFgPicker(false);
                }}
                title="Highlight Color"
              >
                🖍
                <div className="np-color-indicator" style={{ background: "#fef08a" }} />
              </button>
              {showHlPicker && (
                <div className="np-color-picker">
                  <div className="np-cp-label">Highlight Color</div>
                  <div className="np-swatches">
                    {SWATCHES.map((color) => (
                      <div
                        key={color}
                        className="np-swatch"
                        style={{ background: color }}
                        onClick={() => {
                          format("hiliteColor", color);
                          setShowHlPicker(false);
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="nfmt-sep" />

            {/* Alignments */}
            <button className="nfmt" onClick={() => format("justifyLeft")} title="Align Left">
              ≡◀
            </button>
            <button className="nfmt" onClick={() => format("justifyCenter")} title="Align Center">
              ≡◆
            </button>
            <button className="nfmt" onClick={() => format("justifyRight")} title="Align Right">
              ≡▶
            </button>
            <div className="nfmt-sep" />

            {/* Lists */}
            <button className="nfmt" onClick={() => format("insertUnorderedList")} title="Bullet List">
              •≡
            </button>
            <button className="nfmt" onClick={() => format("insertOrderedList")} title="Ordered List">
              1≡
            </button>
            <button className="nfmt" onClick={() => format("indent")} title="Indent">
              →≡
            </button>
            <button className="nfmt" onClick={() => format("outdent")} title="Outdent">
              ←≡
            </button>
            <div className="nfmt-sep" />

            <button className="nfmt" onClick={npInsertQuote} title="Quote Block">
              ❝
            </button>
            <button className="nfmt" onClick={npInsertCode} title="Inline Code">
              &lt;/&gt;
            </button>
            <button className="nfmt" onClick={() => format("removeFormat")} title="Clear Formatting">
              ✕
            </button>
            <div className="nfmt-sep" />

            <button
              className="np-ts-btn"
              onClick={() => {
                const ts = `[${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}] `;
                format("insertText", ts);
              }}
            >
              ⏰ Time
            </button>
            <span className="np-wc">{wordCount} words</span>
          </div>

          {/* Content Editable Area */}
          {activeTabId ? (
            <div
              className="np-editor"
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={handleEditorInput}
              data-ph="Jot anything down — meeting notes, ideas, reminders..."
            />
          ) : (
            <div className="empty" style={{ padding: "40px 18px" }}>
              <span className="em">📓</span>Create or select a note tab to get started.
            </div>
          )}

          {/* Footer controls */}
          <div className="np-footer">
            <span className="np-footer-lbl">{saveStatus}</span>
            <div className="np-footer-actions">
              <button className="np-hist-btn" onClick={handleToggleHistory}>
                {showHistory ? "✕ Close History" : "📅 Past Notes"}
              </button>
              {activeTabId && (
                <button className="np-del-tab" onClick={handleDeleteTab}>
                  🗑 Delete Note
                </button>
              )}
            </div>
          </div>

          {/* Historical archived notes sub-panel */}
          {showHistory && (
            <div className="np-hist-panel" id="npHistPanel">
              <div className="np-hist-inner">
                {historyDates.length === 0 ? (
                  <div style={{ fontSize: "13px", color: "var(--muted)", textAlign: "center", padding: "16px 0" }}>
                    No past notes archived yet. Previous days' notes appear here automatically.
                  </div>
                ) : (
                  historyDates.map((d) => {
                    const hTabs = historyNotes[d] || [];
                    return (
                      <div key={d} className="np-hist-day">
                        <div className="np-hist-day-hdr">
                          <span>📅 {d}</span>
                          <div style={{ display: "flex", gap: "6px" }}>
                            <button
                              className="np-hist-restore"
                              onClick={() => handleRestoreDay(d)}
                              title="Restore notes to active tabs"
                            >
                              ↩ Restore
                            </button>
                            <button
                              className="np-hist-del"
                              onClick={() => handleDeleteHistoryDay(d)}
                            >
                              ✕ Remove
                            </button>
                          </div>
                        </div>
                        {hTabs.map((ht) => (
                          <div key={ht.id} className="np-hist-tab-card">
                            <div className="np-hist-tab-title">📝 {ht.title}</div>
                            <div
                              className="np-hist-tab-body"
                              dangerouslySetInnerHTML={{ __html: ht.content || "<em>Empty</em>" }}
                            />
                          </div>
                        ))}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
