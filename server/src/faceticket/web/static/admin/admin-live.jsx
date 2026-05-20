window.FT = window.FT || {};
FT.admin = FT.admin || {};

function AdminLive({ t, state }) {
  const {
    SectionHeading, StatusChip, KV, MonoLine, FormField, BigButton,
  } = FT.atoms;
  const {
    ShowStrip, AdminHeader, CapacityGauge, TabletMirror, StageMap,
    ShowtimeTimeline, DevicePanel, SetlistPanel, LogFeed,
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

  const btn1En = state.mode === 'issue' ? '① START · 얼굴 캡처 요청'
              : state.mode === 'entry' ? '① START · 입장 시작'
              : '① START · 반납 시작';
  const btn2En = state.mode === 'issue' ? '② WRISTBAND TAGGED · BLE 기록'
              : state.mode === 'entry' ? '② WRISTBAND TAGGED · 인증 진행'
              : '② WRISTBAND TAGGED · 초기화';
  const ioReady = !!state.flags.activeDevice;
  const btn1Enabled = state.fsmState === 'idle' && ioReady;
  const btn2Enabled = state.fsmState === 'await_tag';
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

          <div style={{ marginTop: 18, opacity: state.mode === 'issue' ? 1 : 0.55 }}>
            <FormField t={t} label="좌석 · SEAT"
              value={state.form.seat} onChange={v => state.setFormField('seat', v)}
              placeholder="MZ·B / R07·S11 — 비워두면 자동"
              focused={focusedSeat}
              disabled={state.mode !== 'issue' || state.fsmState !== 'idle'} />
            <FormField t={t} label="구역 · ZONE"
              value={state.form.zone} onChange={v => state.setFormField('zone', v)}
              placeholder="ZN.MEZ · MEZZANINE — 비워두면 자동"
              disabled={state.mode !== 'issue' || state.fsmState !== 'idle'} />
            <FormField t={t} label="관객 이름 · NAME"
              value={state.form.name} onChange={v => state.setFormField('name', v)}
              placeholder="서지윤 — 비워두면 자동"
              disabled={state.mode !== 'issue' || state.fsmState !== 'idle'} />
            <FormField t={t} label="티켓 · TICKET ID"
              value={state.form.ticketId} onChange={v => state.setFormField('ticketId', v)}
              placeholder="NF-26-0512-0917 — 비워두면 자동"
              disabled={state.mode !== 'issue' || state.fsmState !== 'idle'} />
            {state.mode === 'issue' && state.fsmState === 'idle' && (
              <div style={{
                fontFamily: t.monoFamily, fontSize: 10.5, color: t.mute,
                letterSpacing: 1.2, marginTop: -4, marginBottom: 6,
              }}>비어 있는 칸은 START 시 무작위 데모값으로 채워집니다.</div>
            )}
          </div>

          <div style={{ marginTop: 16 }}>
            <BigButton t={t} num="①" en={btn1En}
              enabled={btn1Enabled} pending={false} onClick={state.actStart} />
            <div style={{ height: 8 }} />
            <BigButton t={t} num="②" en={btn2En}
              enabled={btn2Enabled}
              pending={state.fsmState !== 'idle' && !btn2Enabled}
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

        {/* RIGHT — device / setlist / log */}
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
              busy={state.fsmState !== 'idle'}
              onConnect={state.ioConnect}
              onDisconnect={state.ioDisconnect}
              onRefresh={state.ioRefresh} />
            <DevicePanel t={t} label="입장장치 · ENTRY"
              deviceKey="entry"
              status={state.flags.entryStatus}
              ports={state.flags.availablePorts}
              otherConnected={state.flags.issuanceStatus.connected}
              busy={state.fsmState !== 'idle'}
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
          <LogFeed t={t} entries={state.log} />
        </div>
      </div>
    </div>
  );
}

FT.admin.AdminLive = AdminLive;
