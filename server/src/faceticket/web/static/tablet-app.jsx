// tablet-app.jsx — 디자인 atom 그대로 사용 + 실제 동작 흐름과 자연스럽게 정렬.
//
// 표시 상태:
//   idle                     대기 (얼굴 캡처 트리거 대기)
//   capturing-issue          발급용 얼굴 캡처 진행 (BIG 카메라)
//   capturing-entry          입장용 얼굴 캡처 진행 (BIG 카메라)
//   issue-await-tag          발급 — 임베딩 추출 완료, 운영자가 팔찌 태그를 기다림
//   pass-issue               발급 완료
//   pass-entry               입장 통과
//   deny                     입장 거부
//
// 서버 메시지 → 상태 전이:
//   capture_trigger(mode=issue) → capturing-issue
//   capture_trigger(mode=entry) → capturing-entry
//   capture_result(ok=true)     → 발급이면 issue-await-tag, 입장이면 capturing-entry 유지
//   capture_result(ok=false)    → 자동 재캡처
//   complete(ok=true)           → 마지막 flow 가 issue 면 pass-issue, entry 면 pass-entry
//   complete(ok=false)          → deny

const { useState, useEffect, useRef, useCallback } = React;
// Scaler 는 app-common.jsx 가 글로벌로 선언 — 별도 destructure 시 babel-standalone 의
// 공유 스코프에서 재선언 충돌(SyntaxError) 이 나므로 그냥 글로벌 참조로 사용한다.

// ── LiveFacePortrait ─────────────────────────────────────────────
// 디자인의 FacePortrait 시각 구조를 유지하되 추상 흉상 자리에 실제 <video>.
function LiveFacePortrait({ t, size, status, label, sub, videoRef }) {
  // status: 'idle' | 'live' | 'deny'
  const isDeny = status === 'deny';
  const isIdle = status === 'idle';
  const ink = isDeny ? t.accent : t.ink;

  return (
    <div style={{
      position: 'relative', width: size, height: size,
      background: '#0a0807', overflow: 'hidden',
      fontFamily: t.monoFamily,
    }}>
      <video ref={videoRef} autoPlay playsInline muted style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        objectFit: 'cover', transform: 'scaleX(-1)',
        filter: isIdle ? 'grayscale(1) brightness(0.55) contrast(1.05)'
                       : (isDeny ? 'sepia(0.4) saturate(0.7) brightness(0.85)' : 'none'),
      }} />

      {/* 스캔라인 */}
      {!isIdle && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'repeating-linear-gradient(0deg, transparent 0 3px, rgba(0,0,0,0.05) 3px 4px)',
        }} />
      )}

      {/* 코너 브래킷 */}
      {['tl','tr','bl','br'].map(c => {
        const L = 18, W = 1.5;
        const pos = {
          tl: { top: 10, left: 10 }, tr: { top: 10, right: 10 },
          bl: { bottom: 10, left: 10 }, br: { bottom: 10, right: 10 },
        }[c];
        return (
          <React.Fragment key={c}>
            <div style={{ position: 'absolute', background: ink, ...pos, width: L, height: W }} />
            <div style={{ position: 'absolute', background: ink, ...pos, width: W, height: L }} />
          </React.Fragment>
        );
      })}

      {/* 얼굴 크롭 박스 — 캡처 중 또는 deny 시 */}
      {!isIdle && (
        <div style={{
          position: 'absolute', left: '32%', top: '22%', width: '36%', height: '40%',
          border: `1px ${isDeny ? 'solid' : 'dashed'} ${ink}`,
          boxShadow: isDeny ? `0 0 0 2px ${t.paper}, 0 0 0 3px ${t.accent}33` : 'none',
        }}>
          <div style={{
            position: 'absolute', top: -16, left: 0,
            fontSize: 9, color: ink, letterSpacing: 1.2,
            textShadow: '0 0 4px rgba(0,0,0,0.4)',
          }}>FACE · {isDeny ? 'LOW QUALITY' : 'LOCKED'}</div>
        </div>
      )}

      <div style={{ position: 'absolute', top: 10, left: 36, fontSize: 9, color: t.paper,
                    letterSpacing: 1.5, textShadow: '0 0 4px rgba(0,0,0,0.6)' }}>{label}</div>
      <div style={{ position: 'absolute', bottom: 10, left: 36, fontSize: 9, color: t.paper,
                    letterSpacing: 1.2, opacity: 0.85, textShadow: '0 0 4px rgba(0,0,0,0.6)' }}>{sub}</div>
      <div style={{ position: 'absolute', top: 10, right: 36, fontSize: 9,
                    color: isIdle ? t.paper : (isDeny ? t.accent : t.paper),
                    letterSpacing: 1.2, textShadow: '0 0 4px rgba(0,0,0,0.6)' }}>
        {isIdle ? '— NO SUBJECT —' : (isDeny ? '◉ REC · ALERT' : '◉ REC')}
      </div>
    </div>
  );
}

