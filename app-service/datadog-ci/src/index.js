// Minimal tracer-free Node.js app for the Serverless SSI bug bash.
// Deliberately does NOT depend on dd-trace: the tracer is pre-staged on /home and
// activated through NODE_OPTIONS at instrumentation time.
//
// Zero dependencies on purpose, so an App Service deploy cannot fail on `npm install`.
// The tracer instruments the built-in http module, so spans still show up.

const http = require('node:http');

const port = Number(process.env.PORT || 8080);

const server = http.createServer(async (req, res) => {
  if (req.url === '/work') {
    // Outbound call, so an injected tracer produces a client span as well as the
    // inbound server span. Two spans is a clearer signal than one.
    const upstream = await fetch('https://example.com');
    console.log(`handled /work, upstream status ${upstream.status}`);
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end(`upstream responded ${upstream.status}\n`);
    return;
  }

  console.log(`handled ${req.url}`);
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end('Hello from the SSI bug bash (App Service, datadog-ci)\n');
});

server.listen(port, () => console.log(`listening on ${port}`));
