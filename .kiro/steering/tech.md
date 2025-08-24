# Technology Stack

## Core Technologies

- **TypeScript/Node.js** - Primary development language for infrastructure and CDK
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

- Serverless-first approach using AWS Lambda and Step Functions
- Parallel processing for independent data sources
- Error handling with retries and catch blocks
- Infrastructure as Code with AWS CDK
- API-first design with proper authentication
