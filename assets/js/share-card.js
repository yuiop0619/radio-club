/* ============================================================
   share-card.js — 鉴定书分享图（canvas 直出 PNG，不依赖任何素材）
   按钮：#btnCard（鉴定页）。生成后弹出预览，可下载、可调用系统分享。
   ============================================================ */
(function () {
  var W = 900, H = 1200;
  var FONT = '"Microsoft YaHei","PingFang SC","Hiragino Sans GB","MS PGothic",sans-serif';
  var SERIF = '"Songti SC","SimSun","Noto Serif CJK SC","MS PMincho",serif';
  var MONO = '"Consolas","MS Gothic",monospace';

  function esc(s) { return String(s == null ? '' : s); }

  function data() {
    var c = null;
    try { c = RC.case.get(); } catch (e) { c = null; }
    var jp = RC.i18n.lang() === 'jp';
    if (window.RC.engine && c && RC.case.has()) {
      var v = RC.engine.buildVerdict(c);
      return {
        ok: true, jp: jp,
        code: v.code || '', stamp: jp ? v.stampJp : v.stampCn,
        handle: c.handle || (jp ? '名無し' : '客人'),
        category: c.category || '―',
        visits: RC.store.get('visits', 0),
        date: new Date(v.generatedAt || Date.now()).toLocaleDateString('zh-CN'),
        quote: esc(v.quotes.story || v.quotes.dream || ''),
        cards: v.tarot.map(function (t) {
          return esc(t.pos[jp ? 'jp' : 'cn'] || t.pos.cn) + '：' + esc(t.card[jp ? 'jp' : 'cn'] || t.card.cn) +
            (t.upright ? (jp ? '（正位置）' : '（正位）') : (jp ? '（逆位置）' : '（逆位）'));
        }),
        spectrum: v.spectrum.map(function (s) { return esc(s.label) + ' ' + s.v; }),
        hyps: v.hypotheses.slice(0, 2).map(function (h) { return { t: esc(jp ? h.titleJp : h.titleCn), b: esc(h.body) }; }),
        cure: (v.prescription || []).slice(0, 3).map(esc),
        disclaimer: RC.i18n.t('disclaimer')
      };
    }
    var el = document.getElementById('report');
    return { ok: false, jp: jp, plain: el ? (el.innerText || el.textContent || '').slice(0, 1200) : '' };
  }

  function wrap(ctx, text, x, y, maxW, lh, maxLines) {
    var line = '', lines = [], n = 0;
    for (var i = 0; i < text.length; i++) {
      var test = line + text[i];
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = text[i]; n++; if (n >= maxLines - 1) break; }
      else line = test;
    }
    if (line) lines.push(line);
    if (n >= maxLines - 1 && lines.length === maxLines) lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1) + '…';
    for (var j = 0; j < lines.length; j++) { ctx.fillText(lines[j], x, y + j * lh); }
    return y + lines.length * lh;
  }

  function draw(d) {
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var g = cv.getContext('2d');
    if (!g) return null;

    /* 底：暗场 + 琥珀灯 */
    g.fillStyle = '#0b0908'; g.fillRect(0, 0, W, H);
    var r = g.createRadialGradient(W / 2, 60, 20, W / 2, 60, 620);
    r.addColorStop(0, 'rgba(232,163,61,.20)');
    r.addColorStop(1, 'rgba(232,163,61,0)');
    g.fillStyle = r; g.fillRect(0, 0, W, 620);

    /* 内框 */
    g.strokeStyle = '#3b2f25'; g.lineWidth = 2; g.strokeRect(28, 28, W - 56, H - 56);
    g.strokeStyle = '#8a6224'; g.lineWidth = 1; g.strokeRect(38, 38, W - 76, H - 76);

    var M = 74, y = 0;
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';

    /* 抬头 */
    g.fillStyle = '#e8a33d'; g.font = '600 34px ' + FONT;
    g.fillText('RADIO CLUB', M, 108);
    g.fillStyle = '#6b5f50'; g.font = '15px ' + FONT;
    g.fillText(d.jp ? 'ネット上のバー ／ 夢探偵事務所 ／ EST. 2006' : '网络酒吧 ／ 梦侦探事务所 ／ EST. 2006', M, 134);

    /* 标题 */
    g.fillStyle = '#d8cbb8'; g.font = '600 46px ' + SERIF;
    g.fillText(d.jp ? '鑑定書' : '鉴定书', M, 210);
    g.fillStyle = '#8a6224'; g.font = '15px ' + MONO;
    g.save(); g.translate(W - M, 206); g.textAlign = 'right';
    g.fillText(d.code || 'RADIO CLUB', 0, 0);
    g.restore(); g.textAlign = 'left';

    g.strokeStyle = '#3b2f25'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(M, 232); g.lineTo(W - M, 232); g.stroke();

    y = 274;
    if (!d.ok) {
      g.fillStyle = '#9a8c78'; g.font = '20px ' + FONT;
      y = wrap(g, d.plain || '', M, y, W - M * 2, 32, 22);
      return cv;
    }

    /* 基本信息 */
    g.font = '16px ' + FONT;
    var meta = [
      [(d.jp ? '呼び名' : '称呼'), d.handle],
      [(d.jp ? 'カテゴリ' : '类别'), d.category],
      [(d.jp ? '来店' : '来店'), (d.jp ? '第' : '第') + d.visits + (d.jp ? '回' : '回')],
      [(d.jp ? '作成' : '作成'), d.date]
    ];
    var colW = (W - M * 2) / 4;
    for (var i = 0; i < meta.length; i++) {
      var x = M + colW * i;
      g.fillStyle = '#6b5f50'; g.font = '13px ' + FONT; g.fillText(meta[i][0], x, y);
      g.fillStyle = '#d8cbb8'; g.font = '600 20px ' + FONT; g.fillText(esc(meta[i][1]).slice(0, 8), x, y + 26);
    }
    y += 62;

    /* 原话 */
    if (d.quote) {
      g.fillStyle = '#8a6224'; g.font = '13px ' + FONT;
      g.fillText(d.jp ? 'あなたの言葉' : '当事人在委托里写下的第一句', M, y);
      y += 24;
      g.fillStyle = '#f6c877'; g.font = '24px ' + SERIF;
      y = wrap(g, '「' + d.quote + '」', M, y, W - M * 2, 34, 3) + 14;
    }

    /* 牌阵 */
    if (d.cards.length) {
      g.fillStyle = '#8a6224'; g.font = '13px ' + FONT;
      g.fillText(d.jp ? 'タロット' : '牌阵', M, y); y += 26;
      g.fillStyle = '#d8cbb8'; g.font = '19px ' + FONT;
      for (var c2 = 0; c2 < d.cards.length; c2++) { g.fillText('· ' + d.cards[c2], M, y); y += 28; }
      y += 8;
    }

    /* 情感谱 */
    if (d.spectrum.length) {
      g.fillStyle = '#6b5f50'; g.font = '14px ' + MONO;
      g.fillText(d.spectrum.join('  ／  '), M, y); y += 34;
    }

    /* 结论 */
    for (var h2 = 0; h2 < d.hyps.length; h2++) {
      g.fillStyle = '#e8a33d'; g.font = '600 22px ' + SERIF;
      g.fillText((d.jp ? '仮説' : '假说') + (h2 + 1) + '・' + d.hyps[h2].t, M, y); y += 30;
      g.fillStyle = '#9a8c78'; g.font = '17px ' + FONT;
      y = wrap(g, d.hyps[h2].b, M, y, W - M * 2, 26, 4) + 16;
    }

    /* 回去之后 */
    if (d.cure.length) {
      g.fillStyle = '#8a6224'; g.font = '13px ' + FONT;
      g.fillText(d.jp ? '処方' : '回去之后', M, y); y += 24;
      g.fillStyle = '#d8cbb8'; g.font = '17px ' + FONT;
      for (var k = 0; k < d.cure.length; k++) { y = wrap(g, (k + 1) + '. ' + d.cure[k], M, y, W - M * 2, 25, 2) + 4; }
    }

    /* 印章 + 落款 */
    g.save();
    g.translate(W - M - 96, H - 156);
    g.rotate(-0.14);
    g.strokeStyle = '#c8402f'; g.lineWidth = 3;
    g.strokeRect(0, 0, 186, 66);
    g.fillStyle = 'rgba(200,64,47,.10)'; g.fillRect(0, 0, 186, 66);
    g.fillStyle = '#e8604a'; g.font = '600 24px ' + SERIF;
    g.fillText(esc(d.stamp || (d.jp ? '夢探偵サフラン' : '梦侦探萨弗兰')).slice(0, 12), 12, 42);
    g.restore();

    g.fillStyle = '#6b5f50'; g.font = '14px ' + FONT;
    g.fillText((d.jp ? '夢探偵サフラン' : '梦侦探萨弗兰') + ' ／ RADIO CLUB', M, H - 96);
    g.font = '12px ' + FONT;
    wrap(g, d.disclaimer, M, H - 74, W - M * 2 - 200, 18, 3);
    return cv;
  }

  function show(cv) {
    var mask = document.createElement('div');
    mask.className = 'share-mask';
    mask.innerHTML = '<div class="sm-box"><img alt="鉴定书分享图"><div class="sm-acts">' +
      '<button type="button" class="btn" data-act="dl">下载 PNG</button>' +
      '<button type="button" class="btn ghost" data-act="close">关闭</button>' +
      '</div><p class="hint mt" id="cardMsg"></p></div>';
    document.body.appendChild(mask);
    var img = mask.querySelector('img');
    var url = cv.toDataURL('image/png');
    img.src = url;
    var msg = mask.querySelector('#cardMsg');

    function close() { if (mask.parentNode) mask.parentNode.removeChild(mask); }
    mask.addEventListener('click', function (e) { if (e.target === mask) close(); });
    mask.querySelector('[data-act="close"]').addEventListener('click', close);
    mask.querySelector('[data-act="dl"]').addEventListener('click', function () {
      var a = document.createElement('a');
      a.href = url;
      a.download = 'radio-club-verdict-' + new Date().toISOString().slice(0, 10) + '.png';
      document.body.appendChild(a); a.click(); a.remove();
    });
    /* 系统分享（移动端） */
    if (navigator.canShare && cv.toBlob) {
      cv.toBlob(function (blob) {
        if (!blob) return;
        var file = new File([blob], 'radio-club-verdict.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          var b = document.createElement('button');
          b.type = 'button'; b.className = 'btn ghost'; b.textContent = '分享…';
          b.addEventListener('click', function () {
            navigator.share({ files: [file], title: 'RADIO CLUB 鉴定书' }).catch(function () {});
          });
          mask.querySelector('.sm-acts').insertBefore(b, mask.querySelector('[data-act="close"]'));
        }
      }, 'image/png');
    }
    if (msg) msg.textContent = RC.i18n.t('shareCardDone');
  }

  function run() {
    var btn = document.getElementById('btnCard');
    if (btn) btn.addEventListener('click', function () {
      var old = btn.textContent;
      btn.textContent = RC.i18n.t('shareCardDoing');
      try {
        var cv = draw(data());
        if (!cv) throw Error('no canvas');
        show(cv);
      } catch (e) {
        var m = document.getElementById('shareMsg');
        if (m) m.textContent = RC.i18n.t('shareCardFail');
      }
      btn.textContent = old;
    });
  }

  window.RC = window.RC || {};
  RC.shareCard = { draw: draw, data: data };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
