// concert.jsx — Concert show data + concert-specific atoms.
// Fictional band/tour. Lab Notebook aesthetic — everything is mono data,
// stamped chips, dashed perforations. No illustration, no posters.

// ── SHOW (fictional, original) ────────────────────────────────
const SHOW = {
  artist:    'NOISE FLOOR',
  artistKo:  '노이즈 플로어',
  tour:      'ZERO POINT TOUR 2026',
  tourKo:    '영점 투어 2026',
  city:      'SEOUL',
  cityKo:    '서울',
  venue:     'OLYMPIC HALL',
  venueKo:   '올림픽홀',
  date:      '2026·05·19',
  weekday:   'TUE',
  doors:     '19:00',
  show:      '20:00',
  inter:     '20:55',
  encore:    '22:10',
  end:       '22:30',
  capacity:  3200,
  attended:  1247,
  opening:   'STATIC VEIL',
  openingKo: '정적의 베일',
  showCode:  'NF·SE·26·05·19',
};

// ── SETLIST (fictional original titles) ───────────────────────
const SETLIST = [
  { n: '01', titleKo: '영점',         titleEn: 'ZERO POINT',  dur: '03:42', kind: 'intro' },
  { n: '02', titleKo: '신호와 잡음',   titleEn: 'SIGNAL / NOISE', dur: '04:18' },
  { n: '03', titleKo: '거리 함수',     titleEn: 'DISTANCE',    dur: '03:55' },
  { n: '04', titleKo: 'CALIBRATION',  titleEn: 'CALIBRATION', dur: '05:01' },
  { n: '05', titleKo: '잔향',          titleEn: 'RESIDUAL',    dur: '04:24' },
  { n: '06', titleKo: 'ARC LIGHT',    titleEn: 'ARC LIGHT',   dur: '03:36' },
  { n: '07', titleKo: '0 dB',         titleEn: 'ZERO DB',     dur: '04:47' },
  { n: '08', titleKo: '코사인',        titleEn: 'COSINE',      dur: '05:20' },
  { n: 'EN', titleKo: '반감기',        titleEn: 'HALF-LIFE',   dur: '06:08', kind: 'encore' },
];

// ── WRISTBAND ZONES ───────────────────────────────────────────
// One color per zone, encoded as both the visible swatch and the
// BLE LED command sent to the wristband on entry.
const ZONES = {
  PIT:    { code: 'ZN.PIT',  ko: 'PIT 입석',      en: 'STANDING PIT',   color: '#d83a1f', led: 'pulse.red' },
  FLOOR:  { code: 'ZN.FLR',  ko: '플로어 지정석',  en: 'FLOOR SEATED',   color: '#d83a1f', led: 'pulse.red' },
  MEZZ:   { code: 'ZN.MEZ',  ko: '메자닌',         en: 'MEZZANINE',      color: '#15110b', led: 'pulse.white' },
  BALC:   { code: 'ZN.BAL',  ko: '발코니',         en: 'BALCONY',        color: '#857c6c', led: 'pulse.dim' },
};

// ── Subjects for the various scenes ───────────────────────────
const CSUBJECTS = {
  pass:  { name: '김민준', nameEn: 'Min-Jun Kim',
           seat: 'FL·A / R12·S03', zone: 'FLOOR',
           wristId: '7A3F·09C2', ticketId: 'NF-26-0512-0188',
           cos: 0.964, age: 'A · adult', issued: '2026·04·01' },
  deny:  { name: '— UNKNOWN —', nameEn: 'IDENTITY MISMATCH',
           seat: 'FL·A / R12·S03', zone: 'FLOOR',
           wristId: '7A3F·09C2', ticketId: 'NF-26-0512-0188',
           cos: 0.412, age: 'A · adult', issued: '2026·04·01' },
  issue: { name: '서지윤', nameEn: 'Ji-Yoon Seo',
           seat: 'MZ·B / R07·S11', zone: 'MEZZ',
           wristId: '4D2A·11E8', ticketId: 'NF-26-0512-0917',
           cos: null, age: 'A · adult', issued: '2026·04·06' },
};

