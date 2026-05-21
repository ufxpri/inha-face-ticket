window.FT = window.FT || {};
FT.tablet = FT.tablet || {};

// 얼굴 영역은 view 전이에서 절대 흔들리지 않는다. 위/아래 슬롯이 고정 height 를 갖고
// 그 안의 콘텐츠만 opacity 로 페이드. capturing 시 카운트다운 숫자는 얼굴 위에 오버레이.
const HERO_SIZE       = 480;
const HERO_FACE_RATIO = 0.50;
const HINT_SLOT_H     = 130;   // capture title or empty
const INFO_SLOT_H     = 580;   // ResultCard / IdleCallout+StageMap+SetlistPanel
const COUNTDOWN_SLOT_H = 110;   // 3 countdowns visible only on idle, reserved on others

function TabletLive({ t, view, seq, subj, videoRef, countdown, footer, cosineThreshold }) {
  const { StatusChip, MonoLine, ShowCountdown, FadeSlot } = FT.atoms;
  const {
    TicketStub, ShowStrip, TabletHeader, TabletFooter, IdleCallout,
    HeroFace, StageMap, SetlistPanel, ResultCard,
  } = FT.molecules;

  const isIdle      = view === 'idle';
  const isCapturing = view === 'capturing-issue' || view === 'capturing-entry';
  const isAwaitTag  = view === 'issue-await-tag';
  const isPassIssue = view === 'pass-issue';
  const isPassEntry = view === 'pass-entry';
  const isDeny      = view === 'deny';
  const isResult    = isAwaitTag || isPassIssue || isPassEntry || isDeny;

  const headerMode = isIdle ? 'idle'
                   : (isPassIssue || view === 'capturing-issue') ? 'issue'
                   : isDeny ? 'deny' : 'pass';

  // status / chip 텍스트는 한 곳에서만 결정
  const chipKind = isIdle ? 'idle' : isDeny ? 'deny' : isCapturing ? 'scan' : 'pass';
  const chipText = isIdle ? 'STANDBY · 입장 대기 / WAITING'
                 : view === 'capturing-issue' ? '얼굴 캡처 중 · CAPTURING (ISSUE)'
                 : view === 'capturing-entry' ? '얼굴 캡처 중 · CAPTURING (ENTRY)'
                 : isAwaitTag ? '팔찌 태그 대기 · AWAITING WRISTBAND'
                 : isPassIssue ? '발급 완료 · WRISTBAND ISSUED'
                 : isPassEntry ? '입장 허가 · ACCESS GRANTED'
                 : '입장 거부 · ACCESS DENIED';

  // HeroFace 의 status / confidence 만 바뀌고 size 는 절대 바뀌지 않는다.
  const heroStatus = isIdle ? 'idle' : isDeny ? 'deny' : isCapturing ? 'scan' : 'pass';
  const confidence = isIdle ? 0
                   : isCapturing ? 0.55
                   : isDeny ? 0.41
                   : isAwaitTag ? 0.86 : 0.96;
  // 결과 view 에서만 ResultCard 안에 임베딩을 보여준다. capturing 시에는 RadialViz 가
  // status='scan' 으로 자체 시각화하므로 굳이 embedding 까지 흘릴 필요 없음.
  const heroEmbedding = isResult ? subj.embedding : null;

  return (
    <div style={{
      width: 1080, height: 1440,
      background: t.bg, color: t.ink, fontFamily: t.sansFamily,
      display: 'flex',
    }}>
      <TicketStub t={t} ticketId={subj.ticketId} seat={subj.seat} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TabletHeader t={t} mode={headerMode} />
        <ShowStrip t={t} />

        <div style={{
          flex: 1, padding: '22px 36px 18px',
          display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0,
        }}>
          {/* 상태 칩 + 메타 — 텍스트만 바뀜, 박스 자체는 항상 같은 자리 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <StatusChip t={t} kind={chipKind}>{chipText}</StatusChip>
            <div style={{ display: 'flex', gap: 14 }}>
              <MonoLine t={t} letter={1.5}>ML · facenet-pytorch v1.3</MonoLine>
              <MonoLine t={t} letter={1.5}>SEQ · #{String(seq).padStart(4, '0')}</MonoLine>
            </div>
          </div>

          {/* 3개 카운트다운 — idle 일 때만 보이지만 슬롯은 항상 예약 */}
          <FadeSlot height={COUNTDOWN_SLOT_H}>
            <FadeSlot.Item show={isIdle}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <ShowCountdown t={t} label="DOORS · 입장 개시" time="19:00" />
                <ShowCountdown t={t} label="SHOW · 공연 시작 T-MINUS" time="00:47:00" accent />
                <ShowCountdown t={t} label="ENCORE · 앙코르 예상" time="22:10" />
              </div>
            </FadeSlot.Item>
          </FadeSlot>

          {/* 힌트 슬롯 — capturing 일 때만 “정면을 바라봐 주세요” 타이틀 */}
          <FadeSlot height={HINT_SLOT_H - 30}>
            <FadeSlot.Item show={isCapturing}>
              <div style={{
                fontFamily: t.sansFamily, fontSize: 40, fontWeight: 700, color: t.ink,
                letterSpacing: -0.8, textAlign: 'center',
              }}>정면을 바라봐 주세요</div>
              <div style={{
                fontFamily: t.monoFamily, fontSize: 13, color: t.mute, letterSpacing: 2,
                textAlign: 'center', marginTop: 6,
              }}>LOOK STRAIGHT AT THE CAMERA · 3 SECONDS</div>
            </FadeSlot.Item>
          </FadeSlot>

          {/* 얼굴 영역 — 절대 흔들리지 않음 */}
          <div style={{
            flexShrink: 0, position: 'relative',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
          }}>
            <HeroFace t={t} source="video" status={heroStatus}
                      size={HERO_SIZE} faceRatio={HERO_FACE_RATIO}
                      videoRef={videoRef} embedding={heroEmbedding}
                      confidence={confidence} embDim={512} />

            {/* 카운트다운 숫자 오버레이 — 얼굴 위에 떠 있음. transition 으로 등장/소멸 부드럽게 */}
            <div style={{
              position: 'absolute', left: '50%', top: '50%',
              transform: 'translate(-50%, -50%)',
              fontFamily: t.sansFamily, fontWeight: 800,
              fontSize: 220, lineHeight: 1, color: '#fff',
              textShadow: '0 4px 24px rgba(0,0,0,0.5)',
              opacity: isCapturing && countdown > 0 ? 0.92 : 0,
              transition: 'opacity 220ms ease',
              pointerEvents: 'none', userSelect: 'none',
            }}>{countdown || ''}</div>
          </div>

          {/* 정보 슬롯 — idle 의 IdleCallout+StageMap+SetlistPanel 와 결과 ResultCard 가 교대 */}
          <FadeSlot height={INFO_SLOT_H} style={{ marginTop: 8 }}>
            <FadeSlot.Item show={isIdle}>
              <IdleCallout t={t} />
              <div style={{
                display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 14, marginTop: 14,
              }}>
                <StageMap t={t} highlightSection="FL-A" highlightSeat={[12, 3]} />
                <SetlistPanel t={t} current={-1} compact />
              </div>
            </FadeSlot.Item>
            <FadeSlot.Item show={isResult} style={{ justifyContent: 'flex-start' }}>
              <ResultCard t={t} kind={view} subj={subj}
                          cosVal={isPassEntry ? subj.cos : (isDeny ? subj.cos : null)}
                          fadedCos={isAwaitTag || isPassIssue}
                          threshold={cosineThreshold} />
            </FadeSlot.Item>
          </FadeSlot>
        </div>

        <TabletFooter t={t} lines={footer} />
      </div>
    </div>
  );
}

FT.tablet.TabletLive = TabletLive;
