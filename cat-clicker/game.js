'use strict';
const E = window.CatEngine;
const KEY = 'cat-clicker-v02';
const LEGACY_KEY = 'cat-clicker-v01';
const sound = new SoundManager();
const $ = id => document.getElementById(id);
let state = E.initial();
let saveBlocked = false;
let familyKey = '';
let toastTimer;
let previousStage = null;
let eventKind = null;
let importCandidate = null;
let lastTime = performance.now();
const format = n => n < 1e12 ? Math.floor(n).toLocaleString('ja-JP') : n.toExponential(2);
const rate = n => n < 1000 ? n.toLocaleString('ja-JP', { maximumFractionDigits: 1 }) : format(n);
function toast(message) { $('toast').textContent = message; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 1700); }

function serialize(s = state, enabled = sound.enabled) { return JSON.stringify({ ...s, calculated: E.stats(s), seEnabled: enabled }); }
function decode(raw) {
  if (raw.length > 100000) throw Error('データが大きすぎます');
  const restored = E.restore(raw); const data = JSON.parse(raw);
  return { state: restored, seEnabled: typeof data.seEnabled === 'boolean' ? data.seEnabled : true };
}

// Save only this game's namespace. Derived stats are included, then recomputed on load.
function save() {
  if (saveBlocked) { $('save-status').textContent = '保存データを読めませんでした。元データ保護中・保存停止'; return false; }
  try { state.savedAt = Date.now(); localStorage.setItem(KEY, serialize()); $('save-status').textContent = '✓ 保存済み ' + new Date().toLocaleTimeString('ja-JP') + ' · 非表示・閉じている間はお休み'; return true; }
  catch { $('save-status').textContent = '保存できません。このブラウザの保存設定を確認してください'; return false; }
}
function load() {
  try {
    const current = localStorage.getItem(KEY);
    const legacy = current === null ? localStorage.getItem(LEGACY_KEY) : null;
    const raw = current ?? legacy;
    if (raw !== null) { const data = decode(raw); state = data.state; sound.setEnabled(data.seEnabled); }
    if (legacy !== null) toast('V0.1の進行を引き継ぎました');
  }
  catch { saveBlocked = true; $('save-status').textContent = '保存データを読めませんでした。元データ保護中・保存停止'; }
}

// All click sources share the same effect and feedback path.
function feedback(value, automatic = false) {
  const cat = $('cat-button'); cat.classList.remove('boop', 'auto-boop'); void cat.offsetWidth; cat.classList.add(automatic ? 'auto-boop' : 'boop');
  sound.playClick(automatic);
  const add = (text, className, left, top, duration) => {
    if ($('particles').childElementCount >= 16) return;
    const particle = document.createElement('span'); particle.className = 'particle ' + className;
    particle.textContent = text; particle.style.left = left + '%'; particle.style.top = top + '%';
    particle.style.setProperty('--dx', (Math.random() > .5 ? 25 : -25) + 'px');
    $('particles').append(particle); setTimeout(() => particle.remove(), duration);
  };
  add('+' + format(value), automatic ? 'auto' : '', 44 + Math.random() * 12, 40, automatic ? 680 : 880);
  if (!automatic) {
    add('🐾', 'paw', 30 + Math.random() * 12, 58, 850);
    if (Math.random() < .4) add('🐾', 'paw', 61 + Math.random() * 8, 58, 850);
    if (Math.random() < .1) add(['にゃ', 'にゃー', 'ゴロゴロ'][Math.floor(Math.random() * 3)], 'word', 60, 30, 1050);
  }
}
function manualClick() { feedback(E.click(state)); render(); }
function purchase(id) {
  if (!E.buy(state, id)) return;
  const item = E.ITEMS.find(i => i.id === id);
  sound.playPurchase(id === 'cat'); render(); save();
  const card = $('buy-' + id); card.classList.remove('purchased'); void card.offsetWidth; card.classList.add('purchased');
  setTimeout(() => card.classList.remove('purchased'), 560);
  if (id === 'cat') { $('cat-family').lastElementChild?.classList.add('new-cat'); toast('猫を迎えました。仲間が1匹ふえました'); }
  else toast(item.name + 'を購入しました');
}

