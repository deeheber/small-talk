# Technology Stack

## Core Technologies

- **TypeScript/Node.js v22** - Primary development language for infrastructure and CDK (use `.nvmrc`)
- **Python 3.13** - Lambda function runtime for web scraping
- **AWS CDK** - Infrastructure as Code using TypeScript

## AWS Services

- **API Gateway** - REST API endpoint with API key authentication
- **Step Functions** - Express workflows for parallel data fetching
- **Lambda** - Serverless compute for Hacker News scraping
- **Secrets Manager** - Secure storage for OpenWeather API key
- **CloudWatch Logs** - Centralized logging with 1-week retention

## Development Tools

- **ESLint** - Code linting with TypeScript support
- **Prettier** - Code formatting
- **Jest** - Testing framework
- **ts-node** - TypeScript execution

## Common Commands

### Development

```bash
nvm use              # Use Node version from .nvmrc (v22)
npm install          # Install dependencies
npm run build        # Compile TypeScript
npm run watch        # Watch mode compilation
npm run test         # Run tests
```

### Code Quality

```bash
npm run lint         # Fix linting issues
npm run lint:ci      # Check linting (CI)
npm run format       # Format code
npm run format:ci    # Check formatting (CI)
```

### AWS Deployment

```bash
npm run deploy       # Deploy to AWS
npm run deploy:ci    # Deploy with CI settings
npm run destroy      # Remove AWS resources
npm run diff         # Show deployment diff
npm run synth        # Generate CloudFormation
```

### Cleanup

```bash
npm run clean        # Clean all build artifacts
npm run clean:cdk    # Clean CDK output
npm run clean:tsc    # Clean TypeScript output
```

## Architecture Patterns

- **Serverless-first** - AWS Lambda and Step Functions for scalability
- **Parallel processing** - Independent data sources fetched simultaneously
- **Error resilience** - Retries with exponential backoff and catch blocks
- **Infrastructure as Code** - AWS CDK with TypeScript
- **API-first design** - REST API with proper authentication and rate limiting
- **Security** - API keys stored in Secrets Manager, never in code
- **Cost optimization** - ARM64 Lambda architecture, Express Step Functions

## API Specifications

- **Authentication**: API key via `x-api-key` header
- **Rate limiting**: 10 requests/second, 1000/day per key
- **Location format**: `{city name},{state code},{country code}`
- **Response format**: JSON with weather and tech news objects
- **Error handling**: Graceful degradation if one data source fails
