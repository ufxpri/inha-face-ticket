window.FT = window.FT || {};
FT.atoms = FT.atoms || {};

// Unified FacePortrait. `source` selects the visual:
//   'gradient' — abstract radial bust silhouette (was FacePortrait, used by admin mirror / static mocks)
//   'video'    — live <video> element via `videoRef` (was LiveFacePortrait, used by tablet kiosk)
// `mode`/`status` semantics: 'live' | 'idle' | 'deny' | 'scan'  (scan ~ live for portrait coloring)
function FacePortrait({
  t, source = 'gradient', mode = 'live', size = 360,
  label = 'SUBJECT.LIVE', sub = 'CAM01 · 480×640 · 30fps',
  flash = 0, videoRef,
}) {
  const isDeny = mode === 'deny';
  const isIdle = mode === 'idle';
  const isVideo = source === 'video';

  const headTone   = isDeny ? 'rgba(216,58,31,0.55)' : (isIdle ? 'rgba(0,0,0,0.10)' : 'rgba(0,0,0,0.62)');
  const headShadow = isDeny ? 'rgba(216,58,31,0.30)' : (isIdle ? 'rgba(0,0,0,0.04)' : 'rgba(0,0,0,0.35)');
  const ink = isDeny ? t.accent : t.ink;

  return (
    <div style={{
      position: 'relative', width: size, height: size,
      background: isVideo ? '#0a0807' : t.surface,
      border: isVideo ? 'none' : `1px solid ${t.line}`,
      overflow: 'hidden',
      fontFamily: t.monoFamily,
    }}>
      {isVideo ? (
        <video ref={videoRef} autoPlay playsInline muted style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'cover', transform: 'scaleX(-1)',
          filter: isIdle ? 'grayscale(1) brightness(0.55) contrast(1.05)'
                         : (isDeny ? 'sepia(0.4) saturate(0.7) brightness(0.85)' : 'none'),
        }} />
      ) : (
        <div style={{
          position: 'absolute', inset: 0,
          background: isIdle ? `
            repeating-linear-gradient(45deg, transparent 0 8px, ${t.line2} 8px 9px)
          ` : `
            radial-gradient(ellipse 30% 33% at 50% 36%, ${headTone}, transparent 65%),
            radial-gradient(ellipse 55% 32% at 50% 96%, ${headShadow}, transparent 60%),
            radial-gradient(circle at 50% 50%, ${t.surface}, ${t.paper} 80%)
          `,
        }} />
      )}

      {!isIdle && (
        <div style={{
          position: 'absolute', inset: 0,
          background: `repeating-linear-gradient(0deg, transparent 0 3px, ${isVideo ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.035)'} 3px 4px)`,
          pointerEvents: 'none',
        }} />
      )}

      {['tl','tr','bl','br'].map(corner => {
        const len = 18, w = 1.5;
        const pos = {
          tl: { top: 10, left: 10 }, tr: { top: 10, right: 10 },
          bl: { bottom: 10, left: 10 }, br: { bottom: 10, right: 10 },
        }[corner];
        return (
          <React.Fragment key={corner}>
            <div style={{ position: 'absolute', background: ink, ...pos, width: len, height: w }} />
            <div style={{ position: 'absolute', background: ink, ...pos, width: w, height: len }} />
          </React.Fragment>
        );
      })}

      {!isIdle && (
        <div style={{
          position: 'absolute',
          left: '32%', top: '22%', width: '36%', height: '40%',
          border: `1px ${isDeny ? 'solid' : 'dashed'} ${ink}`,
          boxShadow: isDeny ? `0 0 0 2px ${t.paper}, 0 0 0 3px ${t.accent}33` : 'none',
        }}>
          <div style={{
            position: 'absolute', top: -16, left: 0,
            fontSize: 9, color: ink, letterSpacing: 1.2,
            textShadow: isVideo ? '0 0 4px rgba(0,0,0,0.4)' : 'none',
          }}>FACE · {isDeny ? 'LOW QUALITY' : 'LOCKED'}</div>
          {!isDeny && !isVideo && [[28,38],[72,38],[50,58],[35,75],[65,75]].map(([x,y],i) => (
            <div key={i} style={{
              position: 'absolute', left: `${x}%`, top: `${y}%`,
              width: 4, height: 4, marginLeft: -2, marginTop: -2,
              border: `1px solid ${t.ink}`, background: t.paper,
            }} />
          ))}
        </div>
      )}

      <div style={{
        position: 'absolute', top: 10, left: 36, fontSize: 9,
        color: isVideo ? t.paper : t.mute, letterSpacing: 1.5,
        textShadow: isVideo ? '0 0 4px rgba(0,0,0,0.6)' : 'none',
      }}>{label}</div>
      <div style={{
        position: 'absolute', bottom: 10, left: 36, fontSize: 9,
        color: isVideo ? t.paper : t.mute, letterSpacing: 1.2,
        opacity: isVideo ? 0.85 : 1,
        textShadow: isVideo ? '0 0 4px rgba(0,0,0,0.6)' : 'none',
      }}>{sub}</div>
      <div style={{
        position: 'absolute', top: 10, right: 36, fontSize: 9,
        color: isIdle ? (isVideo ? t.paper : t.mute)
              : (isDeny ? t.accent : (isVideo ? t.paper : t.ink)),
        letterSpacing: 1.2,
        textShadow: isVideo ? '0 0 4px rgba(0,0,0,0.6)' : 'none',
      }}>
        {isIdle ? '— NO SUBJECT —' : (isDeny ? '◉ REC · ALERT' : '◉ REC')}
      </div>

      {flash > 0 && (
        <div style={{
          position: 'absolute', inset: 0, background: '#ffffff',
          opacity: flash, pointerEvents: 'none', mixBlendMode: 'screen',
        }} />
      )}
    </div>
  );
}

FT.atoms.FacePortrait = FacePortrait;
