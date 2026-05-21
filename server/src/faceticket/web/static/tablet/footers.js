window.FT = window.FT || {};
FT.tablet = FT.tablet || {};

// Per-view footer telemetry. Tablet kiosk reads from this map and passes
// `{ subj, cosineThreshold }` so dynamic values (seat/zone/cos/threshold)
// land in the rendered line.
FT.tablet.FOOTERS = {
  'pass-entry': () => [
    { l: 'NFC.READER',  r: 'TAG 04:7A:3F:09:C2:81 → read 12 ms' },
    { l: 'BLE.CENTRAL', r: 'PAIRED · RSSI -48 · embedding read 21.4 kB' },
    { l: 'GATE.SERVO',  r: 'OPEN · 90° · ultrasonic pass detected 384 ms', accent: true },
    { l: 'WRIST.LED',   r: 'pulse.red → FLOOR · OK' },
  ],
  'pass-issue': ({ subj }) => [
    { l: 'NFC.READER',  r: 'WRITE BLE_TRIGGER → OK 18 ms' },
    { l: 'BLE.CENTRAL', r: 'PAIRED · wrote 512 B  ▰▰▰▰▰▰ 100%', accent: true },
    { l: 'SEAT.WRITE',  r: subj.seat + ' · ZN.' + subj.zone + ' → OK' },
    { l: 'LED.PRESET',  r: 'pulse.white (MEZZ) · queued · OK' },
  ],
  'deny': ({ subj, cosineThreshold }) => [
    { l: 'NFC.READER',  r: 'TAG 04:7A:3F:09:C2:81 → read 11 ms' },
    { l: 'BLE.CENTRAL', r: 'PAIRED · RSSI -52 · embedding read 21.4 kB' },
    { l: 'GATE.SERVO',  r: 'CLOSED · DENY · retry 1/3 · 1F 매표소 호출 OK', accent: true },
    { l: 'COS.SIM',     r: `${(subj.cos ?? 0.412).toFixed(3)} < ${cosineThreshold.toFixed(3)} · 본인 확인 실패`, accent: true },
  ],
  'capturing-issue': () => [
    { l: 'TABLET',      r: 'getUserMedia 640×480 30fps · streaming → server' },
    { l: 'WS.UPLINK',   r: 'JPEG q85 · ≈ 60 kB / frame', accent: true },
    { l: 'ML',          r: 'facenet-pytorch · MTCNN → InceptionResnetV1' },
    { l: 'CAPTURE',     r: 'countdown 3·2·1 → image → embedding 512-d f32' },
  ],
  'issue-await-tag': ({ subj }) => [
    { l: 'EMBEDDING',   r: '512-d · ‖e‖=1.000 · captured', accent: true },
    { l: 'NFC.READER',  r: 'READY · waiting for wristband tag…' },
    { l: 'BLE.CENTRAL', r: 'IDLE · scan paused' },
    { l: 'SEAT.PENDING', r: subj.seat + ' · ZN.' + subj.zone },
  ],
  'idle': () => [
    { l: 'NFC.READER',  r: 'READY · 0 evt/s · last tag 00:04:12 ago', dim: true },
    { l: 'BLE.CENTRAL', r: 'IDLE · scan paused', dim: true },
    { l: 'GATE.SERVO',  r: 'CLOSED · 0°', dim: true },
    { l: 'CAPACITY',    r: 'FLOOR 612 / 980 · MEZZ 240 / 800 · BALC 395 / 1240' },
  ],
};
FT.tablet.FOOTERS['capturing-entry'] = FT.tablet.FOOTERS['capturing-issue'];

FT.tablet.FOOTERS['pass-return'] = ({ subj }) => [
  { l: 'NFC.READER',  r: 'CLEAR → OK 14 ms' },
  { l: 'BLE.CENTRAL', r: 'PAIRED · embedding zero·write 21.4 kB · OK', accent: true },
  { l: 'WRIST.ID',    r: subj.wristId + ' · session closed' },
  { l: 'LED.PRESET',  r: 'pulse.amber → return · OK' },
];
