window.FT = window.FT || {};
FT.molecules = FT.molecules || {};

function ShowStrip({ t }) {
  const SHOW = FT.data.SHOW;
  return (
    <div style={{
      padding: '14px 32px 16px',
      background: t.bg,
      borderBottom: `1px solid ${t.line}`,
      display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 28, alignItems: 'end',
    }}>
      <div>
        <div style={{
          fontFamily: t.monoFamily, fontSize: 12, color: t.mute, letterSpacing: 2,
        }}>NOW · 공연 입장 / SHOW ENTRY</div>
        <div style={{
          fontFamily: t.sansFamily, fontSize: 34, fontWeight: 700,
          color: t.ink, letterSpacing: -0.3, marginTop: 2, lineHeight: 1,
        }}>
          {SHOW.artist}<span style={{ color: t.accent, margin: '0 6px' }}>·</span>
          <span style={{ fontWeight: 400 }}>{SHOW.tour}</span>
        </div>
        <div style={{
          fontFamily: t.sansFamily, fontSize: 15, color: t.ink2, marginTop: 5,
        }}>
          {SHOW.artistKo} · {SHOW.tourKo}
          <span style={{ color: t.mute, marginLeft: 10, fontFamily: t.monoFamily, fontSize: 12, letterSpacing: 1.5 }}>
            opening · {SHOW.opening} / {SHOW.openingKo}
          </span>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontFamily: t.monoFamily, fontSize: 12, color: t.mute, letterSpacing: 2 }}>VENUE</div>
        <div style={{ fontFamily: t.sansFamily, fontSize: 17, fontWeight: 600, color: t.ink, marginTop: 2 }}>
          {SHOW.venue} · {SHOW.city}
        </div>
        <div style={{ fontFamily: t.sansFamily, fontSize: 13, color: t.mute }}>{SHOW.venueKo} · {SHOW.cityKo}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontFamily: t.monoFamily, fontSize: 12, color: t.mute, letterSpacing: 2 }}>DATE</div>
        <div style={{ fontFamily: t.monoFamily, fontSize: 22, fontWeight: 600, color: t.ink, letterSpacing: 1, marginTop: 2 }}>
          {SHOW.date}<span style={{ color: t.mute, marginLeft: 6 }}>{SHOW.weekday}</span>
        </div>
        <div style={{ fontFamily: t.monoFamily, fontSize: 12, color: t.mute, letterSpacing: 1.5 }}>
          DOORS {SHOW.doors} · SHOW {SHOW.show}
        </div>
      </div>
    </div>
  );
}

FT.molecules.ShowStrip = ShowStrip;
