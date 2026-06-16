# mock-event-broker

The event backbone that's ready before the customer's is — topics and queues
over plain HTTP, standing in for the messaging fabric your iFlow expects.

## Why this exists

Every integration lives in a *landscape*: a cast of systems strung together,
with middleware (SAP Integration Suite / CPI) as the stage manager wiring them
up. A source over here, a target over there, a third party or two waiting in the
wings, and the middleware running the whole show.

The catch is that the cast is almost never all on stage at once. The customer's
landscape is half-built. The third-party endpoint isn't open yet. Sandbox access
is "a couple of weeks away." You've got a four-tier landscape and exactly two of
the systems actually exist.

You can't put the build on hold until everyone shows up — so this is the
**stand-in**: a believable double for the missing system that speaks the right
protocol, answers the way the real one would, and lets the middleware run the
scene end to end. Prove the concept, demo the flow, test the unhappy paths today,
with the systems you *don't* have. When the real platform finally walks on set,
you repoint the adapter and the iFlow never notices the difference.

## What it stands in for

The **event / messaging backbone**, over HTTP so it needs no Cloud Connector:

- **Topics** — fire-and-forget publish, then read back what was published.
- **Queues** — point-to-point with a full lifecycle: enqueue, dequeue (FIFO),
  acknowledge, negative-acknowledge, dead-letter.

It records everything with `runId` / `correlationId` correlation and ships an
assert API, so a test harness can prove a message made it through the flow. Runs
on BTP Cloud Foundry as a public HTTPS endpoint — the cloud-side counterpart to
the on-premise brokers in `mock-mq-broker`.

## Quick start

```bash
npm install
npm run lab:event-broker        # run locally on :8081
npm run lab:event-broker:test   # newman smoke tests

cf push                         # deploy to Cloud Foundry (public HTTPS)
```

Set `MOCK_USERS` / `ADMIN_*` credentials with `cf set-env` (template in
`cf-setup.sh.example`) before pointing real iFlows at it.

## The rest of the cast

- **mock-event-broker** — the HTTP event backbone *(you are here)*
- [catchall-server](https://github.com/samwatso/catchall-server) — the universal receiver; catches whatever an iFlow sends and keeps the evidence
- [mock-erp-server](https://github.com/samwatso/mock-erp-server) — a stand-in SAP ECC / S/4HANA (IDoc, SOAP, OData, XI)
- [mock-sftp-server](https://github.com/samwatso/mock-sftp-server) — a disposable SFTP partner / file drop
- [mock-mq-broker](https://github.com/samwatso/mock-mq-broker) — JMS / AMQP / MQTT brokers (Artemis + Mosquitto)

## House rules

For SAP BTP trial / dev only. No real data, no production systems, and nothing
committed you wouldn't want on a public stage — credentials stay out of the repo
(`cf set-env`, gitignored `.env`).
