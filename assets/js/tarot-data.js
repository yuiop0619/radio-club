/* ============================================================
   tarot-data.js — 大阿尔卡纳 22 张（正位／逆位）+ 封印符号
   每张牌背面按 id 选用不同封印，给每张牌补一行「短牌义」
   ============================================================ */
(function () {
  /* ---------- 内容见 content/tarot.json ----------
     22 张大阿尔卡纳（正/逆位牌义）、封印符号、三种牌阵模板。 */
  var TC = (window.RC_CONTENT && window.RC_CONTENT.tarot) || {};
  var POSITIONS = TC.positions || {};
  var A     = TC.arcana || [];
  var SEALS = TC.seals || [];
  var POS        = POSITIONS.pentagram || [];
  var POS_DAILY  = POSITIONS.daily || [];
  var POS_TL     = POSITIONS.timeline || [];
  var SPREADS    = TC.spreads || {};

  /* ---------- 基于种子洗牌：不重复取 N 张（洗过的牌再放回去时不参与本次抽取） ---------- */
  function drawN(pick, seed) {
    var r = seed != null ? RC.util.rng(seed) : Math.random;
    var bag = A.map(function (c) { return c.n; });
    var out = [];
    var need = Math.min(pick, bag.length);
    for (var i = 0; i < need; i++) {
      var idx = Math.floor(r() * bag.length);
      var id = bag.splice(idx, 1)[0];
      out.push({ id: id, upright: r() < 0.5, pos: i });
    }
    return out;
  }
  function seedFor(spreadKey) {
    if (spreadKey === 'dailyCard') {
      var d = new Date();
      var s = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
      return s;
    }
    return null;
  }

  window.RC = window.RC || {};
  RC.tarot = {
    arcana: A, seals: SEALS, pos: POS,
    positions: POS,                /* legacy alias */
    positionsDaily: POS_DAILY,
    positionsTimeline: POS_TL,
    spreads: SPREADS,
    byId: function (n) { return A[n]; },
    sealOf: function (id) { return SEALS[id % SEALS.length]; },
    draw: function (seed) { return drawN(SPREADS.pentagram.pick, seed); },  /* legacy: always 5 */
    drawFor: function (spreadKey, seedOverride) {
      var sp = SPREADS[spreadKey] || SPREADS.pentagram;
      var seed = seedOverride != null ? seedOverride : seedFor(spreadKey);
      return drawN(sp.pick, seed);
    },
    isShortAvailable: true
  };
})();