// ── TicketStub ────────────────────────────────────────────────
// Vertical perforated strip running down the LEFT edge of the tablet.
// Pure typography — feels like the torn-off side of a paper ticket.
function TicketStub({ t, ticketId = 'NF-26-0512-0188', seat = 'FL·A / R12·S03' }) {
  return (
    <div style={{
      width: 56,
      borderRight: `1px dashed ${t.ink}`,
      background: t.paper,
      position: 'relative',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'space-between',
      padding: '24px 0',
      flexShrink: 0,
    }}>
      {/* perforation dots along the seam */}
      <div style={{
        position: 'absolute', top: 0, bottom: 0, right: -3,
        width: 6, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'space-around',
        padding: '20px 0',
      }}>
        {Array.from({length: 28}).map((_, i) => (
          <div key={i} style={{
            width: 4, height: 4, background: t.bg,
            border: `1px solid ${t.ink}`, borderRadius: '50%',
          }} />
        ))}
      </div>

      <div style={{
        fontFamily: t.monoFamily, fontSize: 11, color: t.mute,
        letterSpacing: 3, writingMode: 'vertical-rl', transform: 'rotate(180deg)',
      }}>TEAR HERE · 절취선</div>

      <div style={{
        fontFamily: t.monoFamily, fontSize: 13, color: t.ink,
        letterSpacing: 4, writingMode: 'vertical-rl', transform: 'rotate(180deg)',
        fontWeight: 600,
      }}>
        {ticketId} · {seat} · ZERO POINT TOUR · NOISE FLOOR · {SHOW.date}
      </div>

      <div style={{
        fontFamily: t.monoFamily, fontSize: 11, color: t.mute,
        letterSpacing: 3, writingMode: 'vertical-rl', transform: 'rotate(180deg)',
      }}>STUB · {SHOW.showCode}</div>
    </div>
  );
}

// ── ShowStrip — concert poster strip just below system header ──
function ShowStrip({ t, accent = false }) {
  return (
    <div style={{
      padding: '14px 32px 16px',
      background: t.bg,
      borderBottom: `1px solid ${t.line}`,
      display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 28, alignItems: 'end',
    }}>
      <div>
        <div style={{
          fontFamily: t.monoFamily, fontSize: 12, color: t.mute,
          letterSpacing: 2,
        }}>NOW · 공연 입장 / SHOW ENTRY</div>
        <div style={{
          fontFamily: t.sansFamily, fontSize: 34, fontWeight: 700,
          color: t.ink, letterSpacing: -0.3, marginTop: 2, lineHeight: 1,
        }}>
          {SHOW.artist}<span style={{ color: t.accent, margin: '0 6px' }}>·</span>
          <span style={{ fontWeight: 400 }}>{SHOW.tour}</span>
        </div>
        <div style={{
          fontFamily: t.sansFamily, fontSize: 15, color: t.ink2, marginTop: 5,
        }}>
          {SHOW.artistKo} · {SHOW.tourKo}
          <span style={{ color: t.mute, marginLeft: 10, fontFamily: t.monoFamily, fontSize: 12, letterSpacing: 1.5 }}>
            opening · {SHOW.opening} / {SHOW.openingKo}
          </span>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontFamily: t.monoFamily, fontSize: 12, color: t.mute, letterSpacing: 2 }}>VENUE</div>
        <div style={{ fontFamily: t.sansFamily, fontSize: 17, fontWeight: 600, color: t.ink, marginTop: 2 }}>
          {SHOW.venue} · {SHOW.city}
        </div>
        <div style={{ fontFamily: t.sansFamily, fontSize: 13, color: t.mute }}>{SHOW.venueKo} · {SHOW.cityKo}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontFamily: t.monoFamily, fontSize: 12, color: t.mute, letterSpacing: 2 }}>DATE</div>
        <div style={{ fontFamily: t.monoFamily, fontSize: 22, fontWeight: 600, color: t.ink, letterSpacing: 1, marginTop: 2 }}>
          {SHOW.date}<span style={{ color: t.mute, marginLeft: 6 }}>{SHOW.weekday}</span>
        </div>
        <div style={{ fontFamily: t.monoFamily, fontSize: 12, color: t.mute, letterSpacing: 1.5 }}>
          DOORS {SHOW.doors} · SHOW {SHOW.show}
        </div>
      </div>
    </div>
  );
}

