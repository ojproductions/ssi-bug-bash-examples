# SSI Bug Bash — deployable examples

One runnable example per platform / instrumentation-helper combination, each with its own
deploy instructions.

## The matrix

| # | Platform | Helper | Example | Modes | Version under test | Origin | Repo |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Google Cloud Run | `datadog-ci` | [`cloud-run/datadog-ci`](./cloud-run/datadog-ci) | Single + Multi | `datadog-ci` >= v5.24.0 | written for the bug bash | [`DataDog/datadog-ci`](https://github.com/DataDog/datadog-ci) |
| 2 | Google Cloud Run | Terraform | [`cloud-run/terraform`](./cloud-run/terraform) | Single | module default branch (unreleased) | copied, 7 languages | [`DataDog/terraform-google-cloud-run-datadog`](https://github.com/DataDog/terraform-google-cloud-run-datadog) |
| 3 | Azure Container Apps | `datadog-ci` | [`container-app/datadog-ci`](./container-app/datadog-ci) | Single + Multi | `datadog-ci` >= v5.24.0 | written for the bug bash | [`DataDog/datadog-ci`](https://github.com/DataDog/datadog-ci) |
| 4 | Azure Container Apps | Terraform | [`container-app/terraform`](./container-app/terraform) | Single | module v1.3.0 | copied | [`DataDog/terraform-azurerm-container-app-datadog`](https://github.com/DataDog/terraform-azurerm-container-app-datadog) |
| 5 | AWS ECS Fargate | `datadog-ci` | [`ecs-fargate/datadog-ci`](./ecs-fargate/datadog-ci) | Single + Multi | `datadog-ci` >= v5.25.0, **beta-gated** | written for the bug bash | [`DataDog/datadog-ci`](https://github.com/DataDog/datadog-ci) |
| 6 | AWS ECS Fargate | CDK | [`ecs-fargate/cdk`](./ecs-fargate/cdk) | Single only | `datadog-cdk-constructs-v2` v5.3.0 | written, from upstream integration test | [`DataDog/datadog-cdk-constructs`](https://github.com/DataDog/datadog-cdk-constructs) |
| 7 | AWS ECS Fargate | Terraform | [`ecs-fargate/terraform`](./ecs-fargate/terraform) | Single | module default branch (unreleased) | copied | [`DataDog/terraform-aws-ecs-datadog`](https://github.com/DataDog/terraform-aws-ecs-datadog) |
| 8 | Azure Linux Web App (code-based) | `datadog-ci` | [`app-service/datadog-ci`](./app-service/datadog-ci) | Single, pre-staged | `datadog-ci` >= v5.25.0 | written for the bug bash | [`DataDog/datadog-ci`](https://github.com/DataDog/datadog-ci) |

Only the Cloud Run Terraform examples ship more than one language. To cover another language
elsewhere, swap `src/` and change the language input. Go is never covered — it stays manual.

You do not have to clone anything to run these examples: `datadog-ci` installs from npm, the
Terraform examples resolve their module remotely, and the CDK example installs
`datadog-cdk-constructs-v2` from npm. Clone the repo in that last column when you want to read
the implementation, run a module from a local path, or open an issue or PR against it.

## Prerequisites

* A [Datadog API key](https://app.datadoghq.com/organization-settings/api-keys) for testing.
  Every example reads it from an environment variable or a cloud secret; do not paste a real
  key into any file here. Rotate or delete it afterwards.
* Docker, plus whatever the example needs: `datadog-ci` (`npm install -g @datadog/datadog-ci`
  or `brew install datadog-ci`), Terraform >= 1.5.0, `aws-cdk`, and the relevant cloud CLI
  (`gcloud`, `az`, `aws`).
* For all three ECS examples, the shared cluster — create it once:

  ```bash
  aws ecs create-cluster --cluster-name ssi-bug-bash --region sa-east-1
  ```

  They are pinned to `sa-east-1` and that cluster, and leave it in place on cleanup. Nothing
  is pinned for Cloud Run, Container Apps, or App Service.
* No `src/` image installs a tracer, on purpose: injection aborts when the tracer is already
  importable, so do not add `dd-trace` / `ddtrace` to one.
