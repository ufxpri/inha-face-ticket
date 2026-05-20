// concert-scenes.jsx — Tablet + Admin scenes for the concert version.
// Single visual direction (Lab Notebook). Tablet = 1080×1440 portrait.
// Admin = 1600×1000 landscape.

function CTabletHeader({ t, mode }) {
  const modeLabel = {
    idle:  ['STANDBY',       '대기 중'],
    pass:  ['ENTRY · MATCH', '본인 확인 완료'],
    deny:  ['ENTRY · DENY',  '본인 확인 실패'],
    issue: ['ISSUE',         '발급 모드'],
  }[mode];
  const time = mode === 'idle' ? '19:13:01' : mode === 'pass' ? '19:48:33' : mode === 'deny' ? '19:50:17' : '15:24:09';
  const seq  = mode === 'idle' ? '#2490' : mode === 'pass' ? '#2491' : mode === 'deny' ? '#2492' : '#0188';
  return (
    <div style={{
      display: 'flex', alignItems: 'stretch', justifyContent: 'space-between',
      borderBottom: `1px solid ${t.ink}`,
      padding: '14px 32px', gap: 24,
      background: t.paper,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 24, height: 24, position: 'relative',
          border: `1.5px solid ${t.ink}`, borderRadius: '50%',
        }}>
          <div style={{ position: 'absolute', inset: 4,
            border: `1.5px solid ${t.ink}`, borderRadius: '50%' }} />
        </div>
        <div style={{
          fontFamily: t.sansFamily, fontWeight: 600,
          fontSize: 17, color: t.ink, letterSpacing: 0.5,
        }}>FACEPASS<span style={{ color: t.accent }}>·</span>kiosk</div>
        <div style={{
          fontFamily: t.monoFamily, fontSize: 11, color: t.mute, letterSpacing: 1.5,
        }}>GATE G-04 · 메인 입장 · {modeLabel[0]} / {modeLabel[1]}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{
          fontFamily: t.monoFamily, fontSize: 11, color: t.mute, letterSpacing: 1.5,
        }}>seq {seq} · KST</div>
        <div style={{
          fontFamily: t.monoFamily, fontSize: 22, color: t.ink, fontWeight: 500, letterSpacing: 1,
        }}>{time}</div>
      </div>
    </div>
  );
}

function CTabletFooter({ t, lines }) {
  return (
    <div style={{
      borderTop: `1px solid ${t.line}`,
      background: t.paper,
      padding: '14px 32px',
      display: 'flex', flexDirection: 'column', gap: 5,
    }}>
      {lines.map((line, i) => (
        <div key={i} style={{
          display: 'flex', justifyContent: 'space-between',
          fontFamily: t.monoFamily, fontSize: 11.5, color: line.dim ? t.mute : t.ink,
          letterSpacing: 1.2,
        }}>
          <span>{line.l}</span>
          <span style={{ color: line.accent ? t.accent : (line.dim ? t.mute : t.ink) }}>{line.r}</span>
        </div>
      ))}
    </div>
  );
}