// ── ShowtimeTimeline — horizontal markers ─────────────────────
function ShowtimeTimeline({ t, current = '20:12' /* HH:MM */ }) {
  const stops = [
    { t: '19:00', l: 'DOORS', sub: '입장 시작' },
    { t: '20:00', l: 'SHOW',  sub: '공연 시작' },
    { t: '20:55', l: 'INTER', sub: '인터미션' },
    { t: '22:10', l: 'ENCORE', sub: '앙코르' },
    { t: '22:30', l: 'END',   sub: '종료' },
  ];
  // Position current marker between first and last
  const toMin = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
  const start = toMin(stops[0].t), end = toMin(stops[stops.length - 1].t);
  const pct = Math.max(0, Math.min(1, (toMin(current) - start) / (end - start)));

  return (
    <div style={{
      border: `1px solid ${t.line}`, background: t.surface,
      padding: '16px 20px',
      fontFamily: t.monoFamily, fontSize: 12, letterSpacing: 1.2,
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        color: t.mute, letterSpacing: 2, marginBottom: 16,
      }}>
        <span>SHOW.TIMELINE</span>
        <span>NOW · <span style={{ color: t.accent, fontWeight: 600 }}>{current}</span></span>
      </div>
      <div style={{ position: 'relative', height: 52 }}>
        {/* baseline */}
        <div style={{ position: 'absolute', top: 16, left: 6, right: 6, height: 1, background: t.ink }} />
        {/* stops */}
        {stops.map((s, i) => {
          const sp = i / (stops.length - 1) * 100;
          return (
            <div key={i} style={{
              position: 'absolute', left: `${sp}%`, top: 0,
              transform: 'translateX(-50%)', textAlign: 'center',
            }}>
              <div style={{
                width: 1, height: 16, background: t.ink, margin: '0 auto',
              }} />
              <div style={{ fontSize: 11, color: t.ink, fontWeight: 600, marginTop: 4, letterSpacing: 1.5 }}>
                {s.l}
              </div>
              <div style={{ fontSize: 10, color: t.mute, letterSpacing: 1 }}>
                {s.t}
              </div>
            </div>
          );
        })}
        {/* current pointer */}
        <div style={{
          position: 'absolute', left: `${pct * 100}%`, top: 6,
          transform: 'translateX(-50%)',
        }}>
          <div style={{
            width: 0, height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop: `6px solid ${t.accent}`,
          }} />
          <div style={{
            width: 1, height: 14, background: t.accent, margin: '0 auto',
          }} />
        </div>
      </div>
    </div>
  );
}

