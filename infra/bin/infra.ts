#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { JamStack } from '../lib/jam-stack';

const app = new cdk.App();

new JamStack(app, 'JamConstrucciones', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
