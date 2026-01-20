# CineMatch: Architettura MongoDB Completa (`cinematch_db`)

Questo documento rappresenta la fonte di verità definitiva per lo schema del database. Include tutte le 10 collezioni identificate nel backend, con i campi reali utilizzati dal codice e simulazioni accurate dei dati.

---

## 1. `users` (Anagrafica e Cache)
Gestisce i profili, le sessioni e memorizza la cache delle raccomandazioni AI per scalabilità.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `user_id` | String | ID univoco (es. "pasquale.langellotti") |
| `username` | String | Nome utente per login |
| `email` | String | Email di contatto |
| `password` | String | Hash BCrypt della password |
| `full_name`| String | Nome completo dell'utente |
| `province` | String | Slug provincia per cinema (es. "napoli") |
| `avatar` | String | URL preset o Base64 dell'immagine profilo |
| `created_at`| ISO Date | Data di registrazione |
| `last_login`| ISO Date | Data dell'ultimo accesso |
| `has_data` | Boolean | `true` se l'utente ha caricato film |
| `movies_count`| Integer | Conteggio reale sincronizzato dei film visti |
| `recommendations` | Object | Cache generata: `{recommended, not_recommended, generated_at}` |
| `data_updated_at`| ISO Date | Timestamp usato per invalidare la cache raccomandazioni |

---

## 2. `movies` (Watchlist Personale)
Dati grezzi dei film aggiunti dall'utente o importati via CSV.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `user_id` | String | Riferimento all'utente proprietario |
| `name` | String | Titolo del film (usato per join con catalogo) |
| `year` | Integer | Anno di uscita |
| `rating` | Integer | Voto utente (1-5) |
| `comment` | String | Recensione o nota personale |
| `imdb_id` | String | Link forte al catalogo (se disponibile) |
| `date` | String | Data di visione (YYYY-MM-DD) |
| `added_at` | ISO Date | Timestamp di inserimento nel DB |

---

## 3. `movies_catalog` (Il Core dei Dati)
Database globale con oltre 85.000 film. Supporta ricerche full-text e normalizzate.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `imdb_id` | String | ID univoco (es: "tt0137523") |
| `title` | String | Titolo italiano |
| `original_title`| String | Titolo originale |
| `normalized_title`| String | Titolo normalizzato senza accenti (per ricerca) |
| `year` | Integer | Anno di produzione |
| `genres` | Array | Lista di generi (es: `["Dramma", "Thriller"]`) |
| `avg_vote` | Float | Media voti globale IMDb |
| `votes` | Integer | Numero totale di voti IMDb |
| `director` | String | Registi (separati da virgola) |
| `actors` | String | Cast principale (separato da virgola) |
| `description` | String | Sinossi/Trama del film |
| `poster_url` | String | Link alla locandina (TMDB/Stock) |
| `has_real_poster`| Boolean| `false` se sta usando un'immagine stock |
| `duration` | Integer | Durata in minuti |

---

## 4. `user_stats` (Analisi Spark)
Statistiche pre-calcolate da **Spark Streaming** per caricamento istantaneo della Dashboard.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `user_id` | String | Riferimento all'utente |
| `total_watched` | Integer | Film totali visti |
| `avg_rating` | Float | Media ponderata dei voti utente |
| `watch_time_hours`| Integer| Ore totali calcolate dalle durate dei film |
| `favorite_genre`| String | Genere predominante |
| `genre_data` | Array | Dati per grafico a torta: `[{name, value, color, count}]` |
| `rating_chart_data`| Array | Dati per istogramma voti: `[{rating, count, stars}]` |
| `year_data` | Array | Film per mese/anno: `[{year, monthly_data: [...]}]` |
| `best_rated_actors`| Object | Top attori per soglia: `{"1": [...], "3": [...]}` |
| `top_rated_movies` | Array | I 10 film con il voto utente più alto |
| `source` | String | Identificativo versione Spark (es: "spark_streaming_bulk_v3") |

---

## 5. `global_stats` (Community Trends)
Aggregati globali aggiornati in tempo reale da Spark sui nuovi inserimenti di tutta la community.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `type` | String | Identificatore fisso: `"global_trends"` |
| `top_movies` | Array | I 10 film più popolari del momento: `[{title, poster_path, count}]` |
| `trending_genres`| Array | Generi di tendenza con percentuale di adozione |
| `movie_counts` | Object | Mappa interna per merge incrementale Spark |
| `poster_cache` | Object | Cache dei poster per evitare lookup continui |

---

## 6. `showtimes` (Cinema Campania)
Dati freschi scaricati tramite scraper da ComingSoon.it.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `film_id` | String | ID interno dello scraper |
| `film_title` | String | Titolo del film in sala |
| `regions` | Object | Gerarchia: `regions -> slug_provincia -> dates -> data_iso -> cinemas -> nome_cinema` |
| `cinemas` | Map | Include `cinema_name`, `cinema_url`, e array `showtimes` (orari, sale, prezzi) |
| `last_updated` | ISO Date | Timestamp ultimo aggiornamento |

---

## 7. `quiz_questions` & `quiz_status`
Sistema di gamification gestito dall'AI (Qwen 2.5 via Ollama).

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `movie_title` | String | Film su cui verte la domanda |
| `question` | String | Testo generato dall'AI |
| `answers` | Array | 4 opzioni (corretta identificata da `isCorrect: true`) |
| `explanation` | String | Spiegazione fornita dall'AI per la risposta corretta |
| `difficulty` | String | Livello (easy, medium, hard) |
| `quiz_date` | String | Data di pubblicazione della domanda (YYYY-MM-DD) |

---

## 8. `reviews` (Asset Esterno)
Database di recensioni testuali (fino a 100 per film) caricate da file CSV esterni per analisi NLP.

---

## 9. `sentiment_history`
Log delle analisi effettuate via API: `movie`, `sentiment_score` (0-1), `sentiment_label` (positive/negative), `timestamp`.

---

## 10. `scraper_progress` & `activity_log`
- **`scraper_progress`**: Stato live (`running`, `idle`, `percentage`) per Cinema e Movie Updater.
- **`activity_log`**: Tracciamento azioni utente (audit trail).