// ── HeroFaceLive ─────────────────────────────────────────────────
// 디자인 CHeroFace 와 같은 구조: RadialViz 배경 + 안쪽 원형 LiveFacePortrait.
// faceRatio 로 안쪽 원 비율 조절 (0.48 기본, 캡처 모드에서 0.66 정도로 확대).
function HeroFaceLive({ t, status, size, faceRatio, videoRef, embedding, confidence, seedKey }) {
  const RadialViz = window.RadialViz;
  const faceSize = Math.round(size * (faceRatio ?? 0.48));
  const portraitStatus = status === 'idle' ? 'idle' : status === 'deny' ? 'deny' : 'live';

  const seed = (() => {
    if (!embedding || embedding.length === 0) {
      return { pass: 13, deny: 91, scan: 41, idle: 1 }[status] || (seedKey || 1);
    }
    let s = 0;
    for (let i = 0; i < Math.min(16, embedding.length); i++) {
      s = (s * 131 + Math.floor(embedding[i] * 1000)) | 0;
    }
    return Math.abs(s) % 1000 + 1;
  })();

  return (
    <div style={{
      position: 'relative', width: size, height: size, margin: '0 auto',
      flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <RadialViz t={t} size={size} dims={128} seed={seed}
                   confidence={confidence} status={status} faceSize={faceSize} />
      </div>

      <div style={{
        width: faceSize, height: faceSize, borderRadius: '50%',
        overflow: 'hidden', position: 'relative',
        boxShadow: status === 'deny' ? `inset 0 0 0 1px ${t.accent}` : `inset 0 0 0 1px ${t.ink}`,
        background: '#000',
      }}>
        <LiveFacePortrait t={t} size={faceSize} status={portraitStatus}
                          videoRef={videoRef}
                          label={status === 'idle' ? 'CAM01 · IDLE'
                                 : status === 'scan' ? 'CAM01 · SCAN'
                                 : status === 'deny' ? 'CAM01 · DENY'
                                 : 'CAM01 · LIVE'}
                          sub="480×640 · 30fps · v2.4" />
      </div>

      {status !== 'idle' && (
        <React.Fragment>
          <div style={{
            position: 'absolute', top: -26, left: '50%', transform: 'translateX(-50%)',
            fontFamily: t.monoFamily, fontSize: 11, color: t.mute, letterSpacing: 2,
          }}>embedding · 512-d · f32</div>
          <div style={{
            position: 'absolute', bottom: -26, left: '50%', transform: 'translateX(-50%)',
            fontFamily: t.monoFamily, fontSize: 11, color: t.mute, letterSpacing: 2,
          }}>cos.sweep · {(confidence * 360).toFixed(0)}° / 360°</div>
        </React.Fragment>
      )}

      <div style={{ position: 'absolute', left: 0, right: 0, top: '50%',
                    height: 0, borderTop: `1px dashed ${t.line2}`, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%',
                    width: 0, borderLeft: `1px dashed ${t.line2}`, pointerEvents: 'none' }} />
    </div>
  );
}

// ── ID 카드 (pass/deny/await-tag 단계 공통) ──────────────────────
function ResultIDCard({ t, kind, subj, cosVal, fadedCos, threshold }) {
  // kind: 'pass-issue' | 'pass-entry' | 'deny' | 'issue-await-tag'
  const { KV, ZoneBadge, ZONES } = window;

  const conf = {
    'pass-entry': { title: '입장 허가', titleEn: 'ACCESS GRANTED', stamp: 'PASS',
                    sub: '게이트가 열립니다. 좌석 안내원의 인도를 따라주세요.',
                    stampBg: t.ink, stampFg: t.paper },
    'pass-issue': { title: '발급 완료',  titleEn: 'WRISTBAND READY', stamp: 'DONE',
                    sub: '팔찌에 좌석 정보와 얼굴 임베딩이 기록되었습니다. 공연장 안내에 따라 입장해 주세요.',
                    stampBg: t.ink, stampFg: t.paper },
    'deny':       { title: '본인 확인 실패', titleEn: 'IDENTITY MISMATCH', stamp: 'DENY',
                    sub: '얼굴 임베딩이 발급 시 등록과 일치하지 않습니다. 1층 매표소에서 본인 확인 후 재발급 받으세요.',
                    stampBg: t.accent, stampFg: t.accentInk },
    'issue-await-tag': { title: '팔찌 태그 대기', titleEn: 'AWAITING WRISTBAND TAG', stamp: 'WAIT',
                    sub: '얼굴 임베딩 추출이 완료되었습니다. 발급 장치의 NFC 리더에 팔찌를 가까이 대주세요.',
                    stampBg: t.ink, stampFg: t.paper },
  }[kind];

  return (
    <div style={{
      border: `1px solid ${t.ink}`, background: t.surface,
      padding: '20px 24px',
      display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 28,
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute', top: -1, right: -1,
        background: conf.stampBg, color: conf.stampFg,
        fontFamily: t.monoFamily, fontSize: 12, letterSpacing: 2.5, fontWeight: 700,
        padding: '6px 13px',
      }}>{conf.stamp}</div>

      <div>
        <div style={{ fontFamily: t.monoFamily, fontSize: 12, color: t.mute, letterSpacing: 2.5 }}>{conf.titleEn}</div>
        <div style={{ fontFamily: t.sansFamily, fontSize: 40, fontWeight: 700, color: t.ink,
                      letterSpacing: -0.6, marginTop: 4, lineHeight: 1.05 }}>{conf.title}</div>
        <div style={{ marginTop: 16, fontFamily: t.sansFamily, fontSize: 15, color: t.ink2, lineHeight: 1.5 }}>{conf.sub}</div>
        <div style={{ marginTop: 20 }}>
          <ZoneBadge t={t} zone={subj.zone} big />
        </div>
        <div style={{ marginTop: 16, fontFamily: t.monoFamily, fontSize: 12, color: t.mute, letterSpacing: 1.5 }}>
          TICKET · <span style={{ color: t.ink, fontWeight: 600 }}>{subj.ticketId}</span>
          <span style={{ marginLeft: 12 }}>ISSUED · {subj.issued}</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <KV t={t} k="SUBJECT · 이름"  v={kind === 'deny' ? '— UNKNOWN —' : (subj.name + ' · ' + subj.nameEn)} />
        <KV t={t} k="SEAT · 좌석"     v={subj.seat} big />
        <KV t={t} k="ZONE · 구역"     v={ZONES[subj.zone].ko + ' / ' + ZONES[subj.zone].en} />
        <KV t={t} k="WRIST.ID"        v={subj.wristId} />
        <KV t={t} k="COS.SIM"
            v={cosVal != null ? cosVal.toFixed(3) : (fadedCos ? '— writing —' : '—')}
            accent={kind === 'deny'} />
        <KV t={t} k="THRESHOLD"       v={(threshold ?? 0.55).toFixed(3)} />
      </div>
    </div>
  );
}

// ── TabletLive ───────────────────────────────────────────────────
function TabletLive({ t, view, seq, subj, videoRef, footer, cosineThreshold }) {
  // view: 'idle' | 'capturing-issue' | 'capturing-entry' | 'issue-await-tag' | 'pass-issue' | 'pass-entry' | 'deny'
  const {
    TicketStub, ShowStrip, CTabletHeader, CTabletFooter, CIdleCallout,
    StatusChip, MonoLine, ShowCountdown, StageMap, SetlistPanel,
  } = window;

  const isIdle      = view === 'idle';
  const isCapturing = view === 'capturing-issue' || view === 'capturing-entry';
  const isAwaitTag  = view === 'issue-await-tag';
  const isPassIssue = view === 'pass-issue';
  const isPassEntry = view === 'pass-entry';
  const isDeny      = view === 'deny';

  // 헤더용 mode (디자인의 CTabletHeader 는 4 모드만 받음)
  const headerMode = isIdle ? 'idle'
                   : (isPassIssue || view === 'capturing-issue') ? 'issue'
                   : isDeny ? 'deny'
                   : 'pass';

  // 상태 chip
  const chipKind = isIdle ? 'idle'
                 : isDeny ? 'deny'
                 : isCapturing ? 'scan'
                 : 'pass';
  const chipText = isIdle ? 'STANDBY · 입장 대기 / WAITING'
                 : view === 'capturing-issue' ? '얼굴 캡처 중 · CAPTURING (ISSUE)'
                 : view === 'capturing-entry' ? '얼굴 캡처 중 · CAPTURING (ENTRY)'
                 : isAwaitTag ? '팔찌 태그 대기 · AWAITING WRISTBAND'
                 : isPassIssue ? '발급 완료 · WRISTBAND ISSUED'
                 : isPassEntry ? '입장 허가 · ACCESS GRANTED'
                 : '입장 거부 · ACCESS DENIED';

  // HeroFaceLive 파라미터
  const heroSize  = isIdle ? 380 : isCapturing ? 720 : 540;
  const faceRatio = isIdle ? 0.48 : isCapturing ? 0.66 : 0.52;
  const heroStatus = isIdle ? 'idle'
                   : isDeny ? 'deny'
                   : isCapturing ? 'scan'
                   : 'pass';
  const confidence = isIdle ? 0
                   : isCapturing ? 0.55
                   : isDeny ? 0.41
                   : isAwaitTag ? 0.86
                   : 0.96;

  return (
    <div style={{
      width: 1080, height: 1440,
      background: t.bg, color: t.ink, fontFamily: t.sansFamily,
      display: 'flex',
    }}>
      <TicketStub t={t} ticketId={subj.ticketId} seat={subj.seat} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <CTabletHeader t={t} mode={headerMode} />
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
              <HeroFaceLive t={t} status="idle" size={380} faceRatio={0.48}
                            videoRef={videoRef} embedding={null} confidence={0} />
              <CIdleCallout t={t} />
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
              <HeroFaceLive t={t} status="scan" size={heroSize} faceRatio={faceRatio}
                            videoRef={videoRef} embedding={null} confidence={confidence} />
            </React.Fragment>
          )}

          {(isAwaitTag || isPassIssue || isPassEntry || isDeny) && (
            <React.Fragment>
              <HeroFaceLive t={t} status={heroStatus} size={heroSize} faceRatio={faceRatio}
                            videoRef={videoRef} embedding={subj.embedding}
                            confidence={confidence} />
              <ResultIDCard t={t} kind={view} subj={subj}
                            cosVal={isPassEntry ? subj.cos : (isDeny ? subj.cos : null)}
                            fadedCos={isAwaitTag || isPassIssue}
                            threshold={cosineThreshold} />
            </React.Fragment>
          )}
        </div>

        <CTabletFooter t={t} lines={footer} />
      </div>
    </div>
  );
}

