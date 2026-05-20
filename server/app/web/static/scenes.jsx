// scenes.jsx — Tablet (portrait kiosk) and Admin (laptop) scene components.
// Each takes a theme `t` from THEMES; tablet takes a `mode` prop for
// idle/pass/deny/issue states.

// Sample subject data — varies per scene for visual variety
const SUBJECTS = {
  pass:  { name: '김민준',     nameEn: 'Min-Jun Kim',  seat: 'A-12', wristId: '7A3F·09C2', cos: 0.964 },
  deny:  { name: '— UNKNOWN —',nameEn: 'IDENTITY MISMATCH', seat: 'A-12', wristId: '7A3F·09C2', cos: 0.412 },
  issue: { name: '서지윤',     nameEn: 'Ji-Yoon Seo',  seat: 'B-07', wristId: '4D2A·11E8', cos: null  },
};

// Header strip — used by all tablet scenes
function TabletHeader({ t, mode }) {
  const modeLabel = {
    idle:  ['STANDBY',      '대기 중'],
    pass:  ['ENTRY · MATCH', '입장 · 본인 확인 완료'],
    deny:  ['ENTRY · DENY',  '입장 · 본인 확인 실패'],
    issue: ['ISSUE',         '발급 모드'],
  }[mode];
  const time = mode === 'idle' ? '21:48:01' : mode === 'pass' ? '21:48:33' : mode === 'deny' ? '21:50:17' : '20:12:09';
  const seq  = mode === 'idle' ? '#2490' : mode === 'pass' ? '#2491' : mode === 'deny' ? '#2492' : '#0188';
  return (
    <div style={{
      display: 'flex', alignItems: 'stretch', justifyContent: 'space-between',
      borderBottom: `1px solid ${t.ink}`,
      padding: '16px 32px', gap: 24,
      background: t.paper,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* glyph */}
        <div style={{
          width: 28, height: 28, position: 'relative',
          border: `1.5px solid ${t.ink}`, borderRadius: '50%',
        }}>
          <div style={{
            position: 'absolute', inset: 6,
            border: `1.5px solid ${t.ink}`, borderRadius: '50%',
          }} />
          <div style={{
            position: 'absolute', left: '50%', top: -3, bottom: -3, width: 1.5,
            background: t.ink, transform: 'translateX(-50%)',
          }} />
        </div>
        <div>
          <div style={{
            fontFamily: t.sansFamily, fontWeight: t.headerWeight,
            fontSize: t.id === 'C' ? 22 : 18, color: t.ink, letterSpacing: t.id === 'C' ? 1 : 0.5,
          }}>FACEPASS<span style={{ color: t.accent }}>·</span>{t.id === 'C' ? 'KIOSK' : 'kiosk'}</div>
          <div style={{
            fontFamily: t.monoFamily, fontSize: 10, color: t.mute, letterSpacing: 1.2, marginTop: 2,
          }}>GATE G-04 · 메인 입장 · {modeLabel[0]} / {modeLabel[1]}</div>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontFamily: t.monoFamily, fontSize: 22, color: t.ink, fontWeight: 500, letterSpacing: 1 }}>
          {time}
        </div>
        <div style={{ fontFamily: t.monoFamily, fontSize: 10, color: t.mute, letterSpacing: 1.2 }}>
          2026-05-19 · KST · seq {seq}
        </div>
      </div>
    </div>
  );
}

