"""
CineMatch Backend API
Sistema di raccomandazione film con analisi sentiment.
"""
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import io
import os
import random
from datetime import datetime
from pymongo import MongoClient
from pydantic import BaseModel
from typing import Optional
from auth import get_password_hash, verify_password, create_access_token, get_current_user_id

# ============================================
# APP CONFIGURATION
# ============================================
app = FastAPI(
    title="CineMatch API",
    description="Sistema di raccomandazione film personalizzato",
    version="1.0.0"
)

# CORS - permette chiamate dal frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In produzione specificare i domini
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================
# DATABASE CONNECTION
# ============================================
MONGO_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
client = MongoClient(MONGO_URL)
db = client.cinematch_db

# Collections
users_collection = db.users
movies_collection = db.movies
stats_collection = db.user_stats
sentiment_collection = db.sentiment_history
activity_collection = db.activity_log

# URL immagine stock di fallback
STOCK_POSTER_URL = "https://via.placeholder.com/500x750/1a1a2e/e50914?text=No+Poster"

# ============================================
# MODELS
# ============================================
class UserAuth(BaseModel):
    username: str
    password: str

class UserRegister(BaseModel):
    username: str
    password: str
    email: Optional[str] = None
    full_name: Optional[str] = None

# ============================================
# STARTUP EVENT
# ============================================
@app.on_event("startup")
async def startup_event():
    """Inizializza il database al primo avvio."""
    print("🚀 Avvio CineMatch Backend...")
    
    # Crea indici se non esistono
    try:
        users_collection.create_index("username", unique=True)
        users_collection.create_index("user_id", unique=True)
        movies_collection.create_index("user_id")
        stats_collection.create_index("user_id", unique=True)
        print("✅ Indici MongoDB creati")
    except Exception as e:
        print(f"⚠️ Indici già esistenti: {e}")
    
    # Controlla se c'è l'utente di default
    default_user = users_collection.find_one({"username": "pasquale.langellotti"})
    if not default_user:
        # Crea utente di default
        users_collection.insert_one({
            "username": "pasquale.langellotti",
            "email": "langellotti19@live.it",
            "password": get_password_hash("Pasquale19!"),
            "user_id": "pasquale.langellotti",
            "full_name": "Pasquale Langellotti",
            "created_at": datetime.utcnow().isoformat(),
            "is_active": True,
            "has_data": False
        })
        print("✅ Utente di default creato: pasquale.langellotti")
    else:
        print("✅ Utente pasquale.langellotti già esistente")
    
    # Carica dati CSV se esistono e non sono già stati processati
    csv_path = "/data/ratings.csv"
    user_id = "pasquale.langellotti"
    
    # Verifica se l'utente ha già dati
    user_data = users_collection.find_one({"user_id": user_id})
    has_data = user_data.get("has_data", False) if user_data else False
    existing_stats = stats_collection.find_one({"user_id": user_id})
    
    if os.path.exists(csv_path) and (not existing_stats or not has_data):
        print(f"📂 Caricamento dati da {csv_path}...")
        try:
            df = pd.read_csv(csv_path)
            df = df.dropna(subset=['Rating'])
            df['Rating'] = pd.to_numeric(df['Rating'], errors='coerce')
            df = df.dropna(subset=['Rating'])
            
            # Prepara lista film
            movies = []
            for _, row in df.iterrows():
                movie = {
                    "user_id": user_id,
                    "name": row['Name'],
                    "year": int(row['Year']) if pd.notna(row.get('Year')) else None,
                    "rating": int(row['Rating']),
                    "date": str(row.get('Date', '')) if pd.notna(row.get('Date')) else None,
                    "letterboxd_uri": row.get('Letterboxd URI', None),
                    "added_at": datetime.utcnow().isoformat()
                }
                movies.append(movie)
            
            # Salva film
            if movies:
                movies_collection.delete_many({"user_id": user_id})
                movies_collection.insert_many(movies)
            
            # Calcola e salva statistiche
            stats = calculate_stats(df, movies)
            stats["user_id"] = user_id
            stats["source_file"] = "ratings.csv"
            stats_collection.update_one(
                {"user_id": user_id},
                {"$set": stats},
                upsert=True
            )
            
            # Aggiorna utente
            users_collection.update_one(
                {"user_id": user_id},
                {"$set": {"has_data": True, "movies_count": len(movies)}}
            )
            
            print(f"✅ Caricati {len(movies)} film per {user_id}")
        except Exception as e:
            print(f"❌ Errore caricamento CSV: {e}")
    elif existing_stats:
        print(f"✅ Dati già presenti per {user_id}: {existing_stats.get('total_watched', 0)} film")
    else:
        print(f"⚠️ File CSV non trovato: {csv_path}")

