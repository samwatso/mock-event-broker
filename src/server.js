require('dotenv').config();
const { createApp } = require('./app');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 8081;
const app  = createApp();

app.listen(PORT, () => {
  logger.info('mock-event-broker started', {
    port: PORT,
    env:  process.env.NODE_ENV || 'development',
  });
});
