import httpx
from bs4 import BeautifulSoup
import re
import html2text
from readability import Document as ReadabilityDocument

# Configure html2text for better Markdown output
def get_html2text_converter():
    h = html2text.HTML2Text()
    h.ignore_links = False
    h.ignore_images = True  # Skip images for cleaner text
    h.ignore_emphasis = False
    h.body_width = 0  # Don't wrap lines
    h.unicode_snob = True
    h.skip_internal_links = True
    h.inline_links = True
    h.protect_links = True
    return h

def process_html_content(html_content: str, url: str = "") -> str:
    """
    Processes raw HTML content and converts it to clean Markdown using Readability.
    """
    try:
        # Use Readability algorithm for universal content extraction
        print("DEBUG: Using Readability algorithm for content extraction...")
        try:
            readability_doc = ReadabilityDocument(html_content)
            readability_html = readability_doc.summary()
            title = readability_doc.title() or "No Title"
            
            # Parse the Readability output
            main_content = BeautifulSoup(readability_html, "html.parser")
            print(f"DEBUG: Readability extracted content successfully")
        except Exception as e:
            print(f"DEBUG: Readability extraction failed: {e}, falling back to body")
            soup = BeautifulSoup(html_content, "html.parser")
            title = soup.title.string.strip() if soup.title else "No Title"
            
            # Remove noise tags
            for tag in soup(["script", "style", "nav", "footer", "header", "aside", 
                            "iframe", "noscript", "form", "button", "input", "svg"]):
                tag.decompose()
            main_content = soup.body
        
        if not main_content:
            return f"Title: {title}\n\nError: Could not extract content"
        
        # Convert HTML to Markdown using html2text
        converter = get_html2text_converter()
        # Ensure base url is set for relative links if url is provided
        if url:
            converter.baseurl = url
            
        markdown_content = converter.handle(str(main_content))
        
        # Clean up excessive whitespace
        markdown_content = re.sub(r'\n{3,}', '\n\n', markdown_content)
        markdown_content = markdown_content.strip()
        
        # Limit length
        if len(markdown_content) > 20000:
            markdown_content = markdown_content[:20000] + "\n\n[内容已截断...]"
        
        print(f"DEBUG: Successfully processed {len(markdown_content)} chars.")
        return f"Title: {title}\n\n{markdown_content}"
        
    except Exception as e:
        print(f"Failed to process HTML: {e}")
        return f"Error processing content: {str(e)}"

async def fetch_url_content(url: str) -> str:
    """
    Fetches the URL and extracts main text content as clean Markdown.
    """
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        async with httpx.AsyncClient(verify=False, timeout=15.0, headers=headers) as client:
            print(f"DEBUG: Fetching URL: {url}")
            response = await client.get(url, follow_redirects=True)
            print(f"DEBUG: URL Status: {response.status_code}")
            response.raise_for_status()
            
            return process_html_content(response.text, url)
            
    except Exception as e:
        print(f"Failed to fetch URL {url}: {e}")
        return f"Error fetching {url}: {str(e)}"

def is_url(text: str) -> bool:
    return re.match(r'^https?://', text.strip()) is not None
