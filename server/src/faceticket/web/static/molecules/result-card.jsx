window.FT = window.FT || {};
FT.molecules = FT.molecules || {};

// ResultCard — pass-issue / pass-entry / deny / issue-await-tag stamp + ID panel.
function ResultCard({ t, kind, subj, cosVal, fadedCos, threshold }) {
  const { KV, ZoneBadge } = FT.atoms;
  const ZONES = FT.data.ZONES;

  const conf = {
    'pass-entry': { title: '입장 허가', titleEn: 'ACCESS GRANTED', stamp: 'PASS',
                    sub: '게이트가 열립니다. 좌석 안내원의 인도를 따라주세요.',
                    stampBg: t.ink, stampFg: t.paper },
    'pass-issue': { title: '발급 완료',  titleEn: 'WRISTBAND READY', stamp: 'DONE',
                    sub: '팔찌에 좌석 정보와 얼굴 임베딩이 기록되었습니다. 공연장 안내에 따라 입장해 주세요.',
                    stampBg: t.ink, stampFg: t.paper },
    'pass-return': { title: '반납 완료', titleEn: 'WRISTBAND RETURNED', stamp: 'RTN',
                    sub: '팔찌 데이터가 초기화되었습니다. 안전히 귀가해 주세요. 보증금이 있다면 매표소에서 환급받으세요.',
                    stampBg: t.ink, stampFg: t.paper },
    'deny':       { title: '본인 확인 실패', titleEn: 'IDENTITY MISMATCH', stamp: 'DENY',
                    sub: '얼굴 임베딩이 발급 시 등록과 일치하지 않습니다. 1층 매표소에서 본인 확인 후 재발급 받으세요.',
                    stampBg: t.accent, stampFg: t.accentInk },
    'issue-await-tag': { title: '팔찌 태그 대기', titleEn: 'AWAITING WRISTBAND TAG', stamp: 'WAIT',
                    sub: '얼굴 임베딩 추출이 완료되었습니다. 발급 장치의 NFC 리더에 팔찌를 가까이 대주세요.',
                    stampBg: t.ink, stampFg: t.paper },
  }[kind];

  // kind 가 result view 가 아닌 경우 (FadeSlot 안에서 show=false 로 잠시 머무는 동안) — 빈 자리만 차지
  if (!conf) return <div />;

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
        <KV t={t} k="SUBJECT · 이름"  v={kind === 'deny' ? '— UNKNOWN —' : (subj.name + (subj.nameEn ? ' · ' + subj.nameEn : ''))} />
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

FT.molecules.ResultCard = ResultCard;
