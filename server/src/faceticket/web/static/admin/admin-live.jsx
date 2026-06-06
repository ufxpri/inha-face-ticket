window.FT = window.FT || {};
FT.admin = FT.admin || {};

// 팔찌 LED 패턴 — 클릭 시 /ws/admin 으로 led 명령 전송. 단색(solid)/끄기(off)는 즉시 1회,
// pattern 류는 서버가 ESP-NOW 프리미티브를 시간차로 연속 전송해 재생(LED_PATTERNS).
const LED_PATTERNS_UI = [
  { id: 'solid-r', label: '레드',     command: 'RGB R',           color: '#d83a1f' },
  { id: 'solid-g', label: '그린',     command: 'RGB G',           color: '#1f9d3a' },
  { id: 'solid-b', label: '블루',     command: 'RGB B',           color: '#2a6cf0' },
  { id: 'off',     label: '끄기',     command: 'RGB OFF',         color: '#2a2620', off: true },
  { id: 'rainbow', label: '레인보우', command: 'PATTERN RAINBOW', color: '#d83a1f', pattern: true },
  { id: 'blink',   label: '깜빡임',   command: 'PATTERN BLINK',   color: '#d83a1f', pattern: true },
  { id: 'breathe', label: '브리딩',   command: 'PATTERN BREATHE', color: '#2a6cf0', pattern: true },
  { id: 'strobe',  label: '스트로브', command: 'PATTERN STROBE',  color: '#f0c000', pattern: true },
];

