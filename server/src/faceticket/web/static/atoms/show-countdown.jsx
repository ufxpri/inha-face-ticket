window.FT = window.FT || {};
FT.atoms = FT.atoms || {};

function ShowCountdown({ t, label, time, accent = false }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '16px 18px',
      border: `1px solid ${accent ? t.accent : t.line}`,
      background: t.surface,
    }}>
      <div style={{
        fontFamily: t.monoFamily, fontSize: 12, color: t.mute, letterSpacing: 2,
      }}>{label}</div>
      <div style={{
        fontFamily: t.monoFamily, fontSize: 42, fontWeight: 600,
        color: accent ? t.accent : t.ink, letterSpacing: 1.5, marginTop: 4, lineHeight: 1,
      }}>{time}</div>
    </div>
  );
}

FT.atoms.ShowCountdown = ShowCountdown;
