(function (root) {
  'use strict';
  const ITEMS = [
    { id: 'cat', name: '猫を迎える', icon: '🐈', base: 15, growth: 1.18, effect: '猫 +1匹 / 毎秒 +1', type: '生産' },
    { id: 'wand', name: '猫じゃらし', icon: '🪶', base: 25, growth: 1.22, effect: 'クリックの基礎獲得量 +1', type: 'クリック' },
    { id: 'scratch', name: '爪とぎ', icon: '🪵', base: 100, growth: 1.20, effect: '毎秒 +5', type: '生産' },
    { id: 'tower', name: 'キャットタワー', icon: '🏠', base: 180, growth: 1.22, effect: '全ての猫の生産量 +20%（加算）', type: '猫強化' },
    { id: 'feeder', name: '自動給餌器', icon: '🥣', base: 550, growth: 1.21, effect: '毎秒 +25', type: '生産' },
    { id: 'treat', name: '高級おやつ', icon: '🐟', base: 350, growth: 2.8, effect: 'クリック獲得量 ×2', type: 'クリック' },
    { id: 'cafe', name: '猫の喫茶店', icon: '☕', base: 2600, growth: 1.22, effect: '毎秒 +120', type: '生産' },
    { id: 'city', name: '猫の市役所', icon: '🏛️', base: 14000, growth: 1.23, effect: '毎秒 +650', type: '生産' }
  ];
  const TYPES = ['茶トラ', '黒猫', '白猫', '三毛猫', 'ハチワレ', 'サバトラ', '長毛猫'];
  const MAX = 1e100;
  const clamp = n => Math.min(MAX, Math.max(0, n));
  const initial = () => ({ version: 1, points: 0, earned: 0, purchases: Object.fromEntries(ITEMS.map(i => [i.id, 0])), auto: false, autoElapsed: 0, eventIn: 150, event: null, selectedCat: 0, savedAt: 0 });
  function stats(s) {
    const p = s.purchases;
    const click = clamp((1 + p.wand) * 2 ** p.treat);
    const base = clamp(p.cat * (1 + p.tower * .2) + p.scratch * 5 + p.feeder * 25 + p.cafe * 120 + p.city * 650);
    return { click, base, perSecond: clamp(base * (s.event?.kind === 'treat' ? 5 : s.event?.kind === 'race' ? 3 : 1)), cats: 1 + p.cat };
  }
  function price(s, id) { const i = ITEMS.find(i => i.id === id); return i ? Math.ceil(i.base * i.growth ** s.purchases[id]) : Infinity; }
  function gain(s, n) { n = clamp(n); s.points = clamp(s.points + n); s.earned = clamp(s.earned + n); return n; }
  function click(s) { return gain(s, stats(s).click); }
  function buy(s, id) { const cost = price(s, id); if (!Number.isFinite(cost) || cost > s.points || cost > MAX) return false; s.points -= cost; s.purchases[id]++; return true; }
  // Kept independent: speed and multi-click upgrades can be added here later.
  function autoClick(s, seconds, interval = 1) {
    if (!s.auto) { s.autoElapsed = 0; return 0; }
    s.autoElapsed += seconds;
    const count = Math.floor((s.autoElapsed + 1e-9) / interval);
    s.autoElapsed -= count * interval;
    if (count) gain(s, stats(s).click * count);
    return count;
  }
  function setAuto(s, enabled) { s.auto = enabled; s.autoElapsed = 0; }
  function startEvent(s, kind) { s.event = { kind, remaining: kind === 'box' ? 25 : 30 }; }
  function claimBox(s) { if (s.event?.kind !== 'box') return 0; const reward = gain(s, Math.max(100, stats(s).base * 45 + stats(s).click * 20)); s.event = null; return reward; }
  function tick(s, seconds, random = Math.random) {
    const dt = Math.max(0, Math.min(seconds, 60));
    const active = Math.min(dt, s.event?.remaining || 0);
    const st = stats(s);
    gain(s, st.perSecond * active + st.base * (dt - active));
    const clicks = autoClick(s, dt);
    if (s.event) { s.event.remaining -= dt; if (s.event.remaining <= 0) s.event = null; }
    s.eventIn -= dt;
    if (s.eventIn <= 0) { startEvent(s, ['box', 'treat', 'race'][Math.min(2, Math.floor(random() * 3))]); s.eventIn = 150 + random() * 90; }
    return clicks;
  }
  function restore(raw) {
    const d = JSON.parse(raw);
    if (!d || d.version !== 1 || !d.purchases || typeof d.auto !== 'boolean') throw Error('保存形式が不正です');
    const s = initial();
    for (const key of ['points', 'earned']) { if (!Number.isFinite(d[key]) || d[key] < 0 || d[key] > MAX) throw Error('保存数値が不正です'); s[key] = d[key]; }
    for (const i of ITEMS) { const n = d.purchases[i.id]; if (!Number.isInteger(n) || n < 0 || n > 1500 || (i.id === 'treat' && n > 330)) throw Error('購入記録が不正です'); s.purchases[i.id] = n; }
    s.auto = d.auto;
    s.selectedCat = Number.isInteger(d.selectedCat) && d.selectedCat >= 0 && d.selectedCat < TYPES.length ? d.selectedCat : 0;
    s.eventIn = Number.isFinite(d.eventIn) ? Math.min(240, Math.max(1, d.eventIn)) : 150;
    if (d.event && ['box', 'treat', 'race'].includes(d.event.kind) && Number.isFinite(d.event.remaining) && d.event.remaining > 0) s.event = { kind: d.event.kind, remaining: Math.min(30, d.event.remaining) };
    s.earned = Math.max(s.earned, s.points); return s;
  }
  const api = { ITEMS, TYPES, initial, stats, price, click, buy, gain, tick, autoClick, setAuto, startEvent, claimBox, restore };
  if (typeof module !== 'undefined') module.exports = api; else root.CatEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
