/**
 * The scrubbable timeline: a log-scaled monthly event histogram that doubles as
 * the seek bar. The played span is drawn bright, the future dim, and in rolling
 * window mode the active window is shaded so you can see what is on screen.
 */

const DAY_MS = 86400000;

/* The narrowest window the scrubber will hold open. Six hours, not a week:
   everything downstream was already built for short spans -- the axis switches
   to hourly ticks under three days, the playback speeds to minutes under two --
   and a floor of a week quietly widened the Live Map's own 24h preset to seven
   days, so the count, the feed and the timeline all disagreed with the control
   that set them. */
export const MIN_SPAN_DAYS = 0.25;

export class Timeline {
  constructor({ track, canvas, head, gripA, gripB, meta, epochMs, totalDays,
                onSeek, onRange }) {
    this.track = track;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.head = head;
    this.gripA = gripA;
    this.gripB = gripB;
    this.epochMs = epochMs;
    this.totalDays = totalDays;
    this.onSeek = onSeek;
    this.onRange = onRange;

    this.now = 0;
    this.windowDays = null;
    this.range = [0, totalDays];
    this.d0 = 0;                        // visible domain follows the selected period
    this.d1 = totalDays;

    const h = meta.histogram ?? { counts: [] };
    this.setHistogram(h, false);
    this.buildTicks();

    this.bindDrag();
    this.observeSize();
  }

  /* ── geometry ─────────────────────────────────────────────── */

  frac(days) {
    const span = this.d1 - this.d0 || 1;
    return Math.min(1, Math.max(0, (days - this.d0) / span));
  }

  /** Adaptive axis ticks for the current domain (years → months → days → hours). */
  buildTicks() {
    const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const span = this.d1 - this.d0;
    const start = new Date(this.epochMs + this.d0 * DAY_MS);
    const end = new Date(this.epochMs + this.d1 * DAY_MS);
    const t = [];
    const push = (label, utcMs) => t.push({ label, d: (utcMs - this.epochMs) / DAY_MS });

    if (span >= 365 * 12) {
      const step = span >= 365 * 60 ? 10 : 5;
      for (let y = Math.ceil(start.getUTCFullYear() / step) * step; y <= end.getUTCFullYear(); y += step) {
        push(String(y), Date.UTC(y, 0, 1));
      }
    } else if (span >= 365 * 2.5) {
      for (let y = start.getUTCFullYear(); y <= end.getUTCFullYear(); y++) push(String(y), Date.UTC(y, 0, 1));
    } else if (span >= 70) {
      let y = start.getUTCFullYear(), m = start.getUTCMonth();
      while (y < end.getUTCFullYear() || (y === end.getUTCFullYear() && m <= end.getUTCMonth())) {
        push(m === 0 ? String(y) : MONS[m], Date.UTC(y, m, 1));
        m++; if (m === 12) { m = 0; y++; }
      }
    } else if (span >= 21) {
      let d = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
      const endMs = end.getTime();
      while (d <= endMs) {
        const dd = new Date(d);
        push((dd.getUTCMonth() + 1) + '/' + dd.getUTCDate(), d);
        d += 7 * DAY_MS;
      }
    } else {
      // Short windows get an hour grid, not just a row of dates: over three
      // days "9/1, 9/2, 9/3" says nothing about where inside a day the playhead
      // is, which is the whole point of scrubbing a window this narrow. Midnight
      // keeps the date so the day is never ambiguous, and the step widens as the
      // window does so the labels never collide.
      const stepH = span >= 10 ? 24 : span >= 5 ? 12 : span >= 2 ? 6 : span >= 0.75 ? 3 : 1;
      const step = stepH * 3600e3;
      const endMs = this.epochMs + this.d1 * DAY_MS;
      let ms = Math.ceil((this.epochMs + this.d0 * DAY_MS) / step) * step;
      while (ms <= endMs) {
        const dd = new Date(ms);
        const h = dd.getUTCHours();
        push(h === 0 ? (dd.getUTCMonth() + 1) + '/' + dd.getUTCDate()
                     : String(h).padStart(2, '0') + ':00', ms);
        ms += step;
      }
    }
    this.years = t;
  }

