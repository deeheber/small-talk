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
import {
  Architecture,
  Code,
  Function,
  LayerVersion,
  Runtime,
} from 'aws-cdk-lib/aws-lambda'
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
import { join } from 'path'
import { execSync } from 'child_process'
config()

export class SmallTalkStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)
    const stack = Stack.of(this)

    // Step Function Lambda Invoke Functions
    const weatherFunctionName = `${stack}-weatherFunction`
    const weatherFunctionLog = new LogGroup(
      this,
      `${weatherFunctionName}-log`,
      {
        logGroupName: weatherFunctionName,
        retention: RetentionDays.ONE_WEEK,
        removalPolicy: RemovalPolicy.DESTROY,
      }
    )
    const weatherFunction = new NodejsFunction(this, weatherFunctionName, {
      description:
        'Get current weather using external API for the small talk app',
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
    })
    weatherFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [process.env.WEATHER_SECRET_ARN!],
      })
    )

    const hackerNewsFunctionName = `${stack}-hackerNewsFunction`
    const hackerNewsFunctionDir = join(
      __dirname,
      '../src/functions/hacker-news'
    )
    const hackerNewsFunctionLog = new LogGroup(
      this,
      `${hackerNewsFunctionName}-log`,
      {
        logGroupName: hackerNewsFunctionName,
        retention: RetentionDays.ONE_WEEK,
        removalPolicy: RemovalPolicy.DESTROY,
      }
    )
    const hackerNewsFunction = new Function(this, hackerNewsFunctionName, {
      description:
        'Scrape tech news from Hacker News website for the small talk app',
      architecture: Architecture.ARM_64,
      functionName: hackerNewsFunctionName,
      runtime: Runtime.PYTHON_3_13,
      handler: 'app.handler',
      logGroup: hackerNewsFunctionLog,
      timeout: Duration.seconds(10),
      memorySize: 3008,
      code: Code.fromAsset(hackerNewsFunctionDir, {
        bundling: {
          image: Runtime.PYTHON_3_13.bundlingImage,
          command: [
            'bash',
            '-c',
            'pip install -r requirements.txt -t /asset-output && cp -au . /asset-output',
          ],
          local: {
            tryBundle(outputDir: string) {
              try {
                execSync('pip3 --version')
              } catch {
                return false
              }

              execSync(
                `pip install -r ${join(
                  hackerNewsFunctionDir,
                  'requirements.txt'
                )} -t ${join(outputDir)}`
              )
              execSync(`cp -r ${hackerNewsFunctionDir}/* ${join(outputDir)}`)
              return true
            },
          },
        },
      }),
    })

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
    const stateMachineName = `${stack}-stateMachine`
    const stateMachineLogGroup = new LogGroup(
      this,
      `${stack}-stateMachine-log`,
      {
        logGroupName: stateMachineName,
        retention: RetentionDays.ONE_WEEK,
        removalPolicy: RemovalPolicy.DESTROY,
      }
    )
    const stateMachine = new StateMachine(this, stateMachineName, {
      stateMachineName,
      stateMachineType: StateMachineType.EXPRESS,
      tracingEnabled: true,
      logs: {
        destination: stateMachineLogGroup,
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
