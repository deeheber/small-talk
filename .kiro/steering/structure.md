# Project Structure

## Root Level

- `bin/` - CDK application entry point
- `lib/` - CDK stack definitions and infrastructure code
- `functions/` - Lambda function source code organized by function
- `test/` - Test files following the same structure as source
- `dist/` - Compiled TypeScript output (generated)
- `cdk.out/` - CDK synthesis output (generated)
- `node_modules/` - NPM dependencies (generated)

## Key Files

- `cdk.json` - CDK configuration and feature flags
- `package.json` - NPM dependencies and scripts
- `tsconfig.json` - TypeScript compiler configuration
- `eslint.config.mjs` - ESLint configuration
- `.prettierrc` - Prettier formatting rules
- `jest.config.js` - Jest testing configuration

## Code Organization

### Infrastructure (`lib/`)

- Stack definitions using AWS CDK constructs
- One stack per logical application boundary
- Resource naming follows pattern: `{stackId}-{resourceType}`

### Lambda Functions (`functions/`)

- Each function in its own subdirectory
- Contains `app.py` (handler) and `requirements.txt`
- Python functions use ARM64 architecture for cost optimization
- Bundling handled automatically by CDK

### Testing (`test/`)

- Test files mirror source structure
- Use `.test.ts` suffix for test files
- Jest configuration supports TypeScript

## Naming Conventions

- Stack resources: `{stackId}-{resourceName}`
- Lambda functions: `{stackId}-{functionName}Function`
- Log groups: Match resource names for easy correlation
- CDK constructs: PascalCase
- Variables: camelCase

## Configuration Management

- Environment-specific values through CDK context
- Secrets stored in AWS Secrets Manager
- API keys and sensitive data never in code
- CDK feature flags in `cdk.json` context

## Build Artifacts

- TypeScript compiles to `dist/`
- CDK synthesizes to `cdk.out/`
- Lambda bundling handled by CDK with local fallback
- Clean commands available for all generated content
