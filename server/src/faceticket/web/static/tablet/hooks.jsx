window.FT = window.FT || {};
FT.hooks = FT.hooks || {};

const { useState: _ts, useEffect: _te, useRef: _tr, useCallback: _tc } = React;

// ── 타이밍 상수 (도메인 의미가 있는 값만 명명) ─────────────────────────
const COUNTDOWN_STEP_MS    = 700;   // 3 → 2 → 1 사이 간격
const CAPTURE_AFTER_TICK_MS = 2100; // 1 표시 후 셔터까지 (3·COUNTDOWN_STEP_MS)
const TRIGGER_TO_COUNTDOWN_MS = 450; // capture_trigger 수신 → 카운트다운 시작
const RETRY_AFTER_FAIL_MS  = 900;   // capture 실패 시 자동 재시도까지
const IDLE_LINGER_MS       = 6000;  // complete → idle 자동 복귀까지

// 사운드 안전 호출 — sounds.js 미로드 시 silent no-op
function _snd(name) {
  if (window.FT && FT.sounds && typeof FT.sounds[name] === 'function') FT.sounds[name]();
}

// useCamera — one-shot getUserMedia, exposes videoRef. Stream is kept alive
// across view changes; we just re-attach to <video> when it re-mounts.
function useCamera({ viewKey }) {
  const videoRef = _tr(null);
  const streamRef = _tr(null);

  _te(() => {
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

  _te(() => {
    if (streamRef.current && videoRef.current
        && videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [viewKey]);

  return { videoRef, streamRef };
}

// useCountdownAndCapture — 3-2-1 countdown then snapshot the current frame
// (mirrored to match the visual) and ship as JPEG over the given WebSocket.
// 사운드(tick) 는 view 가 아닌 타이머에 묶이는 게 자연스러워 여기서 트리거.
function useCountdownAndCapture({ videoRef, wsRef }) {
  const [countdown, setCountdown] = _ts(0);

  const sendCapture = _tc(() => {
    const v = videoRef.current;
    if (!v || !v.videoWidth || !wsRef.current || wsRef.current.readyState !== 1) return;
    const cv = document.createElement('canvas');
    cv.width = v.videoWidth; cv.height = v.videoHeight;
    const ctx = cv.getContext('2d');
    ctx.save(); ctx.scale(-1, 1);
    ctx.drawImage(v, -cv.width, 0, cv.width, cv.height);
    ctx.restore();
    wsRef.current.send(JSON.stringify({ type: 'image', data: cv.toDataURL('image/jpeg', 0.85) }));
  }, [videoRef, wsRef]);

  const runCountdownAndCapture = _tc(() => {
    setCountdown(3);                                              _snd('tick');
    setTimeout(() => { setCountdown(2);                           _snd('tick'); }, COUNTDOWN_STEP_MS);
    setTimeout(() => { setCountdown(1);                           _snd('tick'); }, COUNTDOWN_STEP_MS * 2);
    setTimeout(() => { setCountdown(0); sendCapture(); },          CAPTURE_AFTER_TICK_MS);
  }, [sendCapture]);

  return { countdown, runCountdownAndCapture };
}

// useAudioUnlock — 브라우저 자동재생 정책 우회. 첫 user gesture(click/touch/key) 시
// AudioContext 를 초기화+resume. 사운드가 활성화되면 audioReady=true.
function useAudioUnlock() {
  const [audioReady, setAudioReady] = _ts(false);
  _te(() => {
    const unlock = () => {
      if (!window.FT || !FT.sounds) return;
      FT.sounds.init();
      setAudioReady(FT.sounds.ready);
    };
    const opts = { capture: true };
    window.addEventListener('click', unlock, opts);
    window.addEventListener('touchstart', unlock, opts);
    window.addEventListener('keydown', unlock, opts);
    return () => {
      window.removeEventListener('click', unlock, opts);
      window.removeEventListener('touchstart', unlock, opts);
      window.removeEventListener('keydown', unlock, opts);
    };
  }, []);
  return audioReady;
}

// useViewSounds — view 전이로 결정되는 사운드를 한 곳에 isolate.
// (tick 은 타이머 기반이라 useCountdownAndCapture 안에 남김. captureFail 은
//  view 가 바뀌지 않고 silent retry 라 WS handler 안에 직접 둠.)
const VIEW_ENTRY_SOUND = {
  'issue-await-tag': 'captureOk',  // 발급 캡처 성공 시 await_tag 로 전이
  'pass-issue':      'chimePass',
  'pass-entry':      'chimePass',
  'pass-return':     'chimeReturn',
  'deny':            'buzzDeny',
};

function useViewSounds(view) {
  const prevRef = _tr(view);
  _te(() => {
    const prev = prevRef.current;
    prevRef.current = view;
    if (prev === view) return;
    const fn = VIEW_ENTRY_SOUND[view];
    if (fn) _snd(fn);
  }, [view]);
}

// useTabletViewState — owns the kiosk's WS subscription + view transitions.
function useTabletViewState() {
  const [view, setView] = _ts('idle');
  const [seatInput, setSeatInput] = _ts('');
  const [nameInput, setNameInput] = _ts('');
  const [embedding, setEmbedding] = _ts(null);
  const [seq, setSeq] = _ts(2490);
  const [cosineThreshold, setCosineThreshold] = _ts(0.55);
  const lastFlowRef = _tr(null);
  const wsRef = _tr(null);
  const audioReady = useAudioUnlock();
  useViewSounds(view);
  const { videoRef } = useCamera({ viewKey: view });
  const { countdown, runCountdownAndCapture } = useCountdownAndCapture({ videoRef, wsRef });

  _te(() => {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${location.host}/ws/tablet`);
    wsRef.current = ws;
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.type === 'hello') {
        if (typeof m.cosine_threshold === 'number') setCosineThreshold(m.cosine_threshold);
      } else if (m.type === 'capture_trigger') {
        const flow = m.mode === 'entry' ? 'entry' : 'issue';
        lastFlowRef.current = flow;
        setSeatInput(m.seat || '');
        setNameInput(m.name || '');
        setView(flow === 'entry' ? 'capturing-entry' : 'capturing-issue');
        setSeq(s => s + 1);
        setTimeout(runCountdownAndCapture, TRIGGER_TO_COUNTDOWN_MS);
      } else if (m.type === 'capture_result') {
        if (m.ok) {
          if (m.embedding) setEmbedding(m.embedding);
          // ISSUE 만 view 가 바뀌어 captureOk 사운드를 useViewSounds 가 처리.
          // ENTRY 는 view 가 안 바뀌어 사운드를 위해 명시 호출.
          if (lastFlowRef.current === 'issue') setView('issue-await-tag');
          else                                 _snd('captureOk');
        } else {
          _snd('captureFail');  // view 가 안 바뀜 (자동 재시도)
          setTimeout(runCountdownAndCapture, RETRY_AFTER_FAIL_MS);
        }
      } else if (m.type === 'complete') {
        // 서버가 41baeb7 이후 m.flow 를 항상 동봉. 사운드와 view 는 useViewSounds 가 처리.
        const completedFlow = m.flow;
        if (m.ok) {
          setView(completedFlow === 'entry'  ? 'pass-entry'
                : completedFlow === 'return' ? 'pass-return'
                                              : 'pass-issue');
        } else {
          setView('deny');
        }
        setTimeout(() => {
          setView('idle');
          setEmbedding(null);
          setSeatInput(''); setNameInput('');
        }, IDLE_LINGER_MS);
      }
    };
    return () => ws.close();
  }, [runCountdownAndCapture]);

  return {
    view, seatInput, nameInput, embedding, seq, cosineThreshold, countdown, videoRef,
    audioReady,
  };
}

FT.hooks.useCamera = useCamera;
FT.hooks.useCountdownAndCapture = useCountdownAndCapture;
FT.hooks.useTabletViewState = useTabletViewState;
FT.hooks.useAudioUnlock = useAudioUnlock;
FT.hooks.useViewSounds = useViewSounds;
