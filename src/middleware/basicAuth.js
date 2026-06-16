const crypto = require('crypto');

function timingSafe(a, b) {
  const bA = Buffer.from(a);
  const bB = Buffer.from(b);
  if (bA.length !== bB.length) {
    crypto.timingSafeEqual(bA, bA);
    return false;
  }
  return crypto.timingSafeEqual(bA, bB);
}

function parseBasic(authHeader) {
  if (!authHeader || !authHeader.startsWith('Basic ')) return null;
  const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
  const colon = decoded.indexOf(':');
  if (colon < 0) return null;
  return { user: decoded.slice(0, colon), pass: decoded.slice(colon + 1) };
}

function mockAuth() {
  let users = [];
  if (process.env.MOCK_USERS) {
    try { users = JSON.parse(process.env.MOCK_USERS); } catch (_) {}
  }
  if (!users.length && process.env.MOCK_USER) {
    users = [{ u: process.env.MOCK_USER, p: process.env.MOCK_PASSWORD || '' }];
  }

  return (req, res, next) => {
    if (!users.length) return next(); // dev mode: no auth configured
    const creds = parseBasic(req.headers.authorization);
    if (!creds) {
      return res.status(401).set('WWW-Authenticate', 'Basic realm="mock-event-broker"').json({ error: 'unauthorized' });
    }
    const match = users.find(u => timingSafe(u.u, creds.user) && timingSafe(u.p, creds.pass));
    if (!match) return res.status(401).json({ error: 'unauthorized' });
    req.authUser = creds.user;
    next();
  };
}

function adminAuth({ exempt = [] } = {}) {
  const adminUser = process.env.ADMIN_USER || '';
  const adminPass = process.env.ADMIN_PASSWORD || '';

  return (req, res, next) => {
    if (exempt.some(e => req.path === e || req.path.startsWith(e + '/'))) return next();
    if (!adminUser) return next(); // dev mode: no admin auth configured
    const creds = parseBasic(req.headers.authorization);
    if (!creds) {
      return res.status(401).set('WWW-Authenticate', 'Basic realm="mock-event-broker-admin"').json({ error: 'unauthorized' });
    }
    if (!timingSafe(adminUser, creds.user) || !timingSafe(adminPass, creds.pass)) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    next();
  };
}

module.exports = { mockAuth, adminAuth };
