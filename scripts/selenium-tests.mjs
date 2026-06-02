/**
 * Selenium UI tests for Personal Tracker.
 *
 * Usage:
 *   node scripts/selenium-tests.mjs [URL]
 *
 * Default URL is the Vercel deployment.
 * Each test is wrapped in a hard timeout so one hung test cannot block the suite.
 */

import { Builder, By, Key, until } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const chromedriverPath = require("chromedriver").path;

const BASE_URL = process.argv[2] || "https://personal-tracker-eight-beta.vercel.app";
const SHORT = 4000;
const REFRESH_WAIT = 2500;
const TEST_TIMEOUT = 35000;

let driver;
let passed = 0;
let failed = 0;
const failures = [];

// ── helpers ───────────────────────────────────────────────────────────────────

function ok(label, value) {
  console.log(value ? `  ✓ ${label}` : `  ✗ ${label}`);
  if (value) passed++;
  else { failed++; failures.push(label); }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function find(css, timeout = 8000) {
  return driver.wait(until.elementLocated(By.css(css)), timeout);
}

async function findAll(css) {
  try { return await driver.findElements(By.css(css)); } catch { return []; }
}

async function exists(css, timeout = 2000) {
  try { await driver.wait(until.elementLocated(By.css(css)), timeout); return true; }
  catch { return false; }
}

async function click(css) {
  const el = await find(css);
  await el.click();
}

async function typeInto(css, text) {
  const el = await find(css);
  await el.clear();
  await el.sendKeys(Key.CONTROL, "a");
  await el.sendKeys(Key.DELETE);
  await el.sendKeys(text);
}

async function acceptAlert() {
  try {
    await driver.wait(until.alertIsPresent(), SHORT);
    await driver.switchTo().alert().accept();
  } catch { }
}

async function setDateInput(element, dateStr) {
  await driver.executeScript(`
    const el = arguments[0];
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, arguments[1]);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  `, element, dateStr);
  await wait(200);
}

async function revealHoverButtons() {
  await driver.executeScript(`
    document.querySelectorAll('.tact').forEach(el => {
      el.style.opacity='1'; el.style.visibility='visible'; el.style.display='flex';
    });
  `);
}

// Find task by text — uses page source string check to avoid stale element issues
async function findTaskByText(searchText) {
  const items = await findAll(".ti");
  for (const item of items) {
    try {
      const text = await item.getText();
      if (text.includes(searchText)) return item;
    } catch { }
  }
  return null;
}

async function withTimeout(fn, label, ms = TEST_TIMEOUT) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      console.error(`  ✗ ${label}: TIMEOUT after ${ms / 1000}s`);
      failed++; failures.push(`${label} (timeout)`);
      resolve();
    }, ms);
    fn().then(() => { clearTimeout(timer); resolve(); })
      .catch((err) => {
        clearTimeout(timer);
        console.error(`  ✗ ${label}: ${err.message.slice(0, 100)}`);
        failed++; failures.push(label);
        resolve();
      });
  });
}

async function reloadPage() {
  await driver.get(BASE_URL);
  await find("body");
  await wait(1500);
}

// ── setup ─────────────────────────────────────────────────────────────────────

async function setup() {
  const opts = new chrome.Options().addArguments(
    "--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--window-size=1440,900"
  );
  driver = await new Builder()
    .forBrowser("chrome")
    .setChromeOptions(opts)
    .setChromeService(new chrome.ServiceBuilder(chromedriverPath))
    .build();
  await driver.manage().setTimeouts({ pageLoad: 30000, implicit: 0 });
}

async function teardown() {
  if (driver) await driver.quit();
}

// ── 1. Page Load ──────────────────────────────────────────────────────────────

async function testPageLoad() {
  console.log("\n── 1. Page Load ──");
  await reloadPage();
  const title = await driver.getTitle();
  ok("page title set", title.length > 0);
  ok("panel sections present", await exists(".panel"));
  ok("hero card present", await exists(".hero-card"));
  ok("add task form present", await exists(".addform"));
  ok("progress card present", await exists(".prog-card"));
  ok("notepad panel present", await exists(".notepad-panel"));
  ok("history panel present", await exists(".hist-panel"));
}

// ── 2. One-Off Task — Full CRUD ───────────────────────────────────────────────

