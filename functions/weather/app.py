import boto3
import json
import logging
import os
import requests

logger = logging.getLogger()
logger.setLevel("INFO")

secrets_manager = boto3.client("secretsmanager", region_name=os.environ["AWS_REGION"])
weather_api_key = None


def handler(event, context):
    try:
        logger.info("Received event: " + json.dumps(event, indent=2))
        location = event.get("body", {}).get("location")

        # TODO: get location weather from cache
        # If in there -> return value
        # If not -> continue

        # Reuse secret on subsequent lambda invokes
        global weather_api_key
        if weather_api_key is None:
            weather_api_key = secrets_manager.get_secret_value(
                SecretId="smalltalk-weather"
            )["SecretString"]

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

        result = {
            "statusCode": 200,
            "body": {
                "location": location,
                "lat": lat,
                "lon": lon,
                "weather": weather_data,
            },
        }

        # TODO: Put weather results into cache
        # Just log failures don't block

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
