#!/usr/bin/env node
import { App } from "aws-cdk-lib";
import { SsiBugBashStack } from "../lib/ssi-bugbash-stack";

const app = new App();

new SsiBugBashStack(app, "SsiBugBashEcsCdk", {
  // Account comes from your current AWS credentials; the region is pinned to the
  // one the bug bash runs in.
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "sa-east-1",
  },
});

app.synth();
