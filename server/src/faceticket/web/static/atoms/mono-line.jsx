window.FT = window.FT || {};
FT.atoms = FT.atoms || {};

function MonoLine({ t, color, children, size = 12, weight = 400, letter = 1 }) {
  return (
    <div style={{
      fontFamily: t.monoFamily, fontSize: size, color: color || t.mute,
      letterSpacing: letter, fontWeight: weight,
    }}>{children}</div>
  );
}

FT.atoms.MonoLine = MonoLine;
