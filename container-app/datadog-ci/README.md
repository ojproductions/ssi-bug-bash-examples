# Azure Container Apps — `datadog-ci`

Minimal Python app in `src/` with no tracer installed. Deploy it, then let `datadog-ci` add
the tracer.

Requires `datadog-ci` >= `v5.24.0`. Flag reference:
[`packages/plugin-container-app/README.md`](https://github.com/DataDog/datadog-ci/blob/master/packages/plugin-container-app/README.md).

## Prerequisites

```bash
npm install -g @datadog/datadog-ci   # or: brew install datadog-ci
az login

export SUBSCRIPTION_ID=<SUBSCRIPTION_ID>
export RESOURCE_GROUP=ssi-bugbash-rg
export LOCATION=eastus2
export APP=ssi-bugbash-aca
export DD_API_KEY=<DATADOG_API_KEY>
export DD_SITE=datadoghq.com
```

The app container needs at least 0.5 vCPU, which is what `az containerapp up` gives it by
default. Replica ephemeral storage is derived from CPU, and injection needs >= 1 GiB (Single)
or >= 2 GiB (Multi).

## 1. Deploy the app

`az containerapp up` builds `src/Dockerfile`, pushes it to an ACR it creates, and creates the
resource group and environment if they do not exist:

```bash
az containerapp up \
  --name "$APP" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --environment ssi-bugbash-env \
  --source ./src \
  --target-port 8080 \
  --ingress external

APP_URL=$(az containerapp show -n "$APP" -g "$RESOURCE_GROUP" --query properties.configuration.ingress.fqdn -o tsv)
curl "https://$APP_URL/work"
```

## 2. Instrument

```bash
# Dry-run first
datadog-ci container-app instrument \
  --subscription-id "$SUBSCRIPTION_ID" --resource-group "$RESOURCE_GROUP" --name "$APP" \
  --tracing inject --language python --dry-run

# Single-Language
datadog-ci container-app instrument \
  --subscription-id "$SUBSCRIPTION_ID" --resource-group "$RESOURCE_GROUP" --name "$APP" \
  --tracing inject --language python

# Multi-Language (no --language)
datadog-ci container-app instrument \
  --subscription-id "$SUBSCRIPTION_ID" --resource-group "$RESOURCE_GROUP" --name "$APP" \
  --tracing inject
```

Other flags: `--container-name` to pick the app container, `--tracer-version`/`--tracer-libc`
to pin (needs `--language`), `--tracing manual` for a tracer already in the image,
`--tracing disabled` to turn tracing off, and `uninstrument` to remove everything.
`--resource-id <full-arm-id>` replaces the three `--subscription-id` / `--resource-group` /
`--name` flags and can be repeated.

## 3. Send traffic

```bash
curl "https://$APP_URL/work"
az containerapp show -n "$APP" -g "$RESOURCE_GROUP" -o yaml
az containerapp logs show -n "$APP" -g "$RESOURCE_GROUP" --container datadog-tracer
```

## Clean up

```bash
datadog-ci container-app uninstrument --subscription-id "$SUBSCRIPTION_ID" --resource-group "$RESOURCE_GROUP" --name "$APP"
az group delete --name "$RESOURCE_GROUP" --yes --no-wait
```
