const express = require('express');
const store   = require('../services/eventStore');

const router = express.Router();

// GET /admin/health  — liveness probe (no auth)
router.get('/health', (req, res) => {
  res.json({
    status:   'ok',
    service:  'mock-event-broker',
    ts:       new Date().toISOString(),
    topics:   store.listTopics().length,
    queues:   store.listQueues().length,
  });
});

// GET /admin/topics  — list topic names that have received events
router.get('/topics', (req, res) => {
  res.json({ topics: store.listTopics() });
});

// GET /admin/queues  — list queue names that have received messages
router.get('/queues', (req, res) => {
  res.json({ queues: store.listQueues() });
});

// GET /admin/events  — all events across all topics with optional filters
router.get('/events', (req, res) => {
  const { runId, correlationId, topic, status, limit } = req.query;
  const events = store.getAllEvents({ runId, correlationId, topic, status, limit });
  res.json({ count: events.length, events });
});

// DELETE /admin/events  — clear all topic events
router.delete('/events', (req, res) => {
  store.clearTopicEvents();
  res.json({ cleared: true, scope: 'all_events' });
});

// GET /admin/messages  — all queue messages across all queues with optional filters
router.get('/messages', (req, res) => {
  const { runId, correlationId, queue, status, limit } = req.query;
  const messages = store.getAllMessages({ runId, correlationId, queue, status, limit });
  res.json({ count: messages.length, messages });
});

// DELETE /admin/messages  — clear all queue messages
router.delete('/messages', (req, res) => {
  store.clearQueueMessages();
  res.json({ cleared: true, scope: 'all_messages' });
});

// DELETE /admin/reset  — clear everything (events + messages)
router.delete('/reset', (req, res) => {
  store.resetAll();
  res.json({ cleared: true, scope: 'all' });
});

// POST /admin/assert/events  — poll until matching events exist (or timeout)
router.post('/assert/events', async (req, res) => {
  const {
    topic,
    runId,
    correlationId,
    minCount = 1,
    maxWaitMs = 30000,
    pollMs    = 500,
  } = req.body || {};

  const deadline = Date.now() + Number(maxWaitMs);
  while (Date.now() < deadline) {
    const events = store.getAllEvents({ runId, correlationId, topic });
    if (events.length >= Number(minCount)) {
      return res.json({ passed: true, count: events.length, events: events.slice(0, 10) });
    }
    await new Promise(r => setTimeout(r, Number(pollMs)));
  }
  const events = store.getAllEvents({ runId, correlationId, topic });
  res.status(408).json({ passed: false, count: events.length, wanted: Number(minCount) });
});

// POST /admin/assert/messages  — poll until matching queue messages exist (or timeout)
router.post('/assert/messages', async (req, res) => {
  const {
    queue,
    runId,
    correlationId,
    status,
    minCount = 1,
    maxWaitMs = 30000,
    pollMs    = 500,
  } = req.body || {};

  const deadline = Date.now() + Number(maxWaitMs);
  while (Date.now() < deadline) {
    const messages = store.getAllMessages({ runId, correlationId, queue, status });
    if (messages.length >= Number(minCount)) {
      return res.json({ passed: true, count: messages.length, messages: messages.slice(0, 10) });
    }
    await new Promise(r => setTimeout(r, Number(pollMs)));
  }
  const messages = store.getAllMessages({ runId, correlationId, queue, status });
  res.status(408).json({ passed: false, count: messages.length, wanted: Number(minCount) });
});

module.exports = router;
