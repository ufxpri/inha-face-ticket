window.FT = window.FT || {};
FT.atoms = FT.atoms || {};

// FormField supports both static (read-only display) and interactive (with onChange) usage.
// If `onChange` is provided, renders an <input>; otherwise renders a static value.
function FormField({ t, label, value, onChange, focused, placeholder, disabled }) {
  const interactive = typeof onChange === 'function';
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontFamily: t.monoFamily, fontSize: 11, color: t.mute,
        letterSpacing: 1.8, marginBottom: 6,
      }}>{label}</div>
      {interactive ? (
        <input type="text" value={value || ''} onChange={e => onChange(e.target.value)}
               disabled={disabled} placeholder={placeholder}
               style={{
          width: '100%',
          padding: '11px 13px',
          background: disabled ? t.paper : t.surface,
          border: `1px solid ${focused ? t.ink : t.line}`,
          outline: 'none',
          fontFamily: t.monoFamily, fontSize: 15, color: t.ink,
          boxSizing: 'border-box',
        }} />
      ) : (
        <div style={{
          padding: '11px 13px',
          background: t.surface,
          border: `1px solid ${focused ? t.ink : t.line}`,
          outline: focused ? `2px solid ${t.accent}33` : 'none',
          outlineOffset: -3,
          fontFamily: t.monoFamily, fontSize: 15, color: t.ink,
          position: 'relative',
        }}>
          {value}
          {focused && <span style={{
            display: 'inline-block', width: 8, height: 16,
            background: t.ink, marginLeft: 2, verticalAlign: -2,
          }} />}
        </div>
      )}
    </div>
  );
}

FT.atoms.FormField = FormField;
