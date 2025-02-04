import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  SecretValue,
  Stack,
  StackProps,
} from 'aws-cdk-lib'
import {
  Period,
  RestApi,
  StepFunctionsIntegration,
  UsagePlan,
} from 'aws-cdk-lib/aws-apigateway'
import {
  Authorization,
  Connection,
  HttpParameter,
} from 'aws-cdk-lib/aws-events'
import { Architecture, Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda'
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs'
import {
  Chain,
  DefinitionBody,
  JitterType,
  LogLevel,
  Parallel,
  Pass,
  StateMachine,
  StateMachineType,
  TaskInput,
} from 'aws-cdk-lib/aws-stepfunctions'
import { HttpInvoke, LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks'
import { execSync } from 'child_process'
import { Construct } from 'constructs'
import { join } from 'path'

export class SmallTalkStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    const stack = Stack.of(this)

    // Hacker news branch resources
    const hackerNewsFunctionName = `${stack}-hackerNewsFunction`
    const hackerNewsFunctionDir = join(__dirname, '../functions/hacker-news')
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
                  'requirements.txt',
                )} -t ${join(outputDir)}`,
              )
              execSync(`cp -r ${hackerNewsFunctionDir}/* ${join(outputDir)}`)
              return true
            },
          },
        },
      }),
    })

    const getTechNewsBranch = new LambdaInvoke(this, 'Get Tech News', {
      lambdaFunction: hackerNewsFunction,
      payload: TaskInput.fromJsonPathAt('$'),
      comment: 'Scrape tech news from Hacker News website',
      resultSelector: { 'techNews.$': '$.Payload' },
    })
      .addRetry({
        maxAttempts: 3,
        backoffRate: 2,
        interval: Duration.seconds(2),
        jitterStrategy: JitterType.FULL,
      })
      .addCatch(new Pass(this, 'Handle Tech News Failure'), {
        resultPath: '$.techNews.techNews',
      })

    // Weather branch resources
    const connection = new Connection(this, `${stack}-connection`, {
      description: 'Connection to OpenWeatherMap API',
      connectionName: `${stack}`,
      authorization: Authorization.apiKey(
        'smalltalk-authorization',
        SecretValue.secretsManager('smalltalk-weather'),
      ),
      queryStringParameters: {
        appid: HttpParameter.fromSecret(
          SecretValue.secretsManager('smalltalk-weather'),
        ),
      },
    })

    const getCords = new HttpInvoke(this, 'Get Coordinates', {
      apiRoot: `https://api.openweathermap.org`,
      apiEndpoint: TaskInput.fromText('geo/1.0/direct'),
      connection,
      headers: TaskInput.fromObject({ 'Content-Type': 'application/json' }),
      method: TaskInput.fromText('GET'),
      queryStringParameters: TaskInput.fromObject({
        limit: '1',
        'q.$': '$.body.location',
      }),
      resultSelector: {
        'lat.$': '$.ResponseBody[0].lat',
        'lon.$': '$.ResponseBody[0].lon',
        'name.$': '$$.Execution.Input.body.location',
      },
      resultPath: '$.metadata.metadata',
      outputPath: '$.metadata',
    })
      .addRetry({
        maxAttempts: 3,
        backoffRate: 2,
        interval: Duration.seconds(2),
        jitterStrategy: JitterType.FULL,
      })
      .addCatch(new Pass(this, 'Handle Get Coordinates Failure'), {
        resultPath: '$',
      })

    const getWeather = new HttpInvoke(this, 'Get Weather', {
      apiRoot: `https://api.openweathermap.org`,
      apiEndpoint: TaskInput.fromText('data/3.0/onecall'),
      connection,
      headers: TaskInput.fromObject({ 'Content-Type': 'application/json' }),
      method: TaskInput.fromText('GET'),
      queryStringParameters: TaskInput.fromObject({
        units: 'imperial',
        exclude: 'minutely,hourly,daily,alerts',
        'lat.$': '$.metadata.lat',
        'lon.$': '$.metadata.lon',
      }),
      resultSelector: {
        'weather.$': '$.ResponseBody.current',
        'statusCode.$': '$.StatusCode',
        'statusText.$': '$.StatusText',
      },
      resultPath: '$.taskResult',
    })
      .addRetry({
        maxAttempts: 3,
        backoffRate: 2,
        interval: Duration.seconds(2),
        jitterStrategy: JitterType.FULL,
      })
      .addCatch(new Pass(this, 'Handle Get Weather Failure'), {
        resultPath: '$',
      })

    const getWeatherBranch = getCords.next(getWeather)

    // Step Function definition
    const parallel = new Parallel(this, 'Parallel')
    parallel.branch(getWeatherBranch)
    parallel.branch(getTechNewsBranch)

    const definition = Chain.start(parallel).next(
      new Pass(this, 'Combine Results'),
    )

    // Step Function
    const stateMachineName = `${stack}-stateMachine`
    const stateMachineLogGroup = new LogGroup(
      this,
      `${stack}-stateMachine-log`,
      {
        logGroupName: stateMachineName,
        retention: RetentionDays.ONE_WEEK,
        removalPolicy: RemovalPolicy.DESTROY,
      },
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

    // API Gateway
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
      StepFunctionsIntegration.startExecution(stateMachine),
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
