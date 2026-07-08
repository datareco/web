// =============================================================
// VoltaEdge site interactions
// =============================================================

// --- Scroll reveal ---
const revealObs = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in'); });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

// --- Ticker (hero + trust bar) ---
function initTicker(el, symbols) {
  if (!el) return;
  // Duplicate for seamless loop
  const inner = document.createElement('div');
  inner.className = 'ticker-inner';
  const html = symbols.map(s => {
    const up = s.chg >= 0;
    return `<span class="tick"><span class="tick-sym">${s.sym}</span><span class="tick-px mono">${s.px.toFixed(2)}</span><span class="tick-chg mono ${up ? 'txt-up' : 'txt-down'}">${up ? '▲' : '▼'} ${Math.abs(s.chg).toFixed(2)}%</span></span>`;
  }).join('');
  inner.innerHTML = html + html;
  el.appendChild(inner);
}

const symbols = [
  { sym: 'NIFTY',    px: 24812.40, chg: 0.42 },
  { sym: 'BANKNIFTY',px: 51204.15, chg: -0.18 },
  { sym: 'RELIANCE', px: 2984.75,  chg: 1.24 },
  { sym: 'BTCUSD',   px: 67210.50, chg: 2.11 },
  { sym: 'ETHUSD',   px: 3480.22,  chg: -0.65 },
  { sym: 'EURUSD',   px: 1.0842,   chg: 0.08 },
  { sym: 'CRUDE',    px: 78.14,    chg: 0.94 },
  { sym: 'GOLD',     px: 2412.60,  chg: 0.31 },
  { sym: 'HDFCBANK', px: 1642.10,  chg: -0.42 },
  { sym: 'TCS',      px: 4128.90,  chg: 0.72 },
  { sym: 'INFY',     px: 1854.40,  chg: 1.05 },
  { sym: 'SPX',      px: 5478.20,  chg: 0.24 },
];
document.querySelectorAll('[data-ticker]').forEach(el => initTicker(el, symbols));

// --- Hero P&L feed ---
function initPnlFeed() {
  const feed = document.getElementById('pnl-feed');
  if (!feed) return;

  const trades = [
    { sym: 'NIFTY 24800 CE', side: 'LONG',  tier: 'A+', pnl: 3420 },
    { sym: 'RELIANCE',       side: 'LONG',  tier: 'A',  pnl: 1245 },
    { sym: 'BTCUSD',         side: 'SHORT', tier: 'B',  pnl: -680 },
    { sym: 'BANKNIFTY FUT',  side: 'LONG',  tier: 'A+', pnl: 5240 },
    { sym: 'TCS',            side: 'LONG',  tier: 'A',  pnl: 890 },
    { sym: 'CRUDE FUT',      side: 'SHORT', tier: 'B',  pnl: 1520 },
    { sym: 'ETHUSD',         side: 'LONG',  tier: 'A',  pnl: 2110 },
    { sym: 'HDFCBANK',       side: 'SHORT', tier: 'C',  pnl: -320 },
    { sym: 'NIFTY 24900 CE', side: 'LONG',  tier: 'A+', pnl: 4180 },
    { sym: 'INFY',           side: 'LONG',  tier: 'A',  pnl: 760 },
  ];

  function fmt(n) {
    const s = n >= 0 ? '+' : '−';
    return s + '$' + Math.abs(n).toLocaleString('en-US');
  }

  let cursor = 0;
  function addRow() {
    const t = trades[cursor % trades.length];
    cursor++;
    const now = new Date();
    const time = now.toTimeString().slice(0, 8);
    const up = t.pnl >= 0;
    const row = document.createElement('div');
    row.className = 'pnl-row';
    row.innerHTML = `
      <span class="pnl-time mono">${time}</span>
      <span class="pnl-sym">${t.sym}</span>
      <span class="pnl-side mono ${up ? 'txt-up' : 'txt-down'}">${t.side}</span>
      <span class="pnl-tier mono">${t.tier}</span>
      <span class="pnl-val mono ${up ? 'txt-up' : 'txt-down'}">${fmt(t.pnl)}</span>
    `;
    feed.prepend(row);
    while (feed.children.length > 8) feed.lastChild.remove();
  }

  // Seed
  for (let i = 0; i < 6; i++) addRow();
  setInterval(addRow, 2400);
}
initPnlFeed();