// Footer strip
function TabletFooter({ t, lines }) {
  return (
    <div style={{
      borderTop: `1px solid ${t.line}`,
      background: t.paper,
      padding: '14px 32px',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      {lines.map((line, i) => (
        <div key={i} style={{
          display: 'flex', justifyContent: 'space-between',
          fontFamily: t.monoFamily, fontSize: 10, color: line.dim ? t.mute : t.ink,
          letterSpacing: 1.2,
        }}>
          <span>{line.l}</span>
          <span style={{ color: line.accent ? t.accent : (line.dim ? t.mute : t.ink) }}>{line.r}</span>
        </div>
      ))}
    </div>
  );
}

// ID card centerpiece for PASS / DENY / ISSUE
function IDCard({ t, mode, subj }) {
  const status = mode === 'pass' ? 'pass' : mode === 'deny' ? 'deny' : 'scan';
  const title = mode === 'pass' ? '입장 허가' : mode === 'deny' ? '본인 확인 실패' : '발급 기록 중';
  const titleEn = mode === 'pass' ? 'ACCESS GRANTED' : mode === 'deny' ? 'IDENTITY MISMATCH' : 'WRITING TO WRISTBAND';
  return (
    <div style={{
      border: `1px solid ${t.ink}`,
      background: t.surface,
      padding: '20px 24px',
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22,
      position: 'relative',
    }}>
      {/* corner stamp */}
      <div style={{
        position: 'absolute', top: -1, right: -1,
        background: status === 'deny' ? t.accent : t.ink,
        color: status === 'deny' ? t.accentInk : (t.id === 'B' ? t.accent : t.paper),
        fontFamily: t.monoFamily, fontSize: 10, letterSpacing: 2, fontWeight: 600,
        padding: '5px 10px',
      }}>
        {mode === 'pass' ? 'PASS' : mode === 'deny' ? 'DENY' : 'REC'}
      </div>

      <div>
        <div style={{
          fontFamily: t.monoFamily, fontSize: 10, color: t.mute, letterSpacing: 2,
        }}>{titleEn}</div>
        <div style={{
          fontFamily: t.sansFamily, fontSize: t.id === 'C' ? 38 : 30,
          fontWeight: t.headerWeight, color: t.ink, letterSpacing: -0.5,
          marginTop: 4, lineHeight: 1.05,
        }}>{title}</div>
        <div style={{
          marginTop: 18,
          fontFamily: t.sansFamily, fontSize: 14, color: t.ink2, lineHeight: 1.4,
        }}>
          {mode === 'pass' && '본인 확인 완료. 게이트가 열립니다.'}
          {mode === 'deny' && '얼굴 임베딩이 등록과 일치하지 않습니다. 운영자에게 문의하세요.'}
          {mode === 'issue' && '팔찌에 얼굴 임베딩과 좌석을 기록하는 중입니다.'}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <KV t={t} k="SUBJECT · 이름" v={mode === 'deny' ? '— UNKNOWN —' : subj.name} big />
          <KV t={t} k="SEAT · 좌석"    v={subj.seat} big />
          <KV t={t} k="WRIST.ID"       v={subj.wristId} />
          <KV t={t} k="COS.SIM"        v={subj.cos != null ? subj.cos.toFixed(3) : '—'} accent={mode==='deny'} />
          <KV t={t} k="THRESHOLD"      v="0.620" />
        </div>
      </div>
    </div>
  );
}

// Main hero panel surrounding the face with the radial viz
function HeroFace({ t, mode, subj }) {
  const status = mode === 'idle' ? 'idle' : mode === 'deny' ? 'deny' : (mode === 'issue' ? 'scan' : 'pass');
  const portraitMode = mode === 'idle' ? 'idle' : (mode === 'deny' ? 'deny' : 'live');
  const ringSize = 660;
  const faceSize = 320;
  const seed = mode === 'pass' ? 13 : mode === 'deny' ? 91 : mode === 'issue' ? 41 : 1;
  const confidence = mode === 'pass' ? 0.96 : mode === 'deny' ? 0.41 : mode === 'issue' ? 0.78 : 0;

  return (
    <div style={{
      position: 'relative',
      width: ringSize, height: ringSize,
      margin: '0 auto',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <RadialViz t={t} size={ringSize} dims={128} seed={seed}
                   confidence={confidence} status={status} faceSize={faceSize} />
      </div>
      {/* face in the center, clipped to a circle */}
      <div style={{
        width: faceSize, height: faceSize, borderRadius: '50%',
        overflow: 'hidden', position: 'relative',
        boxShadow: status === 'deny' ? `inset 0 0 0 1px ${t.accent}` : `inset 0 0 0 1px ${t.ink}`,
      }}>
        <FacePortrait t={t} size={faceSize} mode={portraitMode}
                      label={mode === 'idle' ? 'CAM01 · IDLE' : `CAM01 · ${mode.toUpperCase()}`}
                      sub="480×640 · 30fps · v2.4" />
      </div>

      {/* radial decorative readouts */}
      {mode !== 'idle' && (
        <>
          <div style={{
            position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%) translateY(-100%)',
            fontFamily: t.monoFamily, fontSize: 10, color: t.mute, letterSpacing: 1.5,
            paddingBottom: 6,
          }}>
            embedding · 128-d · f32
          </div>
          <div style={{
            position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%) translateY(100%)',
            fontFamily: t.monoFamily, fontSize: 10, color: t.mute, letterSpacing: 1.5,
            paddingTop: 6,
          }}>
            cos.sweep · {(confidence * 360).toFixed(0)}° / 360°
          </div>
        </>
      )}
      {/* center hairlines */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: '50%',
        height: 0, borderTop: `1px dashed ${t.line2}`, pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: 0, bottom: 0, left: '50%',
        width: 0, borderLeft: `1px dashed ${t.line2}`, pointerEvents: 'none',
      }} />
    </div>
  );
}

// Idle special — big bilingual "STEP CLOSER" call-out
function IdleCallout({ t }) {
  return (
    <div style={{ textAlign: 'center', marginTop: 32 }}>
      <StatusChip t={t} kind="idle">STANDBY · 대기 중</StatusChip>
      <div style={{
        fontFamily: t.sansFamily, fontSize: t.id === 'C' ? 54 : 44,
        fontWeight: t.headerWeight, color: t.ink, marginTop: 18, lineHeight: 1,
        letterSpacing: t.id === 'C' ? -1 : -0.5,
      }}>
        팔찌를 태그해 주세요
      </div>
      <div style={{
        fontFamily: t.monoFamily, fontSize: 14, color: t.mute, marginTop: 8,
        letterSpacing: 2,
      }}>TAG YOUR WRISTBAND TO BEGIN</div>
    </div>
  );
}

// Tablet full scene
function Tablet({ t, mode = 'pass' }) {
  const subj = mode === 'pass' ? SUBJECTS.pass : (mode === 'deny' ? SUBJECTS.deny : (mode === 'issue' ? SUBJECTS.issue : SUBJECTS.pass));
  const status = mode === 'idle' ? 'idle' : mode === 'deny' ? 'deny' : mode === 'issue' ? 'scan' : 'pass';
  const chipText = mode === 'pass' ? '입장 허가 · ACCESS GRANTED' :
                   mode === 'deny' ? '입장 거부 · ACCESS DENIED' :
                   mode === 'issue' ? '발급 기록 중 · WRITING' :
                   'STANDBY · 대기 중';

  // Footer telemetry varies per state
  const footer = {
    idle: [
      { l: 'NFC.READER',  r: 'READY · 0 evt/s',  dim: true },
      { l: 'BLE.CENTRAL', r: 'IDLE · scan paused', dim: true },
      { l: 'GATE.SERVO',  r: 'CLOSED · 0°',       dim: true },
      { l: 'CAM01 · CAM02', r: '480×640 · 30fps',  dim: true },
    ],
    pass: [
      { l: 'NFC.READER',  r: 'TAG 04:7A:3F:09:C2:81  →  read 12ms' },
      { l: 'BLE.CENTRAL', r: 'PAIRED · RSSI -48 · 21.4kB rx', accent: false },
      { l: 'GATE.SERVO',  r: 'OPEN · 90° · pass detected (us 384ms)', accent: true },
      { l: 'COS.SIM',     r: '0.964 ≥ 0.620 · PASS', accent: true },
    ],
    deny: [
      { l: 'NFC.READER',  r: 'TAG 04:7A:3F:09:C2:81  →  read 11ms' },
      { l: 'BLE.CENTRAL', r: 'PAIRED · RSSI -52' },
      { l: 'GATE.SERVO',  r: 'CLOSED · DENY · 거부 사유 cos<thr', accent: true },
      { l: 'COS.SIM',     r: '0.412 < 0.620 · DENY · retry 1/3', accent: true },
    ],
    issue: [
      { l: 'NFC.READER',  r: 'WRITE BLE_TRIGGER  →  OK 18ms' },
      { l: 'BLE.CENTRAL', r: 'PAIRED · writing 512 B · 64% [████░░]', accent: true },
      { l: 'SEAT.WRITE',  r: 'B-07 · ko-KR  →  OK' },
      { l: 'LED',         r: 'pulse.amber  →  OK', accent: false },
    ],
  }[mode];

  return (
    <div data-screen-label={`Tablet · ${mode}`}
         style={{
      width: 960, height: 1280,
      background: t.bg, color: t.ink,
      fontFamily: t.sansFamily,
      display: 'flex', flexDirection: 'column',
      position: 'relative',
    }}>
      <TabletHeader t={t} mode={mode} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '40px 56px 24px', gap: 24 }}>
        {/* status chip strip */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <StatusChip t={t} kind={status}>{chipText}</StatusChip>
          <div style={{ display: 'flex', gap: 16 }}>
            <MonoLine t={t} letter={1.5}>ML · face_recognition v1.3</MonoLine>
            <MonoLine t={t} letter={1.5}>QUEUE · 0</MonoLine>
          </div>
        </div>

        {mode === 'idle' ? (
          <>
            <HeroFace t={t} mode="idle" subj={subj} />
            <IdleCallout t={t} />
          </>
        ) : (
          <>
            <HeroFace t={t} mode={mode} subj={subj} />
            <IDCard t={t} mode={mode} subj={subj} />
          </>
        )}
      </div>

      <TabletFooter t={t} lines={footer} />
    </div>
  );
}

