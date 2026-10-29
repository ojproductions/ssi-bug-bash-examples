// Minimal tracer-free Node.js app for the Serverless SSI bug bash.
// Deliberately does NOT depend on dd-trace: the tracer is injected at deploy time.

const express = require('express');

const app = express();
const port = Number(process.env.PORT || 8080);

app.get('/', (_req, res) => {
  console.log('handled /');
  res.send('Hello from the SSI bug bash (Cloud Run, datadog-ci)\n');
});

// Makes an outbound call so an injected tracer produces a client span as well as
// the inbound server span. Two spans is a clearer signal than one.
app.get('/work', async (_req, res) => {
  const upstream = await fetch('https://example.com');
  console.log(`handled /work, upstream status ${upstream.status}`);
  res.send(`upstream responded ${upstream.status}\n`);
});

app.get('/healthz', (_req, res) => res.send('ok\n'));

app.listen(port, '0.0.0.0', () => console.log(`listening on 0.0.0.0:${port}`));
