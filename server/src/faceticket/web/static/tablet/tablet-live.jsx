window.FT = window.FT || {};
FT.tablet = FT.tablet || {};

// 카메라 + 임베딩 영역은 "배경" 으로 취급 — 한 번 자리잡으면 view 전이에서 절대 흔들리지 않고
// 크기/위치 유지. 모든 가변 텍스트(타이틀, 카운트다운, 상태 칩, 결과 카드)는 그 위 또는 별도
// 섹션에 오버레이/페이드.
//
// 섹션 구분:
//   [chip row]    상태/메타 — 위에 한 줄
//   [camera zone] 고정 height. HeroFace + 가변 오버레이(타이틀, 카운트다운). 안쪽 침범 불가.
//   [info zone]   flex 1. IdleCallout ↔ ResultCard 페이드. camera zone 을 침범 못 함.
const HERO_SIZE        = 580;
const HERO_FACE_RATIO  = 0.62;
const CAMERA_ZONE_H    = 680;   // hero 580 + 라벨 위/아래 마진 + 약간의 호흡

function TabletLive({ t, view, seq, subj, videoRef, countdown, footer, cosineThreshold }) {
  const { StatusChip, MonoLine, FadeSlot } = FT.atoms;
  const {
    TicketStub, ShowStrip, TabletHeader, TabletFooter, IdleCallout,
    HeroFace, ResultCard,
  } = FT.molecules;

  const isIdle       = view === 'idle';
  const isCapturing  = view === 'capturing-issue' || view === 'capturing-entry';
  const isAwaitTag   = view === 'issue-await-tag';
  const isPassIssue  = view === 'pass-issue';
  const isPassEntry  = view === 'pass-entry';
  const isPassReturn = view === 'pass-return';
  const isDeny       = view === 'deny';
  const isResult     = isAwaitTag || isPassIssue || isPassEntry || isPassReturn || isDeny;

  const headerMode = isIdle ? 'idle'
                   : (isPassIssue || view === 'capturing-issue') ? 'issue'
                   : isDeny ? 'deny' : 'pass';

  const chipKind = isIdle ? 'idle' : isDeny ? 'deny' : isCapturing ? 'scan' : 'pass';
  const chipText = isIdle ? 'STANDBY · 입장 대기 / WAITING'
                 : view === 'capturing-issue' ? '얼굴 캡처 중 · CAPTURING (ISSUE)'
                 : view === 'capturing-entry' ? '얼굴 캡처 중 · CAPTURING (ENTRY)'
                 : isAwaitTag ? '팔찌 태그 대기 · AWAITING WRISTBAND'
                 : isPassIssue ? '발급 완료 · WRISTBAND ISSUED'
                 : isPassEntry ? '입장 허가 · ACCESS GRANTED'
                 : isPassReturn ? '반납 완료 · WRISTBAND RETURNED'
                 : '입장 거부 · ACCESS DENIED';

  const heroStatus = isIdle ? 'idle' : isDeny ? 'deny' : isCapturing ? 'scan' : 'pass';
  const confidence = isIdle ? 0
                   : isCapturing ? 0.55
                   : isDeny ? 0.41
                   : isAwaitTag ? 0.86 : 0.96;
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
          flex: 1, padding: '20px 36px 18px',
          display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0,
        }}>
          {/* ── 상태 칩 + 메타 ───────────────────────────────────── */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexShrink: 0,
          }}>
            <StatusChip t={t} kind={chipKind}>{chipText}</StatusChip>
            <div style={{ display: 'flex', gap: 14 }}>
              <MonoLine t={t} letter={1.5}>ML · facenet-pytorch v1.3</MonoLine>
              <MonoLine t={t} letter={1.5}>SEQ · #{String(seq).padStart(4, '0')}</MonoLine>
            </div>
          </div>

          {/* ── 카메라 ZONE — 배경처럼 고정, 위 점선으로 경계 ───── */}
          <div style={{
            flexShrink: 0,
            height: CAMERA_ZONE_H,
            position: 'relative',
            borderTop: `1px dashed ${t.line2}`,
            borderBottom: `1px dashed ${t.line2}`,
            display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            {/* HeroFace — 자리 고정, view 전이에도 동일 props 그대로 */}
            <HeroFace t={t} source="video" status={heroStatus}
                      size={HERO_SIZE} faceRatio={HERO_FACE_RATIO}
                      videoRef={videoRef} embedding={heroEmbedding}
                      confidence={confidence} embDim={512} />

            {/* 카메라 ZONE 상단에 떠 있는 가이드 오버레이 — 카메라를 건드리지 않음 */}
            <div style={{
              position: 'absolute', top: 22, left: 0, right: 0,
              textAlign: 'center', pointerEvents: 'none',
              opacity: isCapturing ? 1 : 0,
              transition: 'opacity 240ms ease',
            }}>
              <div style={{
                display: 'inline-block', padding: '8px 18px',
                background: 'rgba(15,17,11,0.92)',
                color: t.paper, fontFamily: t.sansFamily,
                fontSize: 22, fontWeight: 600, letterSpacing: -0.3,
              }}>
                정면을 바라봐 주세요
                <span style={{
                  marginLeft: 12, fontFamily: t.monoFamily, fontSize: 11,
                  letterSpacing: 1.8, opacity: 0.6, fontWeight: 400,
                }}>LOOK STRAIGHT · 3s</span>
              </div>
            </div>

            {/* 카운트다운 숫자 오버레이 — 얼굴 위 정중앙 */}
            <div style={{
              position: 'absolute', left: '50%', top: '50%',
              transform: 'translate(-50%, -50%)',
              fontFamily: t.sansFamily, fontWeight: 800,
              fontSize: 240, lineHeight: 1, color: '#fff',
              textShadow: '0 4px 24px rgba(0,0,0,0.5)',
              opacity: isCapturing && countdown > 0 ? 0.95 : 0,
              transition: 'opacity 220ms ease',
              pointerEvents: 'none', userSelect: 'none',
            }}>{countdown || ''}</div>
          </div>

          {/* ── 정보 ZONE — 별도 섹션, 카메라 침범 불가 ───────── */}
          <div style={{
            flex: 1, position: 'relative', minHeight: 0,
          }}>
            <FadeSlot.Item show={isIdle} style={{ justifyContent: 'flex-start', padding: '4px 0' }}>
              <IdleCallout t={t} />
            </FadeSlot.Item>
            <FadeSlot.Item show={isResult} style={{ justifyContent: 'flex-start', padding: '4px 0' }}>
              <ResultCard t={t} kind={view} subj={subj}
                          cosVal={isPassEntry ? subj.cos : (isDeny ? subj.cos : null)}
                          fadedCos={isAwaitTag || isPassIssue}
                          threshold={cosineThreshold} />
            </FadeSlot.Item>
          </div>
        </div>

        <TabletFooter t={t} lines={footer} />
      </div>
    </div>
  );
}

FT.tablet.TabletLive = TabletLive;
