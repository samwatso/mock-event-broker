const express    = require('express');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const logger     = require('./utils/logger');
const topicRoutes  = require('./routes/topicRoutes');
const queueRoutes  = require('./routes/queueRoutes');
const adminRoutes  = require('./routes/adminRoutes');
const { mockAuth, adminAuth } = require('./middleware/basicAuth');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());

  app.use(rateLimit({
    windowMs:       60 * 1000,
    max:            200,
    standardHeaders: true,
    legacyHeaders:  false,
  }));

  // Capture raw body byte-for-byte so event payloads (XML, JSON, binary) are
  // preserved exactly. Admin JSON endpoints still get a parsed body below.
  app.use(express.raw({ type: () => true, limit: '5mb' }));
  app.use((req, res, next) => {
    if (Buffer.isBuffer(req.body)) {
      req.rawBody = req.body;
      const ct = (req.headers['content-type'] || '').toLowerCase();
      if (ct.includes('application/json') && req.rawBody.length > 0) {
        try { req.body = JSON.parse(req.rawBody.toString('utf8')); }
        catch (_) { req.body = {}; }
      } else {
        req.body = {};
      }
    }
    next();
  });

  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      logger.info('request', {
        method:     req.method,
        path:       req.originalUrl,
        status:     res.statusCode,
        durationMs: Date.now() - start,
        authUser:   req.authUser || null,
      });
    });
    next();
  });

  app.get('/', (req, res) => {
    res.json({
      service: 'mock-event-broker',
      version: '1.0.0',
      topics: {
        publish:    'POST /topics/:topic/events',
        list:       'GET  /topics/:topic/events?runId=&correlationId=&since=&limit=',
        clear:      'DELETE /topics/:topic/events',
      },
      queues: {
        enqueue:    'POST /queues/:queue/messages',
        list:       'GET  /queues/:queue/messages?status=&runId=&correlationId=&limit=',
        dequeue:    'GET  /queues/:queue/messages/next',
        ack:        'POST /queues/:queue/messages/:id/ack',
        nack:       'POST /queues/:queue/messages/:id/nack  body: { "reason": "..." }',
        clear:      'DELETE /queues/:queue/messages',
      },
      admin: {
        health:          'GET    /admin/health  (no auth)',
        topics:          'GET    /admin/topics',
        queues:          'GET    /admin/queues',
        allEvents:       'GET    /admin/events?runId=&topic=&status=&limit=',
        clearEvents:     'DELETE /admin/events',
        allMessages:     'GET    /admin/messages?runId=&queue=&status=&limit=',
        clearMessages:   'DELETE /admin/messages',
        reset:           'DELETE /admin/reset',
        assertEvents:    'POST   /admin/assert/events   body: { topic, runId, minCount, maxWaitMs }',
        assertMessages:  'POST   /admin/assert/messages body: { queue, runId, status, minCount, maxWaitMs }',
      },
    });
  });

  // /topics and /queues — authenticated with MOCK_USERS (publisher/consumer credentials)
  app.use('/topics', mockAuth(), topicRoutes);
  app.use('/queues', mockAuth(), queueRoutes);

  // /admin — separate admin credential; /health is exempt
  app.use('/admin', adminAuth({ exempt: ['/health'] }), adminRoutes);

  app.use((req, res) => {
    res.status(404).json({ error: 'not_found', path: req.originalUrl });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    logger.error('Unhandled error', { err: err.message, stack: err.stack });
    if (res.headersSent) return;
    res.status(500).json({ error: 'internal_error', message: err.message });
  });

  return app;
}

module.exports = { createApp };
