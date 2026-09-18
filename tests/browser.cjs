const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
const near = (a, b) => assert.ok(Number.isFinite(a) && Math.abs(a-b) < 1e-8, `${a} != ${b}`);
(async () => {
  const browser = await chromium.launch({headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined});
  try {
    for (const lang of ['ru', 'en']) {
      const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href + '?lang=' + lang);
      assert.deepEqual(errors, []);
      for (const [name, expected] of Object.entries({reset:0, better10:10, worse10:-10, deploy2x:100/16, dxielite:(8.5/7.7337-1)*25, cfrzero:100/8, offonly:0})) {
        const actual = await page.evaluate(name => {applyPreset(name); return compute().dim.overall;}, name);
        near(actual, expected);
      }
      await page.locator('[data-preset="dxielite"]').click();
      near(await page.evaluate(() => compute().dim.effect), (8.5/7.7337-1)*100);
      assert.match(await page.locator('#v-effect').innerText(), /9[,.]9%/);
      assert.match(await page.locator('#mc-dxiRaw').innerText(), /9[,.]9%/);
      assert.equal(await page.locator('#in-dxiRaw').isEnabled(), true);
      await page.locator('#in-dxiRaw').evaluate(el => {el.value = '7'; el.dispatchEvent(new Event('input', {bubbles: true}));});
      near(await page.evaluate(() => compute().dim.overall), (7/7.7337-1)*25);
      await page.locator('#setbase').click();
      near(await page.evaluate(() => compute().dim.effect), 0);
      near(await page.evaluate(() => compute().dim.overall), 0);
      await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href + '?lang=' + lang);
      await page.locator('[data-preset="roiplus"]').click();
      near(await page.evaluate(() => state.roi), 15);
      near(await page.evaluate(() => roiFrom()), 15);
      assert.match(await page.locator('#roi-out').innerText(), /15[,.]0%/);
      await page.locator('[data-preset="epicsplit"]').click();
      const split = await page.evaluate(() => ({x: RP.x, roi: state.roi, output: roiFrom(), through: state.through, base: M.through.etalon}));
      near(split.roi, split.output);
      near(split.through / split.base, 1.5);
      await page.locator('#setbase').click();
      near(await page.evaluate(() => compute().dim.overall), 0);
      await page.locator('[data-preset="reset"]').click();
      near(await page.evaluate(() => compute().dim.overall), 0);
      await page.locator('#rin-d0').evaluate(el => {el.value = '0'; el.dispatchEvent(new Event('input', {bubbles: true}));});
      near(await page.evaluate(() => state.roi), 0);
      // A manually chosen ROI can be incompatible with the current driver values.
      await page.locator('#in-roi').evaluate(el => {el.value = '50'; el.dispatchEvent(new Event('input', {bubbles: true}));});
      assert.equal(await page.evaluate(() => roiLinked), false);
      await page.locator('#setbase').click();
      near(await page.evaluate(() => state.roi), 50);
      near(await page.evaluate(() => compute().dim.overall), 0);
      await page.locator('[data-preset="reset"]').click();
      near(await page.evaluate(() => state.roi), 50);
      // Diagnostic metrics are independent; TDV is not the complement of Innovation.
      const tdv = await page.evaluate(() => state.tdv);
      await page.locator('#in-inno').evaluate(el => {el.value = '70'; el.dispatchEvent(new Event('input', {bubbles: true}));});
      near(await page.evaluate(() => state.tdv), tdv);
      assert.deepEqual(errors, []);
      await page.reload();
      await page.screenshot({path: path.join(os.tmpdir(), `dx4-${lang}-desktop.png`), fullPage: true});
      await page.setViewportSize({width: 390, height: 844});
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({path: path.join(os.tmpdir(), `dx4-${lang}-mobile.png`), fullPage: true});
      assert.deepEqual(errors, []);
      console.log(`${lang}: presets, ROI, custom baseline, diagnostic independence and mobile layout passed`);
      await page.close();
    }
  } finally {await browser.close();}
})().catch(error => {console.error(error); process.exitCode = 1;});
