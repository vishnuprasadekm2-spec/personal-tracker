"use client";

import React, { useState } from "react";
import { Brand } from "@/types";
import { createBrand, deleteBrand } from "@/lib/actions/brands";

interface BrandBarProps {
  brands: Brand[];
  activeBrand: Brand;
  onSwitchBrand: (brandId: string) => void;
}

const BRAND_EMOJIS = ["🏠", "💼", "🚀", "🌟", "🎯", "💡", "🏢", "🎨", "🛒", "📊", "🌿", "🔥", "💻", "🎓", "🏆", "⚡", "🌈", "🎪", "🎭", "🦁"];
const BRAND_COLORS = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#3b82f6",
  "#84cc16",
  "#f97316",
  "#14b8a6",
  "#a855f7",
  "#0ea5e9",
  "#d946ef",
  "#e11d48",
  "#65a30d"
];

export default function BrandBar({ brands, activeBrand, onSwitchBrand }: BrandBarProps) {
  const [showModal, setShowModal] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState("🏠");
  const [selectedColor, setSelectedColor] = useState("#6366f1");

  const handleAddBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrandName.trim()) return;

    try {
      await createBrand(newBrandName.trim(), selectedEmoji, selectedColor);
      setNewBrandName("");
      setShowModal(false);
    } catch (err) {
      alert("Error adding brand: " + err);
    }
  };

  const handleDeleteBrand = async (brandId: string, name: string) => {
    if (confirm(`Are you sure you want to delete brand "${name}"? This will delete all its tasks.`)) {
      try {
        await deleteBrand(brandId);
        if (activeBrand.id === brandId) {
          onSwitchBrand("default");
        }
      } catch (err) {
        alert("Error deleting brand: " + err);
      }
    }
  };

  return (
    <>
      <div className="brand-bar" id="brandBar">
        {brands.map((b) => {
          const isActive = b.id === activeBrand.id;
          const activeStyle = isActive ? { background: b.color, borderColor: b.color } : {};
          return (
            <button
              key={b.id}
              className={`brand-pill${isActive ? " active" : ""}`}
              style={activeStyle}
              onClick={() => onSwitchBrand(b.id)}
            >
              <span>{b.emoji}</span> <span>{b.name}</span>
            </button>
          );
        })}
        <div className="brand-bar-sep"></div>
        <button className="brand-add-btn" onClick={() => setShowModal(true)}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path
              d="M5.5 1v9M1 5.5h9"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          Add Brand
        </button>
      </div>

      {showModal && (
        <div className="overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: "450px" }}>
            <h2>🏢 Manage Brands</h2>
            <p>Switch or create brand workspaces to isolate tasks.</p>

            {/* List existing brands */}
            <div style={{ maxHeight: "150px", overflowY: "auto", marginBottom: "20px" }}>
              {brands.map((b) => (
                <div
                  key={b.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "9px 0",
                    borderBottom: "1px solid var(--border)"
                  }}
                >
                  <div
                    style={{
                      width: "16px",
                      height: "16px",
                      borderRadius: "50%",
                      background: b.color
                    }}
                  />
                  <span>{b.emoji}</span>
                  <span style={{ flex: 1, fontSize: "14px", fontWeight: 600 }}>{b.name}</span>
                  {b.isDefault ? (
                    <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>
                      Default
                    </span>
                  ) : (
                    <button
                      className="rem-btn"
                      onClick={() => handleDeleteBrand(b.id, b.name)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Create brand form */}
            <form onSubmit={handleAddBrand}>
              <input
                className="minput"
                type="text"
                placeholder="Brand Name (e.g. Work, Side Projects)"
                value={newBrandName}
                onChange={(e) => setNewBrandName(e.target.value)}
                maxLength={40}
                required
              />

              {/* Emoji Picker */}
              <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text2)", marginBottom: "6px" }}>
                Select Emoji
              </div>
              <div className="brand-emoji-pick">
                {BRAND_EMOJIS.map((e) => (
                  <div
                    key={e}
                    className={`brand-emoji-opt${e === selectedEmoji ? " sel" : ""}`}
                    onClick={() => setSelectedEmoji(e)}
                  >
                    {e}
                  </div>
                ))}
              </div>

              {/* Color Picker */}
              <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text2)", marginBottom: "6px", marginTop: "12px" }}>
                Select Color
              </div>
              <div className="brand-color-pick">
                {BRAND_COLORS.map((c) => (
                  <div
                    key={c}
                    className={`brand-color-opt${c === selectedColor ? " sel" : ""}`}
                    style={{ background: c }}
                    onClick={() => setSelectedColor(c)}
                  />
                ))}
              </div>

              <div className="mact" style={{ marginTop: "16px" }}>
                <button type="button" className="mbtn cancel" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="mbtn confirm">
                  Create Brand
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
