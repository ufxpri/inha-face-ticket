window.FT = window.FT || {};
FT.molecules = FT.molecules || {};

function TicketStub({ t, ticketId = 'NF-26-0512-0188', seat = 'FL·A / R12·S03' }) {
  const SHOW = FT.data.SHOW;
  return (
    <div style={{
      width: 56,
      borderRight: `1px dashed ${t.ink}`,
      background: t.paper, position: 'relative',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'space-between',
      padding: '24px 0', flexShrink: 0,
    }}>
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

FT.molecules.TicketStub = TicketStub;
