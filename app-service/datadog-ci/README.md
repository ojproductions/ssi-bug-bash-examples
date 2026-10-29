# Azure code-based Linux Web App (App Service) — `datadog-ci`

Minimal, dependency-free Node.js app in `src/` with no tracer installed. Deploy it, then
`datadog-ci aas instrument --apm-enabled` pre-stages a tracer on `/home` and activates it.

Requires `datadog-ci` >= `v5.25.0`. Flag reference:
[`packages/plugin-aas/README.md`](https://github.com/DataDog/datadog-ci/blob/master/packages/plugin-aas/README.md).

Unlike the other three `datadog-ci` platforms: the opt-in flag is **`--apm-enabled`** (there is
no `--tracing` and no `--language` here), the runtime comes from the app's `linuxFxVersion`, and
only **code-based Linux** Web Apps get a tracer. Supported runtimes: .NET 8-11, Node.js
22/24/26, Python 3.10-3.14, PHP 8.2-8.5, Java 8-23.

## Prerequisites

```bash
npm install -g @datadog/datadog-ci   # or: brew install datadog-ci
az login

export SUBSCRIPTION_ID=<SUBSCRIPTION_ID>
export RESOURCE_GROUP=ssi-bugbash-rg
export LOCATION=eastus2
export APP=ssi-bugbash-aas-$USER     # must be globally unique
export DD_API_KEY=<DATADOG_API_KEY>
export DD_SITE=datadoghq.com
```

The command stages the tracer through the app's SCM (Kudu) site. If basic publishing
credentials are disabled on the app or by subscription policy, enable them first:

```bash
az resource update \
  --resource-group "$RESOURCE_GROUP" \
  --namespace Microsoft.Web --resource-type basicPublishingCredentialsPolicies \
  --parent "sites/$APP" --name scm \
  --set properties.allow=true
```

## 1. Deploy the app

`az webapp up` creates the resource group and App Service plan if they do not exist, zips
`src/`, and deploys it:

```bash
cd src
az webapp up \
  --name "$APP" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --runtime "NODE:22-lts" \
  --os-type Linux \
  --sku B1
cd ..

curl "https://$APP.azurewebsites.net/work"
```

**Wait for the app to finish booting** (roughly a minute after creation) before step 2 —
`/home/data` does not exist until the runtime has started.

## 2. Instrument

```bash
# Dry-run first
datadog-ci aas instrument -s "$SUBSCRIPTION_ID" -g "$RESOURCE_GROUP" -n "$APP" --apm-enabled --dry-run

# Sidecar + tracer
datadog-ci aas instrument -s "$SUBSCRIPTION_ID" -g "$RESOURCE_GROUP" -n "$APP" --apm-enabled

# With unified service tagging
datadog-ci aas instrument -s "$SUBSCRIPTION_ID" -g "$RESOURCE_GROUP" -n "$APP" --apm-enabled \
  --service ssi-bugbash-aas --env bugbash --version 1.0.0
```

Omitting `--apm-enabled` adds the sidecar only, and removes tracer state a previous run added.
`uninstrument` removes everything recognizable. `--slot <slot-name>` targets a deployment slot,
and `-r <full-arm-id>` (repeatable) replaces `-s` / `-g` / `-n`.

## 3. Send traffic

```bash
curl "https://$APP.azurewebsites.net/work"
az webapp config appsettings list -n "$APP" -g "$RESOURCE_GROUP" -o table
az webapp log tail -n "$APP" -g "$RESOURCE_GROUP"
```

The staged tracer files are browsable under `/home` in the Kudu console at
`https://$APP.scm.azurewebsites.net`.

## Clean up

```bash
datadog-ci aas uninstrument -s "$SUBSCRIPTION_ID" -g "$RESOURCE_GROUP" -n "$APP"
az group delete --name "$RESOURCE_GROUP" --yes --no-wait
```
