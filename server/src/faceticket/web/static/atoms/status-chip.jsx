window.FT = window.FT || {};
FT.atoms = FT.atoms || {};

function StatusChip({ t, kind = 'pass', children }) {
  const map = {
    pass: { bg: t.ink,    fg: t.paper,    dot: t.paper },
    deny: { bg: t.accent, fg: t.accentInk, dot: t.accentInk },
    scan: { bg: t.surface, fg: t.ink,     dot: t.ink,  border: t.ink },
    idle: { bg: t.surface, fg: t.mute,    dot: t.mute, border: t.line },
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

FT.atoms.StatusChip = StatusChip;
