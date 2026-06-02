/**
 * Import taskboard-export-2026-06-02.json into the Postgres DB.
 *
 * Usage:
 *   node scripts/import-json.mjs
 *
 * Reads .env.local for DATABASE_URL / DIRECT_URL, then:
 *   1. Wipes all existing data (clean slate)
 *   2. Creates user + brands from brands-meta-v1
 *   3. Creates recurring templates (daily + weekly) from taskboard-v4
 *   4. Creates all tasks + subtasks from taskboard-v4
 *   5. Creates daily focus entries for every date in the taskboard
 *   6. Creates notepad tabs (active) from notepad-v1
 *   7. Creates archived notepad tabs from notepad-history
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");

// ── Load .env.local before importing Prisma client ──────────────────────────
function loadEnvFile(filePath) {
  let raw;
  try { raw = readFileSync(filePath, "utf8"); }
  catch { return; }
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

loadEnvFile(path.join(rootDir, ".env.local"));

const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient({ log: ["error"] });

// ── Load the export JSON ─────────────────────────────────────────────────────
const exportData = JSON.parse(readFileSync(path.join(rootDir, "taskboard-export-2026-06-02.json"), "utf8"));

const brandsMeta = exportData["brands-meta-v1"];
const taskboard = exportData["taskboard-v4"];
const notepadV1 = exportData["notepad-v1"];
const notepadHistory = exportData["notepad-history"];

// ── Helpers ──────────────────────────────────────────────────────────────────
function parseDate(dateStr) {
  if (!dateStr) return null;
  // "2026-05-26" → Date object at midnight UTC
  return new Date(dateStr + "T00:00:00.000Z");
}

function log(msg) { console.log(" ", msg); }

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n════════════════════════════════════════");
  console.log("  Personal Tracker — JSON Import");
  console.log("════════════════════════════════════════\n");

  // ── 1. WIPE existing data (order matters due to FK constraints) ───────────
  log("Wiping existing data...");
  await db.$transaction([
    db.subtask.deleteMany(),
    db.task.deleteMany(),
    db.recurringTaskTemplate.deleteMany(),
    db.dailyFocus.deleteMany(),
    db.notepadTab.deleteMany(),
    db.uIState.deleteMany(),
    db.brand.deleteMany(),
    db.user.deleteMany(),
  ]);
  log("Wiped.");

  // ── 2. CREATE USER ─────────────────────────────────────────────────────────
  log("Creating user...");
  const user = await db.user.create({
    data: {
      email: "user@tracker.com",
      name: "Default User",
    }
  });
  log(`User created: ${user.id}`);

  // ── 3. CREATE BRANDS ───────────────────────────────────────────────────────
  log("Creating brands...");
  // Build a map of JSON brand id → DB brand id (we keep the original IDs)
  const brandMap = {}; // jsonId → db brand record

  for (const b of brandsMeta.brands) {
    const brand = await db.brand.create({
      data: {
        id: b.id, // keep original (e.g. "default", "b_mpmli1zqdedq")
        userId: user.id,
        name: b.name,
        emoji: b.emoji,
        color: b.color,
        isDefault: b.id === "default",
      }
    });
    brandMap[b.id] = brand;
    log(`  Brand: ${b.name} (${b.id})`);
  }

  // The Personal brand is "default"
  const personalBrand = brandMap["default"];
  if (!personalBrand) throw new Error("Personal brand not found in JSON");

  // ── 4. BUILD TEMPLATE ID SETS ──────────────────────────────────────────────
  // Collect all valid template IDs (so we can handle orphan recurIds gracefully)
  const validTemplateIds = new Set([
    ...taskboard.recurring.map(r => r.id),
    ...(taskboard.weeklyRecurring || []).map(r => r.id),
  ]);

  // ── 5. CREATE RECURRING TEMPLATES ─────────────────────────────────────────
  log("Creating recurring templates...");

  for (const r of taskboard.recurring) {
    await db.recurringTaskTemplate.create({
      data: {
        id: r.id,
        brandId: personalBrand.id,
        text: r.text,
        recurType: "daily",
        recurDays: "[]",
        isActive: true,
      }
    });
    log(`  Daily: ${r.text}`);
  }

  for (const r of taskboard.weeklyRecurring || []) {
    await db.recurringTaskTemplate.create({
      data: {
        id: r.id,
        brandId: personalBrand.id,
        text: r.text,
        recurType: "weekly",
        recurDays: JSON.stringify(r.days || []),
        isActive: true,
      }
    });
    log(`  Weekly (${(r.days || []).join(",")}): ${r.text}`);
  }

  // ── 6. COLLECT ALL UNIQUE DATES ────────────────────────────────────────────
  const allDates = new Set(taskboard.tasks.map(t => t.date));

  // ── 7. CREATE DAILY FOCUSES ────────────────────────────────────────────────
  log("Creating daily focus entries...");
  const headingMap = taskboard.heading || {};
  const notesMap = taskboard.notes || {};

  for (const date of allDates) {
    await db.dailyFocus.create({
      data: {
        brandId: personalBrand.id,
        date,
        heading: headingMap[date] !== undefined ? (headingMap[date] || "Daily Report") : "Daily Report",
        note: notesMap[date] !== undefined ? (notesMap[date] || "") : "",
      }
    });
  }
  log(`  Created ${allDates.size} daily focus entries.`);

  // ── 8. CREATE TASKS + SUBTASKS ─────────────────────────────────────────────
  log("Creating tasks...");
  let taskCount = 0;
  let subtaskCount = 0;

  // Group by date for orderIndex
  const tasksByDate = {};
  for (const t of taskboard.tasks) {
    if (!tasksByDate[t.date]) tasksByDate[t.date] = [];
    tasksByDate[t.date].push(t);
  }

  for (const [date, dateTasks] of Object.entries(tasksByDate)) {
    for (let idx = 0; idx < dateTasks.length; idx++) {
      const t = dateTasks[idx];

      const recurTemplateId = (t.recurId && validTemplateIds.has(t.recurId))
        ? t.recurId
        : null;

      const task = await db.task.create({
        data: {
          id: t.id,
          brandId: personalBrand.id,
          text: t.text,
          note: t.note || "",
          isDone: t.done === true,
          date: t.date,
          doneDate: (t.done && t.doneDate) ? parseDate(t.doneDate) : null,
          orderIndex: idx,
          recurType: t.recurType || null,
          recurTemplateId,
        }
      });

      taskCount++;

      // Create subtasks
      if (Array.isArray(t.subtasks) && t.subtasks.length > 0) {
        for (let si = 0; si < t.subtasks.length; si++) {
          const st = t.subtasks[si];
          await db.subtask.create({
            data: {
              id: st.id,
              taskId: task.id,
              text: st.text,
              done: st.done === true,
              orderIndex: si,
            }
          });
          subtaskCount++;
        }
      }
    }
  }

  log(`  Created ${taskCount} tasks, ${subtaskCount} subtasks.`);

  // ── 9. CREATE ACTIVE NOTEPAD TABS ─────────────────────────────────────────
  log("Creating active notepad tabs...");
  if (notepadV1 && Array.isArray(notepadV1.tabs)) {
    for (let i = 0; i < notepadV1.tabs.length; i++) {
      const tab = notepadV1.tabs[i];
      await db.notepadTab.create({
        data: {
          id: tab.id,
          brandId: personalBrand.id,
          title: tab.title,
          content: tab.content || "",
          orderIndex: i,
          isArchived: false,
        }
      });
      log(`  Tab: ${tab.title}`);
    }
  }

  // ── 10. CREATE ARCHIVED NOTEPAD HISTORY ───────────────────────────────────
  log("Creating notepad history (archived tabs)...");
  let histCount = 0;

  if (notepadHistory) {
    for (const [key, tabs] of Object.entries(notepadHistory)) {
      // key format: "notepad-hist-YYYY-MM-DD"
      const archiveDate = key.replace("notepad-hist-", "");
      for (let i = 0; i < tabs.length; i++) {
        const tab = tabs[i];
        await db.notepadTab.create({
          data: {
            id: tab.id,
            brandId: personalBrand.id,
            title: tab.title,
            content: tab.content || "",
            orderIndex: i,
            isArchived: true,
            archiveDate,
          }
        });
        histCount++;
      }
    }
  }

  log(`  Created ${histCount} archived notepad tabs.`);

  // ── SUMMARY ───────────────────────────────────────────────────────────────
  const counts = {
    users: await db.user.count(),
    brands: await db.brand.count(),
    templates: await db.recurringTaskTemplate.count(),
    focuses: await db.dailyFocus.count(),
    tasks: await db.task.count(),
    subtasks: await db.subtask.count(),
    notepadTabs: await db.notepadTab.count(),
  };

  console.log("\n── Final DB counts ──────────────────────────");
  for (const [k, v] of Object.entries(counts)) {
    console.log(`  ${k.padEnd(12)}: ${v}`);
  }

  console.log("\n  Import complete.\n");
  await db.$disconnect();
}

main().catch(async (err) => {
  console.error("\nImport failed:", err);
  await db.$disconnect();
  process.exit(1);
});