// ── Admin Console ─────────────────────────────────────────────
function AdminConsole({ t }) {
  return (
    <div data-screen-label="Admin Console"
         style={{
      width: 1440, height: 900,
      background: t.bg, color: t.ink, fontFamily: t.sansFamily,
      display: 'grid', gridTemplateRows: 'auto 1fr',
    }}>
      {/* header */}
      <div style={{
        padding: '14px 28px',
        borderBottom: `1px solid ${t.ink}`,
        background: t.paper,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 24, height: 24, position: 'relative',
            border: `1.5px solid ${t.ink}`, borderRadius: '50%',
          }}>
            <div style={{
              position: 'absolute', inset: 5, border: `1.5px solid ${t.ink}`, borderRadius: '50%',
            }} />
          </div>
          <div style={{
            fontFamily: t.sansFamily, fontSize: 16, fontWeight: t.headerWeight,
            color: t.ink, letterSpacing: 0.4,
          }}>FACEPASS<span style={{ color: t.accent }}>·</span>operator</div>
          <div style={{
            fontFamily: t.monoFamily, fontSize: 10, color: t.mute,
            letterSpacing: 1.5,
          }}>v2.4.1 · build 0c91a · GATE G-04</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            ['face', 'ML'], ['ble', 'REAL'], ['serial', 'REAL'], ['ws', 'OK'],
          ].map(([k, v]) => (
            <div key={k} style={{
              fontFamily: t.monoFamily, fontSize: 10, padding: '5px 9px',
              border: `1px solid ${t.line}`, background: t.surface,
              letterSpacing: 1.5,
            }}>{k}: <strong style={{ color: v === 'OK' ? t.ink : t.ink }}>{v}</strong></div>
          ))}
        </div>
      </div>

      {/* main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr 420px', gap: 0 }}>
        {/* LEFT — procedural control */}
        <div style={{ borderRight: `1px solid ${t.line}`, padding: '24px 24px', background: t.paper }}>
          <SectionHeading t={t} num="01" en="PROCEDURE" ko="절차 제어" />
          {/* tabs */}
          <div style={{ display: 'flex', gap: 4, marginTop: 14 }}>
            {[['ISSUE','발급', true], ['ENTRY','입장', false], ['RETURN','반납', false]].map(([en, ko, on]) => (
              <div key={en} style={{
                padding: '8px 12px',
                background: on ? t.ink : t.surface,
                color: on ? (t.id === 'B' ? t.accent : t.paper) : t.ink,
                fontFamily: t.monoFamily, fontSize: 11, letterSpacing: 1.5,
                border: `1px solid ${t.ink}`,
                fontWeight: 600,
              }}>{en}<span style={{ opacity: on ? 0.7 : 0.6, marginLeft: 6, fontWeight: 400 }}>· {ko}</span></div>
            ))}
          </div>

          <div style={{ marginTop: 22 }}>
            <FormField t={t} label="좌석 · SEAT" value="B-07" focused />
            <FormField t={t} label="관객 이름 · NAME" value="서지윤" />
          </div>

          <div style={{ marginTop: 22 }}>
            <BigButton t={t} num="①" en="START · 얼굴 캡처 요청" enabled />
            <div style={{ height: 8 }} />
            <BigButton t={t} num="②" en="WRISTBAND TAGGED · BLE 기록" pending />
          </div>

          <div style={{ marginTop: 28 }}>
            <SectionHeading t={t} num="02" en="STATE" ko="상태" />
            <div style={{
              marginTop: 14, padding: '12px 14px',
              background: t.surface, border: `1px solid ${t.ink}`,
            }}>
              <StatusChip t={t} kind="scan">await_face · 얼굴 캡처 대기 (태블릿)</StatusChip>
              <div style={{ marginTop: 10 }}>
                <KV t={t} k="SESSION" v="iss·#0188" />
                <KV t={t} k="ELAPSED" v="00:02.84" />
                <KV t={t} k="WS · TABLET" v="OK · 1 client" />
              </div>
            </div>
          </div>
        </div>

        {/* CENTER — live preview + viz */}
        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 22 }}>
          <SectionHeading t={t} num="03" en="LIVE · TABLET MIRROR" ko="태블릿 미러" />

          <div style={{
            border: `1px solid ${t.ink}`, background: t.surface,
            display: 'grid', gridTemplateColumns: '300px 1fr', gap: 0,
          }}>
            <FacePortrait t={t} size={300} mode="live" label="TABLET · CAM01" sub="480×640 · live" />
            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <MonoLine t={t} size={10} letter={2}>EMBEDDING · 128-D · f32</MonoLine>
              {/* mini bars */}
              <DataBars t={t} data={Array.from({length: 64}, (_, i) =>
                Math.sin(i * 0.21) * 0.6 + Math.cos(i * 0.07) * 0.4 + (i % 5 - 2) * 0.1
              )} height={48} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <KV t={t} k="DIM"      v="128" />
                <KV t={t} k="‖e‖"      v="1.000" />
                <KV t={t} k="COS.SIM"  v="—" />
                <KV t={t} k="QUALITY"  v="0.92 / 1.0" />
                <KV t={t} k="CAPTURED" v="20:12:09.481" />
                <KV t={t} k="LATENCY"  v="184 ms" />
              </div>
            </div>
          </div>

          <SectionHeading t={t} num="04" en="ACTIVE ISSUES · 활성 발급 목록" ko="" />
          <Table t={t} rows={[
            ['#', 'WRIST.ID', '좌석 SEAT', '이름 NAME', '발급 ISSUED'],
            ['012', '04:7A:3F:09:C2:81', 'A-12', '김민준',  '2026-05-19 19:48:33'],
            ['011', '04:4D:2A:11:E8:55', 'A-13', '이서현',  '2026-05-19 19:46:11'],
            ['010', '04:8B:91:0A:6F:22', 'B-04', '박지훈',  '2026-05-19 19:42:50'],
            ['009', '04:3C:18:77:14:9A', 'C-09', '최유나',  '2026-05-19 19:38:02'],
          ]} />
        </div>

        {/* RIGHT — log feed */}
        <div style={{ borderLeft: `1px solid ${t.line}`, padding: '24px 24px', background: t.paper, display: 'flex', flexDirection: 'column' }}>
          <SectionHeading t={t} num="05" en="LOG · 실시간 로그" ko="" />
          <div style={{
            marginTop: 14, flex: 1,
            background: t.ink, color: t.paper,
            padding: '14px 16px',
            fontFamily: t.monoFamily, fontSize: 11, lineHeight: 1.55,
            overflow: 'hidden', letterSpacing: 0.4,
          }}>
            {[
              ['20:12:09.481', 'I', 'tablet → server: image (87.4 kB)'],
              ['20:12:09.665', 'I', 'face.extract → emb[128] ok · ‖e‖=1.000'],
              ['20:12:09.671', 'I', 'serial → arduino : NFC_WRITE BLE_TRIGGER'],
              ['20:12:09.689', 'I', 'arduino → serial : OK 18ms'],
              ['20:12:09.700', 'I', 'ble.central : scan… esp32-c3 wristband'],
              ['20:12:09.842', 'I', 'ble.central : paired · rssi -48 · 21.4 kB'],
              ['20:12:09.901', 'I', 'ble.write CHR_EMBEDDING (512 B / 64%)'],
              ['20:12:09.940', 'W', 'mtu negotiated 247 · 3 chunks'],
              ['20:12:10.064', 'I', 'ble.write CHR_SEAT "B-07" → OK'],
              ['20:12:10.080', 'I', 'led.pulse(amber) → OK'],
              ['20:12:10.085', 'I', 'ble.disconnect · session 0188 → DB'],
              ['20:12:10.090', 'I', 'sqlite : insert ok · id=12'],
              ['—',           '·', 'awaiting next NFC tag…'],
            ].map(([ts, lv, msg], i) => {
              const col = lv === 'W' ? t.accent : lv === 'E' ? t.accent : t.paper;
              return (
                <div key={i} style={{ display: 'flex', gap: 10, opacity: i < 12 ? 1 : 0.5 }}>
                  <span style={{ color: t.mute }}>{ts}</span>
                  <span style={{ color: col, width: 10 }}>{lv}</span>
                  <span style={{ color: lv === 'W' ? t.accent : t.paper }}>{msg}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ t, num, en, ko }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
      <span style={{
        fontFamily: t.monoFamily, fontSize: 12, color: t.accent,
        letterSpacing: 2, fontWeight: 600,
      }}>{num}</span>
      <span style={{
        fontFamily: t.sansFamily, fontSize: 15, color: t.ink,
        letterSpacing: 1.5, fontWeight: 600, textTransform: 'uppercase',
      }}>{en}</span>
      {ko && <span style={{
        fontFamily: t.sansFamily, fontSize: 14, color: t.mute,
      }}>{ko}</span>}
      <div style={{ flex: 1, borderTop: `1px solid ${t.line}`, height: 0, marginTop: 6 }} />
    </div>
  );
}

function FormField({ t, label, value, focused }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontFamily: t.monoFamily, fontSize: 11, color: t.mute,
        letterSpacing: 1.8, marginBottom: 6,
      }}>{label}</div>
      <div style={{
        padding: '11px 13px',
        background: t.surface,
        border: `1px solid ${focused ? t.ink : t.line}`,
        outline: focused ? `2px solid ${t.accent}33` : 'none',
        outlineOffset: -3,
        fontFamily: t.monoFamily, fontSize: 15, color: t.ink,
        position: 'relative',
      }}>
        {value}
        {focused && <span style={{
          display: 'inline-block', width: 8, height: 16,
          background: t.ink, marginLeft: 2, verticalAlign: -2,
        }} />}
      </div>
    </div>
  );
}

