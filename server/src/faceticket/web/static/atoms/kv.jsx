window.FT = window.FT || {};
FT.atoms = FT.atoms || {};

function KV({ t, k, v, accent = false, big = false }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      alignItems: 'baseline',
      borderBottom: `1px dashed ${t.line2}`,
      padding: '7px 0', gap: 12,
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
        textAlign: 'right', letterSpacing: 0.2,
      }}>{v}</div>
    </div>
  );
}

FT.atoms.KV = KV;
