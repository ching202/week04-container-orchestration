import { createApp } from './app.mjs';

const port = Number(process.env.PORT || 8080);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}
const { server, beginDrain } = createApp();
server.listen(port, '0.0.0.0', () => {
  console.log(JSON.stringify({ event: 'listening', port, uid: process.getuid?.() ?? null }));
});

let stopping = false;
function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  beginDrain();
  console.log(JSON.stringify({ event: 'draining', signal }));
  // Keep serving during endpoint propagation, then finish existing requests.
  const deadline = setTimeout(() => process.exit(1), 20_000);
  deadline.unref();
  setTimeout(() => {
    server.close(() => {
      clearTimeout(deadline);
      console.log(JSON.stringify({ event: 'stopped' }));
    });
  }, 5_000);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
