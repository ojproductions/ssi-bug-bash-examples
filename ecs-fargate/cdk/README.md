# ECS Fargate — CDK

A `DatadogECSFargate` task definition with one tracer-free Node.js container built from `src/`,
and a Fargate service with a public IP on port 8080. CDK is **Single-Language only** —
`apmInstrumentation.language` is required (`TracerLanguage.JAVA | NODEJS | DOTNET | PYTHON |
RUBY | PHP`; `dotnet`, not `csharp`).

Uses `datadog-cdk-constructs-v2` v5.3.0. Runs in `sa-east-1` (pinned in `bin/index.ts`) on the shared `ssi-bug-bash` cluster

## Prerequisites

```bash
npm install -g aws-cdk     # or use the local one via npx
aws sts get-caller-identity

export AWS_REGION=sa-east-1
export DD_SITE=datadoghq.com

# Create the shared cluster once; skip if someone already made it
aws ecs create-cluster --cluster-name ssi-bug-bash --region sa-east-1 || true

# Preferred: keep the key out of the task definition
export DD_API_KEY_SECRET_ARN=$(aws secretsmanager create-secret \
  --name ssi-bugbash-cdk-dd-api-key --secret-string '<DATADOG_API_KEY>' \
  --query ARN --output text)

# Fallback the stack uses when DD_API_KEY_SECRET_ARN is unset. This writes the key
# into the task definition in plain text.
# export DD_API_KEY=<DATADOG_API_KEY>
```

Docker must be running: `ContainerImage.fromAsset` builds `src/Dockerfile` during synth.

## Deploy

```bash
npm install
npx cdk bootstrap          # once per account; this one bootstraps sa-east-1
npx cdk synth              # read the task definition before you deploy it
npx cdk diff
npx cdk deploy
```

## Send traffic

```bash
CLUSTER=ssi-bug-bash
SERVICE=$(aws cloudformation describe-stacks --stack-name SsiBugBashEcsCdk \
  --query "Stacks[0].Outputs[?OutputKey=='ServiceName'].OutputValue" --output text)
TASK=$(aws ecs list-tasks --cluster "$CLUSTER" --service-name "$SERVICE" --query 'taskArns[0]' --output text)
ENI=$(aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$TASK" \
  --query "tasks[0].attachments[0].details[?name=='networkInterfaceId'].value" --output text)
IP=$(aws ec2 describe-network-interfaces --network-interface-ids "$ENI" \
  --query 'NetworkInterfaces[0].Association.PublicIp' --output text)

curl "http://$IP:8080/work"
```

## Changing what gets instrumented

* Language, tracer version, libc, and target container: the `apmInstrumentation` object passed
  to `fargateTaskDefinition` in `lib/ssi-bugbash-stack.ts`. Passing it to the
  `DatadogECSFargate` constructor instead applies it to every task definition the construct
  creates.
* Tracer startup variables (`NODE_OPTIONS` and friends) and `DD_TAGS` belong in
  `addContainer`, not `addEnvironment`.

## Clean up

```bash
npx cdk destroy   # removes the service, task definition, and VPC — not the cluster
aws secretsmanager delete-secret --secret-id "$DD_API_KEY_SECRET_ARN" --force-delete-without-recovery
```

Leave the `ssi-bug-bash` cluster in place
