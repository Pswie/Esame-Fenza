# 🎬 Guida al Recupero delle Immagini dei Film

## Panoramica

Per recuperare le immagini (poster) dei film dal tuo dataset CSV, il metodo migliore è utilizzare **TMDb (The Movie Database) API**.

---

## � CARICAMENTO CATALOGO SU MONGODB

### Passo 1: Avvia i container Docker

```bash
docker-compose up -d mongodb backend
```

### Passo 2: Carica il catalogo film

```bash
# Entra nel container backend
docker exec -it cinematch_backend bash

# Esegui lo script di caricamento
python load_movies_catalog.py
```

Oppure da Windows:
```powershell
docker exec cinematch_backend python load_movies_catalog.py
```

### Passo 3: Verifica il caricamento

Visita: `http://localhost:8000/catalog/stats`

Dovresti vedere:
```json
{
  "total_movies": 80000,
  "with_real_poster": 0,
  "with_stock_poster": 80000,
  "top_genres": [...],
  "by_decade": [...]
}
```

---

## 🖼️ GESTIONE POSTER (Con Fallback)

### Come funziona nel tuo progetto

1. **Se `poster_url` è presente nel CSV** → Usa quello
2. **Se `poster_url` è vuoto** → Usa immagine stock di fallback

### URL Immagine Stock di Default

```
https://via.placeholder.com/500x750/1a1a2e/e50914?text=No+Poster
```

### Endpoint API Disponibili

| Endpoint | Descrizione |
|----------|-------------|
| `GET /catalog/movies` | Lista film con filtri |
| `GET /catalog/movie/{imdb_id}` | Dettagli singolo film |
| `GET /catalog/search?q=titolo` | Ricerca per titolo |
| `GET /catalog/genres` | Lista generi |
| `GET /catalog/poster/{imdb_id}` | Solo URL poster |
| `GET /catalog/stats` | Statistiche catalogo |

### Esempi di chiamate

```bash
# Tutti i film
curl http://localhost:8000/catalog/movies?limit=10

# Ricerca
curl http://localhost:8000/catalog/search?q=Inception

# Film per genere
curl http://localhost:8000/catalog/movies?genre=Drama

# Poster specifico
curl http://localhost:8000/catalog/poster/tt0111161
```

---

## 🔑 1. Ottenere Poster REALI con TMDb API (Opzionale)

Se vuoi aggiungere poster reali ai film, puoi usare TMDb API.

---

## 🐍 2. Script Python per Recuperare i Poster

### Installazione dipendenze

```bash
pip install requests pandas
```

### Script completo

```python
import requests
import pandas as pd
import time
import os

# Configurazione
TMDB_API_KEY = "LA_TUA_API_KEY_QUI"  # Sostituisci con la tua API key
TMDB_BASE_URL = "https://api.themoviedb.org/3"
TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500"  # w500 = larghezza 500px

def search_movie(title: str, year: int = None) -> dict:
    """Cerca un film su TMDb per titolo e anno"""
    url = f"{TMDB_BASE_URL}/search/movie"
    params = {
        "api_key": TMDB_API_KEY,
        "query": title,
        "language": "it-IT"  # Risultati in italiano
    }
    if year:
        params["year"] = year
    
    response = requests.get(url, params=params)
    if response.status_code == 200:
        results = response.json().get("results", [])
        if results:
            return results[0]  # Primo risultato (più rilevante)
    return None

def get_poster_url(movie_data: dict) -> str:
    """Estrae l'URL del poster dal risultato TMDb"""
    if movie_data and movie_data.get("poster_path"):
        return f"{TMDB_IMAGE_BASE_URL}{movie_data['poster_path']}"
    return None

def download_poster(url: str, filename: str, output_dir: str = "posters"):
    """Scarica il poster e lo salva su disco"""
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    response = requests.get(url)
    if response.status_code == 200:
        filepath = os.path.join(output_dir, filename)
        with open(filepath, "wb") as f:
            f.write(response.content)
        return filepath
    return None

def process_csv(csv_path: str, output_csv: str = "movies_with_posters.csv"):
    """Processa il CSV e aggiunge gli URL dei poster"""
    df = pd.read_csv(csv_path)
    
    poster_urls = []
    tmdb_ids = []
    
    for index, row in df.iterrows():
        title = row["Name"]
        year = row.get("Year")
        
        print(f"Cercando: {title} ({year})...")
        
        movie = search_movie(title, year)
        
        if movie:
            poster_url = get_poster_url(movie)
            tmdb_id = movie.get("id")
            poster_urls.append(poster_url)
            tmdb_ids.append(tmdb_id)
            print(f"  ✅ Trovato! Poster: {poster_url}")
        else:
            poster_urls.append(None)
            tmdb_ids.append(None)
            print(f"  ❌ Non trovato")
        
        # Rispetta il rate limit (max 40 richieste/10 secondi)
        time.sleep(0.3)
    
    # Aggiungi le nuove colonne
    df["tmdb_id"] = tmdb_ids
    df["poster_url"] = poster_urls
    
    # Salva il nuovo CSV
    df.to_csv(output_csv, index=False)
    print(f"\n✅ Salvato: {output_csv}")
    
    return df

# Esegui
if __name__ == "__main__":
    df = process_csv("Dati-prova-letterbox/ratings.csv")
    print(f"\nFilm con poster trovati: {df['poster_url'].notna().sum()}/{len(df)}")
```

