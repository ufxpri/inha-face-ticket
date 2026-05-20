window.FT = window.FT || {};
FT.atoms = FT.atoms || {};

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

FT.atoms.Table = Table;