// Shop buttons persist between frames so keyboard focus is preserved.
function buildShop() {
  $('shop-items').innerHTML = E.ITEMS.map(i => `<button class="shop-item" id="buy-${i.id}" data-item="${i.id}"><span class="item-icon" aria-hidden="true">${i.icon}</span><span><span class="item-name">${i.name}<span class="owned"></span></span><span class="item-effect">${i.effect}</span></span><span class="cost"><span></span><small>にゃん</small></span></button>`).join('');
  $('shop-items').addEventListener('click', event => { const button = event.target.closest('[data-item]'); if (button) purchase(button.dataset.item); });
}
function renderFamily() {
  const cats = E.stats(state).cats;
  const key = cats + ':' + state.selectedCat;
  if (familyKey === key) return; familyKey = key;
  $('cat-button').innerHTML = renderCat(state.selectedCat);
  $('cat-name').textContent = E.TYPES[state.selectedCat];
  $('cat-count').textContent = format(cats) + '匹';
  $('cat-family').innerHTML = Array.from({ length: Math.min(14, cats) }, (_, i) => `<button class="family-cat" data-cat="${i % 7}" aria-label="${E.TYPES[i % 7]}を選ぶ" aria-pressed="${i % 7 === state.selectedCat}">${renderCat(i % 7)}<span>${E.TYPES[i % 7]}</span></button>`).join('');
  $('family-note').textContent = cats > 14 ? '代表14匹 · 横にスクロールで選択' : cats > 7 ? '横にスクロールで選択' : '選んで、なでる猫を変更';
}
function renderEvents() {
  const event = state.event; const area = $('event-area');
  const kind = event?.kind || '';
  if (kind !== eventKind) {
    if (kind && eventKind !== null) sound.playEvent();
    eventKind = kind;
    area.dataset.kind = kind; area.classList.toggle('active', Boolean(kind)); $('scene').dataset.event = kind;
    $('event-visual').replaceChildren();
    $('scene-event-label').hidden = !kind;
    const messages = {box:'📦 お届けもの！ 部屋の箱をクリック', treat:'🐟 おやつタイム！ 自動生産 ×5', race:'🐾 深夜の運動会！ 自動生産 ×3'};
    $('event-message').textContent = messages[kind] || '☀ いつもの猫日和。たまに、いいことが起こります。';
    $('scene-event-label').textContent = {box:'お届けもの',treat:'おやつタイム ×5',race:'深夜の運動会 ×3'}[kind] || '';
    if (kind === 'box') {
      $('event-visual').innerHTML = '<button id="claim-box" aria-label="段ボール箱をあけてポイント獲得"><svg viewBox="0 0 120 92" aria-hidden="true"><path d="M19 30L62 14L105 30L105 74L62 90L19 72Z" fill="#d6a763" stroke="#9c783f" stroke-width="2.5"/><path d="M19 30L62 46L105 30M62 46V90" fill="none" stroke="#a57e43" stroke-width="2.5"/><path d="M19 30L7 16L49 2L62 14L75 2L118 17L105 30L62 46Z" fill="#e9c58c" stroke="#9c783f" stroke-width="2.5"/><path d="M41 52l5 2v12l-5-2m37-6 10-4" stroke="#a37d43" stroke-width="3" fill="none"/></svg><span>あける！</span></button>';
      $('claim-box').onclick = () => { const n = E.claimBox(state); if (n) { sound.playBox(); toast('箱の中から +' + format(n) + ' にゃん！'); render(); save(); } };
    } else if (kind === 'treat') $('event-visual').innerHTML = '<span class="snack" style="--x:18%;--delay:0s" aria-hidden="true">🐟</span><span class="snack" style="--x:78%;--delay:-1.8s" aria-hidden="true">🐟</span>';
    else if (kind === 'race') $('event-visual').innerHTML = `<div class="runner" aria-hidden="true">${renderCat(1)}</div><div class="runner second" aria-hidden="true">${renderCat(5)}</div>`;
  }
  $('event-countdown').textContent = event ? 'あと ' + Math.ceil(event.remaining) + '秒' : '';
}
function render() {
  const st = E.stats(state);
  $('points').textContent = format(state.points); $('click-value').textContent = '+' + rate(st.click); $('production').textContent = '+' + rate(st.perSecond);
  $('auto').setAttribute('aria-pressed', String(state.auto)); $('auto').querySelector('b').textContent = state.auto ? 'ON' : 'OFF';
  $('sound').setAttribute('aria-pressed', String(sound.enabled)); $('sound').querySelector('b').textContent = sound.enabled ? 'ON' : 'OFF';
  for (const i of E.ITEMS) { const b = $('buy-' + i.id); const cost = E.price(state, i.id); b.disabled = state.points < cost || !Number.isFinite(cost) || cost > 1e100; b.querySelector('.owned').textContent = '×' + state.purchases[i.id]; b.querySelector('.cost span').textContent = cost > 1e100 ? '上限' : format(cost); }
  const stages = [{ name:'普通の猫部屋', threshold:0 }, { name:'猫屋敷', threshold:2000 }, { name:'猫の街', threshold:50000 }, { name:'猫文明', threshold:1000000 }];
  let index = 0; while (index < 3 && state.earned >= stages[index + 1].threshold) index++;
  if (previousStage !== null && index > previousStage) { sound.playStageUp(); document.querySelector('.play').classList.add('stage-flash'); setTimeout(() => document.querySelector('.play').classList.remove('stage-flash'), 950); toast(stages[index].name + 'に発展しました！'); }
  previousStage = index;
  $('stage').textContent = '0' + (index + 1) + ' / ' + stages[index].name;
  const next = stages[index + 1]; $('next-stage').textContent = next ? next.name + 'まで（累計獲得）' : '猫文明、今日も発展中'; $('progress-text').textContent = next ? format(state.earned) + ' / ' + format(next.threshold) : '累計 ' + format(state.earned); $('progress-bar').style.width = next ? Math.min(100, state.earned / next.threshold * 100) + '%' : '100%';
  renderFamily(); renderEvents();
}

