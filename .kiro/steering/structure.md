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

- `README.md` - Project documentation with quick start guide
- `.nvmrc` - Node.js version specification (v22)
- `cdk.json` - CDK configuration and feature flags
- `package.json` - NPM dependencies and scripts
- `tsconfig.json` - TypeScript compiler configuration
- `eslint.config.mjs` - ESLint configuration
- `.prettierrc` - Prettier formatting rules
- `jest.config.js` - Jest testing configuration
- `CONTRIBUTING.md` - Contribution guidelines

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
- Shared utilities in `functions/shared/` for caching and secrets management

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

- **Secrets**: AWS Secrets Manager for API keys (`smalltalk-weather`, `momento-api-key`)
- **Environment**: CDK context for environment-specific values
- **Feature flags**: CDK feature flags in `cdk.json` context
- **Security**: No sensitive data in code or version control
- **Deployment**: Stack outputs provide API endpoints and key IDs
- **Caching**: Momento cache configuration handled via shared utilities

## Documentation Standards

- Use emojis sparingly in documentation for visual appeal
- Keep README scannable with clear sections and code blocks
- Include both curl examples and alternative tools (Postman/Insomnia)
- Provide complete deployment instructions with prerequisites

## Build Artifacts

- TypeScript compiles to `dist/`
- CDK synthesizes to `cdk.out/`
- Lambda bundling handled by CDK with local fallback
- Clean commands available for all generated content
