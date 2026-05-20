// app-common.jsx — tablet-app.jsx 와 admin-app.jsx 가 공유하는 atom.
// 디자인 패키지의 외부 jsx 들은 그대로 두고, 우리 entry 두 개에서 중복되던 부분만 추출.

const { useState: _useState, useEffect: _useEffect, useRef: _useRef } = React;

// 1080×1440 / 1600×1000 고정 아트보드를 현재 뷰포트에 맞게 균일 축소.
function Scaler({ width, height, children }) {
  const wrapRef = _useRef(null);
  const [scale, setScale] = _useState(1);
  _useEffect(() => {
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

window.Scaler = Scaler;
