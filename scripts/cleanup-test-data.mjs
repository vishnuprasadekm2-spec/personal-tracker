/**
 * Removes leftover test data (Selenium*, DnD*, Diag*, etc.) from the database.
 * Run with: node --env-file=.env.local scripts/cleanup-test-data.mjs
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({ log: ["error"] });

const TEST_PATTERNS = [
  "Selenium",
  "DnD",
  "Diag",
  "Stats Test",
  "Delete Recovery",
  "Delete State",
  "Post Delete",
  "Post-Delete",
  "Subtask Parent",
  "Future Scheduled",
  "Scheduled Future",
  "StateRefresh",
  "Diag Task",
];

async function main() {
  console.log("Cleaning up test data...\n");

  for (const pattern of TEST_PATTERNS) {
    const tasks = await db.task.deleteMany({
      where: { text: { contains: pattern } },
    });
    const templates = await db.recurringTaskTemplate.deleteMany({
      where: { text: { contains: pattern } },
    });
    const notes = await db.notepadTab.deleteMany({
      where: { title: { contains: pattern } },
    });
    if (tasks.count || templates.count || notes.count) {
      console.log(`  ${pattern}: ${tasks.count} tasks, ${templates.count} templates, ${notes.count} notes deleted`);
    }
  }

  // Reset Daily Focus heading if it was changed to "Selenium Focus Test"
  await db.dailyFocus.updateMany({
    where: { heading: { contains: "Selenium" } },
    data: { heading: "Daily Focus", note: "" },
  });

  console.log("\nDone.");
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