// ── StageMap — top-down section diagram, user's seat highlighted ──
function StageMap({ t, highlightSection = 'FL-A', highlightSeat = [12, 3] }) {
  // Layout: top STAGE, then PIT row, then FLOOR A/B, then MEZZ L/R, then BALC L/R
  // Simple geometric, no curves — fits Lab Notebook.
  const W = 360, H = 220;
  return (
    <div style={{
      border: `1px solid ${t.ink}`, background: t.surface,
      padding: '14px 16px',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: 12,
      }}>
        <div style={{ fontFamily: t.monoFamily, fontSize: 12, color: t.mute, letterSpacing: 2 }}>
          STAGE.MAP · 좌석 위치
        </div>
        <div style={{ fontFamily: t.monoFamily, fontSize: 12, color: t.accent, fontWeight: 600, letterSpacing: 1.5 }}>
          ✕ {highlightSection} · R{highlightSeat[0]}·S{highlightSeat[1]}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
        {/* stage block */}
        <rect x={W*0.18} y={6} width={W*0.64} height={20} fill={t.ink} />
        <text x={W/2} y={20} fill={t.paper} fontSize={9}
              fontFamily={t.monoFamily} textAnchor="middle"
              letterSpacing="3">STAGE</text>

        {/* PIT (small) */}
        <rect x={W*0.30} y={34} width={W*0.40} height={14}
              fill="none" stroke={t.line} />
        <text x={W*0.50} y={44} fill={t.mute} fontSize={8}
              fontFamily={t.monoFamily} textAnchor="middle" letterSpacing="2">PIT</text>

        {/* FLOOR A / FLOOR B */}
        <rect x={W*0.18} y={56} width={W*0.30} height={50}
              fill="none" stroke={t.line} />
        <text x={W*0.33} y={70} fill={t.mute} fontSize={9}
              fontFamily={t.monoFamily} textAnchor="middle" letterSpacing="2">FL · A</text>
        <rect x={W*0.52} y={56} width={W*0.30} height={50}
              fill="none" stroke={t.line} />
        <text x={W*0.67} y={70} fill={t.mute} fontSize={9}
              fontFamily={t.monoFamily} textAnchor="middle" letterSpacing="2">FL · B</text>

        {/* seat grid in FL-A */}
        {Array.from({length: 14}).map((_, r) =>
          Array.from({length: 8}).map((__, s) => {
            const cx = W*0.18 + 6 + s * ((W*0.30 - 12) / 8) + ((W*0.30 - 12) / 16);
            const cy = 78 + r * 1.8;
            const isMine = highlightSection === 'FL-A' && r + 1 === highlightSeat[0] && s + 1 === highlightSeat[1];
            return <rect key={`a-${r}-${s}`} x={cx-1} y={cy-1} width={2} height={1.5}
                         fill={isMine ? t.accent : t.line} />;
          })
        )}

        {/* MEZZ L / MEZZ R */}
        <rect x={W*0.08} y={114} width={W*0.18} height={36}
              fill="none" stroke={t.line} />
        <text x={W*0.17} y={134} fill={t.mute} fontSize={8}
              fontFamily={t.monoFamily} textAnchor="middle" letterSpacing="2">MEZZ L</text>
        <rect x={W*0.74} y={114} width={W*0.18} height={36}
              fill="none" stroke={t.line} />
        <text x={W*0.83} y={134} fill={t.mute} fontSize={8}
              fontFamily={t.monoFamily} textAnchor="middle" letterSpacing="2">MEZZ R</text>
        {/* MEZZ center (rear floor) */}
        <rect x={W*0.28} y={114} width={W*0.44} height={36}
              fill="none" stroke={t.line} />
        <text x={W*0.50} y={134} fill={t.mute} fontSize={8}
              fontFamily={t.monoFamily} textAnchor="middle" letterSpacing="2">MEZZ · CTR</text>

        {/* BALCONY (curved-ish rear) */}
        <rect x={W*0.10} y={158} width={W*0.80} height={28}
              fill="none" stroke={t.line} />
        <text x={W*0.50} y={175} fill={t.mute} fontSize={8}
              fontFamily={t.monoFamily} textAnchor="middle" letterSpacing="2">BALCONY</text>

        {/* gate labels */}
        <text x={4} y={H-4} fill={t.mute} fontSize={7}
              fontFamily={t.monoFamily} letterSpacing="1.5">G-01</text>
        <text x={W-26} y={H-4} fill={t.mute} fontSize={7}
              fontFamily={t.monoFamily} letterSpacing="1.5">G-04 ◉</text>
        <text x={W/2-12} y={H-4} fill={t.mute} fontSize={7}
              fontFamily={t.monoFamily} letterSpacing="1.5">G-02 / G-03</text>

        {/* crosshair on the mine seat (FL-A) */}
        {highlightSection === 'FL-A' && (() => {
          const cx = W*0.18 + 6 + (highlightSeat[1]-1) * ((W*0.30 - 12) / 8) + ((W*0.30 - 12) / 16);
          const cy = 78 + (highlightSeat[0]-1) * 1.8;
          return (
            <g>
              <line x1={cx-10} y1={cy} x2={cx-3} y2={cy} stroke={t.accent} strokeWidth={1} />
              <line x1={cx+3} y1={cy} x2={cx+10} y2={cy} stroke={t.accent} strokeWidth={1} />
              <line x1={cx} y1={cy-10} x2={cx} y2={cy-3} stroke={t.accent} strokeWidth={1} />
              <line x1={cx} y1={cy+3} x2={cx} y2={cy+10} stroke={t.accent} strokeWidth={1} />
              <circle cx={cx} cy={cy} r={2.5} fill={t.accent} />
            </g>
          );
        })()}
      </svg>
    </div>
  );
}

