window.FT = window.FT || {};
FT.atoms = FT.atoms || {};

function ZoneBadge({ t, zone = 'FLOOR', big = false }) {
  const z = FT.data.ZONES[zone];
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: big ? 10 : 8,
      border: `1px solid ${t.ink}`, background: t.surface,
      padding: big ? '10px 14px' : '6px 10px',
      fontFamily: t.monoFamily, fontSize: big ? 14 : 11, letterSpacing: 1.5,
    }}>
      <span style={{
        display: 'inline-block',
        width: big ? 18 : 12, height: big ? 18 : 12,
        background: z.color,
      }} />
      <span style={{ color: t.mute, fontWeight: 600 }}>{z.code}</span>
      <span style={{ color: t.ink, fontFamily: t.sansFamily, fontWeight: 600 }}>
        {z.ko}
      </span>
      <span style={{ color: t.mute, fontSize: big ? 12 : 10, letterSpacing: 1 }}>
        / {z.en}
      </span>
    </div>
  );
}

FT.atoms.ZoneBadge = ZoneBadge;
