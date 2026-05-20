window.FT = window.FT || {};
FT.atoms = FT.atoms || {};

function RadialViz({
  t, size = 520, dims = 128, seed = 7,
  confidence = 0.94, status = 'pass',
  faceSize = null, showLabels = true, reveal = 1,
}) {
  const r = size / 2;
  const accent = status === 'deny' ? t.accent : t.ink;
  const isDeny = status === 'deny';
  const isIdle = status === 'idle';
  const isScan = status === 'scan';
  const cfg = t.radial;

  const rand = FT.lib.srand(seed);
  const emb = [];
  for (let i = 0; i < dims; i++) {
    const lf = Math.sin(i * 0.18 + seed * 0.3) * 0.6 + Math.cos(i * 0.07) * 0.3;
    const hf = (rand() - 0.5) * 0.5;
    emb.push(lf + hf);
  }
  const maxAbs = Math.max(...emb.map(Math.abs));
  const normEmb = emb.map(v => v / maxAbs);

  const outerR = r - 26;
  const innerR = (faceSize ? faceSize / 2 + 22 : r * 0.48);
  const tickInner = innerR + 4;
  const ringDepth = outerR - innerR - 8;
  const tickOuter = tickInner + ringDepth * 0.7;
  const sweepDeg = isIdle ? 0 : confidence * 360;

  const arc = (cx, cy, rad, startDeg, endDeg) => {
    if (endDeg - startDeg >= 359.999) {
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
      <circle cx={r} cy={r} r={outerR} fill="none"
              stroke={t.ink} strokeWidth={cfg.strokeMain}
              strokeDasharray={cfg.dashed ? '2 3' : 'none'} />
      {cfg.rings >= 3 && (
        <circle cx={r} cy={r} r={(outerR + innerR) / 2} fill="none"
                stroke={t.line} strokeWidth={0.75}
                strokeDasharray={cfg.dashed ? '1 4' : 'none'} />
      )}
      {cfg.rings >= 4 && (
        <circle cx={r} cy={r} r={(outerR + innerR) / 2 + 22} fill="none"
                stroke={t.line2} strokeWidth={0.5} />
      )}
      <circle cx={r} cy={r} r={innerR} fill="none"
              stroke={t.ink} strokeWidth={cfg.strokeMain}
              strokeDasharray={cfg.dashed ? '4 3' : 'none'} />

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
          const col = isDeny ? (positive ? t.accent : t.ink2) : (positive ? t.ink : t.mute);
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={col} strokeWidth={1.0} strokeLinecap="butt"
                  opacity={isScan ? 0.4 + mag * 0.6 : 1} />
          );
        });
      })()}

      {isIdle && Array.from({length: 16}).map((_, i) => {
        const ang = (i / 16) * Math.PI * 2 - Math.PI / 2;
        const cos = Math.cos(ang), sin = Math.sin(ang);
        const x1 = r + cos * tickInner, y1 = r + sin * tickInner;
        const x2 = r + cos * (tickInner + 14), y2 = r + sin * (tickInner + 14);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={t.line} strokeWidth={1} />;
      })}

      {!isIdle && (
        <path d={arc(r, r, outerR + 6, 0, sweepDeg)}
              stroke={accent} strokeWidth={3.5} fill="none" strokeLinecap="butt" />
      )}

      {Array.from({length: 12}).map((_, i) => {
        const ang = (i / 12) * Math.PI * 2 - Math.PI / 2;
        const cos = Math.cos(ang), sin = Math.sin(ang);
        const x1 = r + cos * outerR, y1 = r + sin * outerR;
        const tlen = i % 3 === 0 ? 10 : 5;
        const x2 = r + cos * (outerR + tlen), y2 = r + sin * (outerR + tlen);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={t.ink} strokeWidth={0.75} />;
      })}

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

FT.atoms.RadialViz = RadialViz;
