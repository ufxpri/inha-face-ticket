window.FT = window.FT || {};
FT.atoms = FT.atoms || {};

function DataBars({ t, data, height = 24, color }) {
  const max = Math.max(1e-3, ...data.map(Math.abs));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height, width: '100%' }}>
      {data.map((v, i) => {
        const h = (Math.abs(v) / max) * height;
        return (
          <div key={i} style={{
            flex: 1, height: h, background: v >= 0 ? (color || t.ink) : t.mute,
          }} />
        );
      })}
    </div>
  );
}

FT.atoms.DataBars = DataBars;
