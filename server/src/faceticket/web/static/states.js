// states.js — Python states.py 의 미러. window 에 노출하여 JSX 가 가져다 쓴다.
// 값을 바꿀 때는 양쪽을 함께 수정. JSX 진입 전에 (Babel script 보다 앞서) 로드한다.

window.STATE = Object.freeze({
  IDLE:              'idle',
  AWAIT_FACE:        'await_face',
  AWAIT_TAG:         'await_tag',
  AWAIT_FACE_ENTRY:  'await_face_entry',
  DONE:              'done',
});

window.FLOW = Object.freeze({
  ISSUE:  'issue',
  ENTRY:  'entry',
  RETURN: 'return',
});
