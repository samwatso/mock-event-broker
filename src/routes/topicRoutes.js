const express = require('express');
const store   = require('../services/eventStore');

const router = express.Router();

// POST /topics/:topic/events  — publish an event
router.post('/:topic/events', (req, res) => {
  const { topic } = req.params;
  const runId         = req.headers['x-run-id']         || req.query.runId         || null;
  const correlationId = req.headers['x-correlation-id'] || req.query.correlationId || null;
  const contentType   = req.headers['content-type']     || 'application/octet-stream';
  const payload       = req.rawBody ? req.rawBody.toString('utf8') : '';

  const event = store.publishEvent({ topic, runId, correlationId, contentType, payload });
  res
    .status(201)
    .set('x-event-id', event.id)
    .set('x-run-id', event.runId || '')
    .json(event);
});

// GET /topics/:topic/events  — list events for a topic
router.get('/:topic/events', (req, res) => {
  const { topic } = req.params;
  const { runId, correlationId, since, limit } = req.query;
  const events = store.getTopicEvents(topic, { runId, correlationId, since, limit });
  res.json({ topic, count: events.length, events });
});

// DELETE /topics/:topic/events  — clear all events for a topic
router.delete('/:topic/events', (req, res) => {
  store.clearTopicEvents(req.params.topic);
  res.json({ cleared: true, topic: req.params.topic });
});

module.exports = router;
