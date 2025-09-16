import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  StackProps,
} from 'aws-cdk-lib'
import {
  Period,
  RestApi,
  StepFunctionsIntegration,
  UsagePlan,
} from 'aws-cdk-lib/aws-apigateway'
import { PolicyStatement } from 'aws-cdk-lib/aws-iam'
import { Architecture, Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda'
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs'
import {
  Chain,
  DefinitionBody,
  JitterType,
  LogLevel,
  Parallel,
  Pass,
  QueryLanguage,
  StateMachine,
  StateMachineType,
} from 'aws-cdk-lib/aws-stepfunctions'
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks'
import { Construct } from 'constructs'
import { join } from 'path'

export class SmallTalkStack extends Stack {
  public id: string
  private stateMachine: StateMachine

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)
    this.id = id

    this.createStateMachine()
    this.createApi()
  }

  private createStateMachine() {
    // Hacker news branch resources
    const hackerNewsFunctionName = `${this.id}-hackerNewsFunction`
    const functionsDir = join(__dirname, '../functions')
    const hackerNewsFunctionLog = new LogGroup(
      this,
      `${hackerNewsFunctionName}-log`,
      {
        logGroupName: hackerNewsFunctionName,
        retention: RetentionDays.ONE_WEEK,
        removalPolicy: RemovalPolicy.DESTROY,
      },
    )
    const hackerNewsFunction = new Function(this, hackerNewsFunctionName, {
      description:
        'Scrape tech news from Hacker News website for the small talk app',
      architecture: Architecture.ARM_64,
      functionName: hackerNewsFunctionName,
      runtime: Runtime.PYTHON_3_13,
      handler: 'app.handler',
      logGroup: hackerNewsFunctionLog,
      timeout: Duration.seconds(15),
      memorySize: 512,
      code: Code.fromAsset(functionsDir, {
        exclude: ['weather/**'],
        bundling: {
          image: Runtime.PYTHON_3_13.bundlingImage,
          command: [
            'bash',
            '-c',
            'pip3 install -r hacker-news/requirements.txt -t /asset-output && pip3 install -r shared/requirements.txt -t /asset-output && cp -au hacker-news/* /asset-output && cp -au shared/* /asset-output/',
          ],
        },
      }),
    })
    hackerNewsFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [
          `arn:aws:secretsmanager:${this.region}:${this.account}:secret:momento-api-key*`,
        ],
      }),
    )

    const getTechNewsBranch = new LambdaInvoke(this, 'Get Tech News', {
      queryLanguage: QueryLanguage.JSONATA,
      lambdaFunction: hackerNewsFunction,
      comment: 'Scrape tech news from Hacker News website',
      outputs: {
        techNews: '{% $states.result.Payload %}',
      },
    }).addRetry({
      maxAttempts: 3,
      backoffRate: 2,
      interval: Duration.seconds(2),
      jitterStrategy: JitterType.FULL,
    })

    // Weather branch resources
    const weatherFunctionName = `${this.id}-weatherFunction`
    const weatherFunctionLog = new LogGroup(
      this,
      `${weatherFunctionName}-log`,
      {
        logGroupName: weatherFunctionName,
        retention: RetentionDays.ONE_WEEK,
        removalPolicy: RemovalPolicy.DESTROY,
      },
    )
    const weatherFunction = new Function(this, weatherFunctionName, {
      description: 'Get weather data from an API for the small talk app',
      architecture: Architecture.ARM_64,
      functionName: weatherFunctionName,
      runtime: Runtime.PYTHON_3_13,
      handler: 'app.handler',
      logGroup: weatherFunctionLog,
      timeout: Duration.seconds(15),
      memorySize: 512,
      code: Code.fromAsset(functionsDir, {
        exclude: ['hacker-news/**'],
        bundling: {
          image: Runtime.PYTHON_3_13.bundlingImage,
          command: [
            'bash',
            '-c',
            'pip3 install -r weather/requirements.txt -t /asset-output && pip3 install -r shared/requirements.txt -t /asset-output && cp -au weather/* /asset-output && cp -au shared/* /asset-output/',
          ],
        },
      }),
    })
    weatherFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [
          `arn:aws:secretsmanager:${this.region}:${this.account}:secret:smalltalk-weather*`,
        ],
      }),
    )
    weatherFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [
          `arn:aws:secretsmanager:${this.region}:${this.account}:secret:momento-api-key*`,
        ],
      }),
    )

    const getWeatherBranch = new LambdaInvoke(this, 'Get Weather', {
      queryLanguage: QueryLanguage.JSONATA,
      lambdaFunction: weatherFunction,
      comment: 'Get weather from API calls',
      outputs: {
        weather: '{% $states.result.Payload %}',
      },
    }).addRetry({
      maxAttempts: 3,
      backoffRate: 2,
      interval: Duration.seconds(2),
      jitterStrategy: JitterType.FULL,
    })

    // Step Function definition
    const parallel = new Parallel(this, 'Parallel')
    parallel.branch(getWeatherBranch)
    parallel.branch(getTechNewsBranch)

    const definition = Chain.start(parallel).next(
      new Pass(this, 'Combine Results'),
    )

    // Step Function
    const stateMachineName = `${this.id}-stateMachine`
    const stateMachineLogGroup = new LogGroup(
      this,
      `${this.id}-stateMachine-log`,
      {
        logGroupName: stateMachineName,
        retention: RetentionDays.ONE_WEEK,
        removalPolicy: RemovalPolicy.DESTROY,
      },
    )
    this.stateMachine = new StateMachine(this, stateMachineName, {
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
  }

  private createApi() {
    // API Gateway
    const api = new RestApi(this, `${this.id}-api`, {
      restApiName: `${this.id}-api`,
      defaultMethodOptions: { apiKeyRequired: true },
      deployOptions: {
        stageName: 'v1',
      },
    })

    const endpoint = api.root.addResource('small-talk')
    endpoint.addMethod(
      'POST',
      StepFunctionsIntegration.startExecution(this.stateMachine),
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
