"use client";

import React from "react";
import { fmtDate } from "@/lib/utils";
import { Brand } from "@/types";

interface TopbarProps {
  activeBrand: Brand;
  date: string;
}

export default function Topbar({ activeBrand, date }: TopbarProps) {
  const downloadReport = async () => {
    try {
      const res = await fetch(`/api/report?brandId=${activeBrand.id}&date=${date}`);
      if (!res.ok) throw new Error("Failed to download report");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `daily-report-${activeBrand.name.toLowerCase()}-${date}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Error generating report: " + err);
    }
  };

  return (
    <div className="topbar">
      <div className="tb-left">
        <div className="tb-logo">✅</div>
        <span className="tb-title">TaskBoard</span>
        <span
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: "var(--text2)",
            background: "var(--surface2)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            padding: "2px 9px"
          }}
        >
          {activeBrand.emoji} {activeBrand.name}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div className="tb-date">{fmtDate(date)}</div>
        <button
          onClick={downloadReport}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: "linear-gradient(135deg,var(--green),#059669)",
            color: "#fff",
            border: "none",
            borderRadius: "var(--rs)",
            padding: "7px 14px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
            transition: "opacity .15s"
          }}
          onMouseOver={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = ".85")}
          onMouseOut={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = "1")}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path
              d="M6.5 1v8M3.5 6.5l3 3 3-3M1 11h11"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Download Report
        </button>
      </div>
    </div>
  );
}
