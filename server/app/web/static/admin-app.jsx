// admin-app.jsx — 운영자 콘솔 entry. AdminConcert 의 구조를 따르되 폼/버튼/로그를
// 라이브 상태로 연결한다. 디자인 파일은 일절 수정하지 않고 window.* 만 소비.

const { useState, useEffect, useRef, useCallback } = React;
// Scaler 는 app-common.jsx 가 글로벌로 선언 — 별도 destructure 시 babel-standalone 의
// 공유 스코프에서 재선언 충돌(SyntaxError) 이 나므로 그냥 글로벌 참조로 사용한다.

// ── 인터랙티브 입력 / 버튼 (디자인 FormField·BigButton 시각을 유지) ──
function InteractiveFormField({ t, label, value, onChange, focused, placeholder, disabled }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontFamily: t.monoFamily, fontSize: 11, color: t.mute,
        letterSpacing: 1.8, marginBottom: 6,
      }}>{label}</div>
      <input type="text" value={value || ''} onChange={e => onChange(e.target.value)}
             disabled={disabled} placeholder={placeholder}
             style={{
        width: '100%',
        padding: '11px 13px',
        background: disabled ? t.paper : t.surface,
        border: `1px solid ${focused ? t.ink : t.line}`,
        outline: 'none',
        fontFamily: t.monoFamily, fontSize: 15, color: t.ink,
        boxSizing: 'border-box',
      }} />
    </div>
  );
}

function InteractiveBigButton({ t, num, en, enabled, pending, done, onClick }) {
  const isEnabled = enabled && !pending && !done;
  return (
    <div onClick={isEnabled ? onClick : undefined} style={{
      padding: '14px 16px',
      background: isEnabled ? t.ink : (done ? t.paper : t.surface),
      color: isEnabled ? t.paper : t.mute,
      border: `1px solid ${isEnabled ? t.ink : (done ? t.line : t.line)}`,
      display: 'flex', alignItems: 'center', gap: 14,
      cursor: isEnabled ? 'pointer' : 'not-allowed',
      userSelect: 'none',
    }}>
      <span style={{ fontFamily: t.monoFamily, fontSize: 15, fontWeight: 600, letterSpacing: 1,
                     opacity: pending ? 0.5 : 1 }}>{num}</span>
      <span style={{ fontFamily: t.sansFamily, fontSize: 15, fontWeight: 600,
                     letterSpacing: 0.5, flex: 1 }}>{en}</span>
      <span style={{ fontFamily: t.monoFamily, fontSize: 11, letterSpacing: 2, opacity: 0.65 }}>
        {pending ? '— PENDING —' : (done ? '✓ DONE' : (isEnabled ? '▸' : '—'))}
      </span>
    </div>
  );
}

