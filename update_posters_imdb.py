import pandas as pd
import time
import os

# ==============================
# CONFIGURAZIONE
# ==============================
CSV_PATH = "Dati-prova-letterbox/movies_final.csv"
SLEEP_TIME = 2.0  # IMDb è severo, meglio non scendere sotto i 2 secondi
# ==============================

def main():
    print(f"📂 Lettura file: {CSV_PATH}")
    if not os.path.exists(CSV_PATH):
        print("❌ File non trovato!")
        return

    df = pd.read_csv(CSV_PATH, low_memory=False)

    # Se la colonna poster_url non esiste, la creo
    if "poster_url" not in df.columns:
        df["poster_url"] = None

    # FILTRO: Prendo solo quelli SENZA poster
    # (Il codice del tuo amico faceva solo il 2020, qui facciamo tutto quello che manca)
    missing_mask = df['poster_url'].isna() | (df['poster_url'] == '')
    df_missing = df[missing_mask]

    total_missing = len(df_missing)
    print(f"📊 Totale film nel file: {len(df)}")
    print(f"🎯 Film da aggiornare (senza poster): {total_missing}")

    if total_missing == 0:
        print("✅ Tutti i film hanno già un poster!")
        return

    # Provo a importare la libreria qui per gestire l'errore se manca
    try:
        from imdbinfo import get_movie
    except ImportError:
        print("\n❌ ERRORE: La libreria 'imdbinfo' non è installata.")
        print("👉 Installala eseguendo nel terminale: pip install imdb-info\n")
        return

    print("🚀 Inizio recupero poster da IMDb...")
    count = 0

    for idx, row in df_missing.iterrows():
        imdb_id = row.get("imdb_title_id")

        # Salto se è NaN o non valido
        if pd.isna(imdb_id) or not isinstance(imdb_id, str):
            continue

        # Rimuovo 'tt' perché imdbinfo vuole solo i numeri (es. tt12345 -> 12345)
        imdb_numeric_id = imdb_id[2:]

        try:
            movie = get_movie(imdb_numeric_id)
            
            # Controllo se ha trovato la cover
            if hasattr(movie, 'cover_url') and movie.cover_url:
                poster_url = movie.cover_url
                df.at[idx, "poster_url"] = poster_url
                print(f"✅ [{count+1}/{total_missing}] {imdb_id}: Trovato!")
            else:
                print(f"⚠️  [{count+1}/{total_missing}] {imdb_id}: Poster non disponibile su IMDb")

            # Reset contatore errori consecutivi se va a buon fine
            
        except Exception as e:
            print(f"❌ [{count+1}/{total_missing}] {imdb_id}: Errore ({e})")
        
        count += 1
        
        # Salvataggio intermedio ogni 50 film per sicurezza
        if count % 50 == 0:
            print("💾 Salvataggio automatico...")
            df.to_csv(CSV_PATH, index=False)

        time.sleep(SLEEP_TIME)


    # Salvo il CSV finale
    df.to_csv(CSV_PATH, index=False)
    print("\n✅ CSV aggiornato correttamente e salvato.")

if __name__ == "__main__":
    main()
