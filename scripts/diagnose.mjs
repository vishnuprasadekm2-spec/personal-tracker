import { Builder, By, until } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const chromedriverPath = require("chromedriver").path;

const URL = process.argv[2] || "https://personal-tracker-eight-beta.vercel.app";

function log(msg) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

async function main() {
  log("starting");

  log("building chrome driver…");
  const service = new chrome.ServiceBuilder(chromedriverPath);
  const options = new chrome.Options();
  options.addArguments(
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--window-size=1440,900"
  );

  const t1 = Date.now();
  const driver = await new Builder()
    .forBrowser("chrome")
    .setChromeOptions(options)
    .setChromeService(service)
    .build();
  log(`chrome ready in ${Date.now() - t1}ms`);

  await driver.manage().setTimeouts({ pageLoad: 30000 });

  log(`navigating to ${URL}`);
  const t2 = Date.now();
  await driver.get(URL);
  log(`page loaded in ${Date.now() - t2}ms`);

  log("waiting for body");
  await driver.wait(until.elementLocated(By.css("body")), 10000);
  log("body present");

  log("checking for .panel");
  const t3 = Date.now();
  try {
    await driver.wait(until.elementLocated(By.css(".panel")), 10000);
    log(`.panel found in ${Date.now() - t3}ms`);
  } catch (err) {
    log(`.panel NOT found: ${err.message}`);
    const src = await driver.getPageSource();
    log(`page source length: ${src.length}`);
    log(`first 500 chars: ${src.slice(0, 500)}`);
  }

  log("checking for .ainput (task input)");
  try {
    await driver.wait(until.elementLocated(By.css(".ainput")), 10000);
    log(".ainput found");
  } catch (err) {
    log(`.ainput NOT found: ${err.message}`);
  }

  log("getting page title");
  const title = await driver.getTitle();
  log(`title: "${title}"`);

  log("quitting");
  await driver.quit();
  log("done");
}

main().catch((err) => {
  console.error("ERROR:", err.message);
  process.exit(1);
});