# ============================================
# HELPER FUNCTIONS
# ============================================
def calculate_stats(df: pd.DataFrame, movies: list) -> dict:
    """Calcola le statistiche dai dati."""
    rating_distribution = df['Rating'].value_counts().to_dict()
    # MongoDB richiede chiavi stringa
    rating_distribution = {str(int(k)): int(v) for k, v in rating_distribution.items()}
    
    # Distribuzione rating per grafico a barre
    rating_chart_data = [
        {"rating": "⭐1", "count": int(df[df['Rating'] == 1].shape[0]), "stars": 1},
        {"rating": "⭐2", "count": int(df[df['Rating'] == 2].shape[0]), "stars": 2},
        {"rating": "⭐3", "count": int(df[df['Rating'] == 3].shape[0]), "stars": 3},
        {"rating": "⭐4", "count": int(df[df['Rating'] == 4].shape[0]), "stars": 4},
        {"rating": "⭐5", "count": int(df[df['Rating'] == 5].shape[0]), "stars": 5},
    ]
    
    top_rated = df[df['Rating'] >= 4].nlargest(10, 'Rating')[['Name', 'Year', 'Rating']].to_dict('records')
    
    months = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"]
    if 'Date' in df.columns:
        df_copy = df.copy()
        df_copy['DateParsed'] = pd.to_datetime(df_copy['Date'], errors='coerce')
        df_copy['Month'] = df_copy['DateParsed'].dt.month
        monthly_counts = df_copy.groupby('Month').size().to_dict()
        monthly_data = [{"month": months[i], "films": int(monthly_counts.get(i+1, 0))} for i in range(12)]
        recent = df_copy.nlargest(10, 'DateParsed')[['Name', 'Year', 'Rating', 'Date']].to_dict('records')
    else:
        monthly_data = [{"month": m, "films": 0} for m in months]
        recent = df.head(10)[['Name', 'Year', 'Rating']].to_dict('records')
    
    # Calcola tutte le statistiche avanzate dal catalogo
    advanced_stats = calculate_advanced_stats(movies)
    
    return {
        "total_watched": len(movies),
        "avg_rating": round(float(df['Rating'].mean()), 2),
        "rating_distribution": rating_distribution,
        "rating_chart_data": rating_chart_data,
        "top_rated_movies": top_rated,
        "recent_movies": recent,
        "monthly_data": monthly_data,
        "genre_data": advanced_stats["genre_data"],
        "favorite_genre": advanced_stats["favorite_genre"],
        "total_5_stars": int(df[df['Rating'] == 5].shape[0]),
        "total_4_stars": int(df[df['Rating'] == 4].shape[0]),
        "total_3_stars": int(df[df['Rating'] == 3].shape[0]),
        "total_2_stars": int(df[df['Rating'] == 2].shape[0]),
        "total_1_stars": int(df[df['Rating'] == 1].shape[0]),
        # Nuove statistiche
        "watch_time_hours": advanced_stats["total_watch_time_hours"],
        "watch_time_minutes": advanced_stats["total_watch_time_minutes"],
        "avg_duration": advanced_stats["avg_duration"],
        "top_directors": advanced_stats["top_directors"],
        "top_actors": advanced_stats["top_actors"],
        "rating_vs_imdb": advanced_stats["rating_vs_imdb"],
        "updated_at": datetime.utcnow().isoformat(),
        "top_years": calculate_top_years(movies)
    }


