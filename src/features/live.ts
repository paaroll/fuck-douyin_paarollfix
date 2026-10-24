/**
 * Live-room cleanup features: dynamic stylesheet for static hides, plus
 * hover-and-click automation for the gift-effect / danmaku settings panels.
 */

import { watch } from 'vue';
import { config } from '@/config/store';

const STYLE_ID = 'fd-live-style';
const HIDDEN_CLASS = 'fd-live-hidden';
const CHECK_MS = 1500;
const GIFT_ROW_SELECTOR = ':is(#BottomLayout,.douyin-player-controls)>div:has(>.gitBarOptimizeEnabled)';
const BLURRED_ATTRIBUTE = 'data-fd-live-blurred';
const QUALITY_DELAY_MS = 5000;

let timer: number | undefined;
let triedQuality = false;
let triedGiftSettings = false;
let applyingGiftSettings = false;
let lastRoomKey = '';
let lastSettingsKey = '';

function isLiveHost(): boolean {
  return location.hostname === 'live.douyin.com';
}

function enabled(key: string): boolean {
  return config.enabled && config.live[key] === true;
}

function canAutomateLiveControls(): boolean {
  return config.enabled && (!enabled('hideControlsWhenBlurred') || document.hasFocus());
}

function syncLiveWindowFocus(): void {
  document.documentElement.toggleAttribute(
    BLURRED_ATTRIBUTE,
    enabled('hideControlsWhenBlurred') && !document.hasFocus(),
  );
}

function syncRoomState(): void {
  const roomKey = location.pathname;
  const settingsKey = [
    enabled('removeGiftAnim'),
    enabled('removeAdvancedDanmaku'),
    enabled('blockGiftMsg'),
  ].join(':');
  if (roomKey === lastRoomKey && settingsKey === lastSettingsKey) return;

  lastRoomKey = roomKey;
  lastSettingsKey = settingsKey;
  triedQuality = false;
  triedGiftSettings = false;
}

function css(): string {
  const rules: string[] = [];

  if (enabled('hideControlsWhenBlurred')) {
    rules.push(
      `:root[${BLURRED_ATTRIBUTE}] :is(.douyin-player-controls,xg-controls,.xgplayer-controls,xg-inner-controls,.xg-inner-controls,#BottomLayout:not(:has(video))){opacity:0!important;visibility:hidden!important;pointer-events:none!important;transition:none!important;}`,
    );
  }

  if (enabled('removeGiftBar')) {
    rules.push(
      // Fullscreen moves the gift row out of BottomLayout and into the controls.
      '#BottomLayout:not(:has(.gitBarOptimizeEnabled)):not(:has(video)),.gitBarOptimizeEnabled:not(:has(video)),[data-e2e="gifts-container"],[data-e2e="gift-panel"],[data-e2e="gift-bar"],#giftPanelEntrance{display:none!important;}',
      `${GIFT_ROW_SELECTOR}:not(:has(>:not(.gitBarOptimizeEnabled))){display:none!important;}`,
      // Keep a shared multi-camera entry usable while collapsing the gift row.
      `${GIFT_ROW_SELECTOR}{height:auto!important;min-height:0!important;padding:0!important;}`,
      `${GIFT_ROW_SELECTOR}>:not(.gitBarOptimizeEnabled){height:32px!important;min-height:0!important;}`,
      '.douyin-player-controls:has(>div>.gitBarOptimizeEnabled){height:auto!important;}',
      'xg-controls>div:has([data-e2e="gifts-container"]):not(:has(video)):not(:has(xg-inner-controls)){display:none!important;}',
      'xg-inner-controls,.xg-inner-controls{bottom:8px!important;}',
    );
  }

  if (enabled('removeGiftAnim')) {
    rules.push(
      '#flutterLike{display:none!important;}',
      '.VLPIYL3T{display:none!important;}',
      '.gpFFz2G_{display:none!important;}',
    );
  }

  if (enabled('removeAdvancedDanmaku')) {
    rules.push(
      '.YqmICJp1{opacity:0!important;}',
      '.webcast-chatroom___bottom-message{opacity:0!important;}',
      '.Mv2estbj{display:none!important;}',
      '.Y0sC3Fms{display:none!important;}',
      '.ZUGMpBcb{display:none!important;}',
    );
  }

  if (enabled('removeRoomInfoTags')) {
    rules.push(`.${HIDDEN_CLASS}{display:none!important;}`, '#room_info_bar{display:none!important;}');
  }

  return rules.join('\n');
}

function syncStyle(): void {
  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = css();
}

function removeHiddenMarkers(): void {
  for (const el of document.querySelectorAll(`.${HIDDEN_CLASS}`)) {
    el.classList.remove(HIDDEN_CLASS);
  }
}

