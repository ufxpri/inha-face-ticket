// parts.jsx — reusable atoms/molecules used across all 3 directions
// FacePortrait, RadialViz, IDCard, KV, MonoLine, StatusChip, etc.
// Each part takes `t` (theme object from THEMES) so it adapts per direction.

// Tiny seeded RNG so visualizations are deterministic per scene
function srand(seed) {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 100000) / 100000;
  };
}

// ── FacePortrait ──────────────────────────────────────────────
// Abstract bust silhouette using radial gradients only.
// Placeholder for the live webcam frame. Communicates "person here"
// without hand-drawing a face.
function FacePortrait({ t, mode = 'live', size = 360, label = 'SUBJECT.LIVE', sub = 'CAM01 · 480×640 · 30fps', flash = 0 }) {
  // mode: 'live' (warm, scanning) | 'idle' (no subject) | 'deny' (cool)
  const isDeny = mode === 'deny';
  const isIdle = mode === 'idle';
  const headTone   = isDeny ? 'rgba(216,58,31,0.55)' : (isIdle ? 'rgba(0,0,0,0.10)' : 'rgba(0,0,0,0.62)');
  const headShadow = isDeny ? 'rgba(216,58,31,0.30)' : (isIdle ? 'rgba(0,0,0,0.04)' : 'rgba(0,0,0,0.35)');

  return (
    <div style={{
      position: 'relative',
      width: size, height: size,
      background: t.surface,
      border: `1px solid ${t.line}`,
      overflow: 'hidden',
      fontFamily: t.monoFamily,
    }}>
      {/* bust silhouette */}
      <div style={{
        position: 'absolute', inset: 0,
        background: isIdle ? `
          repeating-linear-gradient(45deg, transparent 0 8px, ${t.line2} 8px 9px)
        ` : `
          radial-gradient(ellipse 30% 33% at 50% 36%, ${headTone}, transparent 65%),
          radial-gradient(ellipse 55% 32% at 50% 96%, ${headShadow}, transparent 60%),
          radial-gradient(circle at 50% 50%, ${t.surface}, ${t.paper} 80%)
        `,
      }} />

      {/* scanlines */}
      {!isIdle && (
        <div style={{
          position: 'absolute', inset: 0,
          background: `repeating-linear-gradient(0deg, transparent 0 3px, rgba(0,0,0,0.035) 3px 4px)`,
          pointerEvents: 'none',
        }} />
      )}

      {/* corner brackets */}
      {['tl','tr','bl','br'].map(corner => {
        const len = 18, w = 1.5;
        const pos = {
          tl: { top: 10, left: 10 },
          tr: { top: 10, right: 10 },
          bl: { bottom: 10, left: 10 },
          br: { bottom: 10, right: 10 },
        }[corner];
        const v1 = { width: len, height: w };
        const v2 = { width: w, height: len };
        const col = isDeny ? t.accent : t.ink;
        return (
          <React.Fragment key={corner}>
            <div style={{ position: 'absolute', background: col, ...pos, ...v1 }} />
            <div style={{ position: 'absolute', background: col, ...pos, ...v2 }} />
          </React.Fragment>
        );
      })}

      {/* face crop box — appears when not idle */}
      {!isIdle && (
        <div style={{
          position: 'absolute',
          left: '32%', top: '22%', width: '36%', height: '40%',
          border: `1px ${isDeny ? 'solid' : 'dashed'} ${isDeny ? t.accent : t.ink}`,
          boxShadow: isDeny ? `0 0 0 2px ${t.paper}, 0 0 0 3px ${t.accent}33` : 'none',
        }}>
          <div style={{
            position: 'absolute', top: -16, left: 0,
            fontSize: 9, color: isDeny ? t.accent : t.ink, letterSpacing: 1.2,
          }}>FACE · {isDeny ? 'LOW QUALITY' : 'LOCKED'}</div>
          {/* tiny landmarks */}
          {!isDeny && [[28,38],[72,38],[50,58],[35,75],[65,75]].map(([x,y],i) => (
            <div key={i} style={{
              position: 'absolute', left: `${x}%`, top: `${y}%`,
              width: 4, height: 4, marginLeft: -2, marginTop: -2,
              border: `1px solid ${t.ink}`, background: t.paper,
            }} />
          ))}
        </div>
      )}

      {/* labels */}
      <div style={{ position: 'absolute', top: 10, left: 36, fontSize: 9, color: t.mute, letterSpacing: 1.5 }}>
        {label}
      </div>
      <div style={{ position: 'absolute', bottom: 10, left: 36, fontSize: 9, color: t.mute, letterSpacing: 1.2 }}>
        {sub}
      </div>

      {/* capture flash overlay — driven by parent (0..1) */}
      {flash > 0 && (
        <div style={{
          position: 'absolute', inset: 0, background: '#ffffff',
          opacity: flash, pointerEvents: 'none', mixBlendMode: 'screen',
        }} />
      )}
      <div style={{ position: 'absolute', top: 10, right: 36, fontSize: 9, color: isIdle ? t.mute : (isDeny ? t.accent : t.ink), letterSpacing: 1.2 }}>
        {isIdle ? '— NO SUBJECT —' : (isDeny ? '◉ REC · ALERT' : '◉ REC')}
      </div>
    </div>
  );
}