// ── DevicePanel — 발급장치 / 입장장치 연결 카드 ──────────────────
function DevicePanel({ t, label, deviceKey, status, ports, otherConnected, busy,
                       onConnect, onDisconnect, onRefresh }) {
  // SIM 가상 포트를 항상 첫번째로 노출. 실제 시리얼 디바이스 없이도 절차 검증 가능.
  const SIM_OPT = { device: 'SIM', description: '가상 시뮬레이션 (시리얼 미사용)', vid_pid: '' };
  const allPorts = [SIM_OPT, ...ports];
  const [selected, setSelected] = useState('SIM');
  // 포트 목록이 갱신되면 선택값 유효성 보정
  useEffect(() => {
    if (status.connected) return;
    if (!selected) setSelected('SIM');
    if (selected !== 'SIM' && !ports.find(p => p.device === selected)) {
      setSelected('SIM');
    }
  }, [ports, status.connected]);

  const connected = status.connected;
  const canConnect = !connected && !otherConnected && !busy && !!selected;
  const canDisconnect = connected && !busy;
  const tip = otherConnected ? '다른 장치 사용 중'
            : busy           ? '진행 중에는 변경 불가'
            : !selected      ? '포트를 선택하세요'
            : '';

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
        <div onClick={canConnect ? () => onConnect(deviceKey, selected) : undefined}
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
        <div onClick={canDisconnect ? () => onDisconnect(deviceKey) : undefined}
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

// ── AdminLive ────────────────────────────────────────────────────
function AdminLive({ t, state }) {
  const {
    ShowStrip, SectionHeading, StatusChip, KV, MonoLine,
    CapacityGauge, StageMap, SetlistPanel, ShowtimeTimeline, DataBars,
  } = window;

  const tabs = [
    { id: FLOW.ISSUE,  en: 'ISSUE',  ko: '발급' },
    { id: FLOW.ENTRY,  en: 'ENTRY',  ko: '입장' },
    { id: FLOW.RETURN, en: 'RETURN', ko: '반납' },
  ];

  // 진행 중에는 탭 전환 금지 (서버 FSM 상태 꼬임 방지)
  const tabsLocked = state.fsmState !== STATE.IDLE;
  const focusedField = state.mode === FLOW.ISSUE ? 'seat' : null;
  const issueNeedsSeat = state.mode === FLOW.ISSUE && !state.form.seat.trim();

  const stateChipKind =
    state.fsmState === STATE.IDLE ? 'idle'
    : state.fsmState === STATE.DONE ? 'pass'
    : 'scan';
  const stateChipText =
    state.fsmState === STATE.IDLE              ? 'idle · 대기'
    : state.fsmState === STATE.AWAIT_FACE       ? 'await_face · 얼굴 캡처 대기'
    : state.fsmState === STATE.AWAIT_TAG        ? 'await_tag · 팔찌 태그 대기'
    : state.fsmState === STATE.AWAIT_FACE_ENTRY ? 'await_face · 입장 얼굴 캡처'
    : state.fsmState === STATE.DONE             ? 'done · 완료'
    : state.fsmState;

  // 발급 버튼 라벨
  const btn1En = state.mode === FLOW.ISSUE ? '① START · 얼굴 캡처 요청'
              : state.mode === FLOW.ENTRY ? '① START · 입장 시작'
              : '① START · 반납 시작';
  const btn2En = state.mode === FLOW.ISSUE ? '② WRISTBAND TAGGED · BLE 기록'
              : state.mode === FLOW.ENTRY ? '② WRISTBAND TAGGED · 인증 진행'
              : '② WRISTBAND TAGGED · 초기화';

  const ioReady = !!state.flags.activeDevice;
  const btn1Enabled = state.fsmState === STATE.IDLE && ioReady;
  const btn2Enabled = state.fsmState === STATE.AWAIT_TAG;

  return (
    <div style={{
      width: 1600, height: 1000,
      background: t.bg, color: t.ink, fontFamily: t.sansFamily,
      display: 'grid', gridTemplateRows: 'auto auto 1fr',
    }}>
      {/* ── 헤더 ── */}
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
          {[
            { k: 'face',   v: state.flags.ml ? 'ML' : 'STUB',
              toggleable: state.flags.faceAvailable,
              toggle: () => state.toggleLayer('face', state.flags.ml) },
            { k: 'ble',    v: state.flags.bleMock ? 'MOCK' : 'REAL',
              toggleable: true,
              toggle: () => state.toggleLayer('ble', !state.flags.bleMock) },
            { k: 'io', v: state.flags.activeDevice
                        ? `${state.flags.activeDevice.toUpperCase()}@${
                            (state.flags.activeDevice === 'issuance'
                              ? state.flags.issuanceStatus
                              : state.flags.entryStatus).port || '?'}`
                        : 'DISCONNECTED',
              toggleable: false },
            { k: 'ws',     v: state.wsOk ? 'OK' : 'DOWN', toggleable: false },
            { k: 'ntp',    v: 'SYNC', toggleable: false },
          ].map(({ k, v, toggleable, toggle }) => {
            const isMock = v === 'MOCK' || v === 'STUB';
            const locked = state.fsmState !== STATE.IDLE;
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

      <ShowStrip t={t} />

      {/* ── 3-컬럼 본문 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr 460px', minHeight: 0 }}>

        {/* 좌 — 절차 제어 */}
        <div style={{
          borderRight: `1px solid ${t.line}`, padding: '20px 22px',
          background: t.paper, overflow: 'hidden',
        }}>
          <SectionHeading t={t} num="01" en="PROCEDURE" ko="절차 제어" />
          <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
            {tabs.map(({ id, en, ko }) => {
              const on = state.mode === id;
              const lock = tabsLocked && !on;
              return (
                <div key={id}
                     onClick={() => { if (!tabsLocked) state.setMode(id); }}
                     title={lock ? '진행 중에는 모드 전환 불가 — CANCEL 후 가능' : ''}
                     style={{
                  padding: '7px 11px',
                  background: on ? t.ink : t.surface,
                  color: on ? t.paper : (lock ? t.mute : t.ink),
                  fontFamily: t.monoFamily, fontSize: 11, letterSpacing: 1.5,
                  border: `1px solid ${lock ? t.line : t.ink}`, fontWeight: 600,
                  cursor: lock ? 'not-allowed' : 'pointer', userSelect: 'none',
                  opacity: lock ? 0.55 : 1,
                }}>
                  {en}<span style={{ opacity: on ? 0.7 : 0.6, marginLeft: 6, fontWeight: 400 }}>· {ko}</span>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 18, opacity: state.mode === FLOW.ISSUE ? 1 : 0.55 }}>
            {/* 발급 모드에서만 의미 있는 입력. 입장/반납에선 회색 처리하되 시각적으로 유지. */}
            <InteractiveFormField t={t} label="좌석 · SEAT"
              value={state.form.seat} onChange={v => state.setFormField('seat', v)}
              placeholder="MZ·B / R07·S11 — 비워두면 자동"
              focused={focusedField === 'seat'}
              disabled={state.mode !== FLOW.ISSUE || state.fsmState !== STATE.IDLE} />
            <InteractiveFormField t={t} label="구역 · ZONE"
              value={state.form.zone} onChange={v => state.setFormField('zone', v)}
              placeholder="ZN.MEZ · MEZZANINE — 비워두면 자동"
              disabled={state.mode !== FLOW.ISSUE || state.fsmState !== STATE.IDLE} />
            <InteractiveFormField t={t} label="관객 이름 · NAME"
              value={state.form.name} onChange={v => state.setFormField('name', v)}
              placeholder="서지윤 — 비워두면 자동"
              disabled={state.mode !== FLOW.ISSUE || state.fsmState !== STATE.IDLE} />
            <InteractiveFormField t={t} label="티켓 · TICKET ID"
              value={state.form.ticketId} onChange={v => state.setFormField('ticketId', v)}
              placeholder="NF-26-0512-0917 — 비워두면 자동"
              disabled={state.mode !== FLOW.ISSUE || state.fsmState !== STATE.IDLE} />
            {state.mode === FLOW.ISSUE && state.fsmState === STATE.IDLE && (
              <div style={{
                fontFamily: t.monoFamily, fontSize: 10.5, color: t.mute,
                letterSpacing: 1.2, marginTop: -4, marginBottom: 6,
              }}>비어 있는 칸은 START 시 무작위 데모값으로 채워집니다.</div>
            )}
          </div>

          <div style={{ marginTop: 16 }}>
            <InteractiveBigButton t={t} num="①" en={btn1En}
              enabled={btn1Enabled} pending={false} onClick={state.actStart} />
            <div style={{ height: 8 }} />
            <InteractiveBigButton t={t} num="②" en={btn2En}
              enabled={btn2Enabled} pending={state.fsmState !== STATE.IDLE && !btn2Enabled}
              onClick={state.actTag} />
          </div>

          <div style={{ marginTop: 12 }}>
            <div onClick={state.actCancel} style={{
              padding: '9px 14px',
              border: `1px solid ${t.line}`, background: t.surface,
              fontFamily: t.monoFamily, fontSize: 12, color: t.mute, letterSpacing: 1.5,
              cursor: 'pointer', textAlign: 'center', userSelect: 'none',
            }}>CANCEL · 취소 / 초기화</div>
          </div>

          <div style={{ marginTop: 18 }}>
            <SectionHeading t={t} num="02" en="STATE · 상태" ko="" />
            <div style={{
              marginTop: 12, padding: '12px 14px',
              background: t.surface, border: `1px solid ${t.ink}`,
            }}>
              <StatusChip t={t} kind={stateChipKind}>{stateChipText}</StatusChip>
              <div style={{ marginTop: 8 }}>
                <KV t={t} k="SESSION" v={`iss·#${String(state.seq).padStart(4,'0')}`} />
                <KV t={t} k="ELAPSED" v={state.elapsed} />
                <KV t={t} k="WS · TABLET" v={state.tabletClients > 0
                                              ? `OK · ${state.tabletClients} client` : '— no client'} />
              </div>
            </div>
          </div>
        </div>

        {/* 중 — 현황 / 미러 / 무대 / 타임라인 */}
        <div style={{ padding: '20px 26px', display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden' }}>
          <SectionHeading t={t} num="03" en="CAPACITY · 입장 현황" ko="" />
          <CapacityGauge t={t} attended={1247} capacity={3200}
            perSection={[
              ['ZN.PIT · 입석',   '140',  '180'],
              ['ZN.FLR · 플로어', '612',  '980'],
              ['ZN.MEZ · 메자닌', '240',  '800'],
              ['ZN.BAL · 발코니', '255',  '1240'],
            ]} />

          <SectionHeading t={t} num="04" en="TABLET MIRROR · LIVE" ko="" />
          <div style={{
            border: `1px solid ${t.ink}`, background: t.surface,
            display: 'grid', gridTemplateColumns: '260px 1fr', gap: 0,
          }}>
            <div style={{
              width: 260, height: 220,
              background: state.lastEmbedding ? t.ink : t.paper,
              backgroundImage: state.lastEmbedding ? 'none'
                : `repeating-linear-gradient(45deg, transparent 0 8px, ${t.line2} 8px 9px)`,
              position: 'relative',
              borderRight: `1px solid ${t.line}`,
            }}>
              <div style={{
                position: 'absolute', inset: 0, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontFamily: t.monoFamily, fontSize: 11,
                color: state.lastEmbedding ? t.paper : t.mute, letterSpacing: 2,
              }}>
                {state.lastEmbedding ? '◉ CAPTURED' : '— NO SUBJECT —'}
              </div>
              <div style={{ position: 'absolute', top: 8, left: 12,
                            fontFamily: t.monoFamily, fontSize: 9, color: state.lastEmbedding ? t.paper : t.mute,
                            letterSpacing: 1.5, opacity: 0.85 }}>TABLET · CAM01</div>
              <div style={{ position: 'absolute', bottom: 8, left: 12,
                            fontFamily: t.monoFamily, fontSize: 9, color: state.lastEmbedding ? t.paper : t.mute,
                            letterSpacing: 1.2, opacity: 0.85 }}>480×640 · 30fps</div>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <MonoLine t={t} size={10} letter={2}>EMBEDDING · 512-D · f32</MonoLine>
              {state.lastEmbedding ? (
                <DataBars t={t}
                  data={state.lastEmbedding.filter((_, i) => i % 6 === 0)}
                  height={42} />
              ) : (
                <div style={{
                  height: 42, border: `1px dashed ${t.line}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: t.monoFamily, fontSize: 10, color: t.mute, letterSpacing: 2,
                }}>— NO CAPTURE — 태블릿에서 얼굴 캡처 시 표시 —</div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                <KV t={t} k="DIM"      v="512" />
                <KV t={t} k="‖e‖"      v={state.lastEmbedding ? '1.000' : '—'} />
                <KV t={t} k="QUALITY"  v={state.lastEmbedding ? '0.92' : '—'} />
                <KV t={t} k="LATENCY"  v={state.lastLatency || '—'} />
                <KV t={t} k="CAPTURED" v={state.lastCapturedAt || '—'} />
                <KV t={t} k="COS.SIM"  v={state.lastCos || '—'} />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, minHeight: 0 }}>
            <StageMap t={t} highlightSection="FL-A" highlightSeat={[7, 4]} />
            <ShowtimeTimeline t={t} current={state.timeStr} />
          </div>
        </div>

        {/* 우 — 장치 연결 + 셋리스트 + 실시간 로그 */}
        <div style={{
          borderLeft: `1px solid ${t.line}`, padding: '20px 22px',
          background: t.paper, display: 'flex', flexDirection: 'column', gap: 14,
          overflow: 'hidden',
        }}>
          <SectionHeading t={t} num="04" en="DEVICE · 장치 연결" ko="" />
          <div>
            <DevicePanel t={t} label="발급장치 · ISSUANCE"
              deviceKey="issuance"
              status={state.flags.issuanceStatus}
              ports={state.flags.availablePorts}
              otherConnected={state.flags.entryStatus.connected}
              busy={state.fsmState !== STATE.IDLE}
              onConnect={state.ioConnect}
              onDisconnect={state.ioDisconnect}
              onRefresh={state.ioRefresh} />
            <DevicePanel t={t} label="입장장치 · ENTRY"
              deviceKey="entry"
              status={state.flags.entryStatus}
              ports={state.flags.availablePorts}
              otherConnected={state.flags.issuanceStatus.connected}
              busy={state.fsmState !== STATE.IDLE}
              onConnect={state.ioConnect}
              onDisconnect={state.ioDisconnect}
              onRefresh={state.ioRefresh} />
            {!state.flags.activeDevice && (
              <div style={{
                fontFamily: t.monoFamily, fontSize: 10.5, color: t.accent,
                letterSpacing: 1.2, marginTop: 4,
              }}>장치를 연결하지 않으면 절차 시작 불가</div>
            )}
          </div>

          <SectionHeading t={t} num="05" en="SETLIST · 셋리스트" ko="" />
          <SetlistPanel t={t} current={-1} />

          <SectionHeading t={t} num="06" en="LOG · 실시간 로그" ko="" />
          <div style={{
            flex: 1, background: t.ink, color: t.paper,
            padding: '12px 14px',
            fontFamily: t.monoFamily, fontSize: 12.5, lineHeight: 1.55,
            overflowY: 'auto', letterSpacing: 0.3,
            minHeight: 220, maxHeight: 460,
          }}>
            {state.log.length === 0 ? (
              <div style={{ color: t.mute, opacity: 0.7 }}>— awaiting events —</div>
            ) : state.log.slice().reverse().map((entry, i) => {
              const col = entry.level === 'warn' ? t.accent
                        : entry.level === 'error' ? t.accent : t.paper;
              return (
                <div key={i} style={{ display: 'flex', gap: 10 }}>
                  <span style={{ color: t.mute, flexShrink: 0 }}>{entry.ts}</span>
                  <span style={{ color: col, width: 10, flexShrink: 0 }}>
                    {entry.level === 'warn' ? 'W' : entry.level === 'error' ? 'E' : 'I'}
                  </span>
                  <span style={{ color: col, wordBreak: 'break-word' }}>{entry.msg}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── AdminApp (root) ──────────────────────────────────────────────
function AdminApp() {
  const t = THEMES.A;
  const [mode, setMode] = useState(FLOW.ISSUE);       // tab
  const [fsmState, setFsmState] = useState(STATE.IDLE); // server FSM
  const [form, setForm] = useState({
    seat: '', zone: '', name: '', ticketId: '',
  });
  const [log, setLog] = useState([]);
  const [flags, setFlags] = useState({
    ml: true, bleMock: true,
    faceAvailable: true, bleAvailable: true,
    issuanceStatus: { connected: false, port: null },
    entryStatus:    { connected: false, port: null },
    activeDevice:   null,
    availablePorts: [],
  });
  const [wsOk, setWsOk] = useState(false);
  const [tabletClients] = useState(1); // 표시용
  const [seq, setSeq] = useState(188);
  const [lastEmbedding, setLastEmbedding] = useState(null);
  const [lastCapturedAt, setLastCapturedAt] = useState('');
  const [lastLatency] = useState('—');
  const [lastCos] = useState('—');
  const [startTs, setStartTs] = useState(null);
  const [elapsed, setElapsed] = useState('00:00.00');
  const [now, setNow] = useState(() => new Date());
  const wsRef = useRef(null);

  // 시계
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 500);
    return () => clearInterval(id);
  }, []);

  // 경과 시간
  useEffect(() => {
    if (!startTs) { setElapsed('00:00.00'); return; }
    const id = setInterval(() => {
      const ms = Date.now() - startTs;
      const s = Math.floor(ms / 1000);
      const cs = Math.floor((ms % 1000) / 10);
      setElapsed(`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}.${String(cs).padStart(2,'0')}`);
    }, 50);
    return () => clearInterval(id);
  }, [startTs]);

  const appendLog = useCallback((msg, level = 'info') => {
    const d = new Date();
    const ts = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}.${String(d.getMilliseconds()).padStart(3,'0')}`;
    setLog(prev => [...prev.slice(-200), { ts, level, msg }]);
  }, []);

  // WebSocket
  useEffect(() => {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${location.host}/ws/admin`);
    wsRef.current = ws;
    ws.onopen  = () => { setWsOk(true); appendLog('ws.admin : connected'); };
    ws.onclose = () => { setWsOk(false); appendLog('ws.admin : closed', 'warn'); };
    ws.onerror = () => { appendLog('ws.admin : error', 'error'); };
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.type === 'hello' || m.type === 'flags') {
        setFlags({
          ml: !!m.ml,
          bleMock: !!m.ble_mock,
          faceAvailable: !!m.face_available,
          bleAvailable: !!m.ble_available,
          issuanceStatus: m.issuance_status || { connected: false, port: null },
          entryStatus:    m.entry_status    || { connected: false, port: null },
          activeDevice:   m.active || null,
          availablePorts: Array.isArray(m.available_ports) ? m.available_ports : [],
        });
        if (m.type === 'hello') {
          const ac = m.active ? `${m.active}@${
            (m.active === 'issuance' ? m.issuance_status : m.entry_status)?.port}` : 'none';
          appendLog(`hello · face=${m.ml?'ML':'stub'} · ble=${m.ble_mock?'mock':'real'} · io=${ac}`);
        }
      } else if (m.type === 'log') {
        appendLog(m.msg, m.level || 'info');
      } else if (m.type === 'state') {
        setFsmState(m.state);
        // elapsed 타이머는 절차가 시작되는 어떤 비-idle 상태에서도 한 번만 시작
        if (m.state !== STATE.IDLE && m.state !== STATE.DONE) {
          setStartTs(prev => prev || Date.now());
        } else {
          setStartTs(null);
        }
      } else if (m.type === 'embedding') {
        // Tablet Mirror 패널용 실데이터
        setLastEmbedding(m.embedding);
        setLastCapturedAt(m.captured_at || '');
      } else if (m.type === 'active_list') {
        // 활성 발급 — 데모에선 별도 패널이 없음(미사용)
      }
    };
    return () => ws.close();
  }, [appendLog]);

  const send = useCallback(obj => {
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify(obj));
    }
  }, []);

  const setFormField = useCallback((k, v) => setForm(prev => ({ ...prev, [k]: v })), []);

  // 빈 칸을 랜덤 데모값으로 채워 반환 (form state 도 업데이트)
  const fillRandomIfEmpty = useCallback(() => {
    const NAMES = [
      ['김민준','Min-Jun Kim'], ['서지윤','Ji-Yoon Seo'], ['이도현','Do-Hyun Lee'],
      ['박서연','Seo-Yeon Park'], ['최예준','Ye-Jun Choi'], ['정하늘','Ha-Neul Jeong'],
      ['윤지호','Ji-Ho Yoon'], ['임수아','Su-A Lim'], ['강민서','Min-Seo Kang'],
      ['오태경','Tae-Kyung Oh'],
    ];
    const ZONES = [
      ['PIT', 'ZN.PIT · STANDING PIT'],
      ['FL',  'ZN.FLR · FLOOR SEATED'],
      ['MZ',  'ZN.MEZ · MEZZANINE'],
      ['BAL', 'ZN.BAL · BALCONY'],
    ];
    const pick = a => a[Math.floor(Math.random() * a.length)];
    const pad = (n, w) => String(n).padStart(w, '0');
    const [zPrefix, zLabel] = pick(ZONES);
    const block = String.fromCharCode(65 + Math.floor(Math.random() * 4));   // A..D
    const row = 1 + Math.floor(Math.random() * 18);
    const seatNo = 1 + Math.floor(Math.random() * 12);
    const seat = `${zPrefix}·${block} / R${pad(row,2)}·S${pad(seatNo,2)}`;
    const [nameKo, nameEn] = pick(NAMES);
    const ticket = `NF-26-${pad(1 + Math.floor(Math.random()*12),2)}${pad(1 + Math.floor(Math.random()*28),2)}-${pad(Math.floor(Math.random()*10000),4)}`;
    const next = {
      seat:     form.seat.trim()     || seat,
      zone:     form.zone.trim()     || zLabel,
      name:     form.name.trim()     || nameKo,
      ticketId: form.ticketId.trim() || ticket,
    };
    setForm(next);
    return next;
  }, [form]);

  const actStart = useCallback(() => {
    setSeq(s => s + 1);
    setLastEmbedding(null);
    setLastCapturedAt('');
    if (mode === FLOW.ISSUE) {
      const filled = fillRandomIfEmpty();
      send({ type: 'issue_start', seat: filled.seat, name: filled.name });
    } else if (mode === FLOW.ENTRY) {
      send({ type: 'entry_start' });
    } else if (mode === FLOW.RETURN) {
      send({ type: 'return_start' });
    }
  }, [mode, send, fillRandomIfEmpty]);

  const actTag = useCallback(() => {
    if (mode === FLOW.ISSUE)       send({ type: 'issue_tag' });
    else if (mode === FLOW.ENTRY)  send({ type: 'entry_tag' });
    else if (mode === FLOW.RETURN) send({ type: 'return_tag' });
  }, [mode, send]);

  const actCancel = useCallback(() => send({ type: 'cancel' }), [send]);

  const toggleLayer = useCallback((layer, newMock) => {
    send({ type: 'toggle', layer, mock: newMock });
  }, [send]);

  const ioConnect    = useCallback((device, port) => send({ type: 'io_connect', device, port }), [send]);
  const ioDisconnect = useCallback((device) => send({ type: 'io_disconnect', device }), [send]);
  const ioRefresh    = useCallback(() => send({ type: 'io_refresh_ports' }), [send]);

  // 캡처 결과는 admin 으로는 안 오므로 (현재 서버 구현),
  // 'await_tag' 진입 시점에 임베딩이 추출됐다고 추정하고 임시 데모 표시.
  // 실제 데이터 미러링이 필요하면 서버에서 admin 으로도 embedding 을 broadcast 하면 됨.

  const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  const state = {
    mode, setMode,
    fsmState,
    form, setFormField,
    flags, wsOk, tabletClients, seq,
    lastEmbedding, lastCapturedAt, lastLatency, lastCos,
    elapsed, timeStr,
    log,
    actStart, actTag, actCancel, toggleLayer,
    ioConnect, ioDisconnect, ioRefresh,
  };

  return (
    <Scaler width={1600} height={1000}>
      <AdminLive t={t} state={state} />
    </Scaler>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<AdminApp />);