function normalizeText(el: Element): string {
  return el.textContent?.replace(/\s+/g, '') ?? '';
}

function pointsToLiveHome(anchor: HTMLAnchorElement): boolean {
  try {
    const url = new URL(anchor.href, location.href);
    return url.hostname === 'live.douyin.com' && url.pathname === '/';
  } catch {
    return false;
  }
}

function hideSmallAnchorContainer(anchor: HTMLAnchorElement): void {
  const parent = anchor.parentElement;
  if (parent && parent.childElementCount === 1) {
    parent.classList.add(HIDDEN_CLASS);
    return;
  }

  anchor.classList.add(HIDDEN_CLASS);
}

function syncRoomInfoTags(): void {
  if (!enabled('removeRoomInfoTags')) {
    removeHiddenMarkers();
    return;
  }

  for (const anchor of document.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    if (!pointsToLiveHome(anchor)) continue;
    if (!normalizeText(anchor).includes('更多直播')) continue;
    hideSmallAnchorContainer(anchor);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function dispatchMouse(el: EventTarget, type: string, x: number, y: number): void {
  if (!canAutomateLiveControls()) return;
  el.dispatchEvent(
    new MouseEvent(type, {
      view: window,
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
    }),
  );
}

function simulateClick(el: Element): void {
  const rect = el.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  for (const type of ['mouseenter', 'mouseover', 'mousemove', 'mousedown', 'mouseup', 'click']) {
    dispatchMouse(el, type, x, y);
  }
}

function activatePlayer(player: HTMLElement): void {
  if (!canAutomateLiveControls()) return;
  player.classList.remove('douyin-player-inactive');
  player.classList.add('douyin-player-active', 'douyin-player-focus');

  const rect = player.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  dispatchMouse(document, 'mousemove', x, y);
  dispatchMouse(player, 'mousemove', x, y);
}

async function waitForElement<T extends Element>(selector: string, timeoutMs: number): Promise<T | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const element = document.querySelector<T>(selector);
    if (element) return element;
    await sleep(100);
  }
  return null;
}

async function openPanel(
  player: HTMLElement,
  buttonSelector: string,
  panelSelector: string,
): Promise<HTMLElement | null> {
  if (!canAutomateLiveControls()) return null;
  activatePlayer(player);
  await sleep(300);
  if (!canAutomateLiveControls()) return null;

  const button = document.querySelector<HTMLElement>(buttonSelector);
  if (!button) return null;

  const playerRect = player.getBoundingClientRect();
  const buttonRect = button.getBoundingClientRect();
  const buttonX = buttonRect.left + buttonRect.width / 2;
  const buttonY = buttonRect.top + buttonRect.height / 2;
  for (const [x, y] of [
    [playerRect.left + playerRect.width / 2, playerRect.top + playerRect.height / 2],
    [buttonX, playerRect.top + playerRect.height * 0.85],
    [buttonX, buttonY],
  ]) {
    dispatchMouse(document, 'mousemove', x, y);
    dispatchMouse(player, 'mousemove', x, y);
  }

  await sleep(150);
  if (!canAutomateLiveControls()) return null;
  simulateClick(button);
  const panel = await waitForElement<HTMLElement>(panelSelector, 1200);
  if (!canAutomateLiveControls()) {
    if (panel) closePanel(panel);
    return null;
  }
  panel?.style.removeProperty('display');
  return panel;
}

function closePanel(panel: HTMLElement): void {
  panel.style.display = 'none';
}

function clickOriginalQuality(): boolean {
  if (!canAutomateLiveControls() || !enabled('autoHD') || triedQuality) return false;

  const controls = document.querySelector('div.douyin-player-controls-right');
  if (!controls) return false;

  for (const el of controls.querySelectorAll<HTMLElement>('.tmNdnn5Q')) {
    if (!el.textContent?.includes('原画')) continue;
    el.click();
    triedQuality = true;
    return true;
  }

  return false;
}

type SettingResult = 'changed' | 'settled' | 'missing' | 'panel-missing';

function isSwitchChecked(el: HTMLElement): boolean | undefined {
  const attrOwner = el.matches('[aria-checked], [data-state]')
    ? el
    : el.querySelector<HTMLElement>('[aria-checked], [data-state]');
  const ariaChecked = attrOwner?.getAttribute('aria-checked');
  if (ariaChecked === 'true') return true;
  if (ariaChecked === 'false') return false;

  const dataState = attrOwner?.getAttribute('data-state');
  if (dataState === 'checked' || dataState === 'on' || dataState === 'open') return true;
  if (dataState === 'unchecked' || dataState === 'off' || dataState === 'closed') return false;

  const input = el.matches('input')
    ? (el as HTMLInputElement)
    : el.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (input) return input.checked;

  return el.classList.contains('SpsbqNUm');
}

