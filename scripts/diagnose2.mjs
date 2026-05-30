import { Builder, By, Key, until } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const chromedriverPath = require("chromedriver").path;

const URL = "https://personal-tracker-eight-beta.vercel.app";

function log(msg) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

async function run() {
  log("init driver");
  const opts = new chrome.Options().addArguments(
    "--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--window-size=1440,900"
  );
  const driver = await new Builder()
    .forBrowser("chrome")
    .setChromeOptions(opts)
    .setChromeService(new chrome.ServiceBuilder(chromedriverPath))
    .build();

  await driver.manage().setTimeouts({ pageLoad: 30000 });

  try {
    log("get page");
    await driver.get(URL);
    log("wait 2s");
    await new Promise(r => setTimeout(r, 2000));

    log("click one-off button");
    const oneBtn = await driver.findElement(By.css(".tbtn.one"));
    await oneBtn.click();
    await new Promise(r => setTimeout(r, 300));

    log("type task name");
    const input = await driver.findElement(By.css(".ainput"));
    await input.clear();
    await input.sendKeys("Diag Task");

    log("click submit");
    const submit = await driver.findElement(By.css(".abtn.one"));
    await submit.click();

    log("wait 3s for refresh");
    await new Promise(r => setTimeout(r, 3000));

    log("findAll .ti");
    const items = await driver.findElements(By.css(".ti"));
    log(`found ${items.length} task items`);

    log("getText on each");
    for (let i = 0; i < items.length; i++) {
      try {
        const t = await items[i].getText();
        log(`  [${i}] ${t.slice(0, 60)}`);
      } catch (e) {
        log(`  [${i}] STALE: ${e.message.slice(0, 60)}`);
      }
    }

    log("cleanup: find and delete Diag Task");
    const items2 = await driver.findElements(By.css(".ti"));
    for (const item of items2) {
      try {
        const t = await item.getText();
        if (t.includes("Diag Task")) {
          log("force reveal .tact");
          await driver.executeScript(
            `document.querySelectorAll('.tact').forEach(el=>{el.style.opacity='1';el.style.visibility='visible';el.style.display='flex';});`
          );
          log("click delete");
          const del = await item.findElement(By.css(".del-btn"));
          await del.click();
          log("wait for alert");
          await driver.wait(until.alertIsPresent(), 3000);
          log("accept alert");
          await driver.switchTo().alert().accept();
          log("wait 3s for refresh");
          await new Promise(r => setTimeout(r, 3000));
          break;
        }
      } catch (e) {
        log(`stale during cleanup: ${e.message.slice(0, 60)}`);
      }
    }

    log("DONE successfully");
  } finally {
    log("quitting driver");
    await driver.quit();
    log("driver quit");
  }
}

run().catch(err => { console.error("FAIL:", err.message); process.exit(1); });
