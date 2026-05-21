function TabletApp() {
  const t = FT.theme.A;
  const s = FT.hooks.useTabletViewState();

  // subj — merges live capture data (view-dependent) with operator inputs.
  const subj = {
    name: s.nameInput || '서지윤',
    nameEn: s.nameInput ? '' : 'Ji-Yoon Seo',
    seat: s.seatInput || 'MZ·B / R07·S11',
    zone: (() => {
      const v = (s.seatInput || '').toUpperCase();
      if (v.startsWith('FL') || v.startsWith('A')) return 'FLOOR';
      if (v.startsWith('PIT')) return 'PIT';
      if (v.startsWith('BAL')) return 'BALC';
      return 'MEZZ';
    })(),
    wristId: '4D2A·11E8',
    ticketId: 'NF-26-0512-' + String(s.seq).padStart(4, '0'),
    issued: '2026·04·01',
    embedding: s.embedding,
    cos: s.view === 'pass-entry' ? 0.964 : s.view === 'deny' ? 0.412 : null,
  };
  const footer = (FT.tablet.FOOTERS[s.view] || FT.tablet.FOOTERS.idle)({ subj, cosineThreshold: s.cosineThreshold });

  return (
    <FT.lib.Scaler width={1080} height={1440}>
      <FT.tablet.TabletLive
        t={t} view={s.view} seq={s.seq} subj={subj}
        videoRef={s.videoRef} countdown={s.countdown}
        footer={footer} cosineThreshold={s.cosineThreshold}
      />
    </FT.lib.Scaler>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<TabletApp />);