function CIDCard({ t, mode, subj }) {
  const title = mode === 'pass' ? '입장 허가' : mode === 'deny' ? '본인 확인 실패' : '팔찌 발급 중';
  const titleEn = mode === 'pass' ? 'ACCESS GRANTED' : mode === 'deny' ? 'IDENTITY MISMATCH' : 'WRITING WRISTBAND';
  const stamp   = mode === 'pass' ? 'PASS' : mode === 'deny' ? 'DENY' : 'REC';
  const stampBg = mode === 'deny' ? t.accent : t.ink;
  const stampFg = mode === 'deny' ? t.accentInk : t.paper;
  const subBody = mode === 'pass' ? '게이트가 열립니다. 좌석 안내원의 인도를 따라주세요.' :
                  mode === 'deny' ? '얼굴 임베딩이 발급 시 등록과 일치하지 않습니다. 1층 매표소에서 본인 확인 후 재발급 받으세요.' :
                                    '팔찌에 얼굴 임베딩(512 B)과 좌석·구역 정보를 기록하고 있습니다.';

  return (
    <div style={{
      border: `1px solid ${t.ink}`,
      background: t.surface,
      padding: '20px 24px',
      display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 28,
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute', top: -1, right: -1,
        background: stampBg, color: stampFg,
        fontFamily: t.monoFamily, fontSize: 12, letterSpacing: 2.5, fontWeight: 700,
        padding: '6px 13px',
      }}>{stamp}</div>

      <div>
        <div style={{
          fontFamily: t.monoFamily, fontSize: 12, color: t.mute, letterSpacing: 2.5,
        }}>{titleEn}</div>
        <div style={{
          fontFamily: t.sansFamily, fontSize: 40,
          fontWeight: 700, color: t.ink, letterSpacing: -0.6,
          marginTop: 4, lineHeight: 1.05,
        }}>{title}</div>
        <div style={{
          marginTop: 16,
          fontFamily: t.sansFamily, fontSize: 15, color: t.ink2, lineHeight: 1.5,
        }}>{subBody}</div>

        <div style={{ marginTop: 20 }}>
          <ZoneBadge t={t} zone={subj.zone} big />
        </div>

        <div style={{
          marginTop: 16,
          fontFamily: t.monoFamily, fontSize: 12, color: t.mute, letterSpacing: 1.5,
        }}>
          TICKET · <span style={{ color: t.ink, fontWeight: 600 }}>{subj.ticketId}</span>
          <span style={{ marginLeft: 12 }}>ISSUED · {subj.issued}</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <KV t={t} k="SUBJECT · 이름"   v={mode === 'deny' ? '— UNKNOWN —' : `${subj.name} · ${subj.nameEn}`} />
        <KV t={t} k="SEAT · 좌석"      v={subj.seat} big />
        <KV t={t} k="ZONE · 구역"      v={ZONES[subj.zone].ko + ' / ' + ZONES[subj.zone].en} />
        <KV t={t} k="WRIST.ID"         v={subj.wristId} />
        <KV t={t} k="COS.SIM"          v={subj.cos != null ? subj.cos.toFixed(3) : '— writing —'} accent={mode==='deny'} />
        <KV t={t} k="THRESHOLD"        v="0.620" />
      </div>
    </div>
  );
}

