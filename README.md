# small-talk

Coming soon ™️

An app to generate small talk for those who hate small talk. Helpful for those who are socially awkward, or just want to avoid it. Could also be helpful to workers who need to communicate with coworkers who are geographically located in different areas.

## Channels

1. Weather
2. Current news

Source APIs - TBD

## Tech stack

- Node.js
- TypeScript
- AWS
  - API Gateway
  - Step Functions
  - Lambda
  - IAM
  - Cognito
  - Secrets Manager
  - CDK
- Caching service - likely [Momento](https://www.gomomento.com/)
- Frontend - TBD (Likely React or Flutter web)

## Release plan

- v1.0.0 - CLI app that generates small talk based on a location that a user inputs
- v2.0.0 - Web app that generates small talk based on a location that a user inputs
- v3.0.0 - Add optional authentication to web app to allow users to save their favorite locations
