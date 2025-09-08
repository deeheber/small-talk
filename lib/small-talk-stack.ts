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
  TaskInput,
} from 'aws-cdk-lib/aws-stepfunctions'
import { HttpInvoke, LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks'
import { execSync } from 'child_process'
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
      timeout: Duration.seconds(15),
      memorySize: 256,
      code: Code.fromAsset(hackerNewsFunctionDir, {
        bundling: {
          image: Runtime.PYTHON_3_13.bundlingImage,
          command: [
            'bash',
            '-c',
            'pip3 install -r requirements.txt -t /asset-output && cp -au . /asset-output',
          ],
          local: {
            tryBundle(outputDir: string) {
              try {
                execSync('pip3 --version')
              } catch {
                return false
              }

              execSync(
                `pip3 install -r ${join(
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
    const weatherFunctionDir = join(__dirname, '../functions/weather')
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
      memorySize: 256,
      code: Code.fromAsset(weatherFunctionDir, {
        bundling: {
          image: Runtime.PYTHON_3_13.bundlingImage,
          command: [
            'bash',
            '-c',
            'pip3 install -r requirements.txt -t /asset-output && cp -au . /asset-output',
          ],
          local: {
            tryBundle(outputDir: string) {
              try {
                execSync('pip3 --version')
              } catch {
                return false
              }

              execSync(
                `pip3 install -r ${join(
                  weatherFunctionDir,
                  'requirements.txt',
                )} -t ${join(outputDir)}`,
              )
              execSync(`cp -r ${weatherFunctionDir}/* ${join(outputDir)}`)
              return true
            },
          },
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

    const connection = new Connection(this, `${this.id}-connection`, {
      description: 'Connection to OpenWeatherMap API',
      connectionName: `${this.id}`,
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
      queryLanguage: QueryLanguage.JSONATA,
      apiRoot: `https://api.openweathermap.org`,
      apiEndpoint: TaskInput.fromText('geo/1.0/direct'),
      connection,
      headers: TaskInput.fromObject({ 'Content-Type': 'application/json' }),
      method: TaskInput.fromText('GET'),
      queryStringParameters: TaskInput.fromObject({
        limit: '1',
        q: '{% $states.input.body.location %}',
      }),
      outputs: {
        metadata: {
          lat: '{% $states.result.ResponseBody[0].lat %}',
          lon: '{% $states.result.ResponseBody[0].lon %}',
          name: '{% $states.context.Execution.Input.body.location %}',
        },
      },
    })
      .addRetry({
        maxAttempts: 3,
        backoffRate: 2,
        interval: Duration.seconds(2),
        jitterStrategy: JitterType.FULL,
      })
      .addCatch(new Pass(this, 'Handle Get Coordinates Failure'), {
        outputs: {
          metadata: {
            name: '{% $states.context.Execution.Input.body.location %}',
          },
          weather: '{% $states.errorOutput %}',
        },
      })

    const getWeather = new HttpInvoke(this, 'Get Weather', {
      queryLanguage: QueryLanguage.JSONATA,
      apiRoot: `https://api.openweathermap.org`,
      apiEndpoint: TaskInput.fromText('data/3.0/onecall'),
      connection,
      headers: TaskInput.fromObject({ 'Content-Type': 'application/json' }),
      method: TaskInput.fromText('GET'),
      queryStringParameters: TaskInput.fromObject({
        units: 'imperial',
        exclude: 'minutely,hourly,daily,alerts',
        lat: '{% $states.input.metadata.lat %}',
        lon: '{% $states.input.metadata.lon %}',
      }),
      outputs: {
        metadata: '{% $states.input.metadata %}',
        weather: {
          statusCode: '{% $states.result.StatusCode %}',
          statusText: '{% $states.result.StatusText %}',
          result: '{% $states.result.ResponseBody.current %}',
        },
      },
    })
      .addRetry({
        maxAttempts: 3,
        backoffRate: 2,
        interval: Duration.seconds(2),
        jitterStrategy: JitterType.FULL,
      })
      .addCatch(new Pass(this, 'Handle Get Weather Failure'), {
        outputs: {
          metadata: '{% $states.input.metadata %}',
          weather: '{% $states.errorOutput %}',
        },
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
