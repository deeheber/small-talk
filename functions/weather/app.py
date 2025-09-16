import json
import logging
import requests
# See bundling code
from utils import get_secret, create_momento_client, get_from_cache, set_in_cache

logger = logging.getLogger()
logger.setLevel("INFO")

def handler(event, context):
    try:
        logger.info("Received event: " + json.dumps(event, indent=2))
        location = event.get("body", {}).get("location")

        # Try to get weather from cache first
        cache_name = "small-talk"
        cache_key = location.lower()
        momento_client = create_momento_client(ttl_seconds=900)  # 15 minutes

        cached_weather = get_from_cache(momento_client, cache_name, cache_key)
        if cached_weather is not None:
            logger.info(f"Returning cached weather for {location.lower()}")
            return {"statusCode": 200, "body": cached_weather}

        logger.info("Cache miss - fetching fresh data from the Weather API")

        weather_api_key = get_secret("smalltalk-weather")

        # Get coords
        coords_response = requests.get(
            f"https://api.openweathermap.org/geo/1.0/direct?q={location}&limit=1&appid={weather_api_key}"
        )
        coords_data = coords_response.json()
        lat = coords_data[0].get("lat", "")
        lon = coords_data[0].get("lon", "")
        logger.info(f"lat: {lat}, lon: {lon}")

        # Get weather
        weather_response = requests.get(
            f"https://api.openweathermap.org/data/3.0/onecall?lat={lat}&lon={lon}&units=imperial&exclude=minutely,hourly,daily,alerts&appid={weather_api_key}"
        )
        weather_data = weather_response.json()["current"]
        logger.info(f"weather_data: {weather_data}")

        # Store fresh data in cache (don't block on cache failures)
        set_in_cache(momento_client, cache_name, cache_key, { "location": location, "lat": lat, "lon": lon, "weather": weather_data})

        result = {
            "statusCode": 200,
            "body": {
                "location": location,
                "lat": lat,
                "lon": lon,
                "weather": weather_data,
            },
        }

    except requests.exceptions.RequestException as e:
        logger.error(f"HTTP error: {e}")
        result = {"statusCode": 500, "body": {"error": "Failed to fetch"}}
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        result = {
            "statusCode": 500,
            "body": {"error": "An unexpected error occurred"},
        }

    return result
