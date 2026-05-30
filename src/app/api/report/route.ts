import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const brandId = searchParams.get("brandId");
  const date = searchParams.get("date");

  if (!brandId || !date) {
    return NextResponse.json({ error: "Missing brandId or date parameters" }, { status: 400 });
  }

  try {
    // Fetch Brand details
    const brand = await db.brand.findUnique({
      where: { id: brandId }
    });

    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    // Fetch Daily Focus
    const focus = await db.dailyFocus.findUnique({
      where: {
        brandId_date: { brandId, date }
      }
    });

    // Fetch Tasks for the day
    const tasks = await db.task.findMany({
      where: { brandId, date },
      orderBy: { orderIndex: "asc" }
    });

    const completed = tasks.filter(t => t.isDone);
    const pending = tasks.filter(t => !t.isDone);

    // Build the Markdown Report
    let report = `# Daily Report: ${brand.emoji} ${brand.name} - ${date}\n\n`;
    
    report += `## 📝 Daily Focus & Intentions\n`;
    report += `**Heading**: ${focus?.heading || "Daily Focus"}\n`;
    report += `**Intention Note**: ${focus?.note || "No note set."}\n\n`;

    report += `## ✅ Completed Tasks (${completed.length})\n`;
    if (completed.length === 0) {
      report += `*No tasks completed today.*\n`;
    } else {
      completed.forEach(t => {
        report += `- [x] ${t.text}${t.note ? ` _(${t.note})_` : ""}\n`;
      });
    }
    report += `\n`;

    report += `## ⏳ Pending Tasks (${pending.length})\n`;
    if (pending.length === 0) {
      report += `*All tasks completed today! 🎉*\n`;
    } else {
      pending.forEach(t => {
        report += `- [ ] ${t.text}${t.note ? ` _(${t.note})_` : ""}\n`;
      });
    }

    // Return as a downloadable text file
    return new NextResponse(report, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="daily-report-${brand.name.toLowerCase()}-${date}.md"`
      }
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
