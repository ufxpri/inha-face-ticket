window.FT = window.FT || {};
FT.molecules = FT.molecules || {};

function IdleCallout({ t }) {
  const { StatusChip } = FT.atoms;
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

FT.molecules.IdleCallout = IdleCallout;
