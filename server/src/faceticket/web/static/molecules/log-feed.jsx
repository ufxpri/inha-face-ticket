window.FT = window.FT || {};
FT.molecules = FT.molecules || {};

function LogFeed({ t, entries }) {
  return (
    <div style={{
      flex: 1, background: t.ink, color: t.paper,
      padding: '10px 12px',
      fontFamily: t.monoFamily, fontSize: 12, lineHeight: 1.5,
      overflowY: 'auto', letterSpacing: 0.3,
      minHeight: 180, maxHeight: 360,
    }}>
      {entries.length === 0 ? (
        <div style={{ color: t.mute, opacity: 0.7 }}>— awaiting events —</div>
      ) : entries.slice().reverse().map((entry, i) => {
        const isErr  = entry.level === 'error';
        const isWarn = entry.level === 'warn';
        const col = isErr ? t.danger : isWarn ? t.accent : t.paper;
        const tag = isErr ? 'E' : isWarn ? 'W' : 'I';
        return (
          <div key={i} style={{ display: 'flex', gap: 10 }}>
            <span style={{ color: t.mute, flexShrink: 0 }}>{entry.ts}</span>
            <span style={{
              color: col, width: 10, flexShrink: 0,
              fontWeight: isErr ? 700 : 400,
            }}>{tag}</span>
            <span style={{
              color: col, wordBreak: 'break-word',
              fontWeight: isErr ? 600 : 400,
            }}>{entry.msg}</span>
          </div>
        );
      })}
    </div>
  );
}

FT.molecules.LogFeed = LogFeed;
