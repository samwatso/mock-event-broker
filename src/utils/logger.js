const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[(process.env.LOG_LEVEL || 'info').toLowerCase()] ?? 20;

function write(level, msg, extra = {}) {
  if ((LEVELS[level] ?? 0) < threshold) return;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...extra });
  if (level === 'error') process.stderr.write(line + '\n');
  else process.stdout.write(line + '\n');
}

module.exports = {
  debug: (msg, extra) => write('debug', msg, extra),
  info:  (msg, extra) => write('info',  msg, extra),
  warn:  (msg, extra) => write('warn',  msg, extra),
  error: (msg, extra) => write('error', msg, extra),
};
