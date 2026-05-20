window.FT = window.FT || {};
FT.molecules = FT.molecules || {};

function SetlistPanel({ t, current = -1, compact = false }) {
  const SETLIST = FT.data.SETLIST;
  return (
    <div style={{
      border: `1px solid ${t.line}`, background: t.surface,
      padding: '14px 16px', fontFamily: t.monoFamily,
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: 10,
      }}>
        <div style={{ fontSize: 12, color: t.mute, letterSpacing: 2 }}>SETLIST · {SETLIST.length} tracks</div>
        <div style={{ fontSize: 12, color: t.mute, letterSpacing: 1.5 }}>~ 41:11 + EN 06:08</div>
      </div>
      {SETLIST.map((s, i) => {
        const state = i === current ? 'now' : (current >= 0 && i < current ? 'done' : 'pend');
        const mark = state === 'now' ? '◉' : state === 'done' ? '✓' : '·';
        const titleCol = state === 'now' ? t.accent : (state === 'done' ? t.mute : t.ink);
        const isEncore = s.kind === 'encore';
        return (
          <div key={s.n} style={{
            display: 'grid', gridTemplateColumns: '22px 28px 1fr auto', gap: 10,
            padding: '5px 0', fontSize: 13,
            borderTop: isEncore ? `1px dashed ${t.line}` : 'none',
            marginTop: isEncore ? 6 : 0,
            paddingTop: isEncore ? 9 : 5,
            opacity: compact && i > 5 && !isEncore ? 0.5 : 1,
          }}>
            <span style={{ color: state === 'now' ? t.accent : t.mute, fontWeight: 600 }}>{mark}</span>
            <span style={{ color: t.mute, letterSpacing: 1 }}>{s.n}</span>
            <span style={{ color: titleCol, fontFamily: t.sansFamily, fontSize: 14 }}>
              {s.titleKo}
              <span style={{ color: t.mute, marginLeft: 8, fontFamily: t.monoFamily, fontSize: 11, letterSpacing: 1 }}>
                {s.titleEn}
              </span>
            </span>
            <span style={{ color: t.mute, letterSpacing: 1 }}>{s.dur}</span>
          </div>
        );
      })}
    </div>
  );
}

FT.molecules.SetlistPanel = SetlistPanel;