function CHeroFace({ t, mode, subj, size = 600 }) {
  const status = mode === 'idle' ? 'idle' : mode === 'deny' ? 'deny' : (mode === 'issue' ? 'scan' : 'pass');
  const portraitMode = mode === 'idle' ? 'idle' : (mode === 'deny' ? 'deny' : 'live');
  const faceSize = Math.round(size * 0.48);
  const seed = mode === 'pass' ? 13 : mode === 'deny' ? 91 : mode === 'issue' ? 41 : 1;
  const confidence = mode === 'pass' ? 0.96 : mode === 'deny' ? 0.41 : mode === 'issue' ? 0.78 : 0;

  return (
    <div style={{
      position: 'relative',
      width: size, height: size,
      margin: '0 auto',
      flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <RadialViz t={t} size={size} dims={128} seed={seed}
                   confidence={confidence} status={status} faceSize={faceSize} />
      </div>
      <div style={{
        width: faceSize, height: faceSize, borderRadius: '50%',
        overflow: 'hidden', position: 'relative',
        boxShadow: status === 'deny' ? `inset 0 0 0 1px ${t.accent}` : `inset 0 0 0 1px ${t.ink}`,
      }}>
        <FacePortrait t={t} size={faceSize} mode={portraitMode}
                      label={mode === 'idle' ? 'CAM01 · IDLE' : `CAM01 · ${mode.toUpperCase()}`}
                      sub="480×640 · 30fps · v2.4" />
      </div>

      {mode !== 'idle' && (
        <>
          <div style={{
            position: 'absolute', top: -26, left: '50%', transform: 'translateX(-50%)',
            fontFamily: t.monoFamily, fontSize: 11, color: t.mute, letterSpacing: 2,
          }}>
            embedding · 128-d · f32
          </div>
          <div style={{
            position: 'absolute', bottom: -26, left: '50%', transform: 'translateX(-50%)',
            fontFamily: t.monoFamily, fontSize: 11, color: t.mute, letterSpacing: 2,
          }}>
            cos.sweep · {(confidence * 360).toFixed(0)}° / 360°
          </div>
        </>
      )}
      <div style={{ position: 'absolute', left: 0, right: 0, top: '50%',
        height: 0, borderTop: `1px dashed ${t.line2}`, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%',
        width: 0, borderLeft: `1px dashed ${t.line2}`, pointerEvents: 'none' }} />
    </div>
  );
}

function CIdleCallout({ t }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <StatusChip t={t} kind="idle">STANDBY · 입장 대기 / WAITING FOR TAG</StatusChip>
      <div style={{
        fontFamily: t.sansFamily, fontSize: 60, fontWeight: 700,
        color: t.ink, marginTop: 18, lineHeight: 1, letterSpacing: -1,
      }}>팔찌를 태그하세요</div>
      <div style={{
        fontFamily: t.monoFamily, fontSize: 16, color: t.mute, marginTop: 10,
        letterSpacing: 2.5,
      }}>TAG YOUR WRISTBAND TO ENTER</div>
    </div>
  );
}

function TabletConcert({ t, mode = 'pass' }) {
  const subj = CSUBJECTS[mode] || CSUBJECTS.pass;
  const status = mode === 'idle' ? 'idle' : mode === 'deny' ? 'deny' : mode === 'issue' ? 'scan' : 'pass';
  const chipText = mode === 'pass'  ? '입장 허가 · ACCESS GRANTED · 본인 확인 완료' :
                   mode === 'deny'  ? '입장 거부 · ACCESS DENIED · 매표소 안내' :
                   mode === 'issue' ? '팔찌 발급 · WRITING WRISTBAND' :
                                      'STANDBY · 입장 대기 / WAITING';

  const footer = {
    idle: [
      { l: 'NFC.READER',  r: 'READY · 0 evt/s · last tag 00:04:12 ago',  dim: true },
      { l: 'BLE.CENTRAL', r: 'IDLE · scan paused',                        dim: true },
      { l: 'GATE.SERVO',  r: 'CLOSED · 0°',                               dim: true },
      { l: 'CAPACITY',    r: 'FLOOR 612 / 980 · MEZZ 240 / 800 · BALC 395 / 1240' },
    ],
    pass: [
      { l: 'NFC.READER',  r: 'TAG 04:7A:3F:09:C2:81  →  read 12 ms' },
      { l: 'BLE.CENTRAL', r: 'PAIRED · RSSI -48 · embedding read 21.4 kB' },
      { l: 'GATE.SERVO',  r: 'OPEN · 90° · ultrasonic pass detected 384 ms', accent: true },
      { l: 'WRIST.LED',   r: 'pulse.red → FLOOR · OK · queued for ENCORE flash' },
    ],
    deny: [
      { l: 'NFC.READER',  r: 'TAG 04:7A:3F:09:C2:81  →  read 11 ms' },
      { l: 'BLE.CENTRAL', r: 'PAIRED · RSSI -52 · embedding read 21.4 kB' },
      { l: 'GATE.SERVO',  r: 'CLOSED · DENY · retry 1/3 · 1F 매표소 호출 OK', accent: true },
      { l: 'COS.SIM',     r: '0.412 < 0.620 · 본인 확인 실패', accent: true },
    ],
    issue: [
      { l: 'NFC.READER',  r: 'WRITE BLE_TRIGGER  →  OK 18 ms' },
      { l: 'BLE.CENTRAL', r: 'PAIRED · writing 512 B  ▰▰▰▰▱▱ 64%', accent: true },
      { l: 'SEAT.WRITE',  r: 'MZ·B / R07·S11 · ZN.MEZ  →  pending' },
      { l: 'LED.PRESET',  r: 'pulse.white (MEZZ) · queued · OK' },
    ],
  }[mode];

  return (
    <div data-screen-label={`Tablet · ${mode}`}
         style={{
      width: 1080, height: 1440,
      background: t.bg, color: t.ink, fontFamily: t.sansFamily,
      display: 'flex',
    }}>
      <TicketStub t={t} ticketId={subj.ticketId} seat={subj.seat} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <CTabletHeader t={t} mode={mode} />
        <ShowStrip t={t} />

        <div style={{ flex: 1, padding: '22px 36px 18px', display: 'flex', flexDirection: 'column', gap: 18, minHeight: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <StatusChip t={t} kind={status}>{chipText}</StatusChip>
            <div style={{ display: 'flex', gap: 14 }}>
              <MonoLine t={t} letter={1.5}>ML · face_recognition v1.3</MonoLine>
              <MonoLine t={t} letter={1.5}>QUEUE · {mode === 'pass' ? '1' : '0'}</MonoLine>
            </div>
          </div>

          {mode === 'idle' ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <ShowCountdown t={t} label="DOORS · 입장 개시" time="19:00" />
                <ShowCountdown t={t} label="SHOW · 공연 시작 T-MINUS" time="00:47:00" accent />
                <ShowCountdown t={t} label="ENCORE · 앙코르 예상" time="22:10" />
              </div>
              <CHeroFace t={t} mode="idle" subj={subj} size={380} />
              <CIdleCallout t={t} />
              <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 14 }}>
                <StageMap t={t} highlightSection="FL-A" highlightSeat={[12, 3]} />
                <SetlistPanel t={t} current={-1} compact />
              </div>
            </>
          ) : (
            <>
              <CHeroFace t={t} mode={mode} subj={subj} size={580} />
              <CIDCard t={t} mode={mode} subj={subj} />
            </>
          )}
        </div>

        <CTabletFooter t={t} lines={footer} />
      </div>
    </div>
  );
}

