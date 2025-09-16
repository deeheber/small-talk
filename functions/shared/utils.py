"""
Shared utilities for Small Talk Lambda functions.
Provides common functionality for secrets management and caching.
"""

import boto3
from botocore.exceptions import ClientError
from datetime import timedelta
import json
import logging
import os
from momento import CacheClient, Configurations, CredentialProvider
from momento.responses import CacheGet, CacheSet

logger = logging.getLogger()

# Global cache for secrets to avoid repeated API calls
_secret_cache = {}


def get_secret(secret_name: str) -> str:
    """
    Retrieve a secret from AWS Secrets Manager with caching.
    
    Args:
        secret_name: Name of the secret in AWS Secrets Manager
        
    Returns:
        The secret value as a string
        
    Raises:
        ClientError: If the secret cannot be retrieved
    """
    global _secret_cache
    
    if secret_name in _secret_cache:
        logger.info(f"Returning cached secret for {secret_name}")
        return _secret_cache[secret_name]

    try:
        client = boto3.client(
            service_name="secretsmanager", 
            region_name=os.environ["AWS_REGION"]
        )
        response = client.get_secret_value(SecretId=secret_name)
        secret_value = response["SecretString"]
        
        # Cache the secret for subsequent calls
        _secret_cache[secret_name] = secret_value
        return secret_value
        
    except ClientError as e:
        logger.error(f"Failed to retrieve secret {secret_name}: {e}")
        raise e


def create_momento_client(ttl_seconds: int = 900) -> CacheClient | None:
    """
    Create a Momento cache client with the specified TTL.
    
    Args:
        ttl_seconds: Time-to-live for cached items in seconds (default: 900 = 15 minutes)
        
    Returns:
        CacheClient instance or None if creation fails
    """
    try:
        momento_api_key = get_secret("momento-api-key")
        momento_auth_token = CredentialProvider.from_string(momento_api_key)
        
        ttl = timedelta(seconds=ttl_seconds)
        config = {
            "configuration": Configurations.Lambda.latest(),
            "credential_provider": momento_auth_token,
            "default_ttl": ttl
        }
        return CacheClient.create(**config)
        
    except Exception as e:
        logger.error(f"Failed to create Momento client: {e}")
        return None


def get_from_cache(client: CacheClient, cache_name: str, key: str) -> dict | None:
    """
    Retrieve data from Momento cache.
    
    Args:
        client: Momento cache client
        cache_name: Name of the cache
        key: Cache key
        
    Returns:
        Cached data as dict or None if not found/error
    """
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


def set_in_cache(client: CacheClient, cache_name: str, key: str, value: dict) -> None:
    """
    Store data in Momento cache.
    
    Args:
        client: Momento cache client
        cache_name: Name of the cache
        key: Cache key
        value: Data to cache (will be JSON serialized)
    """
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
