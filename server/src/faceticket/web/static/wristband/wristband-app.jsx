const { useState, useEffect, useCallback, useRef } = React;

// 팔찌 LED 패턴 샘플.
//  - command : 서버 /ws/admin 의 led 명령으로 보내는 문자열.
//  - kind 'solid'/'off' : 펌웨어가 직접 처리하는 단색 (즉시 1회 전송).
//  - kind 그 외(pattern) : 서버가 프리미티브를 시간차로 연속 전송해 재생 (LED_PATTERNS).
const PATTERNS = [
  { id: 'solid-r', label: '레드',     command: 'RGB R',           kind: 'solid',   color: '#d83a1f' },
  { id: 'solid-g', label: '그린',     command: 'RGB G',           kind: 'solid',   color: '#1f9d3a' },
  { id: 'solid-b', label: '블루',     command: 'RGB B',           kind: 'solid',   color: '#2a6cf0' },
  { id: 'off',     label: '끄기',     command: 'RGB OFF',         kind: 'off',     color: '#2a2620' },
  { id: 'rainbow', label: '레인보우', command: 'PATTERN RAINBOW', kind: 'rainbow', color: '#d83a1f' },
  { id: 'blink',   label: '깜빡임',   command: 'PATTERN BLINK',   kind: 'blink',   color: '#d83a1f' },
  { id: 'breathe', label: '브리딩',   command: 'PATTERN BREATHE', kind: 'breathe', color: '#2a6cf0' },
  { id: 'strobe',  label: '스트로브', command: 'PATTERN STROBE',  kind: 'strobe',  color: '#f0c000' },
];

const SIM_OPT = { device: 'SIM', description: '가상 시뮬레이션 (시리얼 미사용)', vid_pid: '' };

const isPattern = p => p.kind !== 'solid' && p.kind !== 'off';

// 패턴 종류별 미리보기 CSS 클래스(animations 는 wristband.html 에 정의).
function previewClass(kind) {
  if (kind === 'rainbow') return 'ft-led-rainbow';
  if (kind === 'blink')   return 'ft-led-blink';
  if (kind === 'breathe') return 'ft-led-breathe';
  if (kind === 'strobe')  return 'ft-led-strobe';
  return '';
}

