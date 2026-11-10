const byId = (id) => document.getElementById(id);
const refresh = byId('refresh');
let busy = false;
async function update() {
  if (busy) return;
  busy = true;
  refresh.disabled = true;
  const started = performance.now();
  try {
    const response = await fetch('/metadata', { cache: 'no-store', signal: AbortSignal.timeout(4000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    byId('pod').textContent = data.pod;
    byId('uptime').textContent = `${data.uptimeSeconds}s`;
    byId('version').textContent = data.version;
    byId('uid').textContent = data.uid === null ? 'N/A (host)' : String(data.uid);
    byId('latency').textContent = `${Math.round(performance.now() - started)} ms`;
    byId('status').textContent = data.ready ? 'Ready' : 'Draining';
    byId('status').classList.toggle('error', !data.ready);
    byId('detail').textContent = `${data.runtime} · Updated ${new Date().toLocaleTimeString()} · Refreshes every 5 seconds.`;
  } catch (error) {
    byId('status').textContent = 'Unavailable';
    byId('status').classList.add('error');
    byId('detail').textContent = `Refresh failed: ${error.message}. Displayed values may be stale. Retrying automatically.`;
  } finally {
    busy = false;
    refresh.disabled = false;
  }
}
refresh.addEventListener('click', update);
update();
setInterval(update, 5000);
