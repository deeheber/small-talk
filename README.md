# small-talk

A tool to generate small talk for those who hate small talk. Helpful for those who are socially awkward, or just want to avoid it. Could also be helpful to workers who need to communicate with coworkers who are geographically located in different areas.

## Channels

1. Weather - [OpenWeather](https://openweathermap.org/api)
2. News - [Hackernews](https://news.ycombinator.com/) (most news APIs aren't good or cost $)

**Other channel ideas are welcome! Feel free to submit an [issue](https://github.com/deeheber/small-talk/issues) with your idea.**

## Tech stack

- TypeScript/Node.js
- Python
- AWS
  - API Gateway
  - Step Functions
  - Lambda
  - Secrets Manager
  - CDK
- Frontend - TBD (Likely HTMX or React)

## Architecture

### Step Function Workflow Diagram

<img width="537" alt="small-talk-asl" src="https://github.com/deeheber/small-talk/assets/12616554/fff34b51-e832-4f1d-835b-046f4c7eb4eb">

## Release plan

See [the board](https://github.com/users/deeheber/projects/1/views/1) for details and in progress tasks

## How to run

### Prerequisites

1. Install Node.js
2. Ensure you have an AWS account, install the [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html), and [configure your credentials](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html)

### Deployment

1. Get an API key from [OpenWeather](https://openweathermap.org/api)
2. [Create a Secret](https://docs.aws.amazon.com/secretsmanager/latest/userguide/create_secret.html) in Secrets Manager titled `smalltalk-weather` with a plaintext secret value that is your OpenWeather API key
3. Clone the repo
4. Run `npm install`
5. Run `export AWS_PROFILE=<your_aws_profile>`
   - Optional if you have a default profile or use `--profile` instead
6. Run `npm run deploy`

### Using

1. Get the api URL

- Base URL comes from the console output after deploy `SmallTalkStack.SmallTalkStackapiEndpoint`
- Add `/small-talk` to the end

2. Get the api key

- The api-id should be from the console output after deploy `SmallTalkStack.CLIApiKeyId`
- `aws apigateway get-api-key --api-key your-api-id --include-value`

3. Run a curl command

- `curl --location 'your-url' \
--header 'x-api-key: your-api-key' \
--header 'Content-Type: application/json' \
--data '{
    "location": "Portland, Oregon, US"
}
'`

4. Alt: use [Postman](https://www.postman.com/) or [Insomnia](https://insomnia.rest/)

5. Note: Units of measurement returned are imperial (e.g. Fahrenheit, miles, etc.). Location should be in format `{city name},{state code},{country code}`. See [OpenWeather docs](https://openweathermap.org/api/geocoding-api) for more info.

### Cleanup

If you want to delete the resources created by this project, run `npm run destroy`.

### Tests

TODO https://github.com/deeheber/small-talk/issues/5

`npm run test`.

## Contributing

See [CONTRIBUTING.md](https://github.com/deeheber/small-talk/blob/main/CONTRIBUTING.md) for more info on our guidelines.
