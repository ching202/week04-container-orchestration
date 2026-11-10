try {
  const response = await fetch(`http://127.0.0.1:${process.env.PORT || 8080}/healthz`, {
    signal: AbortSignal.timeout(2000),
  });
  const payload = await response.json();
  process.exit(response.status === 200 && payload.status === 'ok' ? 0 : 1);
} catch { process.exit(1); }