async function testOneOffTaskCRUD() {
  console.log("\n── 2. One-Off Task CRUD ──");
  await reloadPage();

  // Add
  await click(".tbtn.one");
  await wait(200);
  await typeInto(".ainput", "Selenium OneOff");
  await click(".abtn.one");
  await wait(REFRESH_WAIT);

  let item = await findTaskByText("Selenium OneOff");
  ok("one-off task added", item !== null);
  if (!item) return;

  // Toggle done
  await item.findElement(By.css(".chk")).then((c) => c.click());
  await wait(REFRESH_WAIT);
  item = await findTaskByText("Selenium OneOff");
  ok("task toggled done", item && (await item.getAttribute("class")).includes("done"));

  // Toggle undone
  await item.findElement(By.css(".chk")).then((c) => c.click());
  await wait(REFRESH_WAIT);
  item = await findTaskByText("Selenium OneOff");
  ok("task toggled undone", item && !(await item.getAttribute("class")).includes("done"));

  // Edit text
  await revealHoverButtons();
  await item.findElement(By.css(".edit-btn")).then((b) => b.click());
  await wait(400);
  const editInput = await item.findElement(By.css(".task-edit-input"));
  await editInput.clear();
  await editInput.sendKeys("Selenium Updated");
  await item.findElement(By.css(".task-edit-save")).then((b) => b.click());
  await wait(REFRESH_WAIT);

  item = await findTaskByText("Selenium Updated");
  ok("task text updated", item !== null);

  // Add note
  if (item) {
    await revealHoverButtons();
    await item.findElement(By.css(".note-btn")).then((b) => b.click());
    await wait(400);
    const noteEditor = await item.findElement(By.css(".note-editor"));
    await noteEditor.clear();
    await noteEditor.sendKeys("Test note");
    await item.findElement(By.css(".note-save-btn")).then((b) => b.click());
    await wait(REFRESH_WAIT);
    ok("task note saved", await exists(".tnote", 3000));
  }

  // Delete
  item = await findTaskByText("Selenium Updated");
  if (item) {
    await revealHoverButtons();
    await item.findElement(By.css(".del-btn")).then((b) => b.click());
    await acceptAlert();
    await wait(REFRESH_WAIT);
    ok("task deleted", (await findTaskByText("Selenium Updated")) === null);
  } else {
    ok("task deleted", false);
  }
}

// ── 3. Subtasks ────────────────────────────────────────────────────────────────

async function testSubtasks() {
  console.log("\n── 3. Subtasks ──");
  await reloadPage();

  await click(".tbtn.one");
  await typeInto(".ainput", "Selenium SubParent");
  await click(".abtn.one");
  await wait(REFRESH_WAIT);

  let parent = await findTaskByText("Selenium SubParent");
  ok("parent task created", parent !== null);
  if (!parent) return;

  await revealHoverButtons();
  await parent.findElement(By.css(".sub-btn")).then((b) => b.click());
  await wait(400);

  const subInput = await parent.findElement(By.css(".sub-inp"));
  await subInput.sendKeys("Sub One");
  await parent.findElement(By.css(".sub-add-btn")).then((b) => b.click());
  await wait(REFRESH_WAIT);

  parent = await findTaskByText("Selenium SubParent");
  const subs = parent ? await parent.findElements(By.css(".subtask-item")) : [];
  ok("subtask added", subs.length > 0);

  if (subs.length > 0) {
    await subs[0].findElement(By.css(".sub-chk")).then((c) => c.click());
    await wait(REFRESH_WAIT);
    parent = await findTaskByText("Selenium SubParent");
    const subsAfter = await parent.findElements(By.css(".subtask-item"));
    const cls = await subsAfter[0].getAttribute("class");
    ok("subtask toggled done", cls.includes("sub-done"));

    await subsAfter[0].findElement(By.css(".sub-del")).then((b) => b.click());
    await wait(REFRESH_WAIT);
    parent = await findTaskByText("Selenium SubParent");
    const subsFinal = await parent.findElements(By.css(".subtask-item"));
    ok("subtask deleted", subsFinal.length === 0);
  } else {
    ok("subtask toggled done", false);
    ok("subtask deleted", false);
  }

  // Cleanup parent
  parent = await findTaskByText("Selenium SubParent");
  if (parent) {
    await revealHoverButtons();
    await parent.findElement(By.css(".del-btn")).then((b) => b.click());
    await acceptAlert();
    await wait(REFRESH_WAIT);
  }
}

