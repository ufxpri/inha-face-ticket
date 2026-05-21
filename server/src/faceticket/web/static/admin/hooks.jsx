window.FT = window.FT || {};
FT.hooks = FT.hooks || {};

const { useState: _useState, useEffect: _useEffect, useRef: _useRef, useCallback: _useCallback } = React;

// useAdminWebSocket — connects to /ws/admin, parses incoming frames into structured updates.
function useAdminWebSocket({ appendLog, onState, onFlags, onEmbedding }) {
  const wsRef = _useRef(null);
  const [wsOk, setWsOk] = _useState(false);

  _useEffect(() => {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${location.host}/ws/admin`);
    wsRef.current = ws;
    ws.onopen  = () => { setWsOk(true); appendLog('ws.admin : connected'); };
    ws.onclose = () => { setWsOk(false); appendLog('ws.admin : closed', 'warn'); };
    ws.onerror = () => { appendLog('ws.admin : error', 'error'); };
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.type === 'hello' || m.type === 'flags') {
        const dev = m.device_status || { connected: false, port: null };
        onFlags({
          ml: !!m.ml,
          bleMock: !!m.ble_mock,
          faceAvailable: !!m.face_available,
          bleAvailable: !!m.ble_available,
          deviceStatus:   dev,
          availablePorts: Array.isArray(m.available_ports) ? m.available_ports : [],
        });
        if (m.type === 'hello') {
          const ac = dev.connected ? `operator@${dev.port}` : 'none';
          appendLog(`hello · face=${m.ml?'ML':'stub'} · ble=${m.ble_mock?'mock':'real'} · io=${ac}`);
        }
      } else if (m.type === 'log') {
        appendLog(m.msg, m.level || 'info');
      } else if (m.type === 'state') {
        onState(m.state);
      } else if (m.type === 'embedding') {
        onEmbedding(m.embedding, m.captured_at || '');
      }
    };
    return () => ws.close();
  }, [appendLog, onState, onFlags, onEmbedding]);

  const send = _useCallback(obj => {
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify(obj));
    }
  }, []);

  return { wsOk, send };
}

// useAdminState — the operator console's reducer-shaped state container.
function useAdminState() {
  const [mode, setMode] = _useState('issue');
  const [fsmState, setFsmState] = _useState('idle');
  const [form, setForm] = _useState({ seat: '', zone: '', name: '', ticketId: '' });
  const [log, setLog] = _useState([]);
  const [flags, setFlags] = _useState({
    ml: true, bleMock: true,
    faceAvailable: true, bleAvailable: true,
    deviceStatus:   { connected: false, port: null },
    availablePorts: [],
  });
  const [seq, setSeq] = _useState(188);
  const [lastEmbedding, setLastEmbedding] = _useState(null);
  const [lastCapturedAt, setLastCapturedAt] = _useState('');
  const [startTs, setStartTs] = _useState(null);
  const [elapsed, setElapsed] = _useState('00:00.00');
  const [now, setNow] = _useState(() => new Date());

  _useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 500);
    return () => clearInterval(id);
  }, []);

  _useEffect(() => {
    if (!startTs) { setElapsed('00:00.00'); return; }
    const id = setInterval(() => {
      const ms = Date.now() - startTs;
      const s = Math.floor(ms / 1000);
      const cs = Math.floor((ms % 1000) / 10);
      setElapsed(`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}.${String(cs).padStart(2,'0')}`);
    }, 50);
    return () => clearInterval(id);
  }, [startTs]);

  const appendLog = _useCallback((msg, level = 'info') => {
    const d = new Date();
    const ts = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}.${String(d.getMilliseconds()).padStart(3,'0')}`;
    setLog(prev => [...prev.slice(-200), { ts, level, msg }]);
  }, []);

  const handleState = _useCallback(newState => {
    setFsmState(newState);
    if (newState !== 'idle' && newState !== 'done') {
      setStartTs(prev => prev || Date.now());
    } else {
      setStartTs(null);
    }
  }, []);

  const handleEmbedding = _useCallback((emb, capturedAt) => {
    setLastEmbedding(emb);
    setLastCapturedAt(capturedAt);
  }, []);

  const setFormField = _useCallback((k, v) => setForm(prev => ({ ...prev, [k]: v })), []);

  // Fill empty form fields with random demo values, return the merged set.
  const fillRandomIfEmpty = _useCallback(() => {
    const pick = a => a[Math.floor(Math.random() * a.length)];
    const pad = (n, w) => String(n).padStart(w, '0');
    const [zPrefix, zLabel] = pick(FT.data.RANDOM_ZONES);
    const block = String.fromCharCode(65 + Math.floor(Math.random() * 4));
    const row = 1 + Math.floor(Math.random() * 18);
    const seatNo = 1 + Math.floor(Math.random() * 12);
    const seat = `${zPrefix}·${block} / R${pad(row,2)}·S${pad(seatNo,2)}`;
    const [nameKo] = pick(FT.data.RANDOM_NAMES);
    const ticket = `NF-26-${pad(1 + Math.floor(Math.random()*12),2)}${pad(1 + Math.floor(Math.random()*28),2)}-${pad(Math.floor(Math.random()*10000),4)}`;
    const next = {
      seat:     form.seat.trim()     || seat,
      zone:     form.zone.trim()     || zLabel,
      name:     form.name.trim()     || nameKo,
      ticketId: form.ticketId.trim() || ticket,
    };
    setForm(next);
    return next;
  }, [form]);

  return {
    mode, setMode, fsmState,
    form, setFormField, fillRandomIfEmpty,
    flags, setFlags,
    seq, setSeq,
    lastEmbedding, lastCapturedAt, setLastEmbedding, setLastCapturedAt,
    log, appendLog,
    elapsed, now,
    handleState, handleEmbedding,
  };
}

FT.hooks.useAdminWebSocket = useAdminWebSocket;
FT.hooks.useAdminState = useAdminState;
