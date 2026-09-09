/* ============================================================
   ambient.js — 店里的环境音（纯 WebAudio 合成，不加载任何音频文件）
   三层：黑胶底噪（布朗噪声 + 低通）／低频嗡鸣（55Hz + 82.5Hz）
        ／随机电台杂音（带通噪声脉冲 + 爆豆）
   浏览器要求先有用户手势才能出声：若上次是开着关掉的，
   这里会等第一次点击/按键再自动接上。
   ============================================================ */
(function () {
  var KEY = 'ambient';
  var ctx = null, master = null, live = [], blipTimer = null, on = false;

  function noiseBuffer(seconds, brown) {
    var len = Math.floor(ctx.sampleRate * seconds);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0), last = 0;
    for (var i = 0; i < len; i++) {
      var w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
      else d[i] = w;
    }
    return buf;
  }

  function build() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    /* 1 · 黑胶底噪 */
    var vinyl = ctx.createBufferSource();
    vinyl.buffer = noiseBuffer(3, true);
    vinyl.loop = true;
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 780;
    var vg = ctx.createGain(); vg.gain.value = 0.5;
    vinyl.connect(lp); lp.connect(vg); vg.connect(master);
    vinyl.start();
    live.push(vinyl);

    /* 2 · 低频嗡鸣（房间 + 五度） */
    [55, 82.5].forEach(function (f, i) {
      var o = ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = f;
      var g = ctx.createGain(); g.gain.value = i ? 0.012 : 0.02;
      o.connect(g); g.connect(master); o.start();
      live.push(o);
    });

    /* 3 · 缓慢起伏（LFO 调制总音量，像呼吸） */
    var lfo = ctx.createOscillator();
    lfo.type = 'sine'; lfo.frequency.value = 0.07;
    var lfoG = ctx.createGain(); lfoG.gain.value = 0.18;
    lfo.connect(lfoG); lfoG.connect(master.gain); lfo.start();
    live.push(lfo);

    return true;
  }

  /* 随机电台杂音：一段带通噪声 + 轻微爆豆 */
  function blip() {
    if (!on || !ctx) return;
    var dur = 0.12 + Math.random() * 0.5;
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer(dur, false);
    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 700 + Math.random() * 2600;
    bp.Q.value = 6 + Math.random() * 8;
    var g = ctx.createGain();
    var peak = 0.05 + Math.random() * 0.07;
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(peak, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    src.connect(bp); bp.connect(g); g.connect(master);
    src.start();
    schedule();
  }
  function schedule() {
    clearTimeout(blipTimer);
    blipTimer = setTimeout(blip, 4000 + Math.random() * 12000);
  }

  function fade(to) {
    if (!ctx) return;
    var t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(to, t + 1.2);
  }

  function start() {
    if (on) return true;
    if (!ctx && !build()) return false;
    if (ctx.state === 'suspended') ctx.resume();
    on = true;
    fade(0.5);
    schedule();
    return true;
  }
  function stop() {
    if (!on) return;
    on = false;
    clearTimeout(blipTimer);
    if (ctx) fade(0);
  }

  /* ---------- 按钮 ---------- */
  function makeBtn() {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'amb-btn';
    b.id = 'ambBtn';
    b.innerHTML = '<span class="dot"></span><span class="lb"></span>';
    b.addEventListener('click', function () {
      if (on) { stop(); RC.store.set(KEY, 0); }
      else { if (!start()) return; RC.store.set(KEY, 1); }
      label();
    });
    document.body.appendChild(b);
    return b;
  }
  function label() {
    var b = document.getElementById('ambBtn');
    if (!b) return;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.setAttribute('title', RC.i18n.t('ambientTip'));
    var lb = b.querySelector('.lb');
    if (lb) lb.textContent = RC.i18n.t('ambient') + ' ' + (on ? 'ON' : 'OFF');
  }

  function init() {
    if (!(window.AudioContext || window.webkitAudioContext)) return;
    var want = RC.store.get(KEY, 0) === 1;
    makeBtn();
    label();
    RC.i18n.onChange(label);
    if (!want) return;
    /* 自动播放限制：等第一次交互再接上 */
    function kick() {
      document.removeEventListener('pointerdown', kick);
      document.removeEventListener('keydown', kick);
      if (!on) { start(); label(); }
    }
    document.addEventListener('pointerdown', kick);
    document.addEventListener('keydown', kick);
  }

  window.RC = window.RC || {};
  RC.ambient = { start: start, stop: stop, isOn: function () { return on; }, toggle: function () { on ? stop() : start(); label(); } };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