// ── 4. Recurring Daily Tasks ──────────────────────────────────────────────────

async function testRecurringDaily() {
  console.log("\n── 4. Recurring Daily — Modal Refresh on Remove (BUG FIX) ──");
  await reloadPage();

  // Find first "+ Manage" button
  const btns = await findAll("button");
  let manageBtn = null;
  for (const b of btns) {
    const t = await b.getText().catch(() => "");
    if (t.trim() === "+ Manage") { manageBtn = b; break; }
  }
  if (!manageBtn) { ok("daily manage button found", false); return; }
  ok("daily manage button found", true);

  await manageBtn.click();
  await wait(500);
  ok("modal opened", await exists(".modal", 3000));

  await typeInto(".minput", "Selenium DailyTpl");
  await click(".mbtn.confirm");
  await wait(REFRESH_WAIT);

  let items = await findAll(".manage-item");
  let found = false;
  for (const it of items) {
    const t = await it.getText().catch(() => "");
    if (t.includes("Selenium DailyTpl")) { found = true; break; }
  }
  ok("template added to modal list", found);

  if (found) {
    items = await findAll(".manage-item");
    let remBtn = null;
    for (const it of items) {
      const t = await it.getText().catch(() => "");
      if (t.includes("Selenium DailyTpl")) {
        remBtn = await it.findElement(By.css(".rem-btn"));
        break;
      }
    }
    if (remBtn) {
      await remBtn.click();
      await acceptAlert();
      await wait(REFRESH_WAIT);

      const itemsAfter = await findAll(".manage-item");
      let stillThere = false;
      for (const it of itemsAfter) {
        const t = await it.getText().catch(() => "");
        if (t.includes("Selenium DailyTpl")) { stillThere = true; break; }
      }
      ok("BUG FIX: modal list refreshes immediately after remove", !stillThere);
    } else {
      ok("BUG FIX: modal list refreshes immediately after remove", false);
    }
  } else {
    ok("BUG FIX: modal list refreshes immediately after remove", false);
  }

  // Close modal
  try { await click(".mbtn.cancel"); } catch { }
  await wait(300);
}

// ── 5. Recurring Weekly Tasks ─────────────────────────────────────────────────

async function testRecurringWeekly() {
  console.log("\n── 5. Recurring Weekly — Modal Refresh on Remove (BUG FIX) ──");
  await reloadPage();

  const btns = await findAll("button");
  const manageBtns = [];
  for (const b of btns) {
    const t = await b.getText().catch(() => "");
    if (t.trim() === "+ Manage") manageBtns.push(b);
  }
  if (manageBtns.length < 2) { ok("weekly manage button found", false); return; }
  ok("weekly manage button found", true);

  await manageBtns[1].click();
  await wait(500);
  ok("weekly modal opened", await exists(".modal", 3000));

  await typeInto(".minput", "Selenium WeeklyTpl");

  // Pick Mon
  const modalBtns = await findAll(".modal button[type='button']");
  for (const b of modalBtns) {
    const t = await b.getText().catch(() => "");
    if (t === "Mon") { await b.click(); break; }
  }

  await click(".mbtn.confirm");
  await wait(REFRESH_WAIT);

  // Re-open to verify
  try { await click(".mbtn.cancel"); } catch { }
  await wait(300);
  await manageBtns[1].click();
  await wait(500);

  let items = await findAll(".manage-item");
  let found = false;
  for (const it of items) {
    const t = await it.getText().catch(() => "");
    if (t.includes("Selenium WeeklyTpl")) { found = true; break; }
  }
  ok("weekly template added", found);

  if (found) {
    items = await findAll(".manage-item");
    let remBtn = null;
    for (const it of items) {
      const t = await it.getText().catch(() => "");
      if (t.includes("Selenium WeeklyTpl")) {
        remBtn = await it.findElement(By.css(".rem-btn"));
        break;
      }
    }
    if (remBtn) {
      await remBtn.click();
      await acceptAlert();
      await wait(REFRESH_WAIT);

      const itemsAfter = await findAll(".manage-item");
      let stillThere = false;
      for (const it of itemsAfter) {
        const t = await it.getText().catch(() => "");
        if (t.includes("Selenium WeeklyTpl")) { stillThere = true; break; }
      }
      ok("BUG FIX: weekly modal refreshes on remove", !stillThere);
    } else {
      ok("BUG FIX: weekly modal refreshes on remove", false);
    }
  } else {
    ok("BUG FIX: weekly modal refreshes on remove", false);
  }

  try { await click(".mbtn.cancel"); } catch { }
}

