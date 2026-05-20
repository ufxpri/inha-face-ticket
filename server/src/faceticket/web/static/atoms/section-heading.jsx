window.FT = window.FT || {};
FT.atoms = FT.atoms || {};

function SectionHeading({ t, num, en, ko }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
      <span style={{
        fontFamily: t.monoFamily, fontSize: 12, color: t.accent,
        letterSpacing: 2, fontWeight: 600,
      }}>{num}</span>
      <span style={{
        fontFamily: t.sansFamily, fontSize: 15, color: t.ink,
        letterSpacing: 1.5, fontWeight: 600, textTransform: 'uppercase',
      }}>{en}</span>
      {ko && <span style={{
        fontFamily: t.sansFamily, fontSize: 14, color: t.mute,
      }}>{ko}</span>}
      <div style={{ flex: 1, borderTop: `1px solid ${t.line}`, height: 0, marginTop: 6 }} />
    </div>
  );
}

FT.atoms.SectionHeading = SectionHeading;
