import { CfnOutput, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import {
  StepFunctionsIntegration,
  RestApi,
  Period,
  UsagePlan,
} from 'aws-cdk-lib/aws-apigateway'
import {
  Chain,
  LogLevel,
  Pass,
  StateMachine,
  StateMachineType,
} from 'aws-cdk-lib/aws-stepfunctions'
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs'

export class SmallTalkStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)
    const stack = Stack.of(this)

    // Step Function stuff
    const logGroup = new LogGroup(this, `${stack}-stateMachineLog`, {
      logGroupName: `${stack}-stateMachineLog`,
      retention: RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY,
    })

    const stateMachine = new StateMachine(this, `${stack}-stateMachine`, {
      stateMachineType: StateMachineType.EXPRESS,
      logs: {
        destination: logGroup,
        includeExecutionData: true,
        level: LogLevel.ALL,
      },
      definition: Chain.start(new Pass(this, 'Pass')),
    })

    // API Gateway stuff
    const api = new RestApi(this, `${stack}-api`, {
      restApiName: `${stack}-api`,
      defaultMethodOptions: { apiKeyRequired: true },
      deployOptions: {
        stageName: 'v1',
      },
    })

    const endpoint = api.root.addResource('small-talk')
    endpoint.addMethod(
      'POST',
      StepFunctionsIntegration.startExecution(stateMachine)
    )

    const defaultUsagePlan = new UsagePlan(this, 'DefaultUsagePlan', {
      name: 'Default',
      throttle: {
        rateLimit: 10,
        burstLimit: 2,
      },
      quota: {
        limit: 1_000,
        period: Period.DAY,
      },
    })

    defaultUsagePlan.addApiStage({
      stage: api.deploymentStage,
    })

    const apiKey = api.addApiKey('CLI-ApiKey')
    defaultUsagePlan.addApiKey(apiKey)
    new CfnOutput(this, `CLI-ApiKeyId`, { value: apiKey.keyId })
  }
}
