#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { JamStack } from '../lib/jam-stack';
import { ExportStack } from '../lib/export-stack';

const app = new cdk.App({ analyticsReporting: false });
const stage = (app.node.tryGetContext('stage') ?? process.env.STAGE ?? 'dev') as 'dev' | 'prod';
const stackName = stage === 'prod' ? 'JamConstruccionesProd' : 'JamConstrucciones';

new JamStack(app, stackName, {
  stage,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  },
});

new ExportStack(app, stage === 'prod' ? 'JamExportarProyectosProd' : 'JamExportarProyectos', {
  stage,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  },
});