// ── Setlist preview, mono ─────────────────────────────────────
function SetlistPanel({ t, current = -1, compact = false }) {
  // current = index currently playing, -1 = not started yet
  return (
    <div style={{
      border: `1px solid ${t.line}`, background: t.surface,
      padding: '14px 16px',
      fontFamily: t.monoFamily,
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: 10,
      }}>
        <div style={{ fontSize: 12, color: t.mute, letterSpacing: 2 }}>SETLIST · {SETLIST.length} tracks</div>
        <div style={{ fontSize: 12, color: t.mute, letterSpacing: 1.5 }}>
          ~ 41:11 + EN 06:08
        </div>
      </div>
      {SETLIST.map((s, i) => {
        const state = i === current ? 'now' : (current >= 0 && i < current ? 'done' : 'pend');
        const mark = state === 'now' ? '◉' : state === 'done' ? '✓' : '·';
        const titleCol = state === 'now' ? t.accent : (state === 'done' ? t.mute : t.ink);
        const isEncore = s.kind === 'encore';
        return (
          <div key={s.n} style={{
            display: 'grid', gridTemplateColumns: '22px 28px 1fr auto', gap: 10,
            padding: '5px 0',
            fontSize: 13,
            borderTop: isEncore ? `1px dashed ${t.line}` : 'none',
            marginTop: isEncore ? 6 : 0,
            paddingTop: isEncore ? 9 : 5,
            opacity: compact && i > 5 && !isEncore ? 0.5 : 1,
          }}>
            <span style={{ color: state === 'now' ? t.accent : t.mute, fontWeight: 600 }}>{mark}</span>
            <span style={{ color: t.mute, letterSpacing: 1 }}>{s.n}</span>
            <span style={{ color: titleCol, fontFamily: t.sansFamily, fontSize: 14 }}>
              {s.titleKo}
              <span style={{ color: t.mute, marginLeft: 8, fontFamily: t.monoFamily, fontSize: 11, letterSpacing: 1 }}>
                {s.titleEn}
              </span>
            </span>
            <span style={{ color: t.mute, letterSpacing: 1 }}>{s.dur}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── ZoneBadge ─────────────────────────────────────────────────
function ZoneBadge({ t, zone = 'FLOOR', big = false }) {
  const z = ZONES[zone];
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: big ? 10 : 8,
      border: `1px solid ${t.ink}`, background: t.surface,
      padding: big ? '10px 14px' : '6px 10px',
      fontFamily: t.monoFamily, fontSize: big ? 14 : 11, letterSpacing: 1.5,
    }}>
      <span style={{
        display: 'inline-block',
        width: big ? 18 : 12, height: big ? 18 : 12,
        background: z.color,
      }} />
      <span style={{ color: t.mute, fontWeight: 600 }}>{z.code}</span>
      <span style={{ color: t.ink, fontFamily: t.sansFamily, fontWeight: 600 }}>
        {z.ko}
      </span>
      <span style={{ color: t.mute, fontSize: big ? 12 : 10, letterSpacing: 1 }}>
        / {z.en}
      </span>
    </div>
  );
}

// ── Big mono countdown ────────────────────────────────────────
function ShowCountdown({ t, label, time, accent = false }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '16px 18px',
      border: `1px solid ${accent ? t.accent : t.line}`,
      background: t.surface,
    }}>
      <div style={{
        fontFamily: t.monoFamily, fontSize: 12, color: t.mute,
        letterSpacing: 2,
      }}>{label}</div>
      <div style={{
        fontFamily: t.monoFamily, fontSize: 42, fontWeight: 600,
        color: accent ? t.accent : t.ink, letterSpacing: 1.5, marginTop: 4, lineHeight: 1,
      }}>{time}</div>
    </div>
  );
}

// ── Capacity gauge — fills as attendance grows ────────────────
function CapacityGauge({ t, attended = SHOW.attended, capacity = SHOW.capacity, perSection }) {
  const pct = attended / capacity;
  return (
    <div style={{ border: `1px solid ${t.line}`, background: t.surface, padding: '14px 16px' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: 10,
      }}>
        <div style={{ fontFamily: t.monoFamily, fontSize: 12, color: t.mute, letterSpacing: 2 }}>
          CAPACITY · 입장 현황
        </div>
        <div style={{ fontFamily: t.monoFamily, fontSize: 13, color: t.ink, letterSpacing: 1 }}>
          <span style={{ fontSize: 22, fontWeight: 600 }}>{attended.toLocaleString()}</span>
          <span style={{ color: t.mute }}> / {capacity.toLocaleString()}</span>
          <span style={{ color: t.accent, marginLeft: 8, fontWeight: 600 }}>{(pct*100).toFixed(1)}%</span>
        </div>
      </div>
      {/* big bar */}
      <div style={{ height: 20, background: t.paper, border: `1px solid ${t.line}`, position: 'relative' }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${pct*100}%`, background: t.ink,
        }} />
        {/* tick marks */}
        {[0.25, 0.5, 0.75].map(f => (
          <div key={f} style={{
            position: 'absolute', left: `${f*100}%`, top: 0, bottom: 0,
            width: 1, background: t.bg,
          }} />
        ))}
      </div>
      {/* per-section breakdown */}
      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {perSection.map(([code, att, cap]) => (
          <div key={code}>
            <div style={{
              fontFamily: t.monoFamily, fontSize: 11, color: t.mute, letterSpacing: 1.5,
            }}>{code}</div>
            <div style={{
              fontFamily: t.monoFamily, fontSize: 16, color: t.ink, fontWeight: 600,
            }}>{att}<span style={{ color: t.mute, fontWeight: 400 }}> / {cap}</span></div>
            <div style={{ height: 4, background: t.paper, border: `1px solid ${t.line2}`, marginTop: 2 }}>
              <div style={{ height: '100%', width: `${(att/cap)*100}%`, background: t.ink }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, {
  SHOW, SETLIST, ZONES, CSUBJECTS,
  TicketStub, ShowStrip, ShowtimeTimeline, StageMap,
  SetlistPanel, ZoneBadge, ShowCountdown, CapacityGauge,
});