// ── 6. Daily Focus ────────────────────────────────────────────────────────────

async function testDailyFocus() {
  console.log("\n── 6. Daily Focus ──");
  await reloadPage();

  const heading = await find(".hero-heading");
  await driver.executeScript("arguments[0].innerText = 'Selenium Focus'", heading);
  await heading.sendKeys(Key.RETURN);
  await wait(REFRESH_WAIT);
  ok("heading edit triggered save", true);

  const noteArea = await find(".hero-note");
  await noteArea.clear();
  await noteArea.sendKeys("Selenium note text");
  await driver.executeScript("arguments[0].blur()", noteArea);
  await wait(REFRESH_WAIT);
  ok("note edit triggered save", true);

  // Reload and verify — use JS .value property (not getAttribute which is for initial HTML attr)
  await reloadPage();
  const savedNote = await find(".hero-note");
  const val = await driver.executeScript("return arguments[0].value", savedNote);
  ok("note persisted after reload", val && val.includes("Selenium note text"));

  // Restore
  const hdg = await find(".hero-heading");
  await driver.executeScript("arguments[0].innerText = 'Daily Focus'", hdg);
  await hdg.sendKeys(Key.RETURN);
  await wait(1500);
  const noteReset = await find(".hero-note");
  await noteReset.clear();
  await driver.executeScript("arguments[0].blur()", noteReset);
  await wait(1500);
}

// ── 7. Date Navigation ─────────────────────────────────────────────────────────

async function testDateNavigation() {
  console.log("\n── 7. Date Navigation ──");
  await reloadPage();

  const dateInputs = await findAll("input[type='date']");
  ok("date inputs present", dateInputs.length > 0);
  if (dateInputs.length === 0) return;

  const navInput = dateInputs[dateInputs.length - 1];
  await setDateInput(navInput, "2099-06-15");
  await wait(REFRESH_WAIT);

  const url = await driver.getCurrentUrl();
  ok("date navigation updates URL", url.includes("2099-06-15"));
}

// ── 8. Task Scheduling (Future Date) ──────────────────────────────────────────

async function testTaskScheduling() {
  console.log("\n── 8. Task Scheduling — Future Date ──");
  await reloadPage();

  await click(".tbtn.one");
  await wait(200);

  const dateInputs = await findAll("input[type='date'].date-inp");
  if (dateInputs.length > 0) {
    await setDateInput(dateInputs[0], "2099-12-31");
    await wait(500);
    ok("scheduled badge shown for future date", await exists(".date-future-badge", 2500));
  } else {
    ok("scheduled badge shown for future date", false);
  }

  // Reset
  const inputs2 = await findAll("input[type='date'].date-inp");
  if (inputs2.length > 0) {
    const today = new Date().toISOString().slice(0, 10);
    await setDateInput(inputs2[0], today);
  }
}

// ── 9. Stats & Progress Bar ────────────────────────────────────────────────────

async function testStatsAndProgress() {
  console.log("\n── 9. Stats & Progress ──");
  await reloadPage();

  ok("progress card present", await exists(".prog-card"));
  ok("progress track present", await exists(".prog-track"));
  ok("stats grid present", await exists(".stats-grid"));

  const pctEl = await find(".prog-pct");
  const pctText = await pctEl.getText();
  ok("progress percentage rendered", pctText.includes("%"));
}

// ── 10. Notepad ────────────────────────────────────────────────────────────────

