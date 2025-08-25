# Small Talk Generator 💬

Generate conversation starters when small talk doesn't come naturally. Perfect for remote workers connecting with distributed teams or anyone who wants to break the ice with relevant, timely topics.

## What You Get

- **Current Weather** ☀️ - Local conditions via [OpenWeather API](https://openweathermap.org/api)
- **Tech News** 📰 - Top 5 stories from [Hacker News](https://news.ycombinator.com/)

Got ideas for more channels? [Open an issue](https://github.com/deeheber/small-talk/issues) and let us know!

## Tech Stack

**Backend:** TypeScript/Node.js, Python, AWS CDK  
**AWS Services:** API Gateway, Step Functions, Lambda, Secrets Manager  
**Frontend:** Coming soon (HTMX or React)

## Architecture

### Step Function Workflow Diagram

<img width="537" alt="small-talk-asl" src="https://github.com/deeheber/small-talk/assets/12616554/fff34b51-e832-4f1d-835b-046f4c7eb4eb">

## Roadmap

Track progress and upcoming features on [the project board](https://github.com/users/deeheber/projects/1/views/1).

## Quick Start 🚀

### Prerequisites

- Node.js installed
- AWS account with [CLI configured](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-quickstart.html)
- [OpenWeather API key](https://openweathermap.org/api) (free tier available)

### Deploy to AWS

1. **Setup secrets**

   ```bash
   # Store your OpenWeather API key in AWS Secrets Manager
   aws secretsmanager create-secret --name smalltalk-weather --secret-string "your-api-key-here"
   ```

2. **Deploy the app**

   ```bash
   git clone <this-repo>
   cd small-talk
   npm install
   npm run deploy
   ```

3. **Note the outputs** - Save the API endpoint and key ID from the deployment output

### Usage

1. **Get your API key**

   ```bash
   aws apigateway get-api-key --api-key <CLI-ApiKeyId-from-deploy> --include-value
   ```

2. **Make a request**
   ```bash
   curl -X POST https://<your-api-endpoint>/small-talk \
     -H "x-api-key: <your-api-key>" \
     -H "Content-Type: application/json" \
     -d '{"location": "Portland, Oregon, US"}'
   ```

**Location format:** `{city name},{state code},{country code}` (see [OpenWeather docs](https://openweathermap.org/api/geocoding-api))  
**Units:** Imperial (Fahrenheit, miles, etc.)  
**Alternative:** Use [Postman](https://www.postman.com/) or [Insomnia](https://insomnia.rest/) for testing

## Development 🛠️

```bash
npm run build    # Compile TypeScript
npm run test     # Run tests (coming soon)
npm run lint     # Check code style
npm run destroy  # Remove AWS resources
```

## Contributing

See [CONTRIBUTING.md](https://github.com/deeheber/small-talk/blob/main/CONTRIBUTING.md) for more info on our guidelines.
