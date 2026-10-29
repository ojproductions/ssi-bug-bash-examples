# Cloud Run — Terraform (`terraform-google-cloud-run-datadog`)

Copied from [`DataDog/terraform-google-cloud-run-datadog`](https://github.com/DataDog/terraform-google-cloud-run-datadog)
`examples/*-ssi`, with one change: `source` points at
`github.com/DataDog/terraform-google-cloud-run-datadog?ref=main`, because Cloud Run tracer
injection is merged but not released (latest tag is `v2.2.0`).

| Example | Language |
| --- | --- |
| [`python-ssi`](./python-ssi) | Python |
| [`node-ssi`](./node-ssi) | Node.js |
| [`node-function-ssi`](./node-function-ssi) | Node.js (Cloud Run function) |
| [`java-ssi`](./java-ssi) | Java |
| [`dotnet-ssi`](./dotnet-ssi) | .NET |
| [`ruby-ssi`](./ruby-ssi) | Ruby |
| [`php-ssi`](./php-ssi) | PHP |

## Prerequisites

* `gcloud`, Docker with `buildx`, Terraform >= 1.5.0
* A GCP project, an Artifact Registry repository, and a
  [Datadog API key](https://app.datadoghq.com/organization-settings/api-keys)
* `gcloud auth login && gcloud auth application-default login`

## Deploy

From inside one example directory:

```bash
cd python-ssi

# 1. Build and push the app image
export PROJECT_ID=<GCP_PROJECT_ID> REGION=us-central1 REPO_NAME=<ARTIFACT_REGISTRY_REPO>
gcloud auth configure-docker $REGION-docker.pkg.dev --quiet
docker buildx build --platform linux/amd64 --load \
  -t $REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/python-ssi:latest ./src
docker push $REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/python-ssi:latest

# 2. Fill in the variables
cp terraform.tfvars.example terraform.tfvars
$EDITOR terraform.tfvars

# 3. Deploy
terraform init
terraform plan
terraform apply

# 4. Send a request
curl "$(gcloud run services describe $(terraform output -raw cloud_run_service_name) \
  --region $REGION --format 'value(status.url)')"
```

`build_and_deploy.sh` does steps 1-3 in one shot. It expects `PROJECT_ID`, `GCP_PROJECT_NAME`,
`DD_SERVICE`, `REPO_NAME`, and optionally `REGION`:

```bash
./build_and_deploy.sh python-ssi
```

`node-function-ssi` is the exception: it is a Cloud Run **function** built with buildpacks
(`gcloud builds submit --pack`) from `src/project.toml`, not from a Dockerfile. Use
[its own README](./node-function-ssi/README.md) for the build step; `build_and_deploy.sh` will
refuse that directory.

## Clean up

```bash
terraform destroy      # or ./destroy.sh python-ssi
```
