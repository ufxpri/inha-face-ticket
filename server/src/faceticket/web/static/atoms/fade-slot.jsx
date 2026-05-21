window.FT = window.FT || {};
FT.atoms = FT.atoms || {};

// FadeSlot — 고정 height 의 컨테이너. children 은 absolute 로 겹쳐서 opacity 만 전환되므로
// view 가 바뀌어도 위/아래 컨텐츠가 점프하지 않는다.
//
// 사용:
//   <FadeSlot height={130}>
//     <FadeSlot.Item show={isIdle}><CountdownGrid /></FadeSlot.Item>
//     <FadeSlot.Item show={isCapturing}><CaptureTitle /></FadeSlot.Item>
//   </FadeSlot>
function FadeSlot({ height, children, style }) {
  return (
    <div style={{
      position: 'relative', height,
      flexShrink: 0,
      ...style,
    }}>
      {children}
    </div>
  );
}

function FadeItem({ show, children, duration = 280, style }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      opacity: show ? 1 : 0,
      pointerEvents: show ? 'auto' : 'none',
      transition: `opacity ${duration}ms ease`,
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
      ...style,
    }}>
      {children}
    </div>
  );
}

FadeSlot.Item = FadeItem;
FT.atoms.FadeSlot = FadeSlot;