// ── RadialViz ─────────────────────────────────────────────────
// Polar embedding chart. Outer ticks = 128-dim embedding magnitudes.
// Middle = confidence sweep. Inner = quadrant markers.
function RadialViz({
  t, size = 520, dims = 128, seed = 7,
  confidence = 0.94, status = 'pass', // pass | deny | scan | idle
  faceSize = null, // px diameter of the central face frame
  showLabels = true,
  reveal = 1, // 0..1 how many bars are drawn (clockwise sweep)
}) {
  const r = size / 2;
  const accent = status === 'deny' ? t.accent : t.ink;
  const isDeny = status === 'deny';
  const isIdle = status === 'idle';
  const isScan = status === 'scan';
  const cfg = t.radial;

  // Generate deterministic embedding magnitudes
  const rand = srand(seed);
  const emb = [];
  for (let i = 0; i < dims; i++) {
    // Mix smooth low-freq with high-freq noise
    const lf = Math.sin(i * 0.18 + seed * 0.3) * 0.6 + Math.cos(i * 0.07) * 0.3;
    const hf = (rand() - 0.5) * 0.5;
    emb.push(lf + hf);
  }
  const maxAbs = Math.max(...emb.map(Math.abs));
  const normEmb = emb.map(v => v / maxAbs);

  // Geometry — leave a generous outer margin so the cos.sweep arc and
  // cardinal labels live INSIDE the SVG viewBox. Bars are tightened so
  // they cluster close to the face instead of reaching the edge.
  const outerR = r - 26;                                  // hard outer ring
  const innerR = (faceSize ? faceSize / 2 + 22 : r * 0.48); // hugs the face
  const tickInner = innerR + 4;
  const ringDepth = outerR - innerR - 8;
  const tickOuter = tickInner + ringDepth * 0.7;          // bars take 70% of ring

  // Confidence sweep span
  const sweepDeg = isIdle ? 0 : confidence * 360;

  // SVG path for an arc
  const arc = (cx, cy, rad, startDeg, endDeg) => {
    if (endDeg - startDeg >= 359.999) {
      // Full circle as two arcs
      return `M ${cx + rad} ${cy} A ${rad} ${rad} 0 1 1 ${cx - rad} ${cy} A ${rad} ${rad} 0 1 1 ${cx + rad} ${cy}`;
    }
    const s = (startDeg - 90) * Math.PI / 180;
    const e = (endDeg - 90) * Math.PI / 180;
    const x1 = cx + rad * Math.cos(s), y1 = cy + rad * Math.sin(s);
    const x2 = cx + rad * Math.cos(e), y2 = cy + rad * Math.sin(e);
    const large = (endDeg - startDeg) > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${rad} ${rad} 0 ${large} 1 ${x2} ${y2}`;
  };

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      <defs>
        <clipPath id={`rv-clip-${seed}`}>
          <circle cx={r} cy={r} r={outerR} />
        </clipPath>
      </defs>

      {/* outer ring */}
      <circle cx={r} cy={r} r={outerR} fill="none"
              stroke={t.ink} strokeWidth={cfg.strokeMain}
              strokeDasharray={cfg.dashed ? '2 3' : 'none'} />

      {/* mid ring */}
      {cfg.rings >= 3 && (
        <circle cx={r} cy={r} r={(outerR + innerR) / 2} fill="none"
                stroke={t.line} strokeWidth={0.75}
                strokeDasharray={cfg.dashed ? '1 4' : 'none'} />
      )}
      {cfg.rings >= 4 && (
        <circle cx={r} cy={r} r={(outerR + innerR) / 2 + 22} fill="none"
                stroke={t.line2} strokeWidth={0.5} />
      )}

      {/* inner ring (face frame edge) */}
      <circle cx={r} cy={r} r={innerR} fill="none"
              stroke={t.ink} strokeWidth={cfg.strokeMain}
              strokeDasharray={cfg.dashed ? '4 3' : 'none'} />

      {/* embedding ticks — `reveal` fraction of bars are drawn (cw sweep) */}
      {!isIdle && (() => {
        const revealCount = Math.max(0, Math.min(dims, Math.floor(reveal * dims)));
        return normEmb.slice(0, revealCount).map((v, i) => {
        const ang = (i / dims) * Math.PI * 2 - Math.PI / 2;
        const cos = Math.cos(ang), sin = Math.sin(ang);
        const mag = Math.abs(v);
        const len = mag * (tickOuter - tickInner);
        const start = tickInner;
        const end = tickInner + len;
        const x1 = r + cos * start, y1 = r + sin * start;
        const x2 = r + cos * end,   y2 = r + sin * end;
        const positive = v >= 0;
        const col = isDeny ? (positive ? t.accent : t.ink2) :
                    (positive ? t.ink : t.mute);
        const sw = t.id === 'C' ? 1.8 : 1.0;
        return (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={col} strokeWidth={sw} strokeLinecap="butt"
                opacity={isScan ? 0.4 + mag * 0.6 : 1} />
        );
        });
      })()}

      {/* idle placeholder ticks — uniform short marks every 22.5° */}
      {isIdle && Array.from({length: 16}).map((_, i) => {
        const ang = (i / 16) * Math.PI * 2 - Math.PI / 2;
        const cos = Math.cos(ang), sin = Math.sin(ang);
        const x1 = r + cos * tickInner, y1 = r + sin * tickInner;
        const x2 = r + cos * (tickInner + 14), y2 = r + sin * (tickInner + 14);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={t.line} strokeWidth={1} />;
      })}

      {/* confidence sweep arc — drawn just outside the outer ring */}
      {!isIdle && (
        <path d={arc(r, r, outerR + 6, 0, sweepDeg)}
              stroke={accent} strokeWidth={t.id === 'C' ? 5 : 3.5}
              fill="none" strokeLinecap="butt" />
      )}

      {/* tick marks every 30 deg on outer ring */}
      {Array.from({length: 12}).map((_, i) => {
        const ang = (i / 12) * Math.PI * 2 - Math.PI / 2;
        const cos = Math.cos(ang), sin = Math.sin(ang);
        const x1 = r + cos * outerR, y1 = r + sin * outerR;
        const tlen = i % 3 === 0 ? 10 : 5;
        const x2 = r + cos * (outerR + tlen), y2 = r + sin * (outerR + tlen);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={t.ink} strokeWidth={0.75} />;
      })}

      {/* cardinal labels — well inside the viewBox */}
      {showLabels && ['N','E','S','W'].map((c, i) => {
        const ang = (i / 4) * Math.PI * 2 - Math.PI / 2;
        const cos = Math.cos(ang), sin = Math.sin(ang);
        const x = r + cos * (outerR + 16);
        const y = r + sin * (outerR + 16);
        return (
          <text key={c} x={x} y={y} fill={t.mute} fontSize={11}
                fontFamily={t.monoFamily} textAnchor="middle" dominantBaseline="middle"
                letterSpacing="1">{c}</text>
        );
      })}
    </svg>
  );
}

// ── KV (key/value row, mono) ──────────────────────────────────
function KV({ t, k, v, accent = false, big = false }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      alignItems: 'baseline',
      borderBottom: `1px dashed ${t.line2}`,
      padding: '7px 0',
      gap: 12,
    }}>
      <div style={{
        fontFamily: t.monoFamily, fontSize: 12, color: t.mute,
        letterSpacing: 1.2, textTransform: 'uppercase',
      }}>{k}</div>
      <div style={{
        fontFamily: t.monoFamily,
        fontSize: big ? 20 : 14,
        color: accent ? t.accent : t.ink,
        fontWeight: big ? 600 : 500,
        textAlign: 'right',
        letterSpacing: 0.2,
      }}>{v}</div>
    </div>
  );
}

// ── StatusChip ────────────────────────────────────────────────
function StatusChip({ t, kind = 'pass', children }) {
  const map = {
    pass: { bg: t.ink,    fg: t.id === 'B' ? t.accent : t.paper, dot: t.id === 'B' ? t.accent : t.paper },
    deny: { bg: t.accent, fg: t.accentInk, dot: t.accentInk },
    scan: { bg: t.surface,fg: t.ink,    dot: t.ink,    border: t.ink },
    idle: { bg: t.surface,fg: t.mute,   dot: t.mute,   border: t.line },
  };
  const c = map[kind];
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '8px 14px',
      background: c.bg, color: c.fg,
      border: c.border ? `1px solid ${c.border}` : 'none',
      fontFamily: t.monoFamily, fontSize: 13, letterSpacing: 1.5,
      fontWeight: 600, textTransform: 'uppercase',
    }}>
      <span style={{
        width: 7, height: 7, background: c.dot, borderRadius: '50%',
        display: 'inline-block',
      }} />
      {children}
    </div>
  );
}

// ── MonoLine ──────────────────────────────────────────────────
function MonoLine({ t, color, children, size = 12, weight = 400, letter = 1 }) {
  return (
    <div style={{
      fontFamily: t.monoFamily, fontSize: size, color: color || t.mute,
      letterSpacing: letter, fontWeight: weight,
    }}>{children}</div>
  );
}

// ── Crosshair tick on a square frame ──────────────────────────
function FrameTicks({ t, n = 12 }) {
  // Decorative little grid frame for charts
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
    }}>
      {Array.from({length: 4}).map((_, side) => (
        <div key={side} style={{
          position: 'absolute',
          ...(side === 0 ? { top: 0, left: 0, right: 0, height: 8 } : {}),
          ...(side === 1 ? { bottom: 0, left: 0, right: 0, height: 8 } : {}),
          ...(side === 2 ? { top: 0, bottom: 0, left: 0, width: 8 } : {}),
          ...(side === 3 ? { top: 0, bottom: 0, right: 0, width: 8 } : {}),
          background: `repeating-linear-gradient(${(side<2?90:0)}deg, ${t.ink} 0 1px, transparent 1px ${100/n}%)`,
        }} />
      ))}
    </div>
  );
}

// ── DataBars (horizontal, mini sparkline-style) ───────────────
function DataBars({ t, data, height = 24, color }) {
  const max = Math.max(1e-3, ...data.map(Math.abs));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height, width: '100%' }}>
      {data.map((v, i) => {
        const h = (Math.abs(v) / max) * height;
        return (
          <div key={i} style={{
            flex: 1, height: h, background: v >= 0 ? (color || t.ink) : t.mute,
          }} />
        );
      })}
    </div>
  );
}

Object.assign(window, { FacePortrait, RadialViz, KV, StatusChip, MonoLine, FrameTicks, DataBars, srand });
