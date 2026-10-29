# ECS Fargate — Terraform (`terraform-aws-ecs-datadog`)

Runs in `sa-east-1`, in the shared `ssi-bug-bash` cluster

[`python-ssi`](./python-ssi) is the only SSI example upstream. For another language, copy it,
swap `src/`, and change `dd_apm_instrumentation.language` to `js`, `java`, `dotnet`, `ruby`, or
`php` (the module's values differ from the CLI's: `js` here, `nodejs` there).

## Prerequisites

* AWS CLI with credentials, Docker, Terraform >= 1.5.0
* An ECR repository and a
  [Datadog API key](https://app.datadoghq.com/organization-settings/api-keys)
* The `ssi-bug-bash` cluster, a public subnet, and a security group allowing inbound TCP 8080:

  ```bash
  aws ecs create-cluster --cluster-name ssi-bug-bash --region sa-east-1
  ```

The module registers a task definition; it does not run a task. You start one yourself in the
last step.

## Deploy

```bash
cd python-ssi

# 1. Build and push the app image
export AWS_REGION=sa-east-1
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGISTRY=$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
aws ecr create-repository --repository-name python-ssi-example || true
aws ecr get-login-password | docker login --username AWS --password-stdin "$REGISTRY"
docker build --platform linux/amd64 -t "$REGISTRY/python-ssi-example:latest" ./src
docker push "$REGISTRY/python-ssi-example:latest"

# 2. Fill in the variables
cp terraform.tfvars.example terraform.tfvars
$EDITOR terraform.tfvars

# 3. Register the task definition
terraform init
terraform plan
terraform apply

# 4. Run a task from it
export SUBNET_ID=<SUBNET_ID> SECURITY_GROUP_ID=<SECURITY_GROUP_ID>
aws ecs run-task \
  --cluster ssi-bug-bash \
  --launch-type FARGATE \
  --task-definition "$(terraform output -raw task_definition_arn)" \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_ID],securityGroups=[$SECURITY_GROUP_ID],assignPublicIp=ENABLED}"
```

Find the task's public IP in the ECS console and `curl http://<PUBLIC_IP>:8080`.

## Clean up

```bash
aws ecs stop-task --cluster ssi-bug-bash --task <TASK_ARN>
terraform destroy
aws ecr delete-repository --repository-name python-ssi-example --force
```

Leave the `ssi-bug-bash` cluster in place — the other ECS examples share it.
