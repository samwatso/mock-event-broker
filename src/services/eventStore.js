const crypto = require('crypto');

const MAX_EVENTS   = parseInt(process.env.MAX_EVENTS   || '1000', 10);
const MAX_MESSAGES = parseInt(process.env.MAX_MESSAGES || '500',  10);

// topic  → Event[]    newest-first
const topicEvents   = new Map();
// queue  → Message[]  newest-first
const queueMessages = new Map();

function makeId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

// ── Topics (fire-and-forget publish) ─────────────────────────────────────────

function publishEvent({ topic, runId, correlationId, contentType, payload }) {
  const event = {
    id:            makeId('evt'),
    topic,
    runId:         runId         || null,
    correlationId: correlationId || null,
    contentType:   contentType   || 'application/octet-stream',
    payload,
    status:        'published',
    publishedAt:   new Date().toISOString(),
  };
  if (!topicEvents.has(topic)) topicEvents.set(topic, []);
  const list = topicEvents.get(topic);
  list.unshift(event);
  if (list.length > MAX_EVENTS) list.length = MAX_EVENTS;
  return event;
}

function getTopicEvents(topic, { runId, correlationId, since, limit = 50 } = {}) {
  return (topicEvents.get(topic) || [])
    .filter(e => {
      if (runId         && e.runId         !== runId)         return false;
      if (correlationId && e.correlationId !== correlationId) return false;
      if (since         && e.publishedAt   <  since)          return false;
      return true;
    })
    .slice(0, Math.min(Number(limit) || 50, 500));
}

function clearTopicEvents(topic) {
  if (topic) topicEvents.delete(topic);
  else       topicEvents.clear();
}

function listTopics() { return [...topicEvents.keys()]; }

// ── Queues (point-to-point with ack/nack state) ───────────────────────────────

function enqueueMessage({ queue, runId, correlationId, contentType, payload }) {
  const message = {
    id:            makeId('msg'),
    queue,
    runId:         runId         || null,
    correlationId: correlationId || null,
    contentType:   contentType   || 'application/octet-stream',
    payload,
    status:        'queued',
    enqueuedAt:    new Date().toISOString(),
    consumedAt:    null,
    ackedAt:       null,
    nackReason:    null,
  };
  if (!queueMessages.has(queue)) queueMessages.set(queue, []);
  const list = queueMessages.get(queue);
  list.unshift(message);
  if (list.length > MAX_MESSAGES) list.length = MAX_MESSAGES;
  return message;
}

function getQueueMessages(queue, { status, runId, correlationId, limit = 50 } = {}) {
  return (queueMessages.get(queue) || [])
    .filter(m => {
      if (status        && m.status        !== status)        return false;
      if (runId         && m.runId         !== runId)         return false;
      if (correlationId && m.correlationId !== correlationId) return false;
      return true;
    })
    .slice(0, Math.min(Number(limit) || 50, 500));
}

// Returns the oldest queued message and marks it consumed (FIFO).
function dequeueNext(queue) {
  const list = queueMessages.get(queue) || [];
  // list is newest-first, so oldest queued is the last matching entry
  const reversed = [...list].reverse();
  const idx = reversed.findIndex(m => m.status === 'queued');
  if (idx < 0) return null;
  const realIdx = list.length - 1 - idx;
  list[realIdx].status     = 'consumed';
  list[realIdx].consumedAt = new Date().toISOString();
  return list[realIdx];
}

function getMessageById(queue, id) {
  return (queueMessages.get(queue) || []).find(m => m.id === id) || null;
}

function ackMessage(queue, id) {
  const msg = getMessageById(queue, id);
  if (!msg) return null;
  msg.status  = 'acknowledged';
  msg.ackedAt = new Date().toISOString();
  return msg;
}

function nackMessage(queue, id, reason) {
  const msg = getMessageById(queue, id);
  if (!msg) return null;
  msg.status     = 'dead-letter';
  msg.nackReason = reason || null;
  msg.ackedAt    = new Date().toISOString();
  return msg;
}

function clearQueueMessages(queue) {
  if (queue) queueMessages.delete(queue);
  else       queueMessages.clear();
}

function listQueues() { return [...queueMessages.keys()]; }

// ── Cross-store queries ───────────────────────────────────────────────────────

function getAllEvents({ runId, correlationId, topic, status, limit = 100 } = {}) {
  const results = [];
  for (const [t, events] of topicEvents) {
    for (const e of events) {
      if (topic         && t             !== topic)         continue;
      if (runId         && e.runId       !== runId)         continue;
      if (correlationId && e.correlationId !== correlationId) continue;
      if (status        && e.status      !== status)        continue;
      results.push(e);
    }
  }
  results.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return results.slice(0, Math.min(Number(limit) || 100, 1000));
}

function getAllMessages({ runId, correlationId, queue, status, limit = 100 } = {}) {
  const results = [];
  for (const [q, messages] of queueMessages) {
    for (const m of messages) {
      if (queue         && q              !== queue)         continue;
      if (runId         && m.runId        !== runId)         continue;
      if (correlationId && m.correlationId !== correlationId) continue;
      if (status        && m.status       !== status)        continue;
      results.push(m);
    }
  }
  results.sort((a, b) => b.enqueuedAt.localeCompare(a.enqueuedAt));
  return results.slice(0, Math.min(Number(limit) || 100, 1000));
}

function resetAll() {
  topicEvents.clear();
  queueMessages.clear();
}

function printStats() {
  const stats = {
    topics:   listTopics().length,
    queues:   listQueues().length,
    events:   getAllEvents({ limit: 9999 }).length,
    messages: getAllMessages({ limit: 9999 }).length,
  };
  process.stdout.write(JSON.stringify(stats, null, 2) + '\n');
}

module.exports = {
  publishEvent, getTopicEvents, clearTopicEvents, listTopics,
  enqueueMessage, getQueueMessages, dequeueNext, getMessageById,
  ackMessage, nackMessage, clearQueueMessages, listQueues,
  getAllEvents, getAllMessages, resetAll, printStats,
};
