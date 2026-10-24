const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { chromium } = require('playwright');

const sourcePath = path.resolve(__dirname, '../dist/douyin-paarollfix.user.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const vueSource = fs.readFileSync(require.resolve('vue/dist/vue.global.prod.js'), 'utf8');
const fixture = `<!doctype html><html><head><style>
body { margin: 0; } [data-e2e="living-container"] { width: 900px; }
.player { background: #222; height: 500px; }
.giftBar { height: 80px; background: pink; }
button { height: 32px; } video { display: block; width: 800px; height: 350px; }
</style></head><body>
<div data-e2e="living-container"><div class="player douyin-player">
  <video id="stream"></video>
  <div class="douyin-player-controls"><div class="douyin-player-controls-inner">
    <button id="volume">音量</button><button id="quality">画质</button><button id="fullscreen">全屏</button>
    <button id="gift-settings" data-e2e="gift-setting">礼物特效设置</button>
  </div><div id="modern-wrapper"><div id="modern-gift" class="giftBar gitBarOptimizeEnabled">
    <div data-e2e="gifts-container"><button data-e2e="gift-btn">赠送</button></div>
  </div></div></div>
</div><div id="BottomLayout"><div id="legacy-gift" class="giftBar">传统礼物底栏</div></div>
<xg-controls><xg-inner-controls id="xg-controls"><button>播放</button></xg-inner-controls>
  <div id="xg-gift" class="giftBar"><div data-e2e="gifts-container">全屏礼物底栏</div></div>
</xg-controls></div>
<div data-e2e="living-container"><div class="douyin-player-controls"><div class="douyin-player-controls-inner"><button id="multicam-play">播放</button></div>
  <div id="multicam-wrapper"><div id="multicam-gift" class="gitBarOptimizeEnabled giftBar"><div data-e2e="gifts-container">多机位直播的礼物栏</div></div><button id="multicam">多机位</button></div>
</div></div>
<article id="ordinary-gift" class="gift-card">普通视频提到礼物，不能隐藏</article>
<div id="dynamic-root"></div>
</body></html>`;

async function openFixture(context, host, storedLive = {}) {
  const page = await context.newPage();
  await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: fixture }));
  await page.goto(`https://${host}/123456789`, { waitUntil: 'domcontentloaded' });
  await page.addScriptTag({ content: vueSource });
  await page.evaluate(live => {
    window.testStored = { enabled: true, video: {skipAd:false,skipShop:false,skipLive:false,autoHD:false}, live: {removeGiftBar:true,removeGiftAnim:false,removeAdvancedDanmaku:false,removeRoomInfoTags:false,blockGiftMsg:false,autoHD:false,...live} };
    window.GM_getValue = (key, fallback) => key === 'fd_config' ? window.testStored : fallback;
    window.GM_setValue = (key, value) => { if (key === 'fd_config') window.testStored = JSON.parse(JSON.stringify(value)); };
    window.GM_addStyle = text => {const style = document.createElement('style'); style.textContent = text; document.head.append(style);};
  }, storedLive);
  await page.addScriptTag({ content: source });
  return page;
}

async function isVisible(page, selector) { return page.locator(selector).evaluate(e => e.checkVisibility()); }
async function assertHidden(page, selector, label) { assert.equal(await isVisible(page, selector), false, label); }
async function assertVisible(page, selector, label) { assert.equal(await isVisible(page, selector), true, label); }

