import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  StackProps,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import {
  StepFunctionsIntegration,
  RestApi,
  Period,
  UsagePlan,
} from 'aws-cdk-lib/aws-apigateway'
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs'
import { Architecture, LayerVersion, Runtime } from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import {
  Chain,
  DefinitionBody,
  LogLevel,
  Parallel,
  Pass,
  StateMachine,
  StateMachineType,
  TaskInput,
} from 'aws-cdk-lib/aws-stepfunctions'
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks'
import { config } from 'dotenv'
import { PolicyStatement } from 'aws-cdk-lib/aws-iam'
config()

export class SmallTalkStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)
    const stack = Stack.of(this)

    // Step Function Lambda Invoke Functions
    const weatherFunctionLog = new LogGroup(
      this,
      `${stack}-weatherFunctionLog`,
      {
        logGroupName: `${stack}-weatherFunction`,
        retention: RetentionDays.ONE_WEEK,
        removalPolicy: RemovalPolicy.DESTROY,
      }
    )
    const weatherFunction = new NodejsFunction(
      this,
      `${stack}-weatherFunction`,
      {
        functionName: `${stack}-weatherFunction`,
        runtime: Runtime.NODEJS_20_X,
        entry: 'dist/src/functions/weather.js',
        logGroup: weatherFunctionLog,
        architecture: Architecture.ARM_64,
        timeout: Duration.seconds(10),
        memorySize: 3008,
        layers: [
          LayerVersion.fromLayerVersionArn(
            this,
            'SecretsManagerLayer',
            process.env.SECRETS_EXTENSION_ARN!
          ),
        ],
      }
    )
    weatherFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [process.env.WEATHER_SECRET_ARN!],
      })
    )

    const hackerNewsFunctionLog = new LogGroup(
      this,
      `${stack}-hackerNewsFunctionLog`,
      {
        logGroupName: `${stack}-hackerNewsFunction`,
        retention: RetentionDays.ONE_WEEK,
        removalPolicy: RemovalPolicy.DESTROY,
      }
    )
    const hackerNewsFunction = new NodejsFunction(
      this,
      `${stack}-hackerNewsFunction`,
      {
        functionName: `${stack}-hackerNewsFunction`,
        runtime: Runtime.NODEJS_20_X,
        entry: 'dist/src/functions/hacker-news.js',
        logGroup: hackerNewsFunctionLog,
        architecture: Architecture.ARM_64,
        timeout: Duration.seconds(10),
        memorySize: 3008,
      }
    )

    // Step Function Definition
    const parallel = new Parallel(this, 'Parallel')

    const getWeather = new LambdaInvoke(this, 'Check current weather', {
      lambdaFunction: weatherFunction,
      payload: TaskInput.fromJsonPathAt('$'),
      comment: 'Get current weather using external API',
      resultSelector: { 'weather.$': '$.Payload' },
    })
      .addRetry({
        maxAttempts: 3,
        backoffRate: 2,
      })
      .addCatch(new Pass(this, 'Handle Weather Failure'), {
        resultPath: '$.weather',
      })

    const getTechNews = new LambdaInvoke(this, 'Get Tech News', {
      lambdaFunction: hackerNewsFunction,
      payload: TaskInput.fromJsonPathAt('$'),
      comment: 'Scrape tech news from Hacker News website',
      resultSelector: { 'techNews.$': '$.Payload' },
    })
      .addRetry({
        maxAttempts: 3,
        backoffRate: 2,
      })
      .addCatch(new Pass(this, 'Handle Tech News Failure'), {
        resultPath: '$.techNews.techNews',
      })

    parallel.branch(getWeather)
    parallel.branch(getTechNews)

    const definition = Chain.start(parallel).next(
      new Pass(this, 'Combine Results')
    )

    // Step Function general stuff
    const logGroup = new LogGroup(this, `${stack}-stateMachineLog`, {
      logGroupName: `${stack}-stateMachine`,
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
      definitionBody: DefinitionBody.fromChainable(definition),
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
