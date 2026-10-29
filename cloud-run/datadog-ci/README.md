# Cloud Run — `datadog-ci`

Minimal Node.js app in `src/` with no tracer installed. Deploy it, then let `datadog-ci` add
the tracer.

Requires `datadog-ci` >= `v5.24.0`. Flag reference:
[`packages/plugin-cloud-run/README.md`](https://github.com/DataDog/datadog-ci/blob/master/packages/plugin-cloud-run/README.md).

## Prerequisites

```bash
npm install -g @datadog/datadog-ci   # or: brew install datadog-ci
gcloud auth login
gcloud auth application-default login

export PROJECT_ID=<GCP_PROJECT_ID>
export REGION=us-central1
export SERVICE=ssi-bugbash-cloud-run
export DD_API_KEY=<DATADOG_API_KEY>
export DD_SITE=datadoghq.com
```

## 1. Deploy the app

From this directory; Cloud Build picks up `src/Dockerfile`:

```bash
gcloud run deploy "$SERVICE" \
  --source ./src \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --port 8080 \
  --allow-unauthenticated

SERVICE_URL=$(gcloud run services describe "$SERVICE" --project "$PROJECT_ID" --region "$REGION" --format 'value(status.url)')
curl "$SERVICE_URL/work"
```

## 2. Instrument

```bash
# Dry-run first
datadog-ci cloud-run instrument -p "$PROJECT_ID" -r "$REGION" -s "$SERVICE" --tracing inject --language nodejs --dry-run

# Single-Language
datadog-ci cloud-run instrument -p "$PROJECT_ID" -r "$REGION" -s "$SERVICE" --tracing inject --language nodejs

# Multi-Language (no --language)
datadog-ci cloud-run instrument -p "$PROJECT_ID" -r "$REGION" -s "$SERVICE" --tracing inject
```

Other modes: `--tracer-version`/`--tracer-libc` to pin (needs `--language`), `--tracing manual`
for a tracer already in the image, `--tracing disabled` to turn tracing off, and
`uninstrument` to remove everything.

## 3. Send traffic

```bash
curl "$SERVICE_URL/work"
gcloud run services describe "$SERVICE" --project "$PROJECT_ID" --region "$REGION" --format yaml
```

## Clean up

```bash
datadog-ci cloud-run uninstrument -p "$PROJECT_ID" -r "$REGION" -s "$SERVICE"
gcloud run services delete "$SERVICE" --project "$PROJECT_ID" --region "$REGION"
```