// ── Footer 라인 (view 별 함수 맵) ─────────────────────────────────
// 디자인의 CTabletFooter 가 그대로 받아 그릴 줄 객체 배열을 반환한다.
const FOOTERS = {
  'pass-entry': () => [
    { l: 'NFC.READER',  r: 'TAG 04:7A:3F:09:C2:81 → read 12 ms' },
    { l: 'BLE.CENTRAL', r: 'PAIRED · RSSI -48 · embedding read 21.4 kB' },
    { l: 'GATE.SERVO',  r: 'OPEN · 90° · ultrasonic pass detected 384 ms', accent: true },
    { l: 'WRIST.LED',   r: 'pulse.red → FLOOR · OK' },
  ],
  'pass-issue': ({ subj }) => [
    { l: 'NFC.READER',  r: 'WRITE BLE_TRIGGER → OK 18 ms' },
    { l: 'BLE.CENTRAL', r: 'PAIRED · wrote 512 B  ▰▰▰▰▰▰ 100%', accent: true },
    { l: 'SEAT.WRITE',  r: subj.seat + ' · ZN.' + subj.zone + ' → OK' },
    { l: 'LED.PRESET',  r: 'pulse.white (MEZZ) · queued · OK' },
  ],
  'deny': ({ subj, cosineThreshold }) => [
    { l: 'NFC.READER',  r: 'TAG 04:7A:3F:09:C2:81 → read 11 ms' },
    { l: 'BLE.CENTRAL', r: 'PAIRED · RSSI -52 · embedding read 21.4 kB' },
    { l: 'GATE.SERVO',  r: 'CLOSED · DENY · retry 1/3 · 1F 매표소 호출 OK', accent: true },
    { l: 'COS.SIM',     r: `${(subj.cos ?? 0.412).toFixed(3)} < ${cosineThreshold.toFixed(3)} · 본인 확인 실패`, accent: true },
  ],
  'capturing-issue': () => [
    { l: 'TABLET',      r: 'getUserMedia 640×480 30fps · streaming → server' },
    { l: 'WS.UPLINK',   r: 'JPEG q85 · ≈ 60 kB / frame', accent: true },
    { l: 'ML',          r: 'facenet-pytorch · MTCNN → InceptionResnetV1' },
    { l: 'CAPTURE',     r: 'countdown 3·2·1 → image → embedding 512-d f32' },
  ],
  'issue-await-tag': ({ subj }) => [
    { l: 'EMBEDDING',   r: '512-d · ‖e‖=1.000 · captured', accent: true },
    { l: 'NFC.READER',  r: 'READY · waiting for wristband tag…' },
    { l: 'BLE.CENTRAL', r: 'IDLE · scan paused' },
    { l: 'SEAT.PENDING', r: subj.seat + ' · ZN.' + subj.zone },
  ],
  'idle': () => [
    { l: 'NFC.READER',  r: 'READY · 0 evt/s · last tag 00:04:12 ago', dim: true },
    { l: 'BLE.CENTRAL', r: 'IDLE · scan paused', dim: true },
    { l: 'GATE.SERVO',  r: 'CLOSED · 0°', dim: true },
    { l: 'CAPACITY',    r: 'FLOOR 612 / 980 · MEZZ 240 / 800 · BALC 395 / 1240' },
  ],
};
FOOTERS['capturing-entry'] = FOOTERS['capturing-issue'];   // 같은 라인

