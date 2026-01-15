import os
import glob
import pandas as pd
from pymongo import MongoClient
import re

# Configuration
MONGO_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
REVIEW_FOLDER = os.path.join(os.path.dirname(__file__), "review")
DB_NAME = "cinematch_db"
COLLECTION_NAME = "reviews"

def import_reviews():
    # Connect to MongoDB
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    collection = db[COLLECTION_NAME]
    
    # Get all csv files
    csv_files = glob.glob(os.path.join(REVIEW_FOLDER, "*.csv"))
    
    if not csv_files:
        print(f"No CSV files found in {REVIEW_FOLDER}")
        return

    print(f"Found {len(csv_files)} CSV files. Starting import...")

    # Clear existing reviews to avoid duplicates or old schema
    collection.delete_many({})
    print("Cleared existing reviews from MongoDB.")

    total_inserted = 0
    
    for file_path in csv_files:
        filename = os.path.basename(file_path)
        # Remove extension
        name_no_ext = os.path.splitext(filename)[0]
        
        # Remove last 5 chars (year + space usually)
        # User instruction: "esclusi gli ultimi 5 caratteri che sono l'anno del film"
        # Example: "3 Idiots 2009" -> "3 Idiots"
        if len(name_no_ext) > 5:
            title = name_no_ext[:-5]
            year = name_no_ext[-4:]
        else:
            title = name_no_ext 
            year = None
            
        print(f"Processing '{filename}' -> Movie: '{title}' ({year})")
        
        try:
            # Read CSV
            df = pd.read_csv(file_path)
            
            # Check columns
            if 'title' in df.columns:
                df.rename(columns={'title': 'title_review'}, inplace=True)
            
            # Add title and year fields
            df['title'] = title
            df['year'] = year
            
            # Limit to 100 reviews
            df = df.head(100)
            
            # Basic cleanup: Handle 'Null' strings as standard NaNs or None
            # (MongoDB handles None as null)
            df.replace({'Null': None}, inplace=True)
            
            # Convert to list of dictionaries
            records = df.to_dict("records")
            
            if records:
                # Insert into MongoDB
                collection.insert_many(records)
                count = len(records)
                total_inserted += count
                # print(f"  Inserted {count} reviews.")
            else:
                print(f"  No records found in {filename}.")
                
        except Exception as e:
            print(f"  Error processing {filename}: {e}")

    print("="*50)
    print(f"Import complete. Total reviews inserted: {total_inserted}")
    print("="*50)
    client.close()

if __name__ == "__main__":
    import_reviews()