---

## 📥 3. Scaricare le Immagini Localmente

Se vuoi scaricare i poster come file immagine:

```python
def download_all_posters(df: pd.DataFrame, output_dir: str = "posters"):
    """Scarica tutti i poster dal DataFrame"""
    for index, row in df.iterrows():
        if row.get("poster_url"):
            # Nome file sicuro
            safe_name = "".join(c for c in row["Name"] if c.isalnum() or c in " -_")
            filename = f"{safe_name}_{row['Year']}.jpg"
            
            print(f"Scaricando: {filename}...")
            download_poster(row["poster_url"], filename, output_dir)
            time.sleep(0.2)
    
    print(f"✅ Poster scaricati in: {output_dir}/")
```

---

## 🌐 4. Uso nel Frontend React

Nel tuo frontend CineMatch, puoi usare direttamente gli URL:

```tsx
interface Movie {
  name: string;
  year: number;
  poster_url: string;
}

const MovieCard = ({ movie }: { movie: Movie }) => {
  return (
    <div className="movie-card">
      <img 
        src={movie.poster_url || "/placeholder-poster.png"} 
        alt={movie.name}
        onError={(e) => {
          e.currentTarget.src = "/placeholder-poster.png";
        }}
      />
      <h3>{movie.name}</h3>
      <p>{movie.year}</p>
    </div>
  );
};
```

---

## 📊 5. Dimensioni Poster Disponibili (TMDb)

| Codice | Dimensione | Uso consigliato |
|--------|------------|-----------------|
| `w92` | 92px | Miniature |
| `w154` | 154px | Liste piccole |
| `w185` | 185px | Card medie |
| `w342` | 342px | Card grandi |
| `w500` | 500px | Dettaglio film |
| `w780` | 780px | Hero images |
| `original` | Originale | Alta qualità |

Cambia `w500` nell'URL base con il codice desiderato.

---

## ⚡ 6. Integrazione con Backend Flask

Aggiungi un endpoint nel tuo backend:

```python
# backend/main.py

@app.route("/api/movie-poster/<title>/<int:year>")
def get_movie_poster(title: str, year: int):
    """Endpoint per recuperare il poster di un film"""
    TMDB_API_KEY = os.getenv("TMDB_API_KEY")
    
    url = f"https://api.themoviedb.org/3/search/movie"
    params = {
        "api_key": TMDB_API_KEY,
        "query": title,
        "year": year
    }
    
    response = requests.get(url, params=params)
    results = response.json().get("results", [])
    
    if results and results[0].get("poster_path"):
        poster_url = f"https://image.tmdb.org/t/p/w500{results[0]['poster_path']}"
        return jsonify({
            "poster_url": poster_url,
            "tmdb_id": results[0]["id"]
        })
    
    return jsonify({"error": "Poster non trovato"}), 404
```

---

## 🔧 7. Variabili d'Ambiente

Aggiungi al tuo `.env`:

```env
TMDB_API_KEY=la_tua_api_key_qui
```

E al `docker-compose.yml`:

```yaml
backend:
  environment:
    - TMDB_API_KEY=${TMDB_API_KEY}
```

---

## 📝 Note Importanti

1. **Rate Limiting**: TMDb permette ~40 richieste ogni 10 secondi
2. **Caching**: Salva gli URL dei poster nel database per evitare chiamate ripetute
3. **Fallback**: Usa sempre un'immagine placeholder se il poster non è disponibile
4. **Licenza**: Le immagini TMDb sono per uso non commerciale, cita la fonte

---

## 🔗 Risorse Utili

- [TMDb API Documentation](https://developers.themoviedb.org/3)
- [TMDb Image Configuration](https://developers.themoviedb.org/3/configuration/get-api-configuration)
- [TMDb Python Wrapper (tmdbsimple)](https://github.com/celiao/tmdbsimple)

---

## ✅ Checklist Implementazione

- [ ] Creare account TMDb
- [ ] Ottenere API Key
- [ ] Testare script Python con alcuni film
- [ ] Aggiungere colonna `poster_url` al CSV
- [ ] Integrare nel backend
- [ ] Aggiornare frontend per mostrare poster
