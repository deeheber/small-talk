import json
import logging
import os
import requests
from bs4 import BeautifulSoup
# See bundling code
from utils import get_secret, create_momento_client, get_from_cache, set_in_cache

logger = logging.getLogger()
logger.setLevel("INFO")

def handler(event, context):
    cache_name = "small-talk"
    cache_key = "top-stories"

    try:
        logger.info("Received event: " + json.dumps(event, indent=2))

        momento_client = create_momento_client(ttl_seconds=300)  # 5 minutes

        # Try to get news from cache first
        cached_articles = get_from_cache(momento_client, cache_name, cache_key)
        if cached_articles is not None:
            logger.info("Returning cached Hacker News articles")
            return {"statusCode": 200, "body": cached_articles}

        # Cache miss or failure - fetch from Hacker News
        logger.info("Cache miss - fetching fresh data from Hacker News")
        page = requests.get("https://news.ycombinator.com/")
        page.raise_for_status()  # Raise an HTTPError for bad responses
        soup = BeautifulSoup(page.content, "html.parser")

        # Extract the top 5 articles
        articles = []
        for item in soup.select(".athing")[:5]:
            try:
                title = item.select_one(".titleline a").get_text()
                link = item.select_one(".titleline a")["href"]
                subtext = item.find_next_sibling()

                if subtext:
                    author_elem = subtext.select_one(".hnuser")
                    points_elem = subtext.select_one(".score")
                    comment_links = subtext.select("a")

                    author = author_elem.get_text() if author_elem else "Unknown"
                    points = points_elem.get_text().replace(" points", "") if points_elem else "0"
                    comments = comment_links[-1].get_text().replace("\xa0comments", "") if comment_links else "0"
                else:
                    author = "Unknown"
                    points = "0"
                    comments = "0"

                # Handle relative URLs
                if link.startswith("/"):
                    link = "https://news.ycombinator.com" + link

                articles.append(
                    {
                        "title": title,
                        "link": link,
                        "author": author,
                        "points": int(points) if points.isdigit() else 0,
                        "comments": int(comments) if comments.isdigit() else 0,
                    }
                )
            except Exception as e:
                logger.error(f"Error processing article: {e}")

        # Store fresh data in cache (don't block on cache failures)
        set_in_cache(momento_client, cache_name, cache_key, articles)

        result = {"statusCode": 200, "body": articles}

    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching Hacker News page: {e}")
        result = {
            "statusCode": 500,
            "body": {"error": "Failed to fetch Hacker News page"},
        }
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        result = {
            "statusCode": 500,
            "body": {"error": "An unexpected error occurred"},
        }

    return result