function findToggle(panel: HTMLElement, labelText: string): HTMLElement | null {
  for (const label of panel.querySelectorAll<HTMLElement>('*')) {
    if (label.children.length > 0 || !normalizeText(label).includes(labelText)) continue;

    let row: HTMLElement | null = label.parentElement;
    while (row && row !== panel) {
      const toggle = row.querySelector<HTMLElement>('.dNuSIvAp');
      if (toggle) return toggle;
      row = row.parentElement;
    }
  }
  return null;
}

async function setNamedToggle(
  panel: HTMLElement,
  label: string,
  desiredOn: boolean,
): Promise<SettingResult> {
  if (!canAutomateLiveControls()) return 'panel-missing';
  const toggle = findToggle(panel, label);
  if (!toggle) return 'missing';
  if (isSwitchChecked(toggle) === desiredOn) return 'settled';

  simulateClick(toggle);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await sleep(100);
    if (isSwitchChecked(toggle) === desiredOn) return 'changed';
  }
  return 'missing';
}

function combineResults(results: SettingResult[]): SettingResult {
  if (results.some((result) => result === 'panel-missing')) return 'panel-missing';
  if (results.some((result) => result === 'missing')) return 'missing';
  if (results.some((result) => result === 'changed')) return 'changed';
  return 'settled';
}

async function configureDanmakuPanel(player: HTMLElement): Promise<SettingResult> {
  const targets: Array<[string, boolean]> = [];
  if (enabled('blockGiftMsg')) {
    targets.push(['送礼信息', false], ['福袋口令', false]);
  }
  if (enabled('removeAdvancedDanmaku')) targets.push(['高级弹幕', false]);
  if (targets.length === 0) return 'settled';

  const panel = await openPanel(
    player,
    '[data-e2e="danmaku-setting-icon"]',
    '.UMXOdhRc',
  );
  if (!panel) return 'panel-missing';

  try {
    const results: SettingResult[] = [];
    for (const [label, desiredOn] of targets) {
      results.push(await setNamedToggle(panel, label, desiredOn));
    }
    return combineResults(results);
  } finally {
    await sleep(200);
    closePanel(panel);
  }
}

async function configureGiftPanel(player: HTMLElement): Promise<SettingResult> {
  if (!enabled('removeGiftAnim')) return 'settled';

  const panel = await openPanel(player, '[data-e2e="gift-setting"]', '.BMrAdi9a');
  if (!panel) return 'panel-missing';

  try {
    return await setNamedToggle(panel, '屏蔽礼物特效', true);
  } finally {
    await sleep(200);
    closePanel(panel);
  }
}

async function applyGiftSettings(): Promise<boolean> {
  if (!canAutomateLiveControls()) return false;
  if (
    (!enabled('removeGiftAnim') &&
      !enabled('removeAdvancedDanmaku') &&
      !enabled('blockGiftMsg')) ||
    triedGiftSettings ||
    applyingGiftSettings
  ) {
    return false;
  }
  const player = document.querySelector<HTMLElement>('.F5Mbv3g1');
  if (!player) return false;
  const runKey = `${lastRoomKey}|${lastSettingsKey}`;
  applyingGiftSettings = true;

  try {
    const danmakuResult = await configureDanmakuPanel(player);
    await sleep(500);
    const giftResult = await configureGiftPanel(player);
    const result = combineResults([danmakuResult, giftResult]);

    if (
      runKey === `${lastRoomKey}|${lastSettingsKey}` &&
      result !== 'panel-missing'
    ) {
      triedGiftSettings = true;
    }
    return result === 'changed';
  } finally {
    applyingGiftSettings = false;
  }
}

function tick(): void {
  syncRoomState();
  syncLiveWindowFocus();
  syncStyle();
  syncRoomInfoTags();
  clickOriginalQuality();
  void applyGiftSettings();
}

export function startLiveEngine(): void {
  if (timer !== undefined) return;
  if (!isLiveHost()) return;

  syncLiveWindowFocus();
  syncStyle();
  window.addEventListener('focus', syncLiveWindowFocus);
  window.addEventListener('blur', syncLiveWindowFocus);
  document.addEventListener('visibilitychange', syncLiveWindowFocus);
  watch(
    () => [config.enabled, config.live.removeGiftBar, config.live.hideControlsWhenBlurred],
    () => {
      syncLiveWindowFocus();
      syncStyle();
    },
    { flush: 'sync' },
  );
  window.setTimeout(() => {
    clickOriginalQuality();
  }, QUALITY_DELAY_MS);
  timer = window.setInterval(tick, CHECK_MS);
  tick();
}
