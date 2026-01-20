import os
from pymongo import MongoClient
from elasticsearch import Elasticsearch

# Configuration
MONGO_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
ES_URL = os.getenv("ELASTICSEARCH_URL", "http://localhost:9200")

DB_NAME = "cinematch_db"
MOVIES_COLLECTION = "movies_catalog"
REVIEWS_COLLECTION = "reviews"
ES_INDEX_NAME = "movies"

def split_field(value):
    """
    Transforms comma-separated strings into clean lists.
    """
    if not value or not isinstance(value, str):
        return []
    return [v.strip() for v in value.split(",") if v.strip()]

def get_reviews_for_movie(db, movie_title, original_title=None, max_reviews=100):
    """
    Fetches reviews from MongoDB matching the movie title.
    Tries matching 'title' first, then 'original_title'.
    """
    reviews = []
    
    # Strategy 1: Match exactly on 'title' (which is the standardized title from earlier import)
    query = {"movie_title": movie_title}
    
    cursor = db[REVIEWS_COLLECTION].find(query).limit(max_reviews)
    reviews = [doc.get("review", "") for doc in cursor if "review" in doc]

    # Strategy 2: If no reviews found and original_title exists, try that
    if not reviews and original_title:
         # Note: The import script used standard filename-based titles. 
         # Depending on how 'original_title' matches the filename, this might or might not yield results.
         # But it's a good fallback requested by user logic.
         query = {"movie_title": original_title}
         cursor = db[REVIEWS_COLLECTION].find(query).limit(max_reviews)
         reviews = [doc.get("review", "") for doc in cursor if "review" in doc]
    
    return reviews

def build_es_document(movie, reviews):
    """
    Constructs the Elasticsearch document from MongoDB movie data and fetched reviews.
    """
    doc = {
        "mongo_id": str(movie.get("_id")),
        "imdb_title_id": movie.get("imdb_title_id"), # distinct field often in datasets
        "title": movie.get("title"),
        "original_title": movie.get("original_title"),
        "year": movie.get("year"),
        "duration": movie.get("duration"),
        
        "genres": split_field(movie.get("genre")),
        "actors": split_field(movie.get("actors")),
        "director": split_field(movie.get("director")),
        "country": movie.get("country"),
        "language": movie.get("language"),

        "description": movie.get("description"),
        
        "avg_vote": movie.get("avg_vote"),
        "votes": movie.get("votes"),
        
        # Reviews added here
        "reviews": reviews
    }
    return doc

def sync_to_elasticsearch():
    # Connections
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    
    es = Elasticsearch(ES_URL)
    
    if not es.ping():
        print(f"Cannot connect to Elasticsearch at {ES_URL}")
        try:
             print(es.info())
        except Exception as e:
             print(f"Error details: {e}")
        return

    # Create index if not exists (simple check, or let automatic creation handle it)
    # Ideally should define mappings for better analysis, but standard dynamic mapping works for now.
    
    print(f"Starting sync from MongoDB [{MOVIES_COLLECTION}] to Elasticsearch [{ES_INDEX_NAME}]...")
    
    cursor = db[MOVIES_COLLECTION].find({}).batch_size(500)
    
    count = 0
    total_docs = db[MOVIES_COLLECTION].count_documents({})
    
    for movie in cursor:
        title = movie.get("title")
        if not title:
            continue
            
        original_title = movie.get("original_title")
        
        # Fetch reviews
        reviews = get_reviews_for_movie(db, title, original_title)
        
        # Build doc
        es_doc = build_es_document(movie, reviews)
        
        # Index
        try:
            es.index(
                index=ES_INDEX_NAME,
                id=str(movie["_id"]),
                document=es_doc
            )
            count += 1
            if count % 100 == 0:
                print(f"Indexed {count}/{total_docs} movies...")
        except Exception as e:
            print(f"Error indexing movie {title}: {e}")

    print(f"Sync complete. Total indexed: {count}")
    client.close()

if __name__ == "__main__":
    sync_to_elasticsearch()
