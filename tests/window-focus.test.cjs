const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { chromium } = require('playwright');
const scriptPath = path.resolve(__dirname, '../dist/douyin-paarollfix.user.js');
const source = fs.readFileSync(scriptPath, 'utf8');
const vueSource = fs.readFileSync(require.resolve('vue/dist/vue.global.prod.js'), 'utf8');
const fixture = `<!doctype html><html><head><style>
body { margin:0; } .douyin-player { width:900px; height:500px; background:#222; }
video {display:block; width:900px; height:400px;} button {height:32px;}
.douyin-player-controls, xg-controls, .xgplayer-controls {display:block; opacity:1; visibility:visible;}
</style></head><body><div data-e2e="living-container"><div class="F5Mbv3g1 douyin-player douyin-player-active">
<video id="stream"></video><div class="douyin-player-controls"><div class="douyin-player-controls-inner">
<button id="volume">音量</button><button id="fullscreen">全屏</button>
<div class="douyin-player-controls-right"><button class="tmNdnn5Q" id="quality">原画</button><button data-e2e="danmaku-setting-icon" id="danmaku">弹幕设置</button><button data-e2e="gift-setting" id="gift-setting">礼物设置</button></div>
</div></div></div></div>
<xg-controls id="legacy-controls"><xg-inner-controls><button>旧版音量</button></xg-inner-controls></xg-controls>
<div id="class-controls" class="xgplayer-controls"><button>旧版全屏</button></div>
<div id="BottomLayout"><div class="gitBarOptimizeEnabled"><div data-e2e="gifts-container">礼物</div></div><button id="normal-multicam">多机位</button></div>
<input id="chat" placeholder="聊天"/><div id="dynamic-root"></div>
<script>
window.testFocus = true;
Object.defineProperty(document, 'hasFocus', {configurable:true,value:()=>window.testFocus});
window.mouseEvents = 0; window.controlClicks = 0; window.qualityClicks = 0;
window.setTestFocus = value => {window.testFocus=value; window.dispatchEvent(new Event(value?'focus':'blur'));};
document.addEventListener('mousemove', () => {
  window.mouseEvents++;
  document.querySelector('.douyin-player').classList.add('douyin-player-active','douyin-player-focus');
  document.querySelectorAll('.douyin-player-controls,xg-controls,.xgplayer-controls').forEach(e=>{e.style.opacity='1';e.style.visibility='visible';});
});
document.addEventListener('click', e => {if(e.target.closest('.douyin-player-controls'))window.controlClicks++;if(e.target.closest('#quality'))window.qualityClicks++;});
</script></body></html>`;

async function setup(context, {focused=true,live={},host='live.douyin.com'} = {}) {
  const page = await context.newPage();
  await page.route('**/*', route => route.fulfill({contentType:'text/html',body:fixture}));
  await page.goto(`https://${host}/123456789`,{waitUntil:'domcontentloaded'});
  await page.addScriptTag({content:vueSource});
  await page.evaluate(({focused,live}) => {
    window.testFocus=focused;
    window.testStored = {enabled:true,video:{skipAd:false,skipShop:false,skipLive:false,autoHD:false},live:{removeGiftBar:true,removeGiftAnim:false,removeAdvancedDanmaku:false,removeRoomInfoTags:false,blockGiftMsg:false,autoHD:false,...live}};
    window.GM_getValue=(key,fallback)=>key==='fd_config'?window.testStored:fallback;
    window.GM_setValue=(key,value)=>{if(key==='fd_config')window.testStored=JSON.parse(JSON.stringify(value));};
    window.GM_addStyle=text=>{const s=document.createElement('style');s.textContent=text;document.head.append(s);};
  },{focused,live});
  await page.addScriptTag({content:source});
  return page;
}
const visible=(page,selector)=>page.locator(selector).evaluate(e=>e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}));
const focus=(page,value)=>page.evaluate(value=>window.setTestFocus(value),value);
const wake=page=>page.evaluate(()=>document.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,clientX:450,clientY:450})));