// ── TabletApp (root) ─────────────────────────────────────────────
function TabletApp() {
  const t = THEMES.A;
  const [view, setView] = useState('idle');
  const lastFlowRef = useRef(null);    // FLOW.* — WS effect 가 재구독되지 않도록 ref
  const [seatInput, setSeatInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [embedding, setEmbedding] = useState(null);
  const [seq, setSeq] = useState(2490);
  const [countdown, setCountdown] = useState(0);
  const [cosineThreshold, setCosineThreshold] = useState(0.55);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const wsRef = useRef(null);

  // 카메라 — 한 번만 받고 streamRef 에 보관
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach(tr => tr.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (e) { console.error('camera error', e); }
    })();
    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(tr => tr.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // view 가 바뀌어 <video> 가 재마운트될 때마다 스트림 재첨부
  useEffect(() => {
    if (streamRef.current && videoRef.current
        && videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [view]);

  const sendCapture = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.videoWidth || !wsRef.current || wsRef.current.readyState !== 1) return;
    const cv = document.createElement('canvas');
    cv.width = v.videoWidth; cv.height = v.videoHeight;
    const ctx = cv.getContext('2d');
    ctx.save(); ctx.scale(-1, 1);
    ctx.drawImage(v, -cv.width, 0, cv.width, cv.height);
    ctx.restore();
    wsRef.current.send(JSON.stringify({ type: 'image', data: cv.toDataURL('image/jpeg', 0.85) }));
  }, []);

  const runCountdownAndCapture = useCallback(() => {
    setCountdown(3);
    setTimeout(() => setCountdown(2), 700);
    setTimeout(() => setCountdown(1), 1400);
    setTimeout(() => { setCountdown(0); sendCapture(); }, 2100);
  }, [sendCapture]);

  useEffect(() => {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${location.host}/ws/tablet`);
    wsRef.current = ws;
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.type === 'hello') {
        if (typeof m.cosine_threshold === 'number') setCosineThreshold(m.cosine_threshold);
      } else if (m.type === 'capture_trigger') {
        const flow = m.mode === FLOW.ENTRY ? FLOW.ENTRY : FLOW.ISSUE;
        lastFlowRef.current = flow;
        setSeatInput(m.seat || '');
        setNameInput(m.name || '');
        setView(flow === FLOW.ENTRY ? 'capturing-entry' : 'capturing-issue');
        setSeq(s => s + 1);
        setTimeout(runCountdownAndCapture, 450);
      } else if (m.type === 'capture_result') {
        if (m.ok) {
          if (m.embedding) setEmbedding(m.embedding);
          // 발급이면 임베딩 추출 후 팔찌 태그 대기 단계로 전환
          if (lastFlowRef.current === FLOW.ISSUE) setView('issue-await-tag');
          // 입장이면 서버가 비교 후 complete 보내올 때까지 캡처 화면 유지
        } else {
          setTimeout(runCountdownAndCapture, 900);
        }
      } else if (m.type === 'complete') {
        if (m.ok) {
          setView(lastFlowRef.current === FLOW.ENTRY ? 'pass-entry' : 'pass-issue');
        } else {
          setView('deny');
        }
        setTimeout(() => {
          setView('idle');
          setEmbedding(null);
          setSeatInput(''); setNameInput('');
        }, 6000);
      }
    };
    return () => ws.close();
    // lastFlow 는 ref 이므로 deps 에서 제외 — WS 가 재구독되지 않게 함
  }, [runCountdownAndCapture]);

  // subj — 가능하면 운영자 입력값, 없으면 데모 데이터
  const subj = {
    name: nameInput || '서지윤',
    nameEn: nameInput ? '' : 'Ji-Yoon Seo',
    seat: seatInput || 'MZ·B / R07·S11',
    zone: (() => {
      const s = (seatInput || '').toUpperCase();
      if (s.startsWith('FL') || s.startsWith('A')) return 'FLOOR';
      if (s.startsWith('PIT')) return 'PIT';
      if (s.startsWith('BAL')) return 'BALC';
      return 'MEZZ';
    })(),
    wristId: '4D2A·11E8',
    ticketId: 'NF-26-0512-' + String(seq).padStart(4, '0'),
    issued: '2026·04·01',
    embedding,
    cos: view === 'pass-entry' ? 0.964 : view === 'deny' ? 0.412 : null,
  };

  // 푸터 라인 — view 별 함수 맵. ctx 에서 동적 값(seat/zone/cos/threshold) 을 읽어 라인 구성.
  const footer = (FOOTERS[view] || FOOTERS.idle)({ subj, cosineThreshold });

  return (
    <Scaler width={1080} height={1440}>
      <div style={{ position: 'relative', width: 1080, height: 1440 }}>
        <TabletLive t={t} view={view} seq={seq} subj={subj}
                    videoRef={videoRef} footer={footer}
                    cosineThreshold={cosineThreshold} />
        {countdown > 0 && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: 'rgba(15,17,11,0.35)', pointerEvents: 'none', zIndex: 50,
          }}>
            <div style={{
              fontFamily: t.monoFamily, fontWeight: 200, fontSize: 320,
              color: t.paper, textShadow: '0 0 80px rgba(216,58,31,0.5)',
              letterSpacing: -10,
            }}>{countdown}</div>
          </div>
        )}
      </div>
    </Scaler>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<TabletApp />);