// /ws/admin 에 붙어 hello/flags(포트·NFC 상태·재생 패턴)·log 를 수신하고 led/io 명령을 송신.
function useWristbandSocket() {
  const wsRef = useRef(null);
  const [wsOk, setWsOk] = useState(false);
  const [ports, setPorts] = useState([]);
  const [nfc, setNfc] = useState({ connected: false, port: null });
  const [ledPattern, setLedPattern] = useState('');   // 서버가 재생 중인 패턴 명령 ("" = 정지)
  const [log, setLog] = useState([]);

  const appendLog = useCallback((msg, level = 'info') => {
    const d = new Date();
    const ts = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    setLog(prev => [{ key: `${ts}-${prev.length}-${msg}`, ts, level, msg }, ...prev].slice(0, 10));
  }, []);

  useEffect(() => {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${location.host}/ws/admin`);
    wsRef.current = ws;
    ws.onopen  = () => { setWsOk(true); appendLog('ws : connected', 'info'); };
    ws.onclose = () => { setWsOk(false); appendLog('ws : closed', 'warn'); };
    ws.onerror = () => { appendLog('ws : error', 'error'); };
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.type === 'hello' || m.type === 'flags') {
        setPorts(Array.isArray(m.available_ports) ? m.available_ports : []);
        setNfc((m.devices && m.devices.nfc) || { connected: false, port: null });
        setLedPattern(m.led_pattern || '');
      } else if (m.type === 'log') {
        appendLog(m.msg, m.level || 'info');
      }
    };
    return () => ws.close();
  }, [appendLog]);

  const send = useCallback(obj => {
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify(obj));
    }
  }, []);

  return { wsOk, ports, nfc, ledPattern, log, send };
}

function PatternButton({ t, pattern, active, playing, onClick }) {
  return (
    <div onClick={onClick} style={{
      position: 'relative',
      border: `1px solid ${active || playing ? t.ink : t.line}`,
      background: active ? t.ink : t.surface,
      padding: '12px 12px',
      display: 'flex', alignItems: 'center', gap: 10,
      cursor: 'pointer', userSelect: 'none',
      transition: 'background 120ms, border-color 120ms',
    }}>
      <span className={previewClass(pattern.kind)} style={{
        width: 18, height: 18, borderRadius: '50%', flex: '0 0 auto',
        background: pattern.color,
        border: pattern.kind === 'off' ? `1px solid ${active ? t.paper : t.line}` : 'none',
        boxShadow: pattern.kind === 'off' ? 'none' : `0 0 8px ${pattern.color}`,
      }} />
      <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{
          fontFamily: t.sansFamily, fontSize: 14, fontWeight: 600, letterSpacing: 0.5,
          color: active ? t.paper : t.ink,
        }}>{pattern.label}</span>
        <span style={{
          fontFamily: t.monoFamily, fontSize: 10, letterSpacing: 1.5,
          color: active ? t.line2 : t.mute,
        }}>{pattern.command}{isPattern(pattern) ? ' · 서버 재생' : ''}</span>
      </span>
      <span style={{
        fontFamily: t.monoFamily, fontSize: 10, letterSpacing: 1,
        color: playing ? t.accent : (active ? t.paper : t.mute),
      }}>{playing ? '▶ 재생중' : (active ? '◉' : '○')}</span>
    </div>
  );
}

// NFC(ESP32) 보드 시리얼 연결 카드 — LED 는 이 보드를 통해 ESP-NOW 로 송신됨.
function NfcConnectBar({ t, ports, nfc, wsOk, onConnect, onDisconnect, onRefresh }) {
  const [selected, setSelected] = useState('SIM');
  const allPorts = [SIM_OPT, ...ports];

  useEffect(() => {
    if (nfc.connected) return;
    if (selected !== 'SIM' && !ports.find(p => p.device === selected)) setSelected('SIM');
  }, [ports, nfc.connected]);

  const connected = nfc.connected;
  const canConnect = wsOk && !connected && !!selected;
  const canDisconnect = wsOk && connected;

  return (
    <div style={{ border: `1px solid ${connected ? t.ink : t.line}`, background: connected ? t.surface : t.paper, padding: '10px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontFamily: t.monoFamily, fontSize: 11, letterSpacing: 1.5, color: t.ink }}>NFC 보드 (ESP-NOW 송신기)</span>
        <span style={{
          fontFamily: t.monoFamily, fontSize: 10, letterSpacing: 1.5, padding: '2px 6px',
          border: `1px solid ${connected ? t.ink : t.line}`,
          background: connected ? t.ink : t.paper, color: connected ? t.paper : t.mute,
        }}>{connected ? `CONNECTED@${nfc.port}` : 'DISCONNECTED'}</span>
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        <select value={selected} disabled={connected} onChange={e => setSelected(e.target.value)} style={{
          flex: 1, padding: '5px 7px', fontFamily: t.monoFamily, fontSize: 11,
          border: `1px solid ${t.line}`, background: connected ? t.paper : t.surface, color: t.ink,
        }}>
          {allPorts.map(p => (
            <option key={p.device} value={p.device}>
              {p.device}{p.vid_pid ? ` · ${p.vid_pid}` : ''}{p.description ? ` · ${p.description}` : ''}
            </option>
          ))}
        </select>
        <div onClick={onRefresh} title="포트 새로고침" style={{
          padding: '5px 9px', border: `1px solid ${t.line}`, background: t.surface,
          fontFamily: t.monoFamily, fontSize: 11, color: t.mute, cursor: 'pointer', userSelect: 'none',
        }}>↻</div>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <div onClick={canConnect ? () => onConnect(selected) : undefined} style={{
          flex: 1, padding: '6px 8px', textAlign: 'center',
          background: canConnect ? t.ink : t.surface, color: canConnect ? t.paper : t.mute,
          border: `1px solid ${canConnect ? t.ink : t.line}`,
          fontFamily: t.monoFamily, fontSize: 11, letterSpacing: 1.2,
          cursor: canConnect ? 'pointer' : 'not-allowed', userSelect: 'none', opacity: canConnect ? 1 : 0.6,
        }}>CONNECT</div>
        <div onClick={canDisconnect ? onDisconnect : undefined} style={{
          flex: 1, padding: '6px 8px', textAlign: 'center',
          background: t.surface, color: canDisconnect ? t.ink : t.mute,
          border: `1px solid ${canDisconnect ? t.ink : t.line}`,
          fontFamily: t.monoFamily, fontSize: 11, letterSpacing: 1.2,
          cursor: canDisconnect ? 'pointer' : 'not-allowed', userSelect: 'none', opacity: canDisconnect ? 1 : 0.6,
        }}>DISCONNECT</div>
      </div>
    </div>
  );
}

function WristbandApp() {
  const t = FT.theme.A;
  const { wsOk, ports, nfc, ledPattern, log, send } = useWristbandSocket();
  const [selected, setSelected] = useState(null);
  const [flash, setFlash] = useState(false);
  const flashTimer = useRef(null);

  const sel = PATTERNS.find(p => p.id === selected) || null;
  const playing = PATTERNS.find(p => p.command === ledPattern) || null;  // 서버 재생 중 패턴

  const onConnect = useCallback(port => send({ type: 'io_connect', role: 'nfc', port }), [send]);
  const onDisconnect = useCallback(() => send({ type: 'io_disconnect', role: 'nfc' }), [send]);
  const onRefresh = useCallback(() => send({ type: 'io_refresh_ports' }), [send]);
  const onStop = useCallback(() => send({ type: 'led_stop' }), [send]);

  const canSend = !!sel && nfc.connected && wsOk;

  const doSend = useCallback(() => {
    if (!canSend) return;
    send({ type: 'led', command: sel.command });   // 단색=즉시 전송 / 패턴=서버 재생 시작
    setFlash(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(false), 600);
  }, [canSend, sel, send]);

  // 미리보기: 재생 중이면 그 패턴, 아니면 선택한 패턴.
  const shown = playing || sel;
  const previewColor = shown ? shown.color : t.line;
  const sendHint = !wsOk ? '서버 연결 대기 중'
    : !nfc.connected ? 'NFC 보드를 먼저 연결하세요'
    : !sel ? '패턴을 선택하세요'
    : '';

  return (
    <div style={{
      minHeight: '100vh', width: '100%', background: t.bg,
      display: 'flex', justifyContent: 'center', padding: '28px 16px', boxSizing: 'border-box',
    }}>
      <div style={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: t.sansFamily, fontSize: 20, fontWeight: 700, color: t.ink, letterSpacing: 0.5 }}>
            팔찌 LED 컨트롤
          </span>
          <span style={{ fontFamily: t.monoFamily, fontSize: 10, letterSpacing: 2, color: wsOk ? t.ink : t.mute }}>
            {wsOk ? '● WS 연결됨' : '○ WS 끊김'}
          </span>
        </div>

        {/* NFC 보드 연결 */}
        <NfcConnectBar t={t} ports={ports} nfc={nfc} wsOk={wsOk}
                       onConnect={onConnect} onDisconnect={onDisconnect} onRefresh={onRefresh} />

        {/* 재생중 배너 */}
        {playing && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            border: `1px solid ${t.ink}`, background: t.ink, color: t.paper, padding: '10px 14px',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="ft-led-blink" style={{
                width: 10, height: 10, borderRadius: '50%', background: t.accent, boxShadow: `0 0 8px ${t.accent}`,
              }} />
              <span style={{ fontFamily: t.sansFamily, fontSize: 14, fontWeight: 600 }}>
                재생중 · {playing.label}
              </span>
              <span style={{ fontFamily: t.monoFamily, fontSize: 10, letterSpacing: 1, color: t.line2 }}>
                {playing.command}
              </span>
            </span>
            <span onClick={onStop} style={{
              padding: '5px 12px', border: `1px solid ${t.paper}`, color: t.paper,
              fontFamily: t.monoFamily, fontSize: 11, letterSpacing: 2,
              cursor: 'pointer', userSelect: 'none',
            }}>■ 정지 STOP</span>
          </div>
        )}

        {/* 미리보기 */}
        <div style={{ border: `1px solid ${t.line}`, background: t.surface, padding: '24px', display: 'flex', alignItems: 'center', gap: 20 }}>
          <div className={shown ? previewClass(shown.kind) : ''} style={{
            width: 88, height: 88, borderRadius: '50%', flex: '0 0 auto',
            background: previewColor,
            border: !shown || shown.kind === 'off' ? `1px solid ${t.line}` : 'none',
            boxShadow: shown && shown.kind !== 'off' ? `0 0 28px ${previewColor}` : 'none',
            opacity: flash ? 0.35 : 1, transition: 'opacity 120ms',
          }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontFamily: t.monoFamily, fontSize: 10, letterSpacing: 2, color: t.mute }}>
              {playing ? 'PLAYING' : 'SELECTED'}
            </span>
            <span style={{ fontFamily: t.sansFamily, fontSize: 18, fontWeight: 600, color: shown ? t.ink : t.mute }}>
              {shown ? shown.label : '패턴을 선택하세요'}
            </span>
            <span style={{ fontFamily: t.monoFamily, fontSize: 11, letterSpacing: 1, color: t.mute }}>
              {shown ? shown.command : '—'}
            </span>
          </div>
        </div>

        {/* 패턴 그리드 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {PATTERNS.map(p => (
            <PatternButton key={p.id} t={t} pattern={p}
                           active={selected === p.id}
                           playing={!!ledPattern && p.command === ledPattern}
                           onClick={() => setSelected(p.id)} />
          ))}
        </div>

        {/* 전송 */}
        <div onClick={canSend ? doSend : undefined} title={sendHint} style={{
          padding: '16px', textAlign: 'center',
          background: canSend ? t.ink : t.surface, color: canSend ? t.paper : t.mute,
          border: `1px solid ${canSend ? t.ink : t.line}`,
          fontFamily: t.monoFamily, fontSize: 14, fontWeight: 600, letterSpacing: 3,
          cursor: canSend ? 'pointer' : 'not-allowed', userSelect: 'none', opacity: canSend ? 1 : 0.6,
        }}>
          ▸ 전송 SEND{!canSend && sendHint ? ` · ${sendHint}` : ''}
        </div>

        {/* 서버 로그 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontFamily: t.monoFamily, fontSize: 10, letterSpacing: 2, color: t.mute }}>SERVER LOG</span>
          {log.length === 0 ? (
            <span style={{ fontFamily: t.sansFamily, fontSize: 13, color: t.mute }}>로그 없음.</span>
          ) : (
            log.map(e => (
              <div key={e.key} style={{
                display: 'flex', gap: 10, alignItems: 'baseline',
                fontFamily: t.monoFamily, fontSize: 12,
                color: e.level === 'warn' || e.level === 'error' ? t.accent : t.ink2,
                borderBottom: `1px solid ${t.line2}`, padding: '4px 0',
              }}>
                <span style={{ color: t.mute, flex: '0 0 auto' }}>{e.ts}</span>
                <span style={{ flex: 1 }}>{e.msg}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<WristbandApp />);