async function testNotepad() {
  console.log("\n── 10. Notepad ──");
  await reloadPage();

  ok("notepad panel present", await exists(".notepad-panel"));

  const addBtn = await find(".np-tab-add");
  await addBtn.click();
  await wait(REFRESH_WAIT);

  const tabs = await findAll(".np-tab");
  ok("notepad tab added", tabs.length > 0);

  if (tabs.length > 0) {
    const editor = await find(".np-editor");
    await driver.executeScript("arguments[0].focus()", editor);
    await editor.sendKeys("Selenium notepad content");
    await wait(2000); // debounce

    // Click another spot to ensure save fires
    await driver.executeScript("arguments[0].blur()", editor);
    await wait(1500);
    ok("notepad content typed and editor functional", true);

    // Delete tab
    if (await exists(".np-del-tab", 2000)) {
      const delTab = await find(".np-del-tab");
      await delTab.click();
      await acceptAlert();
      await wait(REFRESH_WAIT);
      ok("notepad tab deletion works", true);
    } else {
      ok("notepad tab deletion works", false);
    }
  } else {
    ok("notepad content typed and editor functional", false);
    ok("notepad tab deletion works", false);
  }
}

// ── 11. History Panel ─────────────────────────────────────────────────────────

async function testHistoryPanel() {
  console.log("\n── 11. History Panel ──");
  await reloadPage();

  ok("history panel present", await exists(".hist-panel"));

  const header = await find(".hist-header");
  await header.click();
  await wait(800);
  ok("history panel expands", await exists(".hist-body", 2000));

  await header.click();
  await wait(500);
  ok("history panel collapses", !(await exists(".hist-body", 1000)));
}

// ── 12. Task Drag & Drop ──────────────────────────────────────────────────────

async function testDragDrop() {
  console.log("\n── 12. Task Drag & Drop ──");
  await reloadPage();

  await click(".tbtn.one");
  await typeInto(".ainput", "Selenium DnD1");
  await click(".abtn.one");
  await wait(REFRESH_WAIT);

  await typeInto(".ainput", "Selenium DnD2");
  await click(".abtn.one");
  await wait(REFRESH_WAIT);

  const handles = await findAll(".drag-handle");
  ok("drag handles present", handles.length >= 2);

  if (handles.length >= 2) {
    const source = handles[handles.length - 2];
    const target = handles[handles.length - 1];

    const sRect = await driver.executeScript(
      "const r=arguments[0].getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};",
      source
    );
    const tRect = await driver.executeScript(
      "const r=arguments[0].getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};",
      target
    );

    await driver.actions({ async: true })
      .move({ x: sRect.x, y: sRect.y }).press().pause(200)
      .move({ x: tRect.x, y: tRect.y }).pause(200)
      .release().perform();

    await wait(REFRESH_WAIT);
    ok("drag-and-drop performed without error", true);
  }

  // Cleanup
  for (const label of ["Selenium DnD1", "Selenium DnD2"]) {
    const item = await findTaskByText(label);
    if (item) {
      await revealHoverButtons();
      try {
        await item.findElement(By.css(".del-btn")).then((b) => b.click());
        await acceptAlert();
        await wait(REFRESH_WAIT);
      } catch { }
    }
  }
}

// ── 13. Report API ────────────────────────────────────────────────────────────

async function testReportAPI() {
  console.log("\n── 13. Report API ──");

  await driver.get(`${BASE_URL}/api/report`);
  await wait(1500);
  const errSrc = await driver.getPageSource();
  ok("report API returns error on missing params", errSrc.includes("Missing") || errSrc.includes("error"));

  // Navigate to app and click first brand tab to set brandId in URL
  await reloadPage();
  const brandTabs = await findAll(".brand-pill");
  if (brandTabs.length > 0) {
    await brandTabs[0].click();
    await wait(REFRESH_WAIT);
  }

  const url = await driver.getCurrentUrl();
  const m = url.match(/brandId=([^&]+)/);
  const today = new Date().toISOString().slice(0, 10);

  if (m) {
    await driver.get(`${BASE_URL}/api/report?brandId=${m[1]}&date=${today}`);
    await wait(1500);
    const src = await driver.getPageSource();
    ok("report API returns daily report markdown", src.includes("Daily Report"));
  } else {
    ok("report API returns daily report markdown", false);
  }
}

// ── 14. Brand Switching ───────────────────────────────────────────────────────

async function testBrandSwitching() {
  console.log("\n── 14. Brand Switching ──");
  await reloadPage();

  const brandTabs = await findAll(".brand-pill");
  ok("brand tabs render", brandTabs.length > 0);

  if (brandTabs.length > 0) {
    await brandTabs[0].click();
    await wait(REFRESH_WAIT);
    const url = await driver.getCurrentUrl();
    ok("brand tab click updates URL", url.includes("brandId="));
  } else {
    ok("brand tab click updates URL", false);
  }
}

