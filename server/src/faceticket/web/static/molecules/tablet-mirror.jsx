window.FT = window.FT || {};
FT.molecules = FT.molecules || {};

// TabletMirror — small live preview of the kiosk on the operator console.
// Background flips between hatched (no capture) and ink (capture present).
function TabletMirror({ t, embedding, latency, capturedAt, cos }) {
  const { MonoLine, KV, DataBars } = FT.atoms;
  return (
    <div style={{
      border: `1px solid ${t.ink}`, background: t.surface,
      display: 'grid', gridTemplateColumns: '260px 1fr', gap: 0,
    }}>
      <div style={{
        width: 260, height: 220,
        background: embedding ? t.ink : t.paper,
        backgroundImage: embedding ? 'none'
          : `repeating-linear-gradient(45deg, transparent 0 8px, ${t.line2} 8px 9px)`,
        position: 'relative',
        borderRight: `1px solid ${t.line}`,
      }}>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontFamily: t.monoFamily, fontSize: 11,
          color: embedding ? t.paper : t.mute, letterSpacing: 2,
        }}>
          {embedding ? '◉ CAPTURED' : '— NO SUBJECT —'}
        </div>
        <div style={{ position: 'absolute', top: 8, left: 12,
                      fontFamily: t.monoFamily, fontSize: 9,
                      color: embedding ? t.paper : t.mute,
                      letterSpacing: 1.5, opacity: 0.85 }}>TABLET · CAM01</div>
        <div style={{ position: 'absolute', bottom: 8, left: 12,
                      fontFamily: t.monoFamily, fontSize: 9,
                      color: embedding ? t.paper : t.mute,
                      letterSpacing: 1.2, opacity: 0.85 }}>480×640 · 30fps</div>
      </div>
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <MonoLine t={t} size={10} letter={2}>EMBEDDING · 512-D · f32</MonoLine>
        {embedding ? (
          <DataBars t={t}
            data={embedding.filter((_, i) => i % 6 === 0)}
            height={42} />
        ) : (
          <div style={{
            height: 42, border: `1px dashed ${t.line}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: t.monoFamily, fontSize: 10, color: t.mute, letterSpacing: 2,
          }}>— NO CAPTURE — 태블릿에서 얼굴 캡처 시 표시 —</div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <KV t={t} k="DIM"      v="512" />
          <KV t={t} k="‖e‖"      v={embedding ? '1.000' : '—'} />
          <KV t={t} k="QUALITY"  v={embedding ? '0.92' : '—'} />
          <KV t={t} k="LATENCY"  v={latency || '—'} />
          <KV t={t} k="CAPTURED" v={capturedAt || '—'} />
          <KV t={t} k="COS.SIM"  v={cos || '—'} />
        </div>
      </div>
    </div>
  );
}

FT.molecules.TabletMirror = TabletMirror;
