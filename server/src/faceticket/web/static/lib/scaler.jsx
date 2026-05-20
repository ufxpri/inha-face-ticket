window.FT = window.FT || {};
FT.lib = FT.lib || {};

function Scaler({ width, height, children }) {
  const { useState, useEffect, useRef } = React;
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const compute = () => {
      const el = wrapRef.current; if (!el) return;
      setScale(Math.min(el.clientWidth / width, el.clientHeight / height));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [width, height]);
  return (
    <div ref={wrapRef} style={{
      position: 'fixed', inset: 0, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: '#0a0807', overflow: 'hidden',
    }}>
      <div style={{
        width, height, flexShrink: 0,
        transform: `scale(${scale})`, transformOrigin: 'center center',
        boxShadow: '0 30px 100px rgba(0,0,0,0.6)',
      }}>
        {children}
      </div>
    </div>
  );
}

FT.lib.Scaler = Scaler;
