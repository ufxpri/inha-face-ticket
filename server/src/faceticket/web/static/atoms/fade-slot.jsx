window.FT = window.FT || {};
FT.atoms = FT.atoms || {};

// FadeSlot — 고정 height 컨테이너 + position: relative 자리잡기. 자식(FadeSlot.Item) 은
// absolute 로 겹쳐서 opacity 만 전환되므로 view 가 바뀌어도 layout 이 튀지 않는다.
//
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

// FadeSlot.Item — absolute inset:0 + opacity transition. 부모가 반드시 `FadeSlot` 일
// 필요는 없다 — `position: relative` 만 갖는 어떤 컨테이너 안에서도 동작한다.
// (예: tablet-live 의 info zone 은 `flex: 1, position: relative` 한 일반 div 이고
//  그 안에 두 Item 이 형제로 들어가 idle/result 를 페이드한다.)
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
