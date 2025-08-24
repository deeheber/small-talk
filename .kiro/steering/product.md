# Product Overview

Small Talk is a tool designed to generate conversation starters for people who struggle with small talk or need to communicate with geographically distributed coworkers. The application provides two main channels of content:

1. **Weather Information** - Uses OpenWeather API to fetch current weather data for a specified location
2. **Tech News** - Scrapes the top 5 articles from Hacker News

The system is built as a serverless AWS application that combines both data sources in parallel and returns structured conversation topics via a REST API. Users provide a location and receive both weather information and current tech news that can be used as natural conversation starters.

The application is designed for socially awkward individuals or remote workers who need help initiating conversations with colleagues in different locations.
