window.FT = window.FT || {};
FT.molecules = FT.molecules || {};

// DevicePanel — 역할별(NFC 리더 / 입장 게이트) 시리얼 연결 카드. SIM 폴백을 항상 제공.
function DevicePanel({ t, role, label, status, ports, busy, onConnect, onDisconnect, onRefresh }) {
  const { useState, useEffect } = React;
  const SIM_OPT = { device: 'SIM', description: '가상 시뮬레이션 (시리얼 미사용)', vid_pid: '' };
  const allPorts = [SIM_OPT, ...ports];
  const [selected, setSelected] = useState('SIM');

  useEffect(() => {
    if (status.connected) return;
    if (!selected) setSelected('SIM');
    if (selected !== 'SIM' && !ports.find(p => p.device === selected)) {
      setSelected('SIM');
    }
  }, [ports, status.connected]);

  const connected = status.connected;
  const canConnect = !connected && !busy && !!selected;
  const canDisconnect = connected && !busy;
  const tip = busy ? '진행 중에는 변경 불가' : !selected ? '포트를 선택하세요' : '';

  return (
    <div style={{
      border: `1px solid ${connected ? t.ink : t.line}`,
      background: connected ? t.surface : t.paper,
      padding: '10px 12px', marginBottom: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontFamily: t.monoFamily, fontSize: 11, letterSpacing: 1.5, color: t.ink }}>
          {label}
        </span>
        <span style={{
          fontFamily: t.monoFamily, fontSize: 10, letterSpacing: 1.5,
          padding: '2px 6px',
          border: `1px solid ${connected ? t.ink : t.line}`,
          background: connected ? t.ink : t.paper,
          color: connected ? t.paper : t.mute,
        }}>
          {connected ? `CONNECTED@${status.port}` : 'DISCONNECTED'}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        <select value={selected} disabled={connected || busy}
                onChange={e => setSelected(e.target.value)}
                style={{
          flex: 1, padding: '5px 7px',
          fontFamily: t.monoFamily, fontSize: 11,
          border: `1px solid ${t.line}`, background: connected ? t.paper : t.surface,
          color: t.ink, letterSpacing: 0.5,
        }}>
          {allPorts.map(p => (
            <option key={p.device} value={p.device}>
              {p.device}{p.vid_pid ? ` · ${p.vid_pid}` : ''}{p.description ? ` · ${p.description}` : ''}
            </option>
          ))}
        </select>
        <div onClick={onRefresh} title="포트 목록 새로고침" style={{
          padding: '5px 9px', border: `1px solid ${t.line}`, background: t.surface,
          fontFamily: t.monoFamily, fontSize: 11, color: t.mute,
          cursor: 'pointer', userSelect: 'none',
        }}>↻</div>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <div onClick={canConnect ? () => onConnect(role, selected) : undefined}
             title={canConnect ? '' : tip}
             style={{
          flex: 1, padding: '6px 8px', textAlign: 'center',
          background: canConnect ? t.ink : t.surface,
          color: canConnect ? t.paper : t.mute,
          border: `1px solid ${canConnect ? t.ink : t.line}`,
          fontFamily: t.monoFamily, fontSize: 11, letterSpacing: 1.2,
          cursor: canConnect ? 'pointer' : 'not-allowed', userSelect: 'none',
          opacity: canConnect ? 1 : 0.6,
        }}>CONNECT</div>
        <div onClick={canDisconnect ? () => onDisconnect(role) : undefined}
             style={{
          flex: 1, padding: '6px 8px', textAlign: 'center',
          background: t.surface, color: canDisconnect ? t.ink : t.mute,
          border: `1px solid ${canDisconnect ? t.ink : t.line}`,
          fontFamily: t.monoFamily, fontSize: 11, letterSpacing: 1.2,
          cursor: canDisconnect ? 'pointer' : 'not-allowed', userSelect: 'none',
          opacity: canDisconnect ? 1 : 0.6,
        }}>DISCONNECT</div>
      </div>
    </div>
  );
}

FT.molecules.DevicePanel = DevicePanel;
