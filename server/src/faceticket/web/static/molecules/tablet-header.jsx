window.FT = window.FT || {};
FT.molecules = FT.molecules || {};

function TabletHeader({ t, mode }) {
  const modeLabel = {
    idle:  ['STANDBY',       '대기 중'],
    pass:  ['ENTRY · MATCH', '본인 확인 완료'],
    deny:  ['ENTRY · DENY',  '본인 확인 실패'],
    issue: ['ISSUE',         '발급 모드'],
  }[mode];
  const time = mode === 'idle' ? '19:13:01' : mode === 'pass' ? '19:48:33' : mode === 'deny' ? '19:50:17' : '15:24:09';
  const seq  = mode === 'idle' ? '#2490' : mode === 'pass' ? '#2491' : mode === 'deny' ? '#2492' : '#0188';
  return (
    <div style={{
      display: 'flex', alignItems: 'stretch', justifyContent: 'space-between',
      borderBottom: `1px solid ${t.ink}`,
      padding: '14px 32px', gap: 24,
      background: t.paper,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 24, height: 24, position: 'relative',
          border: `1.5px solid ${t.ink}`, borderRadius: '50%',
        }}>
          <div style={{ position: 'absolute', inset: 4,
            border: `1.5px solid ${t.ink}`, borderRadius: '50%' }} />
        </div>
        <div style={{
          fontFamily: t.sansFamily, fontWeight: 600,
          fontSize: 17, color: t.ink, letterSpacing: 0.5,
        }}>FACEPASS<span style={{ color: t.accent }}>·</span>kiosk</div>
        <div style={{
          fontFamily: t.monoFamily, fontSize: 11, color: t.mute, letterSpacing: 1.5,
        }}>GATE G-04 · 메인 입장 · {modeLabel[0]} / {modeLabel[1]}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{
          fontFamily: t.monoFamily, fontSize: 11, color: t.mute, letterSpacing: 1.5,
        }}>seq {seq} · KST</div>
        <div style={{
          fontFamily: t.monoFamily, fontSize: 22, color: t.ink, fontWeight: 500, letterSpacing: 1,
        }}>{time}</div>
      </div>
    </div>
  );
}

FT.molecules.TabletHeader = TabletHeader;
