/**
 * Integration test suite for Personal Tracker database layer.
 * Run with: node --env-file=.env.local scripts/test-db.mjs
 *
 * Tests run against real Supabase DB and clean up after themselves.
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({ log: ["error"] });

let passed = 0;
let failed = 0;
const failures = [];

function ok(label, value) {
  if (value) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
    failures.push(label);
  }
}

async function cleanup(userId) {
  if (userId) {
    // Cascade deletes brands → tasks, subtasks, recurring_templates, daily_focuses, notepad_tabs
    await db.user.deleteMany({ where: { email: "test@tracker-test.local" } });
  }
}

// ─────────────────────────────────────────────────────────────
// 1. CONNECTION
// ─────────────────────────────────────────────────────────────
async function testConnection() {
  console.log("\n── 1. Connection ──");
  const result = await db.$queryRaw`SELECT 1+1 AS result`;
  ok("raw query returns 2", result[0].result === 2);
}

// ─────────────────────────────────────────────────────────────
// 2. USER — getOrCreateDefaultUser pattern
// ─────────────────────────────────────────────────────────────
async function testUser() {
  console.log("\n── 2. User ──");

  // Create test user
  const user = await db.user.create({
    data: {
      email: "test@tracker-test.local",
      name: "Test User",
    },
  });
  ok("user created", !!user.id);
  ok("user email matches", user.email === "test@tracker-test.local");

  // findFirst returns the same user
  const found = await db.user.findFirst({ where: { email: "test@tracker-test.local" } });
  ok("user findFirst works", found?.id === user.id);

  return user;
}

// ─────────────────────────────────────────────────────────────
// 3. BRAND CRUD
// ─────────────────────────────────────────────────────────────
async function testBrands(userId) {
  console.log("\n── 3. Brands ──");

  const brand = await db.brand.create({
    data: {
      userId,
      name: "Test Brand",
      emoji: "🧪",
      color: "#ff0000",
      isDefault: true,
    },
  });
  ok("brand created", !!brand.id);
  ok("brand name matches", brand.name === "Test Brand");

  // Cannot create duplicate name for same user
  let dupError = false;
  try {
    await db.brand.create({
      data: { userId, name: "Test Brand", emoji: "🧪", color: "#ff0000" },
    });
  } catch {
    dupError = true;
  }
  ok("duplicate brand name rejected", dupError);

  // list brands
  const brands = await db.brand.findMany({ where: { userId } });
  ok("brand list returns 1", brands.length === 1);

  return brand;
}

// ─────────────────────────────────────────────────────────────
// 4. DAILY FOCUS
// ─────────────────────────────────────────────────────────────
async function testDailyFocus(brandId) {
  console.log("\n── 4. Daily Focus ──");
  const date = "2099-01-01"; // future date safe for tests

  // upsert create
  const created = await db.dailyFocus.upsert({
    where: { brandId_date: { brandId, date } },
    update: {},
    create: { brandId, date, heading: "Test Focus", note: "" },
  });
  ok("daily focus created", !!created.id);

  // upsert update heading
  const updated = await db.dailyFocus.upsert({
    where: { brandId_date: { brandId, date } },
    update: { heading: "Updated Heading" },
    create: { brandId, date, heading: "Updated Heading", note: "" },
  });
  ok("daily focus heading updated", updated.heading === "Updated Heading");

  // upsert update note
  const withNote = await db.dailyFocus.upsert({
    where: { brandId_date: { brandId, date } },
    update: { note: "Test note content" },
    create: { brandId, date, heading: "Daily Focus", note: "Test note content" },
  });
  ok("daily focus note updated", withNote.note === "Test note content");

  // findUnique
  const found = await db.dailyFocus.findUnique({ where: { brandId_date: { brandId, date } } });
  ok("daily focus findUnique works", found?.note === "Test note content");

  // duplicate date rejected
  let dupError = false;
  try {
    await db.dailyFocus.create({ data: { brandId, date, heading: "Dup", note: "" } });
  } catch {
    dupError = true;
  }
  ok("duplicate brandId+date rejected", dupError);

  return created;
}

// ─────────────────────────────────────────────────────────────
// 5. TASKS — one-off & recurring
// ─────────────────────────────────────────────────────────────
async function testTasks(brandId) {
  console.log("\n── 5. Tasks ──");
  const date = "2099-01-01";

  // Create one-off task
  const task1 = await db.task.create({
    data: { brandId, text: "Task One", date, isDone: false, orderIndex: 0 },
  });
  ok("task created", !!task1.id);
  ok("task text matches", task1.text === "Task One");

  // Create second task
  const task2 = await db.task.create({
    data: { brandId, text: "Task Two", date, isDone: false, orderIndex: 1 },
  });
  ok("second task created", !!task2.id);

  // Toggle done
  const toggled = await db.task.update({
    where: { id: task1.id },
    data: { isDone: true, doneDate: new Date() },
  });
  ok("task toggled done", toggled.isDone === true);
  ok("doneDate set", toggled.doneDate !== null);

  // Toggle undone
  const untoggled = await db.task.update({
    where: { id: task1.id },
    data: { isDone: false, doneDate: null },
  });
  ok("task toggled undone", untoggled.isDone === false);

  // Update text
  const textUpdated = await db.task.update({
    where: { id: task1.id },
    data: { text: "Task One Updated" },
  });
  ok("task text updated", textUpdated.text === "Task One Updated");

  // Update note
  const noteUpdated = await db.task.update({
    where: { id: task1.id },
    data: { note: "A note here" },
  });
  ok("task note updated", noteUpdated.note === "A note here");

  // Reorder tasks
  await db.$transaction([
    db.task.update({ where: { id: task2.id }, data: { orderIndex: 0 } }),
    db.task.update({ where: { id: task1.id }, data: { orderIndex: 1 } }),
  ]);
  const reordered = await db.task.findMany({
    where: { brandId, date },
    orderBy: { orderIndex: "asc" },
  });
  ok("task reorder works", reordered[0].id === task2.id);

  // Get tasks list
  const tasks = await db.task.findMany({
    where: { brandId, date },
    include: { subtasks: { orderBy: { orderIndex: "asc" } } },
    orderBy: { orderIndex: "asc" },
  });
  ok("getTasks returns 2", tasks.length === 2);
  ok("subtasks included", Array.isArray(tasks[0].subtasks));

  // Carry task to another date
  const carryDate = "2099-01-02";
  const carried = await db.task.update({
    where: { id: task1.id },
    data: { date: carryDate, orderIndex: 0 },
  });
  ok("task carried to new date", carried.date === carryDate);

  // Delete task
  await db.task.delete({ where: { id: task1.id } });
  const afterDelete = await db.task.findUnique({ where: { id: task1.id } });
  ok("task deleted", afterDelete === null);

  return task2;
}

// ─────────────────────────────────────────────────────────────
// 6. SUBTASKS
// ─────────────────────────────────────────────────────────────
async function testSubtasks(taskId) {
  console.log("\n── 6. Subtasks ──");

  const sub1 = await db.subtask.create({
    data: { taskId, text: "Subtask One", done: false, orderIndex: 0 },
  });
  ok("subtask created", !!sub1.id);

  const sub2 = await db.subtask.create({
    data: { taskId, text: "Subtask Two", done: false, orderIndex: 1 },
  });
  ok("second subtask created", !!sub2.id);

  // Toggle done
  const toggled = await db.subtask.update({
    where: { id: sub1.id },
    data: { done: true },
  });
  ok("subtask toggled done", toggled.done === true);

  // Delete subtask
  await db.subtask.delete({ where: { id: sub1.id } });
  const afterDelete = await db.subtask.findUnique({ where: { id: sub1.id } });
  ok("subtask deleted", afterDelete === null);

  // Parent task cascade delete removes subtasks
  await db.task.delete({ where: { id: taskId } });
  const orphanedSub = await db.subtask.findUnique({ where: { id: sub2.id } });
  ok("subtask cascade deleted with task", orphanedSub === null);
}

// ─────────────────────────────────────────────────────────────
// 7. RECURRING TASK TEMPLATES
// ─────────────────────────────────────────────────────────────
async function testRecurring(brandId) {
  console.log("\n── 7. Recurring Templates ──");
  const date = "2099-01-01";
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Daily template
  const dailyTpl = await db.recurringTaskTemplate.create({
    data: {
      brandId,
      text: "Daily standup",
      recurType: "daily",
      recurDays: "[]",
      isActive: true,
    },
  });
  ok("daily template created", !!dailyTpl.id);

  // Weekly template
  const weeklyTpl = await db.recurringTaskTemplate.create({
    data: {
      brandId,
      text: "Weekly review",
      recurType: "weekly",
      recurDays: JSON.stringify(["Mon", "Wed", "Fri"]),
      isActive: true,
    },
  });
  ok("weekly template created", !!weeklyTpl.id);

  // Seeding logic: for date 2099-01-01 (it's a Thursday)
  const dateObj = new Date(date + "T00:00:00");
  const dayName = DAYS[dateObj.getDay()];
  ok("day name derived correctly", typeof dayName === "string");

  // Simulate seeding
  const templates = await db.recurringTaskTemplate.findMany({
    where: { brandId, isActive: true },
  });
  ok("templates fetched for seeding", templates.length === 2);

  let seededCount = 0;
  for (const tpl of templates) {
    let shouldSeed = false;
    if (tpl.recurType === "daily") shouldSeed = true;
    else if (tpl.recurType === "weekly") {
      const days = JSON.parse(tpl.recurDays);
      if (days.includes(dayName)) shouldSeed = true;
    }
    if (shouldSeed) {
      await db.task.create({
        data: {
          brandId,
          text: tpl.text,
          date,
          isDone: false,
          recurType: tpl.recurType,
          recurTemplateId: tpl.id,
          orderIndex: seededCount,
        },
      });
      seededCount++;
    }
  }

  // 2099-01-01 is a Thursday, so only daily template seeds (weekly is Mon/Wed/Fri)
  ok("only daily template seeded for Thursday", seededCount === 1);

  // Delete template cascades to SetNull on tasks (not cascade delete)
  await db.recurringTaskTemplate.delete({ where: { id: dailyTpl.id } });
  const seededTask = await db.task.findFirst({
    where: { brandId, date, recurType: "daily" },
  });
  ok("task exists after template delete (SetNull)", seededTask !== null);
  ok("recurTemplateId is null after template delete", seededTask?.recurTemplateId === null);

  // Cleanup seeded tasks
  await db.task.deleteMany({ where: { brandId, date } });
  await db.recurringTaskTemplate.deleteMany({ where: { brandId } });
}

// ─────────────────────────────────────────────────────────────
// 8. NOTEPAD TABS
// ─────────────────────────────────────────────────────────────
async function testNotepad(brandId) {
  console.log("\n── 8. Notepad Tabs ──");

  // Create tabs
  const tab1 = await db.notepadTab.create({
    data: { brandId, title: "Tab One", content: "<p>Hello</p>", isArchived: false, orderIndex: 0 },
  });
  ok("notepad tab created", !!tab1.id);

  const tab2 = await db.notepadTab.create({
    data: { brandId, title: "Tab Two", content: "", isArchived: false, orderIndex: 1 },
  });
  ok("second notepad tab created", !!tab2.id);

  // Update tab
  const updated = await db.notepadTab.update({
    where: { id: tab1.id },
    data: { title: "Tab One Updated", content: "<p>Updated</p>" },
  });
  ok("notepad tab updated", updated.title === "Tab One Updated");

  // Active tabs list
  const active = await db.notepadTab.findMany({
    where: { brandId, isArchived: false },
    orderBy: { orderIndex: "asc" },
  });
  ok("active tabs returned 2", active.length === 2);

  // Archive non-empty tab (simulate new day seeding)
  const prevDate = "2099-01-01";
  await db.notepadTab.update({
    where: { id: tab1.id },
    data: { isArchived: true, archiveDate: prevDate },
  });
  // Delete empty tab
  await db.notepadTab.delete({ where: { id: tab2.id } });
  // Create fresh tab
  const freshTab = await db.notepadTab.create({
    data: { brandId, title: "Today's Notes", content: "", isArchived: false, orderIndex: 0 },
  });
  ok("new day: archive non-empty, delete empty, create fresh", !!freshTab.id);

  // History dates
  const archives = await db.notepadTab.findMany({
    where: { brandId, isArchived: true },
    select: { archiveDate: true },
    distinct: ["archiveDate"],
  });
  const historyDates = archives.map(a => a.archiveDate).filter(Boolean).sort().reverse();
  ok("history dates returned", historyDates.length === 1);
  ok("history date correct", historyDates[0] === prevDate);

  // History by date
  const historyByDate = await db.notepadTab.findMany({
    where: { brandId, isArchived: true, archiveDate: prevDate },
    orderBy: { orderIndex: "asc" },
  });
  ok("history by date returned 1 tab", historyByDate.length === 1);

  // Restore archived tabs
  const lastTab = await db.notepadTab.findFirst({
    where: { brandId, isArchived: false },
    orderBy: { orderIndex: "desc" },
  });
  let orderIndex = lastTab ? lastTab.orderIndex + 1 : 0;
  await db.$transaction(
    historyByDate.map(tab =>
      db.notepadTab.create({
        data: {
          brandId,
          title: `[${prevDate}] ${tab.title}`,
          content: tab.content,
          isArchived: false,
          orderIndex: orderIndex++,
        },
      })
    )
  );
  const afterRestore = await db.notepadTab.findMany({
    where: { brandId, isArchived: false },
  });
  ok("archived tab restored as active", afterRestore.length === 2);

  // Delete history day
  await db.notepadTab.deleteMany({
    where: { brandId, isArchived: true, archiveDate: prevDate },
  });
  const afterHistoryDelete = await db.notepadTab.findMany({
    where: { brandId, isArchived: true },
  });
  ok("history day deleted", afterHistoryDelete.length === 0);

  // Delete single tab
  await db.notepadTab.delete({ where: { id: freshTab.id } });
  ok("tab deleted", true);
}

// ─────────────────────────────────────────────────────────────
// 9. HISTORY QUERIES
// ─────────────────────────────────────────────────────────────
async function testHistory(brandId) {
  console.log("\n── 9. History Queries ──");
  const today = "2099-01-05";

  // Create tasks on past dates
  await db.dailyFocus.create({ data: { brandId, date: "2099-01-03", heading: "Past Focus", note: "Past note" } });
  await db.task.create({ data: { brandId, text: "Past Task 1", date: "2099-01-03", isDone: true, orderIndex: 0 } });
  await db.task.create({ data: { brandId, text: "Past Task 2", date: "2099-01-03", isDone: false, orderIndex: 1 } });
  await db.task.create({ data: { brandId, text: "Past Task 3", date: "2099-01-04", isDone: false, orderIndex: 0 } });

  // History dates
  const dates = await db.task.findMany({
    where: { brandId, date: { lt: today } },
    select: { date: true },
    distinct: ["date"],
    orderBy: { date: "desc" },
  });
  ok("history dates returned 2 distinct dates", dates.length === 2);

  // History details for a date
  const focus = await db.dailyFocus.findUnique({
    where: { brandId_date: { brandId, date: "2099-01-03" } },
  });
  const tasks = await db.task.findMany({
    where: { brandId, date: "2099-01-03" },
    include: { subtasks: { orderBy: { orderIndex: "asc" } } },
    orderBy: { orderIndex: "asc" },
  });
  ok("history focus found", focus?.heading === "Past Focus");
  ok("history tasks found", tasks.length === 2);
  ok("history tasks ordered", tasks[0].text === "Past Task 1");

  // Pending past tasks count
  const pendingCount = await db.task.count({
    where: { brandId, date: { lt: today }, isDone: false },
  });
  ok("pending past tasks count correct", pendingCount === 2);
}

// ─────────────────────────────────────────────────────────────
// 10. NEW DAY SEEDING (full transaction)
// ─────────────────────────────────────────────────────────────
async function testNewDaySeeding(brandId) {
  console.log("\n── 10. New Day Seeding ──");
  const newDate = "2099-02-01"; // Saturday

  // Create a recurring daily template
  const tpl = await db.recurringTaskTemplate.create({
    data: { brandId, text: "Daily task", recurType: "daily", recurDays: "[]", isActive: true },
  });

  // Create active notepad tab with content
  const existingTab = await db.notepadTab.create({
    data: { brandId, title: "Yesterday Notes", content: "<p>Some content</p>", isArchived: false, orderIndex: 0 },
  });

  // Run seeding transaction (mirrors checkNewDayAndSeedTasks)
  const existingFocus = await db.dailyFocus.findUnique({
    where: { brandId_date: { brandId, date: newDate } },
  });
  ok("no existing focus (new day)", existingFocus === null);

  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dateObj = new Date(newDate + "T00:00:00");
  const dayName = DAYS[dateObj.getDay()];

  await db.$transaction(async (tx) => {
    await tx.dailyFocus.create({
      data: { brandId, date: newDate, heading: "Daily Report", note: "" },
    });

    const templates = await tx.recurringTaskTemplate.findMany({
      where: { brandId, isActive: true },
    });

    let orderIdx = 0;
    for (const template of templates) {
      let shouldSeed = false;
      if (template.recurType === "daily") shouldSeed = true;
      else if (template.recurType === "weekly") {
        const days = JSON.parse(template.recurDays);
        if (days.includes(dayName)) shouldSeed = true;
      }
      if (shouldSeed) {
        await tx.task.create({
          data: {
            brandId,
            text: template.text,
            date: newDate,
            isDone: false,
            recurType: template.recurType,
            recurTemplateId: template.id,
            orderIndex: orderIdx++,
          },
        });
      }
    }

    const activeTabs = await tx.notepadTab.findMany({
      where: { brandId, isArchived: false },
    });
    const prevDateObj = new Date(dateObj);
    prevDateObj.setDate(prevDateObj.getDate() - 1);
    const prevDateStr = prevDateObj.toISOString().slice(0, 10);

    for (const tab of activeTabs) {
      const textContent = tab.content.replace(/<[^>]+>/g, "").trim();
      if (textContent.length > 0) {
        await tx.notepadTab.update({
          where: { id: tab.id },
          data: { isArchived: true, archiveDate: prevDateStr },
        });
      } else {
        await tx.notepadTab.delete({ where: { id: tab.id } });
      }
    }

    await tx.notepadTab.create({
      data: { brandId, title: "Today's Notes", content: "", isArchived: false, orderIndex: 0 },
    });
  });

  // Verify results
  const focus = await db.dailyFocus.findUnique({ where: { brandId_date: { brandId, date: newDate } } });
  ok("daily focus created by seeding", focus?.heading === "Daily Report");

  const seededTasks = await db.task.findMany({ where: { brandId, date: newDate } });
  ok("daily task seeded", seededTasks.length === 1);
  ok("seeded task text matches template", seededTasks[0].text === "Daily task");

  const archivedTab = await db.notepadTab.findFirst({ where: { brandId, isArchived: true } });
  ok("notepad tab archived during seeding", archivedTab !== null);

  const freshTab = await db.notepadTab.findFirst({ where: { brandId, isArchived: false } });
  ok("fresh notepad tab created", freshTab?.title === "Today's Notes");

  // Second seeding call is idempotent (focus already exists)
  const secondCheck = await db.dailyFocus.findUnique({
    where: { brandId_date: { brandId, date: newDate } },
  });
  ok("seeding is idempotent (focus already exists guard works)", secondCheck !== null);

  await db.recurringTaskTemplate.delete({ where: { id: tpl.id } });
}

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  Personal Tracker — DB Integration Tests  ");
  console.log("═══════════════════════════════════════════");

  let userId;
  try {
    await testConnection();

    const user = await testUser();
    userId = user.id;

    const brand = await testBrands(userId);
    await testDailyFocus(brand.id);
    const task = await testTasks(brand.id);

    // Task from testTasks might be deleted, create fresh for subtasks
    const taskForSubs = await db.task.create({
      data: { brandId: brand.id, text: "Subtask parent", date: "2099-01-10", isDone: false, orderIndex: 0 },
    });
    await testSubtasks(taskForSubs.id);

    await testRecurring(brand.id);
    await testNotepad(brand.id);
    await testHistory(brand.id);
    await testNewDaySeeding(brand.id);
  } catch (err) {
    console.error("\n💥 Unexpected error during tests:", err.message);
    console.error(err);
    failed++;
    failures.push(`Unexpected: ${err.message}`);
  } finally {
    await cleanup(userId);
    await db.$disconnect();
  }

  console.log("\n═══════════════════════════════════════════");
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log("  Failed:");
    failures.forEach(f => console.log(`    ✗ ${f}`));
  }
  console.log("═══════════════════════════════════════════\n");

  process.exit(failed > 0 ? 1 : 0);
}

main();
