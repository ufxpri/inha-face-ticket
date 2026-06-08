const { useCallback } = React;

function AdminApp() {
  const t = FT.theme.A;
  const s = FT.hooks.useAdminState();
  const { send, wsOk } = FT.hooks.useAdminWebSocket({
    appendLog: s.appendLog,
    onState: s.handleState,
    onFlags: s.setFlags,
    onEmbedding: s.handleEmbedding,
  });

  const actStart = useCallback(() => {
    s.setSeq(n => n + 1);
    s.setLastEmbedding(null);
    s.setLastCapturedAt('');
    if (s.mode === 'issue') {
      const filled = s.fillRandomIfEmpty();
      send({ type: 'issue_start', seat: filled.seat, name: filled.name });
    } else if (s.mode === 'entry') {
      send({ type: 'entry_start' });
    } else if (s.mode === 'return') {
      send({ type: 'return_start' });
    }
  }, [s.mode, send, s.fillRandomIfEmpty]);

  const actCancel = useCallback(() => send({ type: 'cancel' }), [send]);
  const toggleLayer = useCallback((layer, newMock) => send({ type: 'toggle', layer, mock: newMock }), [send]);
  const ioConnect    = useCallback((role, port) => send({ type: 'io_connect', role, port }), [send]);
  const ioDisconnect = useCallback(role => send({ type: 'io_disconnect', role }), [send]);
  const ioRefresh    = useCallback(() => send({ type: 'io_refresh_ports' }), [send]);
  const ledSend = useCallback(command => send({ type: 'led', command }), [send]);
  const ledStop = useCallback(() => send({ type: 'led_stop' }), [send]);

  const timeStr = `${String(s.now.getHours()).padStart(2,'0')}:${String(s.now.getMinutes()).padStart(2,'0')}`;
  const state = {
    ...s, wsOk, tabletClients: 1, timeStr,
    actStart, actCancel, toggleLayer,
    ioConnect, ioDisconnect, ioRefresh,
    ledSend, ledStop,
  };

  return (
    <FT.lib.Scaler width={1600} height={1000}>
      <FT.admin.AdminLive t={t} state={state} />
    </FT.lib.Scaler>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<AdminApp />);
