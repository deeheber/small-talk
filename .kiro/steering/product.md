# Product Overview

Small Talk Generator is a serverless tool that creates conversation starters for people who struggle with small talk or need to connect with geographically distributed teams. The application combines real-time data from multiple sources to provide relevant, timely conversation topics.

## Core Features

1. **Weather Information** ☀️ - Current local conditions via OpenWeather API
2. **Tech News** 📰 - Top 5 trending stories from Hacker News

## Target Users

- **Remote workers** connecting with distributed teams
- **Socially awkward individuals** who want conversation help
- **Anyone** looking to break the ice with relevant topics

## API Design

- REST API with API key authentication
- Single endpoint: `POST /small-talk`
- Input: `{"location": "City, State, Country"}`
- Output: Combined weather + news data for conversation starters
- Imperial units (Fahrenheit, miles) for US audiences

## Future Channels

The architecture supports adding new conversation channels. Ideas welcome via GitHub issues.
