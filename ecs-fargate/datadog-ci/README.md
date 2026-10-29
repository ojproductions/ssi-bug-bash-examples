# ECS Fargate — `datadog-ci`

Minimal Node.js app in `src/` and a minimal Fargate task definition in
`task-definition.json`, neither with a tracer. `datadog-ci` adds one in a new task-definition
revision; running tasks do not change until you deploy that revision (or pass `--ecs-service`).

Requires `datadog-ci` >= `v5.25.0` and `DD_BETA_COMMANDS_ENABLED=1`. Flag reference:
[`packages/plugin-ecs-fargate/README.md`](https://github.com/DataDog/datadog-ci/blob/master/packages/plugin-ecs-fargate/README.md).

Runs in `sa-east-1`, in the shared `ssi-bug-bash` cluster

## Prerequisites

```bash
npm install -g @datadog/datadog-ci   # or: brew install datadog-ci
aws sts get-caller-identity

export DD_BETA_COMMANDS_ENABLED=1
export AWS_REGION=sa-east-1
export FAMILY=ssi-bugbash-ecs
export CLUSTER=ssi-bug-bash
export DD_SITE=datadoghq.com
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGISTRY=$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
```

Your credentials need `ecs:DescribeTaskDefinition`, `ecs:RegisterTaskDefinition`, and
`ecs:TagResource`; add `ecs:DescribeServices` and `ecs:UpdateService` for `--ecs-service`.

## 1. Build and push the app image

```bash
aws ecr create-repository --repository-name ssi-bugbash-ecs || true
aws ecr get-login-password | docker login --username AWS --password-stdin "$REGISTRY"
docker build --platform linux/amd64 -t "$REGISTRY/ssi-bugbash-ecs:latest" ./src
docker push "$REGISTRY/ssi-bugbash-ecs:latest"
```

The task definition is `X86_64` so every language works (.NET injection is not supported on
ARM64).

## 2. Store the Datadog API key in Secrets Manager

```bash
SECRET_ARN=$(aws secretsmanager create-secret \
  --name ssi-bugbash-dd-api-key \
  --secret-string '<DATADOG_API_KEY>' \
  --query ARN --output text)
```

## 3. Roles

The execution role must exist and be allowed to read that secret — ECS resolves secrets
through it:

```bash
EXECUTION_ROLE_ARN=$(aws iam get-role --role-name ecsTaskExecutionRole --query Role.Arn --output text)

cat > /tmp/read-secret.json <<JSON
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"secretsmanager:GetSecretValue","Resource":"$SECRET_ARN"}]}
JSON
aws iam put-role-policy --role-name ecsTaskExecutionRole \
  --policy-name ssi-bugbash-read-dd-api-key --policy-document file:///tmp/read-secret.json
```

Set `TASK_ROLE_ARN` to a role with `ecs:ListClusters`, `ecs:ListContainerInstances`, and
`ecs:DescribeContainerInstances` so the Agent can read task metadata, or remove the
`taskRoleArn` line from `task-definition.json`.

## 4. Register the task definition and run it

```bash
sed -e "s|<IMAGE>|$REGISTRY/ssi-bugbash-ecs:latest|" \
    -e "s|<EXECUTION_ROLE_ARN>|$EXECUTION_ROLE_ARN|" \
    -e "s|<TASK_ROLE_ARN>|$TASK_ROLE_ARN|" \
    task-definition.json > /tmp/$FAMILY.json

aws ecs register-task-definition --cli-input-json file:///tmp/$FAMILY.json

# Create the shared cluster once; skip if someone already made it
aws ecs create-cluster --cluster-name "$CLUSTER" || true

# A public subnet and a security group allowing inbound TCP 8080
export SUBNET_ID=<SUBNET_ID> SECURITY_GROUP_ID=<SECURITY_GROUP_ID>
aws ecs run-task --cluster "$CLUSTER" --launch-type FARGATE --task-definition "$FAMILY" \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_ID],securityGroups=[$SECURITY_GROUP_ID],assignPublicIp=ENABLED}"
```

Find the task's public IP in the ECS console and `curl http://<PUBLIC_IP>:8080/work`.

## 5. Instrument

```bash
# Dry-run first
datadog-ci ecs-fargate instrument --task-definition "$FAMILY" -r "$AWS_REGION" \
  --api-key-secret-arn "$SECRET_ARN" --tracing inject --language nodejs --dry-run

# Single-Language
datadog-ci ecs-fargate instrument --task-definition "$FAMILY" -r "$AWS_REGION" \
  --api-key-secret-arn "$SECRET_ARN" --tracing inject --language nodejs

# Multi-Language (no --language)
datadog-ci ecs-fargate instrument --task-definition "$FAMILY" -r "$AWS_REGION" \
  --api-key-secret-arn "$SECRET_ARN" --tracing inject
```

Other flags: `--container-name` to pick the app container, `--tracer-version`/`--tracer-libc`
to pin (needs `--language`), `--service` / `--env` / `--version` for unified service tagging,
`--log-collection` for the FireLens sidecar, `--tracing manual` for a tracer already in the
image, `--tracing disabled` to turn tracing off, and `uninstrument` to remove everything.
Use `--api-key-secret-arn` rather than `DD_API_KEY`, which writes the key into the task
definition in plain text.

## 6. Run the new revision

```bash
aws ecs run-task --cluster "$CLUSTER" --launch-type FARGATE --task-definition "$FAMILY" \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_ID],securityGroups=[$SECURITY_GROUP_ID],assignPublicIp=ENABLED}"
curl http://<PUBLIC_IP>:8080/work

aws ecs describe-task-definition --task-definition "$FAMILY"
```

## Clean up

```bash
aws ecs stop-task --cluster "$CLUSTER" --task <TASK_ARN>
datadog-ci ecs-fargate uninstrument --task-definition "$FAMILY" -r "$AWS_REGION"
aws ecr delete-repository --repository-name ssi-bugbash-ecs --force
aws secretsmanager delete-secret --secret-id "$SECRET_ARN" --force-delete-without-recovery
aws iam delete-role-policy --role-name ecsTaskExecutionRole --policy-name ssi-bugbash-read-dd-api-key
```

Leave the `ssi-bug-bash` cluster in place — the other ECS examples share it.
