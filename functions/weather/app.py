import boto3
from botocore.exceptions import ClientError
from datetime import timedelta
import json
import logging
import os
import requests
from momento import CacheClient, Configurations, CredentialProvider
from momento.responses import CacheGet, CacheSet

logger = logging.getLogger()
logger.setLevel("INFO")

secrets_manager = boto3.client("secretsmanager", region_name=os.environ["AWS_REGION"])
weather_api_key = None
momento_api_key = None

def get_secret(secret_name):
    try:
        client = boto3.client(service_name="secretsmanager", region_name=os.environ["AWS_REGION"])
        response = client.get_secret_value(SecretId=secret_name)
        return response["SecretString"]
    except ClientError as e:
        raise e

def create_momento_client():
    try:
        # Get Momento API key from AWS Secrets Manager
        global momento_api_key
        if momento_api_key is None:
            momento_api_key = get_secret("momento-api-key")

        momento_auth_token = CredentialProvider.from_string(momento_api_key)
        # 15 minutes
        ttl = timedelta(seconds=int("900"))
        config = {
            "configuration": Configurations.Lambda.latest(),
            "credential_provider": momento_auth_token,
            "default_ttl": ttl
        }
        return CacheClient.create(**config)
    except Exception as e:
        logger.error(f"Failed to create Momento client: {e}")
        return None

def get_from_cache(client, cache_name, key):
    if client is None:
        return None

    try:
        resp = client.get(cache_name, key)
        match resp:
            case CacheGet.Hit():
                return json.loads(resp.value_string)
            case CacheGet.Miss():
                return None
            case _:
                logger.error("Unexpected cache get response")
                return None
    except Exception as e:
        logger.error(f"Error getting from cache: {e}")
        return None

def set_in_cache(client, cache_name, key, value):
    if client is None:
        return

    try:
        resp = client.set(cache_name, key, json.dumps(value))
        match resp:
            case CacheSet.Success():
                logger.info(f"Successfully cached data for key: {key}")
            case CacheSet.Error() as error:
                logger.error(f"Error setting cache value: {error.message}")
            case _:
                logger.error("Unexpected cache set response")
    except Exception as e:
        logger.error(f"Error setting cache: {e}")


def handler(event, context):
    try:
        logger.info("Received event: " + json.dumps(event, indent=2))
        location = event.get("body", {}).get("location")

        # Try to get weather from cache first
        cache_name = "small-talk"
        cache_key = location.lower()
        momento_client = create_momento_client()

        cached_weather = get_from_cache(momento_client, cache_name, cache_key)
        if cached_weather is not None:
            logger.info(f"Returning cached weather for {location.lower()}")
            return {"statusCode": 200, "body": cached_weather}

        logger.info("Cache miss - fetching fresh data from the Weather API")

        # Reuse secret on subsequent lambda invokes
        global weather_api_key
        if weather_api_key is None:
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
