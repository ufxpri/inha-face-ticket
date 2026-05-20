window.FT = window.FT || {};
FT.molecules = FT.molecules || {};

function ShowtimeTimeline({ t, current = '20:12' }) {
  const stops = [
    { t: '19:00', l: 'DOORS', sub: '입장 시작' },
    { t: '20:00', l: 'SHOW',  sub: '공연 시작' },
    { t: '20:55', l: 'INTER', sub: '인터미션' },
    { t: '22:10', l: 'ENCORE', sub: '앙코르' },
    { t: '22:30', l: 'END',   sub: '종료' },
  ];
  const toMin = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
  const start = toMin(stops[0].t), end = toMin(stops[stops.length - 1].t);
  const pct = Math.max(0, Math.min(1, (toMin(current) - start) / (end - start)));

  return (
    <div style={{
      border: `1px solid ${t.line}`, background: t.surface,
      padding: '16px 20px',
      fontFamily: t.monoFamily, fontSize: 12, letterSpacing: 1.2,
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        color: t.mute, letterSpacing: 2, marginBottom: 16,
      }}>
        <span>SHOW.TIMELINE</span>
        <span>NOW · <span style={{ color: t.accent, fontWeight: 600 }}>{current}</span></span>
      </div>
      <div style={{ position: 'relative', height: 52 }}>
        <div style={{ position: 'absolute', top: 16, left: 6, right: 6, height: 1, background: t.ink }} />
        {stops.map((s, i) => {
          const sp = i / (stops.length - 1) * 100;
          return (
            <div key={i} style={{
              position: 'absolute', left: `${sp}%`, top: 0,
              transform: 'translateX(-50%)', textAlign: 'center',
            }}>
              <div style={{ width: 1, height: 16, background: t.ink, margin: '0 auto' }} />
              <div style={{ fontSize: 11, color: t.ink, fontWeight: 600, marginTop: 4, letterSpacing: 1.5 }}>{s.l}</div>
              <div style={{ fontSize: 10, color: t.mute, letterSpacing: 1 }}>{s.t}</div>
            </div>
          );
        })}
        <div style={{
          position: 'absolute', left: `${pct * 100}%`, top: 6,
          transform: 'translateX(-50%)',
        }}>
          <div style={{
            width: 0, height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop: `6px solid ${t.accent}`,
          }} />
          <div style={{ width: 1, height: 14, background: t.accent, margin: '0 auto' }} />
        </div>
      </div>
    </div>
  );
}

FT.molecules.ShowtimeTimeline = ShowtimeTimeline;
