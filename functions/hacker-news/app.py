import json
import requests
from bs4 import BeautifulSoup

def handler(event, context):
  try:
    # Log the received event
    print("Received event: " + json.dumps(event, indent=2))
    
    # Fetch the Hacker News page
    page = requests.get('https://news.ycombinator.com/')
    page.raise_for_status()  # Raise an HTTPError for bad responses
    soup = BeautifulSoup(page.content, 'html.parser')
    
    # Extract the top 5 articles
    articles = []
    for item in soup.select('.athing')[:5]:
      try:
        title = item.select_one('.titleline a').get_text()
        link = item.select_one('.titleline a')['href']
        subtext = item.find_next_sibling()
        
        if subtext:
          author = subtext.select_one('.hnuser').get_text()
          points = subtext.select_one('.score').get_text().replace(' points', '')
          comments = subtext.select('a')[-1].get_text().replace('\xa0comments', '')
        else:
          author = None
          points = None
          comments = None
        
        articles.append({
            'title': title,
            'link': link,
            'author': author,
            'points': int(points),
            'comments': int(comments)
        })
      except Exception as e:
        print(f"Error processing article: {e}")
    
    # Return the result
    result = {
      'statusCode': 200,
      'body': articles
    }
    
  except requests.exceptions.RequestException as e:
    print(f"Error fetching Hacker News page: {e}")
    result = {
      'statusCode': 500,
      'body': json.dumps({'error': 'Failed to fetch Hacker News page'})
    }
  except Exception as e:
    print(f"Unexpected error: {e}")
    result = {
      'statusCode': 500,
      'body': json.dumps({'error': 'An unexpected error occurred'})
    }
  
  return result
