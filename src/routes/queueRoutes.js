const express = require('express');
const store   = require('../services/eventStore');

const router = express.Router();

// POST /queues/:queue/messages  — enqueue a message
router.post('/:queue/messages', (req, res) => {
  const { queue } = req.params;
  const runId         = req.headers['x-run-id']         || req.query.runId         || null;
  const correlationId = req.headers['x-correlation-id'] || req.query.correlationId || null;
  const contentType   = req.headers['content-type']     || 'application/octet-stream';
  const payload       = req.rawBody ? req.rawBody.toString('utf8') : '';

  const message = store.enqueueMessage({ queue, runId, correlationId, contentType, payload });
  res
    .status(201)
    .set('x-message-id', message.id)
    .set('x-run-id', message.runId || '')
    .json(message);
});

// GET /queues/:queue/messages/next  — dequeue (consume) the oldest queued message (FIFO)
// Must be declared before /:id routes to avoid 'next' being treated as an id.
router.get('/:queue/messages/next', (req, res) => {
  const msg = store.dequeueNext(req.params.queue);
  if (!msg) return res.status(204).end(); // empty queue
  res.set('x-message-id', msg.id).json(msg);
});

// GET /queues/:queue/messages  — list messages with optional filters
router.get('/:queue/messages', (req, res) => {
  const { queue } = req.params;
  const { status, runId, correlationId, limit } = req.query;
  const messages = store.getQueueMessages(queue, { status, runId, correlationId, limit });
  res.json({ queue, count: messages.length, messages });
});

// POST /queues/:queue/messages/:id/ack  — mark a consumed message as acknowledged
router.post('/:queue/messages/:id/ack', (req, res) => {
  const msg = store.ackMessage(req.params.queue, req.params.id);
  if (!msg) return res.status(404).json({ error: 'not_found', id: req.params.id });
  res.json(msg);
});

// POST /queues/:queue/messages/:id/nack  — mark a consumed message as dead-letter
router.post('/:queue/messages/:id/nack', (req, res) => {
  const reason = (req.body && req.body.reason) ? req.body.reason : null;
  const msg = store.nackMessage(req.params.queue, req.params.id, reason);
  if (!msg) return res.status(404).json({ error: 'not_found', id: req.params.id });
  res.json(msg);
});

// DELETE /queues/:queue/messages  — clear all messages for a queue
router.delete('/:queue/messages', (req, res) => {
  store.clearQueueMessages(req.params.queue);
  res.json({ cleared: true, queue: req.params.queue });
});

module.exports = router;