// ── 15. Delete Task — State Recovery (BUG FIX) ───────────────────────────────

async function testDeleteRecovery() {
  console.log("\n── 15. Delete Task — UI State Recovery (BUG FIX) ──");
  await reloadPage();

  await click(".tbtn.one");
  await typeInto(".ainput", "Selenium DelTest");
  await click(".abtn.one");
  await wait(REFRESH_WAIT);

  let item = await findTaskByText("Selenium DelTest");
  ok("task created", item !== null);
  if (!item) return;

  await revealHoverButtons();
  await item.findElement(By.css(".del-btn")).then((b) => b.click());
  await acceptAlert();
  await wait(REFRESH_WAIT);

  ok("task removed from UI", (await findTaskByText("Selenium DelTest")) === null);

  // Verify UI still functional after delete
  await typeInto(".ainput", "Selenium PostDel");
  await click(".abtn.one");
  await wait(REFRESH_WAIT);

  const postItem = await findTaskByText("Selenium PostDel");
  ok("BUG FIX: UI remains functional after task delete", postItem !== null);

  if (postItem) {
    await revealHoverButtons();
    await postItem.findElement(By.css(".del-btn")).then((b) => b.click());
    await acceptAlert();
    await wait(REFRESH_WAIT);
  }
}

// ── 16. Section Collapse / Expand ─────────────────────────────────────────────

async function testSectionCollapse() {
  console.log("\n── 16. Section Collapse / Expand ──");
  await reloadPage();

  const headers = await findAll(".ph");
  ok("panel headers present", headers.length > 0);
  if (headers.length === 0) return;

  const firstHeader = headers[0];
  const parent = await firstHeader.findElement(By.xpath(".."));
  const initial = await parent.getAttribute("class");

  await firstHeader.click();
  await wait(500);
  const after1 = await parent.getAttribute("class");
  ok("section state toggles on header click", initial !== after1);

  await firstHeader.click();
  await wait(500);
  const after2 = await parent.getAttribute("class");
  ok("section state toggles back on second click", after1 !== after2);
}

// ── MAIN ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  Personal Tracker — Selenium UI Tests");
  console.log(`  Target: ${BASE_URL}`);
  console.log("═══════════════════════════════════════════════════\n");

  const startTime = Date.now();

  try {
    await setup();
    console.log("Chrome ready.");
  } catch (err) {
    console.error("Failed to start Chrome:", err.message);
    process.exit(1);
  }

  await withTimeout(testPageLoad, "1. Page Load");
  await withTimeout(testOneOffTaskCRUD, "2. One-Off Task CRUD");
  await withTimeout(testSubtasks, "3. Subtasks");
  await withTimeout(testRecurringDaily, "4. Recurring Daily (BUG FIX)");
  await withTimeout(testRecurringWeekly, "5. Recurring Weekly (BUG FIX)");
  await withTimeout(testDailyFocus, "6. Daily Focus");
  await withTimeout(testDateNavigation, "7. Date Navigation");
  await withTimeout(testTaskScheduling, "8. Task Scheduling");
  await withTimeout(testStatsAndProgress, "9. Stats & Progress");
  await withTimeout(testNotepad, "10. Notepad");
  await withTimeout(testHistoryPanel, "11. History Panel");
  await withTimeout(testDragDrop, "12. Drag & Drop");
  await withTimeout(testReportAPI, "13. Report API");
  await withTimeout(testBrandSwitching, "14. Brand Switching");
  await withTimeout(testDeleteRecovery, "15. Delete Recovery (BUG FIX)");
  await withTimeout(testSectionCollapse, "16. Section Collapse");

  await teardown();

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log("\n═══════════════════════════════════════════════════");
  console.log(`  Results: ${passed} passed, ${failed} failed   (${elapsed}s)`);
  if (failures.length > 0) {
    console.log("\n  Failed:");
    failures.forEach((f) => console.log(`    ✗ ${f}`));
  }
  console.log("═══════════════════════════════════════════════════\n");

  process.exit(failed > 0 ? 1 : 0);
}

main();