  observeSize() {
    const resize = () => {
      const r = this.track.getBoundingClientRect();
      this.w = Math.max(1, Math.round(r.width));
      this.h = Math.max(1, Math.round(r.height));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      this.canvas.width = Math.round(this.w * dpr);
      this.canvas.height = Math.round(this.h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.paint();
    };
    new ResizeObserver(resize).observe(this.track);
    resize();
  }

  /* ── interaction ──────────────────────────────────────────── */

  /** Pointer x -> days since epoch, mapped through the visible domain. */
  daysAt(clientX) {
    const r = this.track.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    return this.d0 + f * (this.d1 - this.d0);
  }

  bindDrag() {
    // Seeking on the track itself.
    const seek = (ev) => this.onSeek(this.daysAt(ev.clientX));
    this.track.addEventListener('pointerdown', (ev) => {
      if (ev.target !== this.track && ev.target !== this.canvas) return;   // a grip
      this.track.setPointerCapture(ev.pointerId);
      this.dragging = true;
      seek(ev);
    });
    this.track.addEventListener('pointermove', (ev) => { if (this.dragging) seek(ev); });
    const stop = (ev) => {
      this.dragging = false;
      if (this.track.hasPointerCapture?.(ev.pointerId)) this.track.releasePointerCapture(ev.pointerId);
    };
    this.track.addEventListener('pointerup', stop);
    this.track.addEventListener('pointercancel', stop);

    // Dragging either end of the period.
    const bindGrip = (grip, edge) => {
      grip.addEventListener('pointerdown', (ev) => {
        ev.stopPropagation();
        grip.setPointerCapture(ev.pointerId);
        grip.classList.add('dragging');
        this.gripEdge = edge;
      });
      grip.addEventListener('pointermove', (ev) => {
        if (this.gripEdge !== edge) return;
        const d = this.daysAt(ev.clientX);
        const [a, b] = this.range;
        this.onRange(edge === 0
          ? [Math.min(d, b - MIN_SPAN_DAYS), b]
          : [a, Math.max(d, a + MIN_SPAN_DAYS)]);
      });
      const end = (ev) => {
        this.gripEdge = null;
        grip.classList.remove('dragging');
        if (grip.hasPointerCapture?.(ev.pointerId)) grip.releasePointerCapture(ev.pointerId);
      };
      grip.addEventListener('pointerup', end);
      grip.addEventListener('pointercancel', end);
    };
    if (this.gripA) bindGrip(this.gripA, 0);
    if (this.gripB) bindGrip(this.gripB, 1);
  }

  /* ── paint ────────────────────────────────────────────────── */

  set(nowDays, windowDays, range) {
    this.now = nowDays;
    this.windowDays = windowDays;
    if (range) this.range = range;

    // zoom the axis to the selected period (small margin keeps grips reachable)
    const margin = Math.max(0.02, (this.range[1] - this.range[0]) * 0.02);
    const nd0 = Math.max(0, this.range[0] - margin);
    const nd1 = Math.min(this.totalDays, this.range[1] + margin);
    if (nd0 !== this.d0 || nd1 !== this.d1) {
      this.d0 = nd0;
      this.d1 = nd1;
      this.buildTicks();
    }

    this.head.style.left = `${(this.frac(nowDays) * 100).toFixed(3)}%`;
    if (this.gripA) this.gripA.style.left = `${(this.frac(this.range[0]) * 100).toFixed(3)}%`;
    if (this.gripB) this.gripB.style.left = `${(this.frac(this.range[1]) * 100).toFixed(3)}%`;
    this.paint();
  }

  paint() {
    const { ctx, w, h } = this;
    if (!w) return;
    ctx.clearRect(0, 0, w, h);

    const pad = 13;                       // room for the year strip
    const plot = h - pad;
    const norm = Math.log1p(this.maxCount);
    const headX = this.frac(this.now) * w;
    const [rA, rB] = this.range;

    // Rolling-window shading.
    if (this.windowDays != null) {
      const x0 = this.frac(Math.max(rA, this.now - this.windowDays)) * w;
      ctx.fillStyle = 'rgba(53,214,245,.09)';
      ctx.fillRect(x0, 0, Math.max(1, headX - x0), plot);
    }

    // Histogram bars. Three tiers: outside the selected period, inside but not
    // yet played, and played.
    for (const b of this.bins) {
      if (b.count === 0) continue;
      const x = this.frac(b.d0) * w;
      const bw = Math.max(0.9, this.frac(b.d1) * w - x);
      const bh = Math.max(1, (Math.log1p(b.count) / norm) * (plot - 3));
      const outside = b.d1 <= rA || b.d0 >= rB;
      ctx.fillStyle = outside
        ? 'rgba(120,140,168,.13)'
        : b.d0 < this.now
          ? 'rgba(53,214,245,.75)'
          : 'rgba(150,175,205,.24)';
      ctx.fillRect(x, plot - bh, bw, bh);
    }

    // Dim the excluded spans so the period reads at a glance.
    ctx.fillStyle = 'rgba(5,7,13,.5)';
    const xA = this.frac(rA) * w;
    const xB = this.frac(rB) * w;
    if (xA > 0) ctx.fillRect(0, 0, xA, plot);
    if (xB < w) ctx.fillRect(xB, 0, w - xB, plot);

    // Baseline.
    ctx.fillStyle = 'rgba(140,165,200,.22)';
    ctx.fillRect(0, plot - 0.5, w, 1);

    // Year ticks + labels. Gridlines always; labels only where they fit, so a
    // century-long axis on a phone thins itself out instead of overlapping.
    ctx.font = '9px ui-monospace, Consolas, monospace';
    ctx.textBaseline = 'bottom';
    let lastLabelX = -Infinity;
    for (const y of this.years) {
      const x = this.frac(y.d) * w;
      ctx.fillStyle = 'rgba(140,165,200,.16)';
      ctx.fillRect(x, 0, 1, plot);
      if (x - lastLabelX < 34) continue;
      lastLabelX = x;
      ctx.fillStyle = 'rgba(120,140,168,.85)';
      ctx.textAlign = x < 18 ? 'left' : x > w - 18 ? 'right' : 'center';
      ctx.fillText(y.label ?? String(y.year), Math.min(Math.max(x, 1), w - 1), h - 2);
    }

    // Source handoff: the detection threshold changes here, so the bar height
    // drops for reasons that have nothing to do with seismicity.
    if (this.handoffDays != null) {
      const x = this.frac(this.handoffDays) * w;
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = 'rgba(192,132,252,.85)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, plot);
      ctx.stroke();
      ctx.restore();
    }
  }

  /** Mark where the catalogue switches source (days since epoch). */
  setHandoff(days) {
    this.handoffDays = days;
    this.paint();
  }

  /** Swap the monthly histogram (the seek bar serves both catalogues). */
  setHistogram(histogram, repaint = true) {
    const h = histogram ?? { counts: [] };
    this.bins = h.counts.map((count, i) => {
      const y = h.start_year + Math.floor((h.start_month - 1 + i) / 12);
      const m = (h.start_month - 1 + i) % 12;
      return {
        count,
        d0: (Date.UTC(y, m, 1) - this.epochMs) / DAY_MS,
        d1: (Date.UTC(m === 11 ? y + 1 : y, (m + 1) % 12, 1) - this.epochMs) / DAY_MS,
      };
    });
    this.maxCount = Math.max(1, ...this.bins.map((b) => b.count));
    if (repaint) this.paint();
  }
}
