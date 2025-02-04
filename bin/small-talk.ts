#!/usr/bin/env node
import 'source-map-support/register'

import { App } from 'aws-cdk-lib'

import { SmallTalkStack } from '../lib/small-talk-stack'

const app = new App()

new SmallTalkStack(app, 'small-talk', {
  description: 'An app that generates small talk for social interactions',
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
})
