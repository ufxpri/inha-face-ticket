window.FT = window.FT || {};
FT.molecules = FT.molecules || {};

function CapacityGauge({ t, attended, capacity, perSection }) {
  const SHOW = FT.data.SHOW;
  attended = attended ?? SHOW.attended;
  capacity = capacity ?? SHOW.capacity;
  perSection = perSection || FT.data.CAPACITY_BREAKDOWN;
  const pct = attended / capacity;
  return (
    <div style={{ border: `1px solid ${t.line}`, background: t.surface, padding: '14px 16px' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: 10,
      }}>
        <div style={{ fontFamily: t.monoFamily, fontSize: 12, color: t.mute, letterSpacing: 2 }}>
          CAPACITY · 입장 현황
        </div>
        <div style={{ fontFamily: t.monoFamily, fontSize: 13, color: t.ink, letterSpacing: 1 }}>
          <span style={{ fontSize: 22, fontWeight: 600 }}>{attended.toLocaleString()}</span>
          <span style={{ color: t.mute }}> / {capacity.toLocaleString()}</span>
          <span style={{ color: t.accent, marginLeft: 8, fontWeight: 600 }}>{(pct*100).toFixed(1)}%</span>
        </div>
      </div>
      <div style={{ height: 20, background: t.paper, border: `1px solid ${t.line}`, position: 'relative' }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${pct*100}%`, background: t.ink,
        }} />
        {[0.25, 0.5, 0.75].map(f => (
          <div key={f} style={{
            position: 'absolute', left: `${f*100}%`, top: 0, bottom: 0,
            width: 1, background: t.bg,
          }} />
        ))}
      </div>
      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {perSection.map(([code, att, cap]) => (
          <div key={code}>
            <div style={{
              fontFamily: t.monoFamily, fontSize: 11, color: t.mute, letterSpacing: 1.5,
            }}>{code}</div>
            <div style={{
              fontFamily: t.monoFamily, fontSize: 16, color: t.ink, fontWeight: 600,
            }}>{att}<span style={{ color: t.mute, fontWeight: 400 }}> / {cap}</span></div>
            <div style={{ height: 4, background: t.paper, border: `1px solid ${t.line2}`, marginTop: 2 }}>
              <div style={{ height: '100%', width: `${(att/cap)*100}%`, background: t.ink }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

FT.molecules.CapacityGauge = CapacityGauge;