(async () => {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined, headless: true });
  const context = await browser.newContext({ locale: 'zh-CN', viewport: {width:1440,height:900} });
  const check = async (name, action) => { await test(name, action); };
  try {
    const page = await openFixture(context, 'live.douyin.com');
    await check('legacy gift bar hidden', () => assertHidden(page, '#legacy-gift', 'legacy gift bar visible'));
    await check('modern gift bar hidden after mouse movement', async () => {
      await page.mouse.move(500, 400);
      await assertHidden(page, '#modern-gift', 'modern gift bar reappears after mouse movement');
    });
    await check('gift wrapper background removed', () => assertHidden(page, '#modern-wrapper', 'gift wrapper remains visible'));
    await check('xgplayer gift bar hidden and controls preserved', async () => {
      await assertHidden(page, '#xg-gift', 'xgplayer gift bar visible');
      await assertVisible(page, '#xg-controls', 'xgplayer playback controls hidden');
    });
    await check('video, settings, volume, quality and fullscreen preserved', async () => {
      for (const selector of ['#stream','#gift-settings','#volume','#quality','#fullscreen','#ordinary-gift']) await assertVisible(page, selector, `${selector} was hidden`);
    });
    await check('multi-camera entry preserved while shared gift row collapses', async () => {
      await assertHidden(page, '#multicam-gift', 'multi-camera gift bar visible');
      await assertVisible(page, '#multicam', 'multi-camera entry was hidden');
      await assertVisible(page, '#multicam-play', 'multi-camera playback controls hidden');
      assert.equal(await page.locator('#multicam').evaluate(e => e.getBoundingClientRect().height), 32);
    });
    await check('dynamic gifts, portals and inline display handled without polling', async () => {
      await page.evaluate(() => {
        document.querySelector('#dynamic-root').innerHTML = '<div id="portal-gift" data-e2e="gift-panel" class="giftBar">礼物面板</div><div data-e2e="living-container"><div id="dynamic-gift" class="giftBar gitBarOptimizeEnabled" style="display:flex"><div data-e2e="gifts-container">延迟加载礼物</div></div></div>';
      });
      await assertHidden(page, '#portal-gift', 'portal gift visible');
      await assertHidden(page, '#dynamic-gift', 'dynamic gift visible');
      await page.mouse.move(50, 50);
      await page.evaluate(() => { document.querySelector('#dynamic-gift').style.display = 'flex'; });
      await assertHidden(page, '#dynamic-gift', 'inline display restored gift bar');
      await page.evaluate(() => {document.querySelector('#dynamic-gift').outerHTML = '<div id="dynamic-gift" class="giftBar gitBarOptimizeEnabled"><div data-e2e="gifts-container">新直播间礼物</div></div>';});
      await assertHidden(page, '#dynamic-gift', 'recreated gift bar visible');
    });
    await check('gift toggle restores and reapplies immediately', async () => {
      await page.getByRole('button', {name:'打开抖音净化设置（可拖动）'}).click();
      await page.locator('.tabs .tab').filter({hasText:'直播'}).click();
      const row = page.locator('.row').filter({hasText:'屏蔽底部送礼栏'});
      await row.getByRole('switch').click();
      await assertVisible(page, '#modern-gift', 'toggle off did not restore gift bar');
      await assertVisible(page, '#legacy-gift', 'toggle off did not restore legacy bar');
      await row.getByRole('switch').click();
      await assertHidden(page, '#modern-gift', 'toggle on did not hide immediately');
      const master = page.locator('.master').getByRole('switch');
      await master.click();
      await assertVisible(page, '#modern-gift', 'master off did not restore gift bar');
      await master.click();
      await assertHidden(page, '#modern-gift', 'master on did not hide gift bar');
    });
    await page.close();
    await check('ordinary www.douyin.com feed is unchanged', async () => {
      const embedded = await openFixture(context, 'www.douyin.com');
      await assertVisible(embedded, '#modern-gift', 'independent live rules leaked into feed');
      await assertVisible(embedded, '#ordinary-gift', 'ordinary feed content hidden');
      await embedded.close();
    });
    await check('saved false setting is respected', async () => {
      const disabled = await openFixture(context, 'live.douyin.com', {removeGiftBar:false});
      await assertVisible(disabled, '#legacy-gift', 'stored false setting was ignored');
      await assertVisible(disabled, '#modern-gift', 'stored false setting was ignored');
      await disabled.close();
    });
  } finally { await browser.close(); }
})().catch(error => { console.error(`FAIL ${error.message}`); process.exitCode = 1; });
