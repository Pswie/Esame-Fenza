import { useState, useEffect } from 'react';
import { MovieModal } from '../components/MovieModal';
import { catalogAPI } from '../services/api';
import './Cinema.css';

interface CinemaShowtime {
    time: string;
    price: string;
    sala: string;
}

interface CinemaInfo {
    name: string;
    address: string;
    showtimes: CinemaShowtime[];
}

interface CinemaFilm {
    id: string;
    title: string;
    original_title: string;
    director: string;
    poster: string;
    description: string;
    rating: number | null;
    genres: string[];
    year: number | null;
    duration: number | null;
    actors?: string;
    cinemas: CinemaInfo[];
    province: string;
}

interface CinemaResponse {
    province: string;
    films: CinemaFilm[];
    total: number;
}

export function Cinema() {
    const [films, setFilms] = useState<CinemaFilm[]>([]);
    const [selectedFilm, setSelectedFilm] = useState<CinemaFilm | null>(null);
    const [province, setProvince] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isWatchedModalOpen, setIsWatchedModalOpen] = useState(false);

    useEffect(() => {
        fetchCinemaFilms();
    }, []);

    const fetchCinemaFilms = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:8000/cinema/films', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data: CinemaResponse = await response.json();
                setFilms(data.films);
                setProvince(data.province);
                if (data.films.length > 0) {
                    setSelectedFilm(data.films[0]);
                }
            } else {
                setError('Errore nel caricamento dei film');
            }
        } catch (err) {
            setError('Errore di connessione');
        } finally {
            setLoading(false);
        }
    };

    const handleAddToWatched = async (rating: number, comment: string) => {
        if (!selectedFilm) return;

        try {
            await catalogAPI.addOrUpdateMovie({
                name: selectedFilm.title,
                year: selectedFilm.year || new Date().getFullYear(),
                rating: rating,
                comment: comment,
                poster_url: selectedFilm.poster
            });

            // Rimuovi il film dalla lista locale poiché ora è visto
            const updatedFilms = films.filter(f => f.id !== selectedFilm.id);
            setFilms(updatedFilms);
            if (updatedFilms.length > 0) {
                setSelectedFilm(updatedFilms[0]);
            } else {
                setSelectedFilm(null);
            }
            setIsWatchedModalOpen(false);
        } catch (error) {
            console.error("Errore salvataggio film visto:", error);
            throw error;
        }
    };

    if (loading) {
        return (
            <div className="cinema-page">
                <div className="cinema-loading">
                    <div className="loading-spinner"></div>
                    <p>Caricamento film in sala...</p>
                </div>
            </div>
        );
    }

    if (error || films.length === 0) {
        return (
            <div className="cinema-page">
                <div className="page-header">
                    <h1>🎭 Al Cinema Ora</h1>
                    <p>{error || 'Nessun film in programmazione nella tua zona'}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="cinema-page">
            <div className="page-header">
                <h1>🎭 Al Cinema Ora</h1>
                <p>Film in programmazione a <strong>{province}</strong></p>
            </div>

            <div className="cinema-layout">
                {/* Film Principale Selezionato */}
                {selectedFilm && (
                    <div className="featured-movie">
                        <div className="featured-poster">
                            <img src={selectedFilm.poster} alt={selectedFilm.title} />
                            {selectedFilm.rating && (
                                <div className="poster-overlay">
                                    <div className="rating-badge">
                                        <span className="star">★</span> {selectedFilm.rating.toFixed(1)}
                                    </div>
                                </div>
                            )}
                            <button className="btn-watched-under-poster" onClick={() => setIsWatchedModalOpen(true)}>
                                Film già visto
                            </button>
                        </div>

                        <div className="featured-info">
                            <h2>{selectedFilm.title}</h2>
                            {selectedFilm.original_title && selectedFilm.original_title !== selectedFilm.title && (
                                <p className="original-title">({selectedFilm.original_title})</p>
                            )}
                            <div className="movie-extra-info">
                                {selectedFilm.director && (
                                    <p className="director-info">
                                        <strong>Regia:</strong> {selectedFilm.director}
                                    </p>
                                )}
                                {selectedFilm.actors && (
                                    <p className="cast-info">
                                        <strong>Cast:</strong> {selectedFilm.actors}
                                    </p>
                                )}
                            </div>

                            {selectedFilm.genres.length > 0 && (
                                <div className="genres-row">
                                    {selectedFilm.genres.slice(0, 4).map((genre) => (
                                        <span key={genre} className="genre-tag">{genre}</span>
                                    ))}
                                </div>
                            )}

                            {selectedFilm.description && (
                                <div className="description-section">
                                    <p className="movie-description">{selectedFilm.description}</p>
                                </div>
                            )}

                            {/* Cinema e Orari */}
                            <div className="cinemas-section">
                                <h4>📍 Cinema Disponibili</h4>
                                {selectedFilm.cinemas.map((cinema, idx) => (
                                    <div key={idx} className="cinema-block">
                                        <div className="cinema-header">
                                            <span className="cinema-name">{cinema.name}</span>
                                            {cinema.address && (
                                                <span className="cinema-address">{cinema.address}</span>
                                            )}
                                        </div>
                                        <div className="showtimes-grid">
                                            {cinema.showtimes.map((show, sIdx) => (
                                                <button key={sIdx} className="showtime-btn">
                                                    <span className="time">{show.time}</span>
                                                    {show.price && <span className="price">{show.price}</span>}
                                                    {show.sala && <span className="sala">{show.sala}</span>}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Lista Altri Film */}
                <div className="other-movies">
                    <h3>Film in Sala ({films.length})</h3>
                    <div className="movie-list">
                        {films.map((film) => (
                            <div
                                key={film.id}
                                className={`movie-list-item ${selectedFilm?.id === film.id ? 'active' : ''}`}
                                onClick={() => setSelectedFilm(film)}
                            >
                                <img src={film.poster} alt={film.title} className="list-poster" />
                                <div className="list-info">
                                    <h4>{film.title}</h4>
                                    <p>{film.genres.slice(0, 2).join(', ')}</p>
                                    <div className="list-meta">
                                        {film.rating && (
                                            <span className="rating">★ {film.rating.toFixed(1)}</span>
                                        )}
                                        <span className="cinemas-count">
                                            🎦 {film.cinemas.length} cinema
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {isWatchedModalOpen && selectedFilm && (
                <MovieModal
                    movie={{
                        name: selectedFilm.title,
                        year: selectedFilm.year || new Date().getFullYear(),
                        poster_url: selectedFilm.poster,
                        description: selectedFilm.description,
                        director: selectedFilm.director,
                        actors: selectedFilm.actors,
                        genres: selectedFilm.genres
                    } as any}
                    mode="edit"
                    onClose={() => setIsWatchedModalOpen(false)}
                    onSave={handleAddToWatched}
                />
            )}
        </div>
    );
}