(async()=>{
  const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||undefined,headless:true});
  const context=await browser.newContext({locale:'zh-CN',viewport:{width:1440,height:900}});
  async function check(name,run,options) {
    await test(name,async()=>{
      const page=await setup(context,options);
      try {await run(page);} finally {await page.close();}
    });
  }
  try {
    await check('page-triggered menu stays hidden after window blur',async page=>{
      await focus(page,false); await wake(page);
      assert.equal(await visible(page,'.douyin-player-controls'),false,'page mousemove revived bottom controls in an unfocused window');
    });
    await check('focus restores native controls and background video geometry is preserved',async page=>{
      const before=await page.locator('#stream').boundingBox();
      await focus(page,false);
      assert.equal(await visible(page,'#stream'),true);
      assert.deepEqual(await page.locator('#stream').boundingBox(),before);
      assert.equal(await visible(page,'#chat'),true);
      assert.equal(await page.getByRole('button',{name:'打开抖音净化设置（可拖动）'}).isVisible(),true);
      await focus(page,true);await wake(page);
      for(const selector of ['#volume','#fullscreen','#quality'])assert.equal(await visible(page,selector),true);
    });
    await check('legacy controls also stay hidden in an unfocused window',async page=>{
      await focus(page,false);await wake(page);
      for(const selector of ['#legacy-controls','#class-controls'])assert.equal(await visible(page,selector),false);
      await focus(page,true);
      for(const selector of ['#legacy-controls','#class-controls'])assert.equal(await visible(page,selector),true);
    });
    await check('normal-layout multi-camera entry hides and restores with its bottom bar',async page=>{
      assert.equal(await visible(page,'#normal-multicam'),true);
      await focus(page,false);await wake(page);
      assert.equal(await visible(page,'#normal-multicam'),false);
      await focus(page,true);
      assert.equal(await visible(page,'#normal-multicam'),true);
    });
    await check('blur without document focus loss leaves controls usable for iframe interaction',async page=>{
      await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
      assert.equal(await visible(page,'#volume'),true);
    });
    await check('initially unfocused page is protected without waiting for a blur event',async page=>{
      await wake(page);assert.equal(await visible(page,'.douyin-player-controls'),false);
    },{focused:false});
    await check('dynamically rebuilt controls remain hidden without an observer',async page=>{
      await focus(page,false);
      await page.evaluate(()=>document.querySelector('.douyin-player-controls').outerHTML='<div class="douyin-player-controls" style="opacity:1;visibility:visible"><button id="rebuilt">新控制条</button></div>');
      assert.equal(await visible(page,'#rebuilt'),false);
      await focus(page,true);assert.equal(await visible(page,'#rebuilt'),true);
    });
    await check('separate option and master switch restore controls immediately',async page=>{
      await page.getByRole('button',{name:'打开抖音净化设置（可拖动）'}).click();
      await page.locator('.tabs .tab').filter({hasText:'直播'}).click();
      const toggle=page.locator('.row').filter({hasText:'失焦时隐藏控制栏'}).getByRole('switch');
      await focus(page,false);assert.equal(await visible(page,'#volume'),false);
      await toggle.click();assert.equal(await visible(page,'#volume'),true);
      await toggle.click();assert.equal(await visible(page,'#volume'),false);
      const master=page.locator('.master').getByRole('switch');
      await master.click();assert.equal(await visible(page,'#volume'),true);
      await master.click();assert.equal(await visible(page,'#volume'),false);
    });
    await check('saved false setting retains native behavior',async page=>{
      await wake(page);assert.equal(await visible(page,'#volume'),true);
    },{focused:false,live:{hideControlsWhenBlurred:false}});
    await check('background automatic settings send no mouse events or clicks',async page=>{
      await page.waitForTimeout(1700);
      const events=await page.evaluate(()=>({mouse:window.mouseEvents,clicks:window.controlClicks,quality:window.qualityClicks}));
      assert.deepEqual(events,{mouse:0,clicks:0,quality:0});
    },{focused:false,live:{removeGiftAnim:true,removeAdvancedDanmaku:true,blockGiftMsg:true,autoHD:true}});
    await check('losing focus during asynchronous setup stops later simulated input',async page=>{
      await page.waitForFunction(()=>window.mouseEvents>0);
      await focus(page,false);
      const events=await page.evaluate(()=>({mouse:window.mouseEvents,clicks:window.controlClicks}));
      await page.waitForTimeout(900);
      assert.deepEqual(await page.evaluate(()=>({mouse:window.mouseEvents,clicks:window.controlClicks})),events);
    },{live:{blockGiftMsg:true}});
    await check('automatic settings can resume after focus returns',async page=>{
      await focus(page,true);
      await page.waitForFunction(()=>window.mouseEvents>0,null,{timeout:2500});
      assert.ok(await page.evaluate(()=>window.mouseEvents>0));
    },{focused:false,live:{blockGiftMsg:true}});
    await check('ordinary feed has no window-focus override',async page=>{
      await focus(page,false);await wake(page);
      assert.equal(await visible(page,'#volume'),true);
      assert.equal(await page.evaluate(()=>document.documentElement.hasAttribute('data-fd-live-blurred')),false);
    },{host:'www.douyin.com'});
  } finally {await browser.close();}
})().catch(error=>{console.error(`FAIL ${error.stack}`);process.exitCode=1;});