def calculate_advanced_stats(movies: list) -> dict:
    """
    Calcola statistiche avanzate dai film dell'utente con JOIN al catalogo.
    Include: generi, durata, registi, attori, confronto IMDb.
    """
    from collections import Counter, defaultdict
    
    # Colori per i generi
    genre_colors = {
        "Drama": "#E50914", "Comedy": "#FF6B35", "Action": "#00529B",
        "Thriller": "#8B5CF6", "Horror": "#6B21A8", "Romance": "#EC4899",
        "Sci-Fi": "#06B6D4", "Adventure": "#10B981", "Crime": "#F59E0B",
        "Mystery": "#7C3AED", "Fantasy": "#8B5CF6", "Animation": "#F472B6",
        "Documentary": "#22C55E", "Family": "#FBBF24", "War": "#78716C",
        "History": "#A78BFA", "Music": "#FB7185", "Western": "#D97706",
        "Sport": "#34D399", "Biography": "#60A5FA"
    }
    default_color = "#9CA3AF"
    
    # Raccoglie tutti i titoli per batch lookup
    titles = [m.get('name', '').lower() for m in movies if m.get('name')]
    
    if not titles:
        return {
            "genre_data": [], "favorite_genre": "Nessuno",
            "total_watch_time_hours": 0, "total_watch_time_minutes": 0,
            "avg_duration": 0, "top_directors": [], "top_actors": [],
            "rating_vs_imdb": []
        }
    
    # Batch lookup nel catalogo
    import re
    escaped_titles = [re.escape(t) for t in titles[:500]]
    regex_pattern = f"^({'|'.join(escaped_titles)})$"
    
    catalog_movies = list(movies_catalog.find(
        {"title": {"$regex": regex_pattern, "$options": "i"}},
        {"title": 1, "genres": 1, "duration": 1, "director": 1, "actors": 1, "avg_vote": 1}
    ))
    
    # Crea mapping titolo -> dati catalogo
    title_data = {}
    for cm in catalog_movies:
        title_key = cm['title'].lower()
        title_data[title_key] = cm
    
    # Inizializza contatori
    genre_counter = Counter()
    director_counter = Counter()
    director_ratings = defaultdict(list)
    actor_counter = Counter()
    total_duration = 0
    duration_count = 0
    rating_vs_imdb = []
    
    # Processa ogni film dell'utente
    for movie in movies:
        title = movie.get('name', '').lower()
        user_rating = movie.get('rating', 0)
        catalog_info = title_data.get(title, {})
        
        # Generi
        for genre in catalog_info.get('genres', []):
            if genre:
                genre_counter[genre] += 1
        
        # Durata
        duration = catalog_info.get('duration')
        if duration and isinstance(duration, (int, float)) and duration > 0:
            total_duration += duration
            duration_count += 1
        
        # Registi
        director = catalog_info.get('director')
        if director:
            # Alcuni film hanno più registi separati da virgola
            for d in director.split(','):
                d = d.strip()
                if d:
                    director_counter[d] += 1
                    director_ratings[d].append(user_rating)
        
        # Attori (prendi i primi 3 per film)
        actors = catalog_info.get('actors', '')
        if actors:
            for i, actor in enumerate(actors.split(',')):
                if i >= 3:  # Solo i primi 3 attori per film
                    break
                actor = actor.strip()
                if actor:
                    actor_counter[actor] += 1
        
        # Rating vs IMDb
        imdb_rating = catalog_info.get('avg_vote')
        if imdb_rating and user_rating:
            # Converti rating utente (1-5) in scala 1-10 per confronto
            user_rating_10 = user_rating * 2
            rating_vs_imdb.append({
                "title": movie.get('name', ''),
                "user_rating": user_rating,
                "user_rating_10": user_rating_10,
                "imdb_rating": round(imdb_rating, 1),
                "difference": round(user_rating_10 - imdb_rating, 1)
            })
    
    # Calcola statistiche generi
    total_genres = sum(genre_counter.values()) or 1
    top_genres = genre_counter.most_common(8)
    genre_data = []
    for genre, count in top_genres:
        percentage = round((count / total_genres) * 100, 1)
        color = genre_colors.get(genre, default_color)
        genre_data.append({"name": genre, "value": percentage, "color": color, "count": count})
    
    favorite_genre = top_genres[0][0] if top_genres else "Nessuno"
    
    # Calcola statistiche registi
    top_directors = []
    for director, count in director_counter.most_common(5):
        ratings = director_ratings[director]
        avg_rating = round(sum(ratings) / len(ratings), 1) if ratings else 0
        top_directors.append({
            "name": director,
            "count": count,
            "avg_rating": avg_rating
        })
    
    # Calcola statistiche attori
    top_actors = [{"name": actor, "count": count} for actor, count in actor_counter.most_common(8)]
    
    # Calcola durate
    avg_duration = round(total_duration / duration_count) if duration_count > 0 else 0
    total_hours = total_duration // 60
    total_minutes = total_duration % 60
    
    # Ordina rating_vs_imdb per differenza (più controversi)
    rating_vs_imdb.sort(key=lambda x: abs(x['difference']), reverse=True)
    
    return {
        "genre_data": genre_data,
        "favorite_genre": favorite_genre,
        "total_watch_time_hours": total_hours,
        "total_watch_time_minutes": total_minutes,
        "avg_duration": avg_duration,
        "top_directors": top_directors,
        "top_actors": top_actors,
        "rating_vs_imdb": rating_vs_imdb[:20]  # Top 20 più controversi
    }


