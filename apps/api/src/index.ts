import 'dotenv/config';
import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { config } from './config.js';

const app = createApp();
const hostname = process.env.API_HOST ?? '0.0.0.0';

serve({ fetch: app.fetch, port: config.port, hostname }, (info) => {
  console.log(`Penny API listening on http://${hostname}:${info.port}`);
  console.log(`CORS web origins: ${config.webOrigins.join(', ')}`);
});
