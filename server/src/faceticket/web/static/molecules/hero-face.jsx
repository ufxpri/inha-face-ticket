window.FT = window.FT || {};
FT.molecules = FT.molecules || {};

// HeroFace — RadialViz ring + circular FacePortrait center.
// Source 'gradient' renders the abstract bust (admin mirror / static mocks).
// Source 'video' wires a <video> element through `videoRef` (tablet kiosk).
// `status` ∈ 'idle' | 'scan' | 'pass' | 'deny'. The inner portrait `mode`
// is derived from status (scan→live, pass→live, deny→deny, idle→idle).
function HeroFace({
  t, source = 'gradient', status = 'pass',
  size = 660, faceRatio = null,
  embedding = null, confidence = 0,
  seedKey = null, videoRef, embDim = 128,
}) {
  const { RadialViz, FacePortrait } = FT.atoms;
  const faceSize = Math.round(size * (faceRatio ?? 0.485));
  const portraitMode = status === 'idle' ? 'idle' : status === 'deny' ? 'deny' : 'live';

  // Seed: embedding-derived for live captures (so the viz visually responds to the face),
  // else a fixed per-status seed so static / static-style frames are stable.
  const seed = (() => {
    if (embedding && embedding.length > 0) {
      let s = 0;
      for (let i = 0; i < Math.min(16, embedding.length); i++) {
        s = (s * 131 + Math.floor(embedding[i] * 1000)) | 0;
      }
      return Math.abs(s) % 1000 + 1;
    }
    return { pass: 13, deny: 91, scan: 41, idle: 1 }[status] || (seedKey || 1);
  })();

  return (
    <div style={{
      position: 'relative', width: size, height: size, margin: '0 auto',
      flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <RadialViz t={t} size={size} dims={128} seed={seed}
                   confidence={confidence} status={status} faceSize={faceSize} />
      </div>

      <div style={{
        width: faceSize, height: faceSize, borderRadius: '50%',
        overflow: 'hidden', position: 'relative',
        boxShadow: status === 'deny' ? `inset 0 0 0 1px ${t.accent}` : `inset 0 0 0 1px ${t.ink}`,
        background: source === 'video' ? '#000' : 'transparent',
      }}>
        <FacePortrait t={t} source={source} size={faceSize} mode={portraitMode}
                      videoRef={videoRef}
                      label={status === 'idle' ? 'CAM01 · IDLE' : `CAM01 · ${status.toUpperCase()}`}
                      sub="480×640 · 30fps · v2.4" />
      </div>

      {status !== 'idle' && (
        <React.Fragment>
          <div style={{
            position: 'absolute', top: -26, left: '50%', transform: 'translateX(-50%)',
            fontFamily: t.monoFamily, fontSize: 11, color: t.mute, letterSpacing: 2,
          }}>embedding · {embDim}-d · f32</div>
          <div style={{
            position: 'absolute', bottom: -26, left: '50%', transform: 'translateX(-50%)',
            fontFamily: t.monoFamily, fontSize: 11, color: t.mute, letterSpacing: 2,
          }}>cos.sweep · {(confidence * 360).toFixed(0)}° / 360°</div>
        </React.Fragment>
      )}

      <div style={{ position: 'absolute', left: 0, right: 0, top: '50%',
                    height: 0, borderTop: `1px dashed ${t.line2}`, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%',
                    width: 0, borderLeft: `1px dashed ${t.line2}`, pointerEvents: 'none' }} />
    </div>
  );
}

FT.molecules.HeroFace = HeroFace;
