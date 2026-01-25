
"""
Quality Score Calculator
========================
Script one-off per calcolare e salvare il 'quality_score' per tutti i film
nella collezione movies_catalog.

Formula Bayesiana:
    WR = (v / (v + m)) * R + (m / (v + m)) * C
    
    Dove:
    R = avg_vote (voto medio del film)
    v = votes (numero di voti)
    m = MIN_VOTES (soglia minima voti, es. 1000)
    C = GLOBAL_MEAN (media globale voti, es. 6.0)
"""

import os
import time
from pymongo import MongoClient
from pymongo import UpdateOne

# =============================================================================
# CONFIGURAZIONE
# =============================================================================
MONGO_URI = os.getenv("MONGODB_URL", "mongodb://mongodb:27017")
DB_NAME = os.getenv("MONGODB_DB", "cinematch_db")
COLL_NAME = "movies_catalog"

# Parametri Formula Bayesiana (devono coincidere con recommendation_service.py)
MIN_VOTES = 1000
GLOBAL_MEAN = 6.0

def calculate_quality_score(avg_vote, votes):
    """Calcola lo score bayesiano normalizzato 0-1."""
    # Gestione valori null/invalidi
    try:
        if avg_vote is None:
            r = GLOBAL_MEAN
        else:
            r = float(avg_vote)
            
        if votes is None:
            v = 0
        else:
            v = int(votes)
    except (ValueError, TypeError):
        r = GLOBAL_MEAN
        v = 0

    # Formula
    if v > 0:
        weighted_rating = (v / (v + MIN_VOTES)) * r + (MIN_VOTES / (v + MIN_VOTES)) * GLOBAL_MEAN
    else:
        weighted_rating = GLOBAL_MEAN
        
    # Normalizzazione 0-1 (scala 10)
    return weighted_rating / 10.0

def main():
    print("=" * 60)
    print("QUALITY SCORE CALCULATOR")
    print("=" * 60)
    
    start_time = time.time()
    
    try:
        client = MongoClient(MONGO_URI)
        db = client[DB_NAME]
        collection = db[COLL_NAME]
        
        # 1. Recupera tutti i documenti necessari
        print("Reading movies from MongoDB...")
        cursor = collection.find({}, {"_id": 1, "avg_vote": 1, "votes": 1})
        
        # 2. Prepara le operazioni bulk
        print("Calculating scores...")
        updates = []
        count = 0
        
        for doc in cursor:
            score = calculate_quality_score(doc.get("avg_vote"), doc.get("votes"))
            
            updates.append(
                UpdateOne(
                    {"_id": doc["_id"]},
                    {"$set": {"quality_score": score}}
                )
            )
            count += 1
            
            if len(updates) >= 5000:
                print(f"Writing batch... ({count} processed)")
                collection.bulk_write(updates)
                updates = []
        
        # Scrivi rimanenti
        if updates:
            print(f"Writing final batch... ({count} processed)")
            collection.bulk_write(updates)
            
        elapsed = time.time() - start_time
        print("\n" + "=" * 60)
        print("COMPLETED!")
        print(f"Processed documents: {count}")
        print(f"Time elapsed: {elapsed:.2f}s")
        print("=" * 60)
        
    except Exception as e:
        print(f"\nERROR: {e}")
    finally:
        if 'client' in locals():
            client.close()

if __name__ == "__main__":
    main()