function BigButton({ t, num, en, enabled, pending }) {
  const isEnabled = enabled && !pending;
  return (
    <div style={{
      padding: '14px 16px',
      background: isEnabled ? t.ink : t.surface,
      color: isEnabled ? (t.id === 'B' ? t.accent : t.paper) : t.mute,
      border: `1px solid ${isEnabled ? t.ink : t.line}`,
      display: 'flex', alignItems: 'center', gap: 14,
      cursor: isEnabled ? 'pointer' : 'not-allowed',
    }}>
      <span style={{
        fontFamily: t.monoFamily, fontSize: 15, fontWeight: 600,
        letterSpacing: 1, opacity: pending ? 0.5 : 1,
      }}>{num}</span>
      <span style={{
        fontFamily: t.sansFamily, fontSize: 15, fontWeight: 600,
        letterSpacing: 0.5, flex: 1,
      }}>{en}</span>
      <span style={{
        fontFamily: t.monoFamily, fontSize: 11, letterSpacing: 2,
        opacity: 0.6,
      }}>{pending ? '— PENDING —' : (isEnabled ? '▸' : '✓ DONE')}</span>
    </div>
  );
}

function Table({ t, rows }) {
  return (
    <div style={{
      border: `1px solid ${t.line}`, background: t.surface,
      fontFamily: t.monoFamily, fontSize: 11,
    }}>
      {rows.map((row, i) => (
        <div key={i} style={{
          display: 'grid',
          gridTemplateColumns: '40px 220px 90px 1fr 200px',
          padding: '8px 14px',
          borderBottom: i < rows.length - 1 ? `1px solid ${t.line2}` : 'none',
          background: i === 0 ? t.paper : 'transparent',
          color: i === 0 ? t.mute : t.ink,
          fontSize: i === 0 ? 9 : 11,
          letterSpacing: i === 0 ? 2 : 0.3,
          textTransform: i === 0 ? 'uppercase' : 'none',
        }}>
          {row.map((c, j) => <div key={j}>{c}</div>)}
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { Tablet, AdminConsole, SectionHeading, FormField, BigButton, Table });
