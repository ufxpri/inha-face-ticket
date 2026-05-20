window.FT = window.FT || {};
FT.atoms = FT.atoms || {};

// BigButton: interactive when `onClick` provided, otherwise static display.
function BigButton({ t, num, en, enabled, pending, done, onClick }) {
  const interactive = typeof onClick === 'function';
  const isEnabled = enabled && !pending && !done;
  return (
    <div onClick={interactive && isEnabled ? onClick : undefined} style={{
      padding: '14px 16px',
      background: isEnabled ? t.ink : (done ? t.paper : t.surface),
      color: isEnabled ? t.paper : t.mute,
      border: `1px solid ${isEnabled ? t.ink : t.line}`,
      display: 'flex', alignItems: 'center', gap: 14,
      cursor: interactive ? (isEnabled ? 'pointer' : 'not-allowed') : 'default',
      userSelect: 'none',
    }}>
      <span style={{
        fontFamily: t.monoFamily, fontSize: 15, fontWeight: 600,
        letterSpacing: 1, opacity: pending ? 0.5 : 1,
      }}>{num}</span>
      <span style={{
        fontFamily: t.sansFamily, fontSize: 15, fontWeight: 600,
        letterSpacing: 0.5, flex: 1,
      }}>{en}</span>
      <span style={{
        fontFamily: t.monoFamily, fontSize: 11, letterSpacing: 2, opacity: 0.65,
      }}>{pending ? '— PENDING —' : (done ? '✓ DONE' : (isEnabled ? '▸' : '—'))}</span>
    </div>
  );
}

FT.atoms.BigButton = BigButton;