def calculate_top_years(movies: list) -> list:
    """Calcola i 5 anni con più film visti."""
    from collections import Counter
    years = [m['year'] for m in movies if m.get('year')]
    year_counts = Counter(years)
    top_5 = year_counts.most_common(5)
    return [{"year": year, "count": count} for year, count in top_5]

# ============================================
# AUTH ENDPOINTS
# ============================================
@app.get("/")
def read_root():
    return {
        "message": "CineMatch API is running",
        "version": "1.0.0",
        "status": "healthy"
    }

@app.get("/health")
def health_check():
    """Health check endpoint."""
    try:
        client.admin.command('ping')
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}

@app.post("/register")
async def register(user: UserRegister):
    """Registra un nuovo utente."""
    # Verifica username esistente
    if users_collection.find_one({"username": user.username}):
        raise HTTPException(status_code=400, detail="Username già esistente")
    
    # Verifica email esistente (se fornita)
    if user.email and users_collection.find_one({"email": user.email}):
        raise HTTPException(status_code=400, detail="Email già registrata")
    
    # Crea utente
    new_user = {
        "username": user.username,
        "password": get_password_hash(user.password),
        "user_id": user.username,
        "email": user.email,
        "full_name": user.full_name,
        "created_at": datetime.utcnow().isoformat(),
        "is_active": True,
        "has_data": False,
        "movies_count": 0
    }
    
    users_collection.insert_one(new_user)
    
    return {"message": "Utente registrato con successo", "username": user.username}

@app.post("/login")
async def login(user: UserAuth):
    """Effettua il login."""
    db_user = users_collection.find_one({"username": user.username})
    
    if not db_user:
        raise HTTPException(status_code=401, detail="Username non trovato")
    
    if not verify_password(user.password, db_user["password"]):
        raise HTTPException(status_code=401, detail="Password non corretta")
    
    # Aggiorna last login
    users_collection.update_one(
        {"user_id": db_user["user_id"]},
        {"$set": {"last_login": datetime.utcnow().isoformat()}}
    )
    
    access_token = create_access_token(data={"sub": db_user["user_id"]})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "username": db_user["username"],
        "has_data": db_user.get("has_data", False)
    }

