#!/usr/bin/env node
import 'source-map-support/register'
import { App } from 'aws-cdk-lib'
import { SmallTalkStack } from '../lib/small-talk-stack'

const app = new App()
new SmallTalkStack(app, 'small-talk', {
  description: 'Resources needed for small talk',
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
})