// --- Animated candlestick chart ---
function initCandles() {
  const canvases = document.querySelectorAll('canvas[data-candles]');
  canvases.forEach(canvas => {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    function resize() {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    }
    resize();

    // Generate candles
    const N = 60;
    let candles = [];
    let px = 100;
    for (let i = 0; i < N; i++) {
      const o = px;
      const move = (Math.random() - 0.48) * 2.5;
      const c = o + move;
      const h = Math.max(o, c) + Math.random() * 1.2;
      const l = Math.min(o, c) - Math.random() * 1.2;
      candles.push({ o, h, l, c });
      px = c;
    }

    let signalIdx = 20;
    let signalIdx2 = 45;

    function draw() {
      const rect = canvas.getBoundingClientRect();
      const W = rect.width, H = rect.height;
      ctx.clearRect(0, 0, W, H);

      const min = Math.min(...candles.map(c => c.l));
      const max = Math.max(...candles.map(c => c.h));
      const range = max - min;
      const pad = 16;

      const cw = (W - pad * 2) / N;
      const scaleY = y => pad + (1 - (y - min) / range) * (H - pad * 2);

      // Grid lines
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const y = pad + (i / 4) * (H - pad * 2);
        ctx.beginPath();
        ctx.moveTo(pad, y);
        ctx.lineTo(W - pad, y);
        ctx.stroke();
      }

      // Candles
      candles.forEach((c, i) => {
        const x = pad + i * cw + cw / 2;
        const up = c.c >= c.o;
        ctx.strokeStyle = up ? '#3DDC97' : '#FF5C5C';
        ctx.fillStyle = up ? '#3DDC97' : '#FF5C5C';
        ctx.lineWidth = 1;
        // wick
        ctx.beginPath();
        ctx.moveTo(x, scaleY(c.h));
        ctx.lineTo(x, scaleY(c.l));
        ctx.stroke();
        // body
        const bw = Math.max(cw * 0.65, 2);
        const bo = scaleY(c.o);
        const bc = scaleY(c.c);
        ctx.fillRect(x - bw / 2, Math.min(bo, bc), bw, Math.max(Math.abs(bc - bo), 1));
      });

      // Signal markers
      [signalIdx, signalIdx2].forEach((idx, k) => {
        const c = candles[idx];
        const x = pad + idx * cw + cw / 2;
        const y = scaleY(c.l) + 14;
        // Triangle
        ctx.fillStyle = '#E5FF3A';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 5, y + 8);
        ctx.lineTo(x + 5, y + 8);
        ctx.closePath();
        ctx.fill();
        // Label
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillStyle = '#E5FF3A';
        ctx.textAlign = 'center';
        ctx.fillText(k === 0 ? 'A+' : 'A', x, y + 20);
      });
    }

    draw();
    window.addEventListener('resize', () => { resize(); draw(); });

    // Occasional new candle
    setInterval(() => {
      const last = candles[candles.length - 1].c;
      const o = last;
      const c = o + (Math.random() - 0.48) * 2.5;
      const h = Math.max(o, c) + Math.random() * 1.2;
      const l = Math.min(o, c) - Math.random() * 1.2;
      candles.push({ o, h, l, c });
      candles.shift();
      signalIdx--;
      signalIdx2--;
      if (signalIdx < 0) signalIdx = 55;
      if (signalIdx2 < 0) signalIdx2 = 50;
      draw();
    }, 1800);
  });
}
initCandles();

