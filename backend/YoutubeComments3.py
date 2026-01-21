"""
YoutubeComments3 - Ottiene multipli commenti puliti da un video YouTube
"""
from googleapiclient.discovery import build
import re
import html

# -----------------------------
# CONFIG
# -----------------------------
YOUTUBE_API_KEY = "AIzaSyCWgR9xeE3H2arlD_M8twh82WJ8cc2g6WQ"
MAX_COMMENTS = 5
MIN_CHARS = 80

SPAM_KEYWORDS = ["subscribe"]


# -----------------------------
# UTILITY
# -----------------------------
def extract_video_id(youtube_url: str) -> str:
    """Estrae il video ID da un URL YouTube."""
    if "v=" in youtube_url:
        return youtube_url.split("v=")[-1].split("&")[0]
    return youtube_url


def clean_comment(text: str) -> str:
    """Pulisce il testo del commento."""
    text = html.unescape(text)

    # rimuove HTML
    text = re.sub(r"<.*?>", "", text)

    # rimuove URL
    text = re.sub(r"http\S+", "", text)

    # rimuove timestamp tipo 1:23
    text = re.sub(r"\b\d{1,2}:\d{2}\b", "", text)

    # rimuove emoji / caratteri strani (soft)
    text = re.sub(r"[^\w\s.,!?'\"]", "", text)

    # spazi multipli
    text = re.sub(r"\s+", " ", text).strip()

    return text


def is_spam(text: str) -> bool:
    """Controlla se il commento è spam."""
    lower = text.lower()

    # keyword spam
    for k in SPAM_KEYWORDS:
        if k in lower:
            return True

    # troppi link
    if text.count("http") > 0:
        return True

    # tutto maiuscolo
    if text.isupper():
        return True

    # troppe ripetizioni
    words = text.split()
    if len(words) > 10 and len(set(words)) / len(words) < 0.4:
        return True

    return False


# -----------------------------
# COMMENTI YOUTUBE
# -----------------------------
def get_multiple_comments(youtube_url: str, max_comments: int = 5, min_chars: int = 5) -> list:
    """
    Ottiene multipli commenti validi da un video YouTube.
    Restituisce una lista di dizionari con author, published_at, text.
    """
    video_id = extract_video_id(youtube_url)

    try:
        youtube = build(
            "youtube",
            "v3",
            developerKey=YOUTUBE_API_KEY
        )

        collected = []

        request = youtube.commentThreads().list(
            part="snippet",
            videoId=video_id,
            maxResults=100,
            textFormat="plainText",
            order="relevance"
        )

        while request and len(collected) < max_comments:
            response = request.execute()

            for item in response.get("items", []):
                snippet = item["snippet"]["topLevelComment"]["snippet"]
                raw = snippet["textDisplay"]
                cleaned = clean_comment(raw)

                if len(cleaned) < min_chars:
                    continue

                if is_spam(cleaned):
                    continue

                comment_data = {
                    "author": snippet["authorDisplayName"],
                    "published_at": snippet["publishedAt"],
                    "text": cleaned
                }

                collected.append(comment_data)

                if len(collected) >= max_comments:
                    break

            if len(collected) >= max_comments:
                break

            request = youtube.commentThreads().list_next(request, response)

        return collected

    except Exception as e:
        print(f"Errore recupero commenti YouTube: {e}")
        return []


def get_trailer_comments(trailer_url: str, max_comments: int = 5) -> list:
    """
    Wrapper per ottenere multipli commenti da un trailer.
    Restituisce lista vuota se il trailer_url è None o non valido.
    """
    if not trailer_url:
        return []
    
    return get_multiple_comments(trailer_url, max_comments=max_comments, min_chars=MIN_CHARS)
