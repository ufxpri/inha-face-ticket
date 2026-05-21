window.FT = window.FT || {};
FT.hooks = FT.hooks || {};

const { useState: _ts, useEffect: _te, useRef: _tr, useCallback: _tc } = React;

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
    const tick = () => { if (window.FT && FT.sounds) FT.sounds.tick(); };
    setCountdown(3);                                 tick();
    setTimeout(() => { setCountdown(2);              tick(); }, 700);
    setTimeout(() => { setCountdown(1);              tick(); }, 1400);
    setTimeout(() => { setCountdown(0); sendCapture(); }, 2100);
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
        setTimeout(runCountdownAndCapture, 450);
      } else if (m.type === 'capture_result') {
        if (m.ok) {
          if (m.embedding) setEmbedding(m.embedding);
          if (window.FT && FT.sounds) FT.sounds.captureOk();
          // ISSUE: server holds at await_tag; we show the wait card.
          // ENTRY: server compares + sends `complete`, so the capture view stays.
          if (lastFlowRef.current === 'issue') setView('issue-await-tag');
        } else {
          if (window.FT && FT.sounds) FT.sounds.captureFail();
          setTimeout(runCountdownAndCapture, 900);
        }
      } else if (m.type === 'complete') {
        // 서버가 동봉한 flow 로 결과 view 분기.
        const completedFlow = m.flow || lastFlowRef.current;
        if (m.ok) {
          setView(completedFlow === 'entry'  ? 'pass-entry'
                : completedFlow === 'return' ? 'pass-return'
                                              : 'pass-issue');
          if (window.FT && FT.sounds) {
            if (completedFlow === 'return') FT.sounds.chimeReturn();
            else                            FT.sounds.chimePass();
          }
        } else {
          setView('deny');
          if (window.FT && FT.sounds) FT.sounds.buzzDeny();
        }
        setTimeout(() => {
          setView('idle');
          setEmbedding(null);
          setSeatInput(''); setNameInput('');
        }, 6000);
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
