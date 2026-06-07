// Web Audio API 기반 사운드 합성기 — 별도 mp3/wav 파일 없이 키오스크 효과음 생성.
//
// 브라우저 자동재생 정책: 첫 사용자 제스처(클릭/터치) 가 있어야 AudioContext 가 동작.
// FT.sounds.init() 를 첫 제스처 시점에 호출하면 그 이후 모든 메서드가 동작.
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

  // ── 음악적 상수 ─────────────────────────────────────────────
  // 12-TET 표준 음. 새 효과음 추가 시 여기서 이름으로 참조.
  const NOTES = {
    A3:  220.00,
    A4:  440.00,
    A5:  880.00,
    C5:  523.25,
    E5:  659.25,
    G5:  783.99,
    C6: 1046.50,
    E6: 1318.51,   // 1320 근사
  };

  // ── envelope 프리셋 ─────────────────────────────────────────
  // attack/release 가 짧을수록 click 에 가깝고, 길수록 부드럽다.
  const ENV = {
    click: { attack: 0.002, release: 0.020 },
    short: { attack: 0.008, release: 0.080 },
    soft:  { attack: 0.010, release: 0.180 },
  };

  // ── 게인 ────────────────────────────────────────────────────
  const MASTER_GAIN = 0.6;   // 전체 볼륨 캡
  const G = { tick: 0.18, ok: 0.20, fail: 0.18, chime: 0.17, deny: 0.20 };

  let ctx = null;
  let masterGain = null;

  function ensureCtx() {
    if (ctx) return ctx;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = MASTER_GAIN;
      masterGain.connect(ctx.destination);
    } catch (e) {
      console.warn('[sounds] AudioContext unavailable:', e);
    }
    return ctx;
  }

  // 한 음 만들기 — 사인/사각 등 type, 주파수, 길이, 게인, 어택/릴리스 envelope.
  function tone({
    freq = NOTES.A5, dur = 0.18, type = 'sine', gain = 0.20,
    attack = ENV.short.attack, release = ENV.short.release, delay = 0,
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

  const sounds = {
    init() {
      ensureCtx();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    get ready() { return !!ctx && ctx.state === 'running'; },

    // ── 카운트다운 틱 — 짧은 high-pitched 클릭
    tick() {
      ensureCtx();
      tone({ freq: 1100, dur: 0.05, gain: G.tick, type: 'triangle', ...ENV.click });
    },

    // ── NFC 태그 인식 — 명료한 단일 "삑" (인식 즉시 피드백)
    tag() {
      ensureCtx();
      tone({ freq: NOTES.E6, dur: 0.12, gain: 0.22, type: 'square', ...ENV.short });
    },

    // ── 캡처 성공 — A5 → E6 (저→고 두 음)
    captureOk() {
      ensureCtx();
      tone({ freq: NOTES.A5, dur: 0.10, gain: G.ok, type: 'sine' });
      tone({ freq: NOTES.E6, dur: 0.16, gain: G.ok, type: 'sine', delay: 0.08 });
    },

    // ── 캡처 거부 — 두 번 짧은 저음 (얼굴 미검출)
    captureFail() {
      ensureCtx();
      tone({ freq: 360, dur: 0.10, gain: G.fail, type: 'triangle' });
      tone({ freq: 300, dur: 0.14, gain: G.fail, type: 'triangle', delay: 0.10 });
    },

    // ── pass-issue / pass-entry — 아르페지오 C5 E5 G5 C6 (C major triad)
    chimePass() {
      ensureCtx();
      const seq = [NOTES.C5, NOTES.E5, NOTES.G5, NOTES.C6];
      seq.forEach((f, i) => tone({
        freq: f, dur: 0.34, gain: G.chime, type: 'sine',
        delay: i * 0.07, ...ENV.soft,
      }));
    },

    // ── pass-return — 차분한 두 음 E5 → C5 (인사하듯 내려옴)
    chimeReturn() {
      ensureCtx();
      tone({ freq: NOTES.E5, dur: 0.22, gain: G.chime, type: 'sine' });
      tone({ freq: NOTES.C5, dur: 0.30, gain: G.chime, type: 'sine', delay: 0.16 });
    },

    // ── deny — 하강 buzz A4 → A3 → 낮은 끝
    buzzDeny() {
      ensureCtx();
      tone({ freq: NOTES.A4, freqEnd: NOTES.A3, dur: 0.30, gain: G.deny, type: 'sawtooth', release: ENV.soft.release });
      tone({ freq: NOTES.A3, freqEnd: 140,      dur: 0.30, gain: G.deny - 0.02, type: 'sawtooth', delay: 0.18, release: ENV.soft.release });
    },
  };

  FT.sounds = sounds;
})();
