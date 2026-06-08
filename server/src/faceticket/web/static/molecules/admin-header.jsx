window.FT = window.FT || {};
FT.molecules = FT.molecules || {};

// AdminHeader — operator console top bar with the device/flag chips.
function AdminHeader({ t, flags, wsOk, fsmState, onToggle }) {
  const locked = fsmState !== 'idle';
  const chips = [
    { k: 'face',   v: flags.ml ? 'ML' : 'STUB',
      toggleable: flags.faceAvailable,
      toggle: () => onToggle('face', flags.ml) },
    { k: 'ble',    v: flags.bleMock ? 'MOCK' : 'REAL',
      toggleable: true,
      toggle: () => onToggle('ble', !flags.bleMock) },
    { k: 'io', v: (() => {
        const d = flags.devices || {};
        const one = (label, s) => s && s.connected ? `${label}@${s.port || '?'}` : `${label}✗`;
        return `${one('N', d.nfc)} ${one('G', d.gate)}`;
      })(),
      toggleable: false },
    { k: 'ws',     v: wsOk ? 'OK' : 'DOWN', toggleable: false },
    { k: 'ntp',    v: 'SYNC', toggleable: false },
  ];

  return (
    <div style={{
      padding: '12px 28px',
      borderBottom: `1px solid ${t.ink}`,
      background: t.paper,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 22, height: 22, position: 'relative',
          border: `1.5px solid ${t.ink}`, borderRadius: '50%',
        }}>
          <div style={{ position: 'absolute', inset: 4, border: `1.5px solid ${t.ink}`, borderRadius: '50%' }} />
        </div>
        <div style={{ fontFamily: t.sansFamily, fontSize: 17, fontWeight: 600,
                      color: t.ink, letterSpacing: 0.4 }}>
          FACEPASS<span style={{ color: t.accent }}>·</span>operator
        </div>
        <div style={{ fontFamily: t.monoFamily, fontSize: 11.5, color: t.mute, letterSpacing: 1.5 }}>
          v2.4.1 · GATE G-04 · OPERATOR · 박서연
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {chips.map(({ k, v, toggleable, toggle }) => {
          const isMock = v === 'MOCK' || v === 'STUB';
          const can = toggleable && !locked;
          return (
            <div key={k}
                 onClick={can ? toggle : undefined}
                 title={!toggleable ? `${k}: 토글 불가 (모듈/포트 없음)`
                       : locked ? '진행 중에는 전환 불가' : `클릭으로 ${isMock ? 'REAL' : 'MOCK'} 전환`}
                 style={{
              fontFamily: t.monoFamily, fontSize: 12, padding: '6px 11px',
              border: `1px solid ${isMock ? t.accent : t.line}`,
              background: isMock ? `${t.accent}11` : t.surface,
              letterSpacing: 1.5,
              cursor: can ? 'pointer' : (toggleable ? 'not-allowed' : 'default'),
              opacity: can ? 1 : (toggleable ? 0.6 : 1),
              userSelect: 'none',
              transition: 'background 150ms, border-color 150ms',
            }}>
              {k}: <strong style={{ color: isMock ? t.accent : t.ink }}>{v}</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

FT.molecules.AdminHeader = AdminHeader;