load(); buildShop(); render();
if (!saveBlocked) save();
// Capture phase unlocks audio before the first button's click handler.
document.addEventListener('pointerdown', () => sound.unlock(), { capture:true });
document.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') sound.unlock(); }, { capture:true });
$('sound').onclick = () => { sound.setEnabled(!sound.enabled); if (sound.enabled) { sound.unlock(); sound.playClick(); } render(); save(); };
$('cat-button').addEventListener('click', manualClick);
$('auto').onclick = () => { E.setAuto(state, !state.auto); render(); save(); };
$('cat-family').onclick = event => { const cat = event.target.closest('[data-cat]'); if (cat) { state.selectedCat = Number(cat.dataset.cat); renderFamily(); save(); } };
$('save').onclick = () => { toast(save() ? '保存しました' : '保存できません。画面下の案内をご確認ください'); };
$('reset').onclick = () => $('reset-dialog').showModal();
$('cancel-reset').onclick = () => $('reset-dialog').close();
$('confirm-reset').onclick = () => {
  const fresh = E.initial();
  // Write the empty V0.2 save directly, so reset cannot re-import the legacy key.
  try { localStorage.setItem(KEY, serialize(fresh)); } catch { toast('保存データを変更できませんでした。リセットを中止しました'); return; }
  state = fresh; saveBlocked = false; familyKey = ''; previousStage = null; eventKind = null; lastTime = performance.now(); sound.stopAll(); $('particles').replaceChildren(); $('reset-dialog').close(); render(); save(); toast('新しい猫暮らしが始まりました');
};

// One small import/export dialog handles file:// storage isolation without editing V0.1.
$('transfer').onclick = () => { importCandidate = null; $('apply-import').hidden = true; $('import-data').value = ''; $('import-status').textContent = 'V0.1とV0.2の形式に対応しています。'; $('transfer-dialog').showModal(); };
$('close-transfer').onclick = () => $('transfer-dialog').close();
$('import-data').oninput = () => { importCandidate = null; $('apply-import').hidden = true; };
$('preview-import').onclick = () => {
  try { importCandidate = decode($('import-data').value.trim()); const s = importCandidate.state; $('import-status').textContent = `${format(s.points)}にゃん / 猫${E.stats(s).cats}匹 / オート${s.auto ? 'ON' : 'OFF'}。この進行で現在のデータを置き換えます。`; $('apply-import').hidden = false; }
  catch { importCandidate = null; $('apply-import').hidden = true; $('import-status').textContent = '保存データを確認できません。JSON全体を貼り付けてください。現在のデータは変更していません。'; }
};
$('apply-import').onclick = () => {
  if (!importCandidate) return;
  try { localStorage.setItem(KEY, serialize(importCandidate.state, importCandidate.seEnabled)); }
  catch { $('import-status').textContent = '保存できないため読み込みを中止しました。ブラウザの保存設定をご確認ください。'; return; }
  state = importCandidate.state; sound.setEnabled(importCandidate.seEnabled); saveBlocked = false; familyKey = ''; previousStage = null; eventKind = null; lastTime = performance.now(); $('particles').replaceChildren(); render(); save(); $('transfer-dialog').close(); importCandidate = null; toast('進行を引き継ぎました');
};
$('export-save').onclick = () => {
  const url = URL.createObjectURL(new Blob([serialize()], { type:'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'cat-clicker-v02-save.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
// Hidden tabs pause. No catch-up burst, and no clock-dependent offline rewards.
setInterval(() => { const now = performance.now(); const dt = (now - lastTime) / 1000; lastTime = now; if (document.hidden) return; const count = E.tick(state, Math.min(dt, 1)); if (count) feedback(E.stats(state).click, true); render(); }, 100);
setInterval(save, 5000);
document.addEventListener('visibilitychange', () => { lastTime = performance.now(); if (document.hidden) { sound.stopAll(); save(); } });
window.addEventListener('pagehide', save);
