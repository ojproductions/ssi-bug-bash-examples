# Azure Container Apps — Terraform (`terraform-azurerm-container-app-datadog`)

Copied from [`DataDog/terraform-azurerm-container-app-datadog`](https://github.com/DataDog/terraform-azurerm-container-app-datadog)
`examples/python-ssi`, with one change: `source` points at Terraform Registry version `1.3.0`,
which is where Container Apps tracer injection shipped.

[`python-ssi`](./python-ssi) is the only SSI example upstream. For another language, copy it,
swap `src/`, and change `datadog_apm_instrumentation.language` to `js`, `java`, `dotnet`,
`ruby`, or `php` (the module's values differ from the CLI's: `js` here, `nodejs` there).

## Prerequisites

* Azure CLI (`az login`), Docker with `buildx`, Terraform >= 1.5.0
* A resource group, a Container Apps environment, a container registry, and a
  [Datadog API key](https://app.datadoghq.com/organization-settings/api-keys)

## Deploy

```bash
cd python-ssi

# 1. Build and push the app image
az acr login --name <REGISTRY>
docker buildx build --platform linux/amd64 -t <REGISTRY>.azurecr.io/python-ssi:latest ./src --push

# 2. Fill in the variables
cp terraform.tfvars.example terraform.tfvars
$EDITOR terraform.tfvars

# 3. Deploy
terraform init
terraform plan
terraform apply

# 4. Send a request
curl "$(terraform output -raw url)"
```

The example runs `cpu = 0.5`, which resolves to 2 GiB of replica ephemeral storage — enough
for injection. Lowering it below 0.25 vCPU drops under the 1 GiB minimum.

## Clean up

```bash
terraform destroy
```