function AdminLive({ t, state }) {
  const {
    SectionHeading, StatusChip, KV, MonoLine, FormField, BigButton,
  } = FT.atoms;
  const {
    ShowStrip, AdminHeader, CapacityGauge, TabletMirror, StageMap,
    ShowtimeTimeline, DevicePanel, LogFeed,
  } = FT.molecules;

  const tabs = [
    { id: 'issue',  en: 'ISSUE',  ko: '발급' },
    { id: 'entry',  en: 'ENTRY',  ko: '입장' },
    { id: 'return', en: 'RETURN', ko: '반납' },
  ];
  const tabsLocked = state.fsmState !== 'idle';

  const stateChipKind =
    state.fsmState === 'idle' ? 'idle'
    : state.fsmState === 'done' ? 'pass' : 'scan';
  const stateChipText = ({
    'idle':              'idle · 대기',
    'await_face':        'await_face · 얼굴 캡처 대기',
    'await_tag':         'await_tag · 팔찌 태그 대기',
    'await_face_entry':  'await_face · 입장 얼굴 캡처',
    'done':              'done · 완료',
  })[state.fsmState] || state.fsmState;

  const btn1En = state.mode === 'issue' ? '① START · 얼굴 캡처 → 자동 팔찌 대기'
              : state.mode === 'entry' ? '① START · 입장 (자동 팔찌 대기)'
              : '① START · 반납 (자동 팔찌 대기)';
  // 2단계(팔찌 인식)는 자동 진입 — 버튼이 아니라 진행 상태 표시.
  const tagCaption = state.fsmState === 'await_tag'
    ? '② 팔찌를 NFC 리더에 대주세요 — 자동 인식 중 (최대 15초)'
    : (state.mode === 'issue' ? '② 팔찌 자동 인식 · BLE 기록'
      : state.mode === 'entry' ? '② 팔찌 자동 인식 · 인증 진행'
      : '② 팔찌 자동 인식 · 초기화');
  const devices = state.flags.devices || {};
  const nfcStatus  = devices.nfc  || { connected: false, port: null };
  const gateStatus = devices.gate || { connected: false, port: null };
  const ledPattern = state.flags.ledPattern || '';   // 서버가 재생 중인 패턴 명령 ("" = 정지)
  // NFC 리더가 모든 플로우의 진입(wake) 조건 — 이게 연결돼야 절차 시작 가능. 게이트는 입장 전용.
  const ioReady = !!nfcStatus.connected;
  const btn1Enabled = state.fsmState === 'idle' && ioReady;
  const focusedSeat = state.mode === 'issue';

  return (
    <div style={{
      width: 1600, height: 1000,
      background: t.bg, color: t.ink, fontFamily: t.sansFamily,
      display: 'grid', gridTemplateRows: 'auto auto 1fr',
    }}>
      <AdminHeader t={t} flags={state.flags} wsOk={state.wsOk}
                   fsmState={state.fsmState} onToggle={state.toggleLayer} />
      <ShowStrip t={t} />

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr 460px', minHeight: 0 }}>

        {/* LEFT — procedure control */}
        <div style={{
          borderRight: `1px solid ${t.line}`, padding: '16px 18px',
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

          <div style={{ marginTop: 18, opacity: state.mode === 'issue' ? 1 : 0.55 }}>
            <FormField t={t} label="좌석 · SEAT"
              value={state.form.seat} onChange={v => state.setFormField('seat', v)}
              placeholder="MZ·B / R07·S11 — 비워두면 자동"
              focused={focusedSeat}
              disabled={state.mode !== 'issue' || state.fsmState !== 'idle'} />
            <FormField t={t} label="관객 이름 · NAME"
              value={state.form.name} onChange={v => state.setFormField('name', v)}
              placeholder="서지윤 — 비워두면 자동"
              disabled={state.mode !== 'issue' || state.fsmState !== 'idle'} />
            {state.mode === 'issue' && state.fsmState === 'idle' && (
              <div style={{
                fontFamily: t.monoFamily, fontSize: 10.5, color: t.mute,
                letterSpacing: 1.2, marginTop: -4, marginBottom: 6,
              }}>비어 있는 칸은 START 시 자동으로 채워집니다.</div>
            )}
          </div>

          <div style={{ marginTop: 16 }}>
            <BigButton t={t} num="①" en={btn1En}
              enabled={btn1Enabled} pending={false} onClick={state.actStart} />
            <div style={{ height: 8 }} />
            {/* 팔찌 인식은 START 후 자동 진입 — 클릭 대신 상태 배너로 표시 */}
            <div style={{
              padding: '14px 16px', textAlign: 'center', userSelect: 'none',
              fontFamily: t.monoFamily, fontSize: 13, letterSpacing: 0.8,
              border: `1px solid ${state.fsmState === 'await_tag' ? t.accent : t.line}`,
              background: state.fsmState === 'await_tag' ? t.surface : t.bg,
              color: state.fsmState === 'await_tag' ? t.ink : t.mute,
              fontWeight: state.fsmState === 'await_tag' ? 700 : 400,
            }}>{tagCaption}</div>
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

        {/* CENTER — capacity / mirror / stage / timeline */}
        <div style={{ padding: '20px 26px', display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden' }}>
          <SectionHeading t={t} num="03" en="CAPACITY · 입장 현황" ko="" />
          <CapacityGauge t={t} />

          <SectionHeading t={t} num="04" en="TABLET MIRROR · LIVE" ko="" />
          <TabletMirror t={t}
            embedding={state.lastEmbedding}
            latency="—"
            capturedAt={state.lastCapturedAt}
            cos="—" />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, minHeight: 0 }}>
            <StageMap t={t} highlightSection="FL-A" highlightSeat={[7, 4]} />
            <ShowtimeTimeline t={t} current={state.timeStr} />
          </div>
        </div>

        {/* RIGHT — device / log (셋리스트는 태블릿용이라 admin 에선 생략) */}
        <div style={{
          borderLeft: `1px solid ${t.line}`, padding: '16px 18px',
          background: t.paper, display: 'flex', flexDirection: 'column', gap: 12,
          overflow: 'hidden', minHeight: 0,
        }}>
          <SectionHeading t={t} num="04" en="DEVICE · 장치 연결" ko="" />
          <div>
            <DevicePanel t={t}
              role="nfc" label="NFC 리더 · ESP32"
              status={nfcStatus}
              ports={state.flags.availablePorts}
              busy={state.fsmState !== 'idle'}
              onConnect={state.ioConnect}
              onDisconnect={state.ioDisconnect}
              onRefresh={state.ioRefresh} />
            <DevicePanel t={t}
              role="gate" label="입장 게이트 · UNO"
              status={gateStatus}
              ports={state.flags.availablePorts}
              busy={state.fsmState !== 'idle'}
              onConnect={state.ioConnect}
              onDisconnect={state.ioDisconnect}
              onRefresh={state.ioRefresh} />
            {!nfcStatus.connected && (
              <div style={{
                fontFamily: t.monoFamily, fontSize: 10.5, color: t.accent,
                letterSpacing: 1.2, marginTop: 4,
              }}>NFC 리더를 연결하지 않으면 절차 시작 불가</div>
            )}
            {nfcStatus.connected && !gateStatus.connected && (
              <div style={{
                fontFamily: t.monoFamily, fontSize: 10.5, color: t.mute,
                letterSpacing: 1.2, marginTop: 4,
              }}>입장 게이트 미연결 — 입장 PASS/DENY 신호는 동작하지 않음</div>
            )}
          </div>

          <div>
            <SectionHeading t={t} num="05" en="WRISTBAND LED · 팔찌 LED" ko="" />
            {!nfcStatus.connected && (
              <div style={{
                fontFamily: t.monoFamily, fontSize: 10.5, color: t.accent,
                letterSpacing: 1.2, margin: '6px 0 0',
              }}>NFC 보드(ESP-NOW 송신기) 연결 후 사용 가능</div>
            )}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8,
              opacity: nfcStatus.connected ? 1 : 0.5,
            }}>
              {LED_PATTERNS_UI.map(p => {
                const on = !!ledPattern && p.command === ledPattern;
                return (
                  <div key={p.id}
                       onClick={nfcStatus.connected ? () => state.ledSend(p.command) : undefined}
                       title={p.command}
                       style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px',
                    border: `1px solid ${on ? t.ink : t.line}`,
                    background: on ? t.ink : t.surface,
                    cursor: nfcStatus.connected ? 'pointer' : 'not-allowed', userSelect: 'none',
                  }}>
                    <span style={{
                      width: 13, height: 13, borderRadius: '50%', flex: '0 0 auto',
                      background: p.color,
                      border: p.off ? `1px solid ${on ? t.paper : t.line}` : 'none',
                      boxShadow: p.off ? 'none' : `0 0 6px ${p.color}`,
                    }} />
                    <span style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span style={{
                        fontFamily: t.sansFamily, fontSize: 12, fontWeight: 600,
                        color: on ? t.paper : t.ink,
                      }}>{p.label}</span>
                      <span style={{
                        fontFamily: t.monoFamily, fontSize: 9, letterSpacing: 1,
                        color: on ? t.line2 : t.mute,
                      }}>{p.command}{p.pattern ? ' · 재생' : ''}</span>
                    </span>
                    {on && <span style={{ fontFamily: t.monoFamily, fontSize: 9, color: t.accent }}>▶</span>}
                  </div>
                );
              })}
            </div>
            {!!ledPattern && (
              <div onClick={state.ledStop} style={{
                marginTop: 6, padding: '7px 10px', textAlign: 'center',
                border: `1px solid ${t.ink}`, background: t.surface, color: t.ink,
                fontFamily: t.monoFamily, fontSize: 11, letterSpacing: 1.5,
                cursor: 'pointer', userSelect: 'none',
              }}>■ 정지 STOP · 패턴 재생중</div>
            )}
          </div>

          <SectionHeading t={t} num="06" en="LOG · 실시간 로그" ko="" />
          <LogFeed t={t} entries={state.log} />
        </div>
      </div>
    </div>
  );
}

FT.admin.AdminLive = AdminLive;
