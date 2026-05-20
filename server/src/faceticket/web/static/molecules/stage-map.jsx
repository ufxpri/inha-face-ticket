window.FT = window.FT || {};
FT.molecules = FT.molecules || {};

function StageMap({ t, highlightSection = 'FL-A', highlightSeat = [12, 3] }) {
  const W = 360, H = 220;
  return (
    <div style={{
      border: `1px solid ${t.ink}`, background: t.surface,
      padding: '14px 16px',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: 12,
      }}>
        <div style={{ fontFamily: t.monoFamily, fontSize: 12, color: t.mute, letterSpacing: 2 }}>
          STAGE.MAP · 좌석 위치
        </div>
        <div style={{ fontFamily: t.monoFamily, fontSize: 12, color: t.accent, fontWeight: 600, letterSpacing: 1.5 }}>
          ✕ {highlightSection} · R{highlightSeat[0]}·S{highlightSeat[1]}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
        <rect x={W*0.18} y={6} width={W*0.64} height={20} fill={t.ink} />
        <text x={W/2} y={20} fill={t.paper} fontSize={9}
              fontFamily={t.monoFamily} textAnchor="middle" letterSpacing="3">STAGE</text>
        <rect x={W*0.30} y={34} width={W*0.40} height={14} fill="none" stroke={t.line} />
        <text x={W*0.50} y={44} fill={t.mute} fontSize={8}
              fontFamily={t.monoFamily} textAnchor="middle" letterSpacing="2">PIT</text>
        <rect x={W*0.18} y={56} width={W*0.30} height={50} fill="none" stroke={t.line} />
        <text x={W*0.33} y={70} fill={t.mute} fontSize={9}
              fontFamily={t.monoFamily} textAnchor="middle" letterSpacing="2">FL · A</text>
        <rect x={W*0.52} y={56} width={W*0.30} height={50} fill="none" stroke={t.line} />
        <text x={W*0.67} y={70} fill={t.mute} fontSize={9}
              fontFamily={t.monoFamily} textAnchor="middle" letterSpacing="2">FL · B</text>
        {Array.from({length: 14}).map((_, r) =>
          Array.from({length: 8}).map((__, s) => {
            const cx = W*0.18 + 6 + s * ((W*0.30 - 12) / 8) + ((W*0.30 - 12) / 16);
            const cy = 78 + r * 1.8;
            const isMine = highlightSection === 'FL-A' && r + 1 === highlightSeat[0] && s + 1 === highlightSeat[1];
            return <rect key={`a-${r}-${s}`} x={cx-1} y={cy-1} width={2} height={1.5}
                         fill={isMine ? t.accent : t.line} />;
          })
        )}
        <rect x={W*0.08} y={114} width={W*0.18} height={36} fill="none" stroke={t.line} />
        <text x={W*0.17} y={134} fill={t.mute} fontSize={8}
              fontFamily={t.monoFamily} textAnchor="middle" letterSpacing="2">MEZZ L</text>
        <rect x={W*0.74} y={114} width={W*0.18} height={36} fill="none" stroke={t.line} />
        <text x={W*0.83} y={134} fill={t.mute} fontSize={8}
              fontFamily={t.monoFamily} textAnchor="middle" letterSpacing="2">MEZZ R</text>
        <rect x={W*0.28} y={114} width={W*0.44} height={36} fill="none" stroke={t.line} />
        <text x={W*0.50} y={134} fill={t.mute} fontSize={8}
              fontFamily={t.monoFamily} textAnchor="middle" letterSpacing="2">MEZZ · CTR</text>
        <rect x={W*0.10} y={158} width={W*0.80} height={28} fill="none" stroke={t.line} />
        <text x={W*0.50} y={175} fill={t.mute} fontSize={8}
              fontFamily={t.monoFamily} textAnchor="middle" letterSpacing="2">BALCONY</text>
        <text x={4} y={H-4} fill={t.mute} fontSize={7}
              fontFamily={t.monoFamily} letterSpacing="1.5">G-01</text>
        <text x={W-26} y={H-4} fill={t.mute} fontSize={7}
              fontFamily={t.monoFamily} letterSpacing="1.5">G-04 ◉</text>
        <text x={W/2-12} y={H-4} fill={t.mute} fontSize={7}
              fontFamily={t.monoFamily} letterSpacing="1.5">G-02 / G-03</text>
        {highlightSection === 'FL-A' && (() => {
          const cx = W*0.18 + 6 + (highlightSeat[1]-1) * ((W*0.30 - 12) / 8) + ((W*0.30 - 12) / 16);
          const cy = 78 + (highlightSeat[0]-1) * 1.8;
          return (
            <g>
              <line x1={cx-10} y1={cy} x2={cx-3} y2={cy} stroke={t.accent} strokeWidth={1} />
              <line x1={cx+3} y1={cy} x2={cx+10} y2={cy} stroke={t.accent} strokeWidth={1} />
              <line x1={cx} y1={cy-10} x2={cx} y2={cy-3} stroke={t.accent} strokeWidth={1} />
              <line x1={cx} y1={cy+3} x2={cx} y2={cy+10} stroke={t.accent} strokeWidth={1} />
              <circle cx={cx} cy={cy} r={2.5} fill={t.accent} />
            </g>
          );
        })()}
      </svg>
    </div>
  );
}

FT.molecules.StageMap = StageMap;