function AdminConcert({ t }) {
  return (
    <div data-screen-label="Admin · concert"
         style={{
      width: 1600, height: 1000,
      background: t.bg, color: t.ink, fontFamily: t.sansFamily,
      display: 'grid', gridTemplateRows: 'auto auto 1fr',
    }}>
      <div style={{
        padding: '12px 28px',
        borderBottom: `1px solid ${t.ink}`,
        background: t.paper,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 22, height: 22, position: 'relative',
            border: `1.5px solid ${t.ink}`, borderRadius: '50%',
          }}>
            <div style={{ position: 'absolute', inset: 4, border: `1.5px solid ${t.ink}`, borderRadius: '50%' }} />
          </div>
          <div style={{
            fontFamily: t.sansFamily, fontSize: 17, fontWeight: 600,
            color: t.ink, letterSpacing: 0.4,
          }}>FACEPASS<span style={{ color: t.accent }}>·</span>operator</div>
          <div style={{
            fontFamily: t.monoFamily, fontSize: 11.5, color: t.mute, letterSpacing: 1.5,
          }}>v2.4.1 · GATE G-04 · OPERATOR · 박서연</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['face','ML'],['ble','REAL'],['serial','REAL'],['ws','OK'],['ntp','SYNC']].map(([k,v]) => (
            <div key={k} style={{
              fontFamily: t.monoFamily, fontSize: 12, padding: '6px 11px',
              border: `1px solid ${t.line}`, background: t.surface,
              letterSpacing: 1.5,
            }}>{k}: <strong style={{ color: t.ink }}>{v}</strong></div>
          ))}
        </div>
      </div>

      <ShowStrip t={t} />

      <div style={{
        display: 'grid',
        gridTemplateColumns: '380px 1fr 460px',
        minHeight: 0,
      }}>
        <div style={{
          borderRight: `1px solid ${t.line}`, padding: '20px 22px',
          background: t.paper, overflow: 'hidden',
        }}>
          <SectionHeading t={t} num="01" en="PROCEDURE" ko="절차 제어" />
          <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
            {[['ISSUE','발급', true], ['ENTRY','입장', false], ['RETURN','반납', false]].map(([en, ko, on]) => (
              <div key={en} style={{
                padding: '7px 11px',
                background: on ? t.ink : t.surface,
                color: on ? t.paper : t.ink,
                fontFamily: t.monoFamily, fontSize: 11, letterSpacing: 1.5,
                border: `1px solid ${t.ink}`, fontWeight: 600,
              }}>{en}<span style={{ opacity: on ? 0.7 : 0.6, marginLeft: 6, fontWeight: 400 }}>· {ko}</span></div>
            ))}
          </div>

          <div style={{ marginTop: 18 }}>
            <FormField t={t} label="좌석 · SEAT" value="MZ·B / R07·S11" focused />
            <FormField t={t} label="구역 · ZONE" value="ZN.MEZ · MEZZANINE" />
            <FormField t={t} label="관객 이름 · NAME" value="서지윤" />
            <FormField t={t} label="티켓 · TICKET ID" value="NF-26-0512-0917" />
          </div>

          <div style={{ marginTop: 16 }}>
            <BigButton t={t} num="①" en="START · 얼굴 캡처 요청" enabled />
            <div style={{ height: 8 }} />
            <BigButton t={t} num="②" en="WRISTBAND TAGGED · BLE 기록" pending />
          </div>

          <div style={{ marginTop: 22 }}>
            <SectionHeading t={t} num="02" en="STATE · 상태" ko="" />
            <div style={{
              marginTop: 12, padding: '12px 14px',
              background: t.surface, border: `1px solid ${t.ink}`,
            }}>
              <StatusChip t={t} kind="scan">await_face · 얼굴 캡처 대기</StatusChip>
              <div style={{ marginTop: 8 }}>
                <KV t={t} k="SESSION" v="iss·#0188" />
                <KV t={t} k="ELAPSED" v="00:02.84" />
                <KV t={t} k="WS · TABLET" v="OK · 1 client" />
              </div>
            </div>
          </div>
        </div>

        <div style={{
          padding: '20px 26px', display: 'flex', flexDirection: 'column', gap: 16,
          overflow: 'hidden',
        }}>
          <SectionHeading t={t} num="03" en="CAPACITY · 입장 현황" ko="" />
          <CapacityGauge t={t} attended={1247} capacity={3200}
            perSection={[
              ['ZN.PIT  · 입석',   '140',  '180'],
              ['ZN.FLR · 플로어',  '612',  '980'],
              ['ZN.MEZ · 메자닌',  '240',  '800'],
              ['ZN.BAL · 발코니',  '255', '1240'],
            ]} />

          <SectionHeading t={t} num="04" en="TABLET MIRROR · LIVE" ko="" />
          <div style={{
            border: `1px solid ${t.ink}`, background: t.surface,
            display: 'grid', gridTemplateColumns: '260px 1fr', gap: 0,
          }}>
            <FacePortrait t={t} size={260} mode="live" label="TABLET · CAM01" sub="480×640 · live" />
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <MonoLine t={t} size={10} letter={2}>EMBEDDING · 128-D · f32</MonoLine>
              <DataBars t={t} data={Array.from({length: 80}, (_, i) =>
                Math.sin(i * 0.21) * 0.6 + Math.cos(i * 0.07) * 0.4 + (i % 5 - 2) * 0.1
              )} height={42} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                <KV t={t} k="DIM"      v="128" />
                <KV t={t} k="‖e‖"      v="1.000" />
                <KV t={t} k="QUALITY"  v="0.92" />
                <KV t={t} k="LATENCY"  v="184 ms" />
                <KV t={t} k="CAPTURED" v="19:48:09" />
                <KV t={t} k="COS.SIM"  v="—" />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, minHeight: 0 }}>
            <StageMap t={t} highlightSection="FL-A" highlightSeat={[7, 4]} />
            <ShowtimeTimeline t={t} current="19:48" />
          </div>
        </div>

        <div style={{
          borderLeft: `1px solid ${t.line}`, padding: '20px 22px',
          background: t.paper, display: 'flex', flexDirection: 'column', gap: 14,
          overflow: 'hidden',
        }}>
          <SectionHeading t={t} num="05" en="SETLIST · 셋리스트" ko="" />
          <SetlistPanel t={t} current={-1} />

          <SectionHeading t={t} num="06" en="LOG · 실시간 로그" ko="" />
          <div style={{
            flex: 1, background: t.ink, color: t.paper,
            padding: '12px 14px',
            fontFamily: t.monoFamily, fontSize: 12.5, lineHeight: 1.55,
            overflow: 'hidden', letterSpacing: 0.3,
          }}>
            {[
              ['19:48:33.481', 'I', 'tablet → server: image (87.4 kB)'],
              ['19:48:33.665', 'I', 'face.extract → emb[128] · ‖e‖=1.000 · q=0.92'],
              ['19:48:33.671', 'I', 'serial → arduino : NFC_WRITE BLE_TRIGGER'],
              ['19:48:33.689', 'I', 'arduino → serial : OK 18ms'],
              ['19:48:33.700', 'I', 'ble.central : scan… esp32-c3 7A3F·09C2'],
              ['19:48:33.842', 'I', 'ble.central : paired · rssi -48 · 21.4 kB'],
              ['19:48:33.901', 'I', 'ble.read  CHR_EMBEDDING (512 B / 100%)'],
              ['19:48:33.940', 'I', 'cos.sim(stored, live) = 0.964 ≥ 0.620 PASS'],
              ['19:48:34.014', 'I', 'serial → arduino : GATE OPEN'],
              ['19:48:34.398', 'I', 'arduino → serial : OK PASS (us 384ms)'],
              ['19:48:34.420', 'I', 'ble.write CHR_LED pulse.red (FLOOR)'],
              ['19:48:34.440', 'I', 'ble.disconnect · session 0091 → DB'],
              ['19:48:34.445', 'I', 'sqlite : entry ok · ticket NF-26-0512-0188'],
              ['19:48:34.450', 'I', 'capacity : FLOOR 611→612 · TOTAL 1246→1247'],
              ['—',            '·', 'awaiting next NFC tag…'],
            ].map(([ts, lv, msg], i) => {
              const col = lv === 'W' ? t.accent : lv === 'E' ? t.accent : t.paper;
              return (
                <div key={i} style={{ display: 'flex', gap: 10, opacity: i < 14 ? 1 : 0.5 }}>
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

Object.assign(window, { TabletConcert, AdminConcert, CTabletHeader, CTabletFooter, CIDCard, CHeroFace, CIdleCallout });
