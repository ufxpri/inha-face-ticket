// Web Audio API 기반 사운드 합성기 — 별도 mp3/wav 파일 없이 키오스크 효과음 생성.
//
// 브라우저 자동재생 정책: 첫 사용자 제스처(클릭/터치) 가 있어야 AudioContext 가 동작.
// FT.sounds.init() 를 첫 제스처 시점에 호출하면 그 이후 모든 play_* 가 동작.
//
// 사용:
//   FT.sounds.init();          // 첫 user gesture 안에서
//   FT.sounds.tick();          // 카운트다운 틱 (짧은 클릭)
//   FT.sounds.captureOk();     // 얼굴 인식 성공 — 짧은 두 음
//   FT.sounds.captureFail();   // 얼굴 인식 실패 — 부드러운 거부음
//   FT.sounds.chimePass();     // 입장/발급 성공 — 메이저 트라이어드 아르페지오
//   FT.sounds.chimeReturn();   // 반납 완료 — 차분한 두 음
//   FT.sounds.buzzDeny();      // 본인 확인 실패 — 거친 하강 톤
(function () {
  window.FT = window.FT || {};

  let ctx = null;
  let masterGain = null;

  function ensureCtx() {
    if (ctx) return ctx;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.6;
      masterGain.connect(ctx.destination);
    } catch (e) {
      console.warn('[sounds] AudioContext unavailable:', e);
    }
    return ctx;
  }

  // 한 음 만들기 — 사인/사각 등 type, 주파수, 길이, 게인, 어택/릴리스 envelope.
  function tone({
    freq = 880, dur = 0.18, type = 'sine', gain = 0.20,
    attack = 0.008, release = 0.10, delay = 0,
    freqEnd = null,  // 있으면 freq → freqEnd 로 글라이드
  }) {
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd != null) osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 0.01), t0 + dur);
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(gain, t0 + attack);
    env.gain.setValueAtTime(gain, t0 + Math.max(attack, dur - release));
    env.gain.linearRampToValueAtTime(0, t0 + dur);
    osc.connect(env).connect(masterGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // 짧은 노이즈 — 클릭/탁 느낌 (필요 시 사용)
  function noise({ dur = 0.04, gain = 0.10, delay = 0 }) {
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(gain, t0 + 0.005);
    env.gain.linearRampToValueAtTime(0, t0 + dur);
    src.connect(env).connect(masterGain);
    src.start(t0); src.stop(t0 + dur);
  }

  const sounds = {
    init() {
      ensureCtx();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    get ready() { return !!ctx && ctx.state === 'running'; },

    // ── 카운트다운 틱 — 짧은 high-pitched 클릭
    tick() {
      ensureCtx();
      tone({ freq: 1100, dur: 0.05, gain: 0.18, type: 'triangle', attack: 0.002, release: 0.02 });
    },

    // ── 캡처 성공 — 두 음 짧게 (저→고)
    captureOk() {
      ensureCtx();
      tone({ freq: 880,  dur: 0.10, gain: 0.18, type: 'sine' });
      tone({ freq: 1320, dur: 0.16, gain: 0.20, type: 'sine', delay: 0.08 });
    },

    // ── 캡처 거부 — 두 번 짧은 저음 (얼굴 미검출)
    captureFail() {
      ensureCtx();
      tone({ freq: 360, dur: 0.10, gain: 0.18, type: 'triangle' });
      tone({ freq: 300, dur: 0.14, gain: 0.18, type: 'triangle', delay: 0.10 });
    },

    // ── pass-issue / pass-entry — 아르페지오 C E G C
    chimePass() {
      ensureCtx();
      const seq = [523.25, 659.25, 783.99, 1046.50];
      seq.forEach((f, i) => tone({
        freq: f, dur: 0.34, gain: 0.16, type: 'sine',
        delay: i * 0.07, attack: 0.01, release: 0.18,
      }));
    },

    // ── pass-return — 차분한 두 음 (인사하듯)
    chimeReturn() {
      ensureCtx();
      tone({ freq: 659.25, dur: 0.22, gain: 0.16, type: 'sine' });
      tone({ freq: 523.25, dur: 0.30, gain: 0.18, type: 'sine', delay: 0.16 });
    },

    // ── deny — 하강 buzz
    buzzDeny() {
      ensureCtx();
      tone({ freq: 440, freqEnd: 220, dur: 0.30, gain: 0.22, type: 'sawtooth', release: 0.18 });
      tone({ freq: 220, freqEnd: 140, dur: 0.30, gain: 0.18, type: 'sawtooth', delay: 0.18, release: 0.18 });
    },
  };

  FT.sounds = sounds;
})();
