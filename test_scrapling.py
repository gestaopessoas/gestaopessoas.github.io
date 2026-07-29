from scrapling.fetchers import Fetcher

def scrape_quotes():
    print("Buscando citações em quotes.toscrape.com...")
    # Fetcher is used for fast HTTP requests
    response = Fetcher.get('https://quotes.toscrape.com/')
    
    quotes = response.css('.quote')
    print(f"Foram encontradas {len(quotes)} citações:\n")
    
    for quote in quotes:
        text = quote.css('.text::text').get()
        author = quote.css('.author::text').get()
        print(f"- {author}: {text}")

if __name__ == "__main__":
    scrape_quotes()
