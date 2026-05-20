window.FT = window.FT || {};
FT.tablet = FT.tablet || {};

function TabletLive({ t, view, seq, subj, videoRef, footer, cosineThreshold }) {
  const { StatusChip, MonoLine, ShowCountdown } = FT.atoms;
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

  const headerMode = isIdle ? 'idle'
                   : (isPassIssue || view === 'capturing-issue') ? 'issue'
                   : isDeny ? 'deny' : 'pass';

  const chipKind = isIdle ? 'idle'
                 : isDeny ? 'deny'
                 : isCapturing ? 'scan' : 'pass';
  const chipText = isIdle ? 'STANDBY · 입장 대기 / WAITING'
                 : view === 'capturing-issue' ? '얼굴 캡처 중 · CAPTURING (ISSUE)'
                 : view === 'capturing-entry' ? '얼굴 캡처 중 · CAPTURING (ENTRY)'
                 : isAwaitTag ? '팔찌 태그 대기 · AWAITING WRISTBAND'
                 : isPassIssue ? '발급 완료 · WRISTBAND ISSUED'
                 : isPassEntry ? '입장 허가 · ACCESS GRANTED'
                 : '입장 거부 · ACCESS DENIED';

  const heroSize  = isIdle ? 380 : isCapturing ? 720 : 540;
  const faceRatio = isIdle ? 0.48 : isCapturing ? 0.66 : 0.52;
  const heroStatus = isIdle ? 'idle'
                   : isDeny ? 'deny'
                   : isCapturing ? 'scan' : 'pass';
  const confidence = isIdle ? 0
                   : isCapturing ? 0.55
                   : isDeny ? 0.41
                   : isAwaitTag ? 0.86 : 0.96;

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

        <div style={{ flex: 1, padding: '22px 36px 18px', display: 'flex', flexDirection: 'column', gap: 18, minHeight: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <StatusChip t={t} kind={chipKind}>{chipText}</StatusChip>
            <div style={{ display: 'flex', gap: 14 }}>
              <MonoLine t={t} letter={1.5}>ML · facenet-pytorch v1.3</MonoLine>
              <MonoLine t={t} letter={1.5}>SEQ · #{String(seq).padStart(4, '0')}</MonoLine>
            </div>
          </div>

          {isIdle && (
            <React.Fragment>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <ShowCountdown t={t} label="DOORS · 입장 개시" time="19:00" />
                <ShowCountdown t={t} label="SHOW · 공연 시작 T-MINUS" time="00:47:00" accent />
                <ShowCountdown t={t} label="ENCORE · 앙코르 예상" time="22:10" />
              </div>
              <HeroFace t={t} source="video" status="idle" size={380} faceRatio={0.48}
                        videoRef={videoRef} embedding={null} confidence={0} embDim={512} />
              <IdleCallout t={t} />
              <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 14 }}>
                <StageMap t={t} highlightSection="FL-A" highlightSeat={[12, 3]} />
                <SetlistPanel t={t} current={-1} compact />
              </div>
            </React.Fragment>
          )}

          {isCapturing && (
            <React.Fragment>
              <div style={{
                fontFamily: t.sansFamily, fontSize: 40, fontWeight: 700, color: t.ink,
                letterSpacing: -0.8, textAlign: 'center', marginTop: 4,
              }}>정면을 바라봐 주세요</div>
              <div style={{
                fontFamily: t.monoFamily, fontSize: 13, color: t.mute, letterSpacing: 2,
                textAlign: 'center', marginTop: -10,
              }}>LOOK STRAIGHT AT THE CAMERA · 3 SECONDS</div>
              <HeroFace t={t} source="video" status="scan" size={heroSize} faceRatio={faceRatio}
                        videoRef={videoRef} embedding={null} confidence={confidence} embDim={512} />
            </React.Fragment>
          )}

          {(isAwaitTag || isPassIssue || isPassEntry || isDeny) && (
            <React.Fragment>
              <HeroFace t={t} source="video" status={heroStatus} size={heroSize} faceRatio={faceRatio}
                        videoRef={videoRef} embedding={subj.embedding}
                        confidence={confidence} embDim={512} />
              <ResultCard t={t} kind={view} subj={subj}
                          cosVal={isPassEntry ? subj.cos : (isDeny ? subj.cos : null)}
                          fadedCos={isAwaitTag || isPassIssue}
                          threshold={cosineThreshold} />
            </React.Fragment>
          )}
        </div>

        <TabletFooter t={t} lines={footer} />
      </div>
    </div>
  );
}

FT.tablet.TabletLive = TabletLive;