// --- Kill switch ---
function initKillSwitch() {
  const btn = document.getElementById('kill-btn');
  const status = document.getElementById('kill-status');
  const positions = document.querySelectorAll('.kill-pos');
  const timer = document.getElementById('kill-timer');
  if (!btn) return;

  let armed = false;
  let running = false;

  btn.addEventListener('click', () => {
    if (running) return;
    if (!armed) {
      armed = true;
      btn.classList.add('armed');
      btn.querySelector('.kill-label').textContent = 'Confirm — press again';
      status.textContent = 'ARMED · awaiting confirmation';
      setTimeout(() => {
        if (armed && !running) {
          armed = false;
          btn.classList.remove('armed');
          btn.querySelector('.kill-label').textContent = 'Emergency kill switch';
          status.textContent = 'IDLE · all systems green';
        }
      }, 4000);
      return;
    }
    // Fire
    running = true;
    armed = false;
    btn.classList.remove('armed');
    btn.classList.add('firing');
    btn.querySelector('.kill-label').textContent = 'Flattening…';
    status.textContent = 'FIRING · flattening all positions';

    const t0 = performance.now();
    let flatCount = 0;
    positions.forEach((p, i) => {
      setTimeout(() => {
        p.classList.add('flat');
        flatCount++;
        const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
        timer.textContent = elapsed + 's · ' + flatCount + '/' + positions.length + ' flat';
      }, 200 + i * 220);
    });
    setTimeout(() => {
      const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
      status.textContent = `HALTED · ${positions.length} positions flat in ${elapsed}s · awaiting human restart`;
      btn.querySelector('.kill-label').textContent = 'Reset demo';
      btn.classList.remove('firing');
    }, 200 + positions.length * 220 + 300);

    // Allow reset
    setTimeout(() => {
      const resetHandler = () => {
        if (!running) return;
        running = false;
        positions.forEach(p => p.classList.remove('flat'));
        btn.querySelector('.kill-label').textContent = 'Emergency kill switch';
        status.textContent = 'IDLE · all systems green';
        timer.textContent = '';
      };
      btn.addEventListener('click', resetHandler, { once: true });
    }, 200 + positions.length * 220 + 400);
  });
}
initKillSwitch();

// --- Contact form ---
function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  const endpoint = form.dataset.contactEndpoint;
  const button = form.querySelector('button[type="submit"]');
  const feedback = document.getElementById('contact-feedback');
  const defaultButtonHtml = button.innerHTML;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!endpoint) {
      feedback.textContent = 'Contact endpoint is not configured yet. Email support@datareco.com for now.';
      return;
    }

    const formData = new FormData(form);
    const payload = {
      name: String(formData.get('name') || '').trim(),
      email: String(formData.get('email') || '').trim(),
      organisation: String(formData.get('organisation') || '').trim(),
      interest: String(formData.get('interest') || '').trim(),
      notes: String(formData.get('notes') || '').trim(),
      source: window.location.hostname,
    };

    button.disabled = true;
    button.textContent = 'Sending…';
    feedback.textContent = '';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'We could not send your request just now.');
      }

      button.textContent = 'Received — we\'ll be in touch';
      feedback.textContent = 'Request received. We will come back within 48 hours.';
      form.reset();
    } catch (error) {
      button.disabled = false;
      button.innerHTML = defaultButtonHtml;
      feedback.textContent = error.message || 'We could not send your request just now.';
    }
  });
}
initContactForm();

// --- Trade lifecycle scrubber ---
function initLifecycle() {
  const stages = document.querySelectorAll('.lc-stage');
  if (!stages.length) return;
  let active = 0;
  function set(i) {
    stages.forEach((s, k) => s.classList.toggle('active', k === i));
    active = i;
  }
  set(0);
  setInterval(() => set((active + 1) % stages.length), 2200);

  stages.forEach((s, i) => s.addEventListener('mouseenter', () => set(i)));
}
initLifecycle();

// --- Architecture pulse ---
function initArch() {
  const arch = document.querySelector('.arch-svg');
  if (!arch) return;
  // The pulse is CSS-driven; nothing to do here
}
initArch();

// --- FAQ accordion ---
document.querySelectorAll('.faq-item').forEach(item => {
  const q = item.querySelector('.faq-q');
  q.addEventListener('click', () => item.classList.toggle('open'));
});
