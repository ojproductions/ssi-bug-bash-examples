# Minimal tracer-free Python app for the Serverless SSI bug bash.
# Deliberately does NOT depend on ddtrace: the tracer is injected at deploy time.
# Injection aborts when the tracer is already importable in the image.

import logging
import os

import requests
from flask import Flask

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@app.get("/")
def index():
    logger.info("handled /")
    return "Hello from the SSI bug bash (Container Apps, datadog-ci)\n"


# Makes an outbound call so an injected tracer produces a client span as well as
# the inbound server span. Two spans is a clearer signal than one.
@app.get("/work")
def work():
    upstream = requests.get("https://example.com", timeout=10)
    logger.info("handled /work, upstream status %s", upstream.status_code)
    return f"upstream responded {upstream.status_code}\n"


@app.get("/healthz")
def healthz():
    return "ok\n"


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