@app.get("/me")
async def get_current_user(current_user_id: str = Depends(get_current_user_id)):
    """Ottiene i dati dell'utente corrente."""
    user = users_collection.find_one({"user_id": current_user_id}, {"password": 0, "_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    return user

# ============================================
# DATA ENDPOINTS
# ============================================
@app.post("/upload-csv")
async def upload_csv(file: UploadFile = File(...), current_user_id: str = Depends(get_current_user_id)):
    """Carica e processa un file CSV di Letterboxd."""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Il file deve essere un CSV")
    
    contents = await file.read()
    df = pd.read_csv(io.BytesIO(contents))
    
    # Verifica colonne necessarie
    if 'Name' not in df.columns or 'Rating' not in df.columns:
        raise HTTPException(status_code=400, detail="Il CSV deve contenere le colonne 'Name' e 'Rating'")
    
    # Pulizia dati
    df = df.dropna(subset=['Rating'])
    df['Rating'] = pd.to_numeric(df['Rating'], errors='coerce')
    df = df.dropna(subset=['Rating'])
    
    if len(df) == 0:
        raise HTTPException(status_code=400, detail="Nessun film valido trovato nel CSV")
    
    # Prepara lista film
    movies = []
    for _, row in df.iterrows():
        movie = {
            "user_id": current_user_id,
            "name": row['Name'],
            "year": int(row['Year']) if pd.notna(row.get('Year')) else None,
            "rating": int(row['Rating']),
            "date": str(row.get('Date', '')) if pd.notna(row.get('Date')) else None,
            "letterboxd_uri": row.get('Letterboxd URI', None),
            "added_at": datetime.utcnow().isoformat()
        }
        movies.append(movie)
    
    # Salva film
    movies_collection.delete_many({"user_id": current_user_id})
    movies_collection.insert_many(movies)
    
    # Calcola e salva statistiche
    stats = calculate_stats(df, movies)
    stats["user_id"] = current_user_id
    stats["source_file"] = file.filename
    stats_collection.update_one(
        {"user_id": current_user_id},
        {"$set": stats},
        upsert=True
    )
    
    # Aggiorna utente
    users_collection.update_one(
        {"user_id": current_user_id},
        {"$set": {
            "has_data": True,
            "movies_count": len(movies),
            "data_updated_at": datetime.utcnow().isoformat()
        }}
    )
    
    return {
        "status": "success",
        "filename": file.filename,
        "count": len(movies),
        "stats": stats,
        "message": f"Caricati {len(movies)} film con successo!"
    }


@app.post("/recalculate-stats")
async def recalculate_stats(current_user_id: str = Depends(get_current_user_id)):
    """Ricalcola le statistiche dell'utente basandosi sul catalogo per i generi."""
    movies = list(movies_collection.find({"user_id": current_user_id}))
    
    if not movies:
        raise HTTPException(status_code=404, detail="Nessun film trovato")
    
    # Crea DataFrame per le stats
    df = pd.DataFrame(movies)
    df = df.rename(columns={"name": "Name", "year": "Year", "rating": "Rating", "date": "Date"})
    
    # Ricalcola le statistiche con i generi reali
    stats = calculate_stats(df, movies)
    stats["user_id"] = current_user_id
    
    # Aggiorna nel database
    stats_collection.update_one(
        {"user_id": current_user_id},
        {"$set": stats},
        upsert=True
    )
    
    return {"message": "Statistiche ricalcolate con successo!", "stats": stats}


@app.get("/user-stats")
async def get_user_stats(current_user_id: str = Depends(get_current_user_id)):
    """Ottiene le statistiche dell'utente."""
    stats = stats_collection.find_one({"user_id": current_user_id}, {"_id": 0})
    
    if not stats:
        raise HTTPException(status_code=404, detail="Nessun dato trovato. Carica prima un file CSV.")
    
    # Se mancano le nuove statistiche, ricalcola tutto
    needs_recalc = False
    if "top_directors" not in stats or "top_actors" not in stats or "rating_vs_imdb" not in stats:
        needs_recalc = True
    elif "genre_data" in stats and stats["genre_data"] and "count" not in stats["genre_data"][0]:
        needs_recalc = True
    
    if needs_recalc:
        movies = list(movies_collection.find({"user_id": current_user_id}))
        advanced_stats = calculate_advanced_stats(movies)
        
        # Aggiorna le stats con i nuovi dati
        stats.update({
            "genre_data": advanced_stats["genre_data"],
            "favorite_genre": advanced_stats["favorite_genre"],
            "watch_time_hours": advanced_stats["total_watch_time_hours"],
            "watch_time_minutes": advanced_stats["total_watch_time_minutes"],
            "avg_duration": advanced_stats["avg_duration"],
            "top_directors": advanced_stats["top_directors"],
            "top_actors": advanced_stats["top_actors"],
            "rating_vs_imdb": advanced_stats["rating_vs_imdb"]
        })
        
        # Salva nel database
        stats_collection.update_one(
            {"user_id": current_user_id},
            {"$set": stats}
        )
    
    if "top_years" not in stats:
        movies = list(movies_collection.find({"user_id": current_user_id}))
        stats["top_years"] = calculate_top_years(movies)
    
    return stats

@app.get("/movies")
async def get_movies(current_user_id: str = Depends(get_current_user_id)):
    """Ottiene tutti i film dell'utente (per pagina Film Visti)."""
    movies = list(movies_collection.find(
        {"user_id": current_user_id},
        {"_id": 0, "user_id": 0}
    ))
    return movies

@app.get("/monthly-stats/{year}")
async def get_monthly_stats(year: int, current_user_id: str = Depends(get_current_user_id)):
    """Ottiene le statistiche mensili per un anno specifico (basato sulla data di visione)."""
    movies = list(movies_collection.find(
        {"user_id": current_user_id},
        {"_id": 0, "user_id": 0}
    ))
    
    months = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"]
    monthly_counts = {i: 0 for i in range(1, 13)}
    films_in_year = 0
    
    for movie in movies:
        if movie.get('date'):
            try:
                # Parsing data nel formato YYYY-MM-DD
                date_str = str(movie['date'])
                movie_year = int(date_str.split('-')[0])
                movie_month = int(date_str.split('-')[1])
                
                if movie_year == year:
                    monthly_counts[movie_month] += 1
                    films_in_year += 1
            except (ValueError, IndexError):
                continue
    
    monthly_data = [{"month": months[i], "films": monthly_counts[i+1]} for i in range(12)]
    
    # Trova gli anni disponibili (in cui l'utente ha visto film)
    available_years = set()
    for movie in movies:
        if movie.get('date'):
            try:
                date_str = str(movie['date'])
                movie_year = int(date_str.split('-')[0])
                available_years.add(movie_year)
            except (ValueError, IndexError):
                continue
    
    return {
        "year": year,
        "monthly_data": monthly_data,
        "total_films": films_in_year,
        "available_years": sorted(list(available_years), reverse=True)
    }

@app.get("/user-movies")
async def get_user_movies(
    current_user_id: str = Depends(get_current_user_id),
    skip: int = 0,
    limit: int = 500
):
    """
    Ottiene la lista dei film dell'utente con poster dal catalogo.
    Ottimizzato: recupera prima i film utente, poi fa un batch lookup nel catalogo.
    """
    # Step 1: Recupera i film dell'utente
    user_movies = list(movies_collection.find(
        {"user_id": current_user_id},
        {"_id": 0, "user_id": 0}
    ).sort("added_at", -1).skip(skip).limit(limit))
    
    # Step 2: Raccogli tutti i titoli per un batch lookup
    titles_to_lookup = []
    for movie in user_movies:
        if not movie.get("poster_url") or movie.get("poster_url") == STOCK_POSTER_URL:
            titles_to_lookup.append({
                "title": movie["name"].lower(),
                "year": movie.get("year")
            })
    
    # Step 3: Batch lookup nel catalogo (una sola query)
    if titles_to_lookup:
        # Crea indice per ricerca veloce
        catalog_cache = {}
        
        # Query batch per tutti i titoli - usa $in per ricerca esatta (più veloce)
        title_list = list(set(t["title"] for t in titles_to_lookup))
        
        # Escape caratteri speciali regex e costruisci pattern
        import re
        escaped_titles = [re.escape(t) for t in title_list]
        regex_pattern = f"^({'|'.join(escaped_titles)})$"
        
        catalog_movies = movies_catalog.find(
            {"title": {"$regex": regex_pattern, "$options": "i"}},
            {"title": 1, "year": 1, "poster_url": 1, "imdb_id": 1, "genres": 1}
        )
        
        # Costruisci cache con chiave title_year
        for cm in catalog_movies:
            key = f"{cm['title'].lower()}_{cm.get('year', '')}"
            catalog_cache[key] = cm
            # Anche solo per titolo come fallback
            title_key = cm['title'].lower()
            if title_key not in catalog_cache:
                catalog_cache[title_key] = cm
        
        # Step 4: Applica i dati del catalogo ai film utente
        for movie in user_movies:
            if not movie.get("poster_url") or movie.get("poster_url") == STOCK_POSTER_URL:
                title_lower = movie["name"].lower()
                year = movie.get("year")
                
                # Cerca prima con anno, poi solo titolo
                catalog_movie = catalog_cache.get(f"{title_lower}_{year}") or catalog_cache.get(title_lower)
                
                if catalog_movie:
                    movie["poster_url"] = catalog_movie.get("poster_url") or STOCK_POSTER_URL
                    movie["imdb_id"] = catalog_movie.get("imdb_id")
                    movie["genres"] = catalog_movie.get("genres", [])
                else:
                    movie["poster_url"] = STOCK_POSTER_URL
    
    total = movies_collection.count_documents({"user_id": current_user_id})
    
    return {
        "movies": user_movies,
        "total": total,
        "skip": skip,
        "limit": limit
    }


# Modello per aggiungere film
class AddMovieRequest(BaseModel):
    name: str
    year: int
    rating: int
    imdb_id: Optional[str] = None
    poster_url: Optional[str] = None


class RemoveMovieRequest(BaseModel):
    name: str
    year: int


class UpdateRatingRequest(BaseModel):
    name: str
    year: int
    rating: int


@app.post("/user-movies/add")
async def add_movie_to_collection(
    movie: AddMovieRequest,
    current_user_id: str = Depends(get_current_user_id)
):
    """Aggiunge un film alla collezione dell'utente."""
    # Verifica se il film esiste già
    existing = movies_collection.find_one({
        "user_id": current_user_id,
        "name": movie.name,
        "year": movie.year
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Film già presente nella collezione")
    
    # Crea documento film
    new_movie = {
        "user_id": current_user_id,
        "name": movie.name,
        "year": movie.year,
        "rating": movie.rating,
        "date": datetime.utcnow().strftime("%Y-%m-%d"),
        "imdb_id": movie.imdb_id,
        "poster_url": movie.poster_url,
        "added_at": datetime.utcnow().isoformat()
    }
    
    movies_collection.insert_one(new_movie)
    
    # Aggiorna conteggio utente
    users_collection.update_one(
        {"user_id": current_user_id},
        {
            "$inc": {"movies_count": 1},
            "$set": {"has_data": True}
        }
    )
    
    # Ricalcola statistiche
    await recalculate_user_stats(current_user_id)
    
    return {"message": "Film aggiunto con successo", "movie": movie.name}


@app.delete("/user-movies/remove")
async def remove_movie_from_collection(
    movie: RemoveMovieRequest,
    current_user_id: str = Depends(get_current_user_id)
):
    """Rimuove un film dalla collezione dell'utente."""
    result = movies_collection.delete_one({
        "user_id": current_user_id,
        "name": movie.name,
        "year": movie.year
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Film non trovato nella collezione")
    
    # Aggiorna conteggio utente
    users_collection.update_one(
        {"user_id": current_user_id},
        {"$inc": {"movies_count": -1}}
    )
    
    # Ricalcola statistiche
    await recalculate_user_stats(current_user_id)
    
    return {"message": "Film rimosso con successo"}


@app.put("/user-movies/update-rating")
async def update_movie_rating(
    movie: UpdateRatingRequest,
    current_user_id: str = Depends(get_current_user_id)
):
    """Aggiorna il rating di un film nella collezione."""
    result = movies_collection.update_one(
        {
            "user_id": current_user_id,
            "name": movie.name,
            "year": movie.year
        },
        {"$set": {"rating": movie.rating}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Film non trovato nella collezione")
    
    # Ricalcola statistiche
    await recalculate_user_stats(current_user_id)
    
    return {"message": "Rating aggiornato con successo"}


async def recalculate_user_stats(user_id: str):
    """Ricalcola le statistiche dell'utente."""
    movies = list(movies_collection.find({"user_id": user_id}))
    
    if not movies:
        stats_collection.delete_one({"user_id": user_id})
        return
    
    # Calcola statistiche
    total = len(movies)
    ratings = [m["rating"] for m in movies]
    avg_rating = sum(ratings) / total
    
    rating_dist = {}
    for r in range(1, 6):
        rating_dist[str(r)] = len([m for m in movies if m["rating"] == r])
    
    top_rated = sorted([m for m in movies if m["rating"] >= 4], key=lambda x: -x["rating"])[:10]
    top_rated_list = [{"Name": m["name"], "Year": m["year"], "Rating": m["rating"]} for m in top_rated]
    
    # Aggiorna statistiche
    stats_collection.update_one(
        {"user_id": user_id},
        {"$set": {
            "total_watched": total,
            "avg_rating": round(avg_rating, 2),
            "rating_distribution": rating_dist,
            "top_rated_movies": top_rated_list,
            "total_5_stars": rating_dist.get("5", 0),
            "total_4_stars": rating_dist.get("4", 0),
            "total_3_stars": rating_dist.get("3", 0),
            "total_2_stars": rating_dist.get("2", 0),
            "total_1_stars": rating_dist.get("1", 0),
            "updated_at": datetime.utcnow().isoformat()
        }},
        upsert=True
    )


@app.get("/user-history")
async def get_user_history(current_user_id: str = Depends(get_current_user_id)):
    """Ottiene la cronologia delle analisi sentiment."""
    history = list(sentiment_collection.find(
        {"user_id": current_user_id},
        {"_id": 0}
    ).sort("timestamp", -1).limit(50))
    
    return {"history": history}

# ============================================
# SENTIMENT ENDPOINTS
# ============================================
@app.get("/analyze-movie-sentiment/{title}")
async def analyze_sentiment(title: str, current_user_id: str = Depends(get_current_user_id)):
    """Analizza il sentiment di un film (simulato per ora)."""
    # Simula commenti
    mock_comments = [
        f"I absolutely loved {title}! Amazing film!",
        f"{title} was okay, nothing special.",
        f"Didn't enjoy {title}, waste of time.",
        f"One of the best movies I've seen - {title}!",
        f"{title} has great cinematography."
    ]
    
    # Calcola sentiment simulato
    sentiment_score = round(random.uniform(0.3, 0.9), 2)
    
    result = {
        "user_id": current_user_id,
        "movie": title,
        "sentiment_score": sentiment_score,
        "sentiment_label": "positive" if sentiment_score > 0.6 else ("negative" if sentiment_score < 0.4 else "neutral"),
        "comments_analyzed": len(mock_comments),
        "timestamp": datetime.utcnow().isoformat()
    }
    
    # Salva nella cronologia
    sentiment_collection.insert_one(result)
    
    return {
        "result": {k: v for k, v in result.items() if k not in ["user_id", "_id"]},
        "status": "success"
    }

# ============================================
# ACTIVITY LOG
# ============================================
@app.post("/log-activity")
async def log_activity(activity: dict, current_user_id: str = Depends(get_current_user_id)):
    """Registra un'attività dell'utente."""
    activity["user_id"] = current_user_id
    activity["timestamp"] = datetime.utcnow().isoformat()
    
    activity_collection.insert_one(activity)
    
    return {"status": "success", "message": "Attività registrata"}

# ============================================
# MOVIES CATALOG ENDPOINTS (Catalogo Film IMDb)
# ============================================

# Collezione catalogo
movies_catalog = db.movies_catalog


@app.get("/catalog/movies")
async def get_catalog_movies(
    skip: int = 0,
    limit: int = 50,
    genre: str = None,
    year: int = None,
    min_rating: float = None,
    search: str = None
):
    """
    Ottiene film dal catalogo con filtri opzionali.
    Non richiede autenticazione per la navigazione.
    """
    query = {}
    
    if genre:
        query["genres"] = genre
    if year:
        query["year"] = year
    if min_rating:
        query["avg_vote"] = {"$gte": min_rating}
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"original_title": {"$regex": search, "$options": "i"}},
            {"director": {"$regex": search, "$options": "i"}},
            {"actors": {"$regex": search, "$options": "i"}}
        ]
    
    movies = list(movies_catalog.find(
        query,
        {"_id": 0}
    ).sort("votes", -1).skip(skip).limit(limit))
    
    # Assicura che ogni film abbia un poster_url
    for movie in movies:
        if not movie.get("poster_url"):
            movie["poster_url"] = STOCK_POSTER_URL
    
    total = movies_catalog.count_documents(query)
    
    return {
        "movies": movies,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@app.get("/catalog/movie/{imdb_id}")
async def get_catalog_movie(imdb_id: str):
    """Ottiene i dettagli di un singolo film dal catalogo."""
    movie = movies_catalog.find_one({"imdb_id": imdb_id}, {"_id": 0})
    
    if not movie:
        raise HTTPException(status_code=404, detail="Film non trovato")
    
    # Assicura poster_url
    if not movie.get("poster_url"):
        movie["poster_url"] = STOCK_POSTER_URL
    
    return movie


@app.get("/catalog/search")
async def search_catalog(
    q: str,
    limit: int = 20
):
    """Ricerca film nel catalogo per titolo."""
    movies = list(movies_catalog.find(
        {"$or": [
            {"title": {"$regex": q, "$options": "i"}},
            {"original_title": {"$regex": q, "$options": "i"}}
        ]},
        {"_id": 0, "imdb_id": 1, "title": 1, "year": 1, "poster_url": 1, "avg_vote": 1, "genres": 1}
    ).sort("votes", -1).limit(limit))
    
    # Assicura poster_url
    for movie in movies:
        if not movie.get("poster_url"):
            movie["poster_url"] = STOCK_POSTER_URL
    
    return {"results": movies, "query": q}


@app.get("/catalog/genres")
async def get_catalog_genres():
    """Ottiene la lista dei generi disponibili nel catalogo."""
    pipeline = [
        {"$unwind": "$genres"},
        {"$group": {"_id": "$genres", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 30}
    ]
    genres = list(movies_catalog.aggregate(pipeline))
    return {"genres": [{"name": g["_id"], "count": g["count"]} for g in genres]}


@app.get("/catalog/poster/{imdb_id}")
async def get_movie_poster(imdb_id: str):
    """Ottiene solo l'URL del poster per un film."""
    movie = movies_catalog.find_one({"imdb_id": imdb_id}, {"_id": 0, "poster_url": 1})
    
    if movie and movie.get("poster_url"):
        return {"poster_url": movie["poster_url"]}
    
    return {"poster_url": STOCK_POSTER_URL}


@app.get("/catalog/stats")
async def get_catalog_stats():
    """Statistiche del catalogo film."""
    total = movies_catalog.count_documents({})
    with_poster = movies_catalog.count_documents({"has_real_poster": True})
    
    # Top generi
    genre_pipeline = [
        {"$unwind": "$genres"},
        {"$group": {"_id": "$genres", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    top_genres = list(movies_catalog.aggregate(genre_pipeline))
    
    # Film per decennio
    decade_pipeline = [
        {"$match": {"year": {"$ne": None}}},
        {"$group": {
            "_id": {"$subtract": ["$year", {"$mod": ["$year", 10]}]},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    by_decade = list(movies_catalog.aggregate(decade_pipeline))
    
    return {
        "total_movies": total,
        "with_real_poster": with_poster,
        "with_stock_poster": total - with_poster,
        "top_genres": [{"name": g["_id"], "count": g["count"]} for g in top_genres],
        "by_decade": [{"decade": d["_id"], "count": d["count"]} for d in by_decade]
    }
