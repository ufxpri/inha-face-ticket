window.FT = window.FT || {};
FT.molecules = FT.molecules || {};

function TabletFooter({ t, lines }) {
  return (
    <div style={{
      borderTop: `1px solid ${t.line}`,
      background: t.paper,
      padding: '14px 32px',
      display: 'flex', flexDirection: 'column', gap: 5,
    }}>
      {lines.map((line, i) => (
        <div key={i} style={{
          display: 'flex', justifyContent: 'space-between',
          fontFamily: t.monoFamily, fontSize: 11.5, color: line.dim ? t.mute : t.ink,
          letterSpacing: 1.2,
        }}>
          <span>{line.l}</span>
          <span style={{ color: line.accent ? t.accent : (line.dim ? t.mute : t.ink) }}>{line.r}</span>
        </div>
      ))}
    </div>
  );
}

FT.molecules.TabletFooter = TabletFooter;
