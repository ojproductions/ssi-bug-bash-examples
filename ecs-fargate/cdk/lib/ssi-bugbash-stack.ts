import * as path from "path";

import { CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import { Construct } from "constructs";
import { DatadogECSFargate, TracerLanguage } from "datadog-cdk-constructs-v2";

const APP_CONTAINER_NAME = "node-app";
const CLUSTER_NAME = "ssi-bug-bash";

export class SsiBugBashStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Public-subnet-only VPC so the task is reachable without a NAT gateway.
    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [{ name: "public", subnetType: ec2.SubnetType.PUBLIC }],
    });

    // The bug bash shares one cluster across all three ECS examples, so import it by
    // name instead of creating one. `cdk destroy` then cannot take it down with the stack.
    // A cluster is VPC-agnostic, so handing it this stack's VPC is what lets the service
    // place tasks in the subnets above.
    const cluster = ecs.Cluster.fromClusterAttributes(this, "Cluster", {
      clusterName: CLUSTER_NAME,
      vpc,
      securityGroups: [],
    });

    // Prefer a Secrets Manager secret. `apiKey` writes the key into the task
    // definition in plain text, so it is only the fallback.
    const apiKeySecretArn = process.env.DD_API_KEY_SECRET_ARN;
    const ecsDatadog = new DatadogECSFargate({
      apiKeySecretArn,
      apiKey: apiKeySecretArn ? undefined : process.env.DD_API_KEY,
      site: process.env.DD_SITE ?? "datadoghq.com",
      env: "bugbash",
      service: "ssi-bugbash-ecs-cdk",
      version: "1.0.0",
      apm: {
        // Required for automatic APM instrumentation.
        isEnabled: true,
      },
    });

    // `apmInstrumentation` is set per task definition. Setting it on
    // DatadogECSFargate instead applies it to every task definition the
    // construct creates.
    const taskDefinition = ecsDatadog.fargateTaskDefinition(
      this,
      "SsiBugBashTask",
      {
        cpu: 512,
        memoryLimitMiB: 1024,
      },
      {
        apmInstrumentation: {
          language: TracerLanguage.NODEJS,
          // Required once the task definition has more than one application
          // container; harmless and clearer when it has one.
          containerName: APP_CONTAINER_NAME,
          // tracerVersion: "6.10.1",
          // tracerLibc: TracerLibc.GLIBC,
        },
      },
    );

    taskDefinition.addContainer("App", {
      containerName: APP_CONTAINER_NAME,
      // Builds src/Dockerfile and publishes it to the CDK asset repository.
      image: ecs.ContainerImage.fromAsset(path.join(__dirname, "..", "src")),
      essential: true,
      portMappings: [{ containerPort: 8080 }],
      // The construct appends the tracer to this value instead of replacing it.
      // Set tracer startup variables here, not in `secrets`, an environment
      // file, or a later `addEnvironment` call.
      environment: {
        NODE_OPTIONS: "--max-old-space-size=256",
      },
      // Also gives the datadog-tracer container somewhere to log, since this
      // stack does not enable `logCollection`.
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: "app" }),
    });

    const service = new ecs.FargateService(this, "Service", {
      cluster,
      taskDefinition,
      desiredCount: 1,
      assignPublicIp: true,
      minHealthyPercent: 100,
    });
    service.connections.allowFromAnyIpv4(ec2.Port.tcp(8080), "app traffic");

    new CfnOutput(this, "ClusterName", { value: cluster.clusterName });
    new CfnOutput(this, "ServiceName", { value: service.serviceName });
  }
}
