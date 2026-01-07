import pandas as pd
import requests
import time
import os

# =================CONFIGURATION=================
# INSERISCI QUI LA TUA CHIAVE API DI TMDB
TMDB_API_KEY = "272643841dd72057567786d8fa7f8c5f" 
# ===============================================

INPUT_CSV = "Dati-prova-letterbox/movies_final.csv"
OUTPUT_CSV = "Dati-prova-letterbox/movies_final_updated.csv"

def get_poster_from_tmdb(imdb_id):
    """
    Cerca il poster su TMDB usando l'ID IMDb.
    """
    if not isinstance(imdb_id, str):
        return None
        
    url = f"https://api.themoviedb.org/3/find/{imdb_id}"
    params = {
        "api_key": TMDB_API_KEY,
        "external_source": "imdb_id"
    }
    
    try:
        response = requests.get(url, params=params, timeout=5)
        if response.status_code == 200:
            data = response.json()
            # Cerca nei risultati dei film
            results = data.get("movie_results", [])
            if results:
                poster_path = results[0].get("poster_path")
                if poster_path:
                    # Costruisci URL completo (w500 è la dimensione)
                    return f"https://image.tmdb.org/t/p/w500{poster_path}"
    except Exception as e:
        print(f"Errore richiesta per {imdb_id}: {e}")
    
    return None

def main():
    print(f"📂 Lettura file: {INPUT_CSV}")
    try:
        df = pd.read_csv(INPUT_CSV, low_memory=False)
    except FileNotFoundError:
        print("❌ File non trovato!")
        return

    # Conta quanti mancano
    missing_mask = df['poster_url'].isna() | (df['poster_url'] == '')
    total_missing = missing_mask.sum()
    
    print(f"📊 Totale film: {len(df)}")
    print(f"🖼️  Poster mancanti: {total_missing}")
    
    if total_missing == 0:
        print("✅ Tutti i film hanno già un poster!")
        return

    print("🚀 Inizio recupero poster da TMDB...")
    
    # Contatore per limitare le richieste (rate limit) o per test
    count = 0
    updated_count = 0
    
    for index, row in df[missing_mask].iterrows():
        imdb_id = row.get('imdb_title_id')
        
        poster_url = get_poster_from_tmdb(imdb_id)
        
        if poster_url:
            df.at[index, 'poster_url'] = poster_url
            updated_count += 1
            print(f"✅ [{updated_count}/{total_missing}] Trovato per {row['title']}: {poster_url}")
        else:
            print(f"❌ [{count+1}/{total_missing}] Non trovato per {imdb_id} - {row['title']}")
            
        count += 1
        
        # Salvataggio intermedio ogni 100 richieste
        if count % 100 == 0:
            print("💾 Salvataggio intermedio...")
            df.to_csv(OUTPUT_CSV, index=False)
            
        # Rispetta i limiti API (circa 40/50 richieste al secondo per TMDB, ma stiamo sicuri)
        time.sleep(0.1)

    # Salvataggio finale
    print("💾 Salvataggio finale...")
    df.to_csv(OUTPUT_CSV, index=False)
    print(f"✅ Finito! File salvato in: {OUTPUT_CSV}")

if __name__ == "__main__":
    if TMDB_API_KEY == "LA_TUA_CHIAVE_API_MDB":
        print("⚠️  ATTENZIONE: Devi inserire la tua API KEY di TMDB nello script!")
    else:
        main()
