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
    last_update: string | null;
    is_refreshing: boolean;
}

// Helper to format date in Italian
function formatDateItalian(isoDate: string | null): string {
    if (!isoDate) return 'Data non disponibile';
    try {
        const date = new Date(isoDate);
        const months = [
            'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
            'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
        ];
        return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
    } catch {
        return 'Data non disponibile';
    }
}

export function Cinema() {
    const [films, setFilms] = useState<CinemaFilm[]>([]);
    const [selectedFilm, setSelectedFilm] = useState<CinemaFilm | null>(null);
    const [province, setProvince] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isWatchedModalOpen, setIsWatchedModalOpen] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [refreshProgress, setRefreshProgress] = useState(0);
    const [refreshProvince, setRefreshProvince] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncFilm, setSyncFilm] = useState('');
    // Date navigation
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [availableDates, setAvailableDates] = useState<string[]>([]);
    const [todayDate, setTodayDate] = useState<string>('');

    useEffect(() => {
        // Fetch available dates on mount
        const fetchDates = async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch('http://localhost:8000/cinema/dates', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (response.ok) {
                    const data = await response.json();
                    setAvailableDates(data.available_dates || []);
                    setTodayDate(data.today);
                    // Start with newest available date (last in array)
                    const newestDate = data.available_dates?.length > 0
                        ? data.available_dates[data.available_dates.length - 1]
                        : data.today;
                    setSelectedDate(newestDate);
                }
            } catch (err) {
                console.error('Error fetching dates:', err);
                const today = new Date().toISOString().split('T')[0];
                setSelectedDate(today);
                setTodayDate(today);
            }
        };
        fetchDates();
    }, []);

    useEffect(() => {
        if (selectedDate) {
            fetchCinemaFilms(selectedDate);
        }
    }, [selectedDate]);

    // Poll for progress when refreshing
    useEffect(() => {
        if (!isRefreshing) return;

        const pollProgress = async () => {
            try {
                const response = await fetch('http://localhost:8000/cinema/progress');
                if (response.ok) {
                    const data = await response.json();
                    setRefreshProgress(data.percentage);
                    setRefreshProvince(data.current_province);

                    // Check sync status
                    if (data.sync) {
                        setIsSyncing(data.sync.status === 'running');
                        setSyncFilm(data.sync.current_film || '');
                    }

                    // If both completed, refresh the films list and navigate to today
                    if (data.status === 'completed' && (!data.sync || data.sync.status !== 'running')) {
                        setIsRefreshing(false);
                        setIsSyncing(false);
                        setRefreshProgress(0);
                        // Refetch dates and navigate to today
                        setTimeout(async () => {
                            try {
                                const token = localStorage.getItem('token');
                                const datesResponse = await fetch('http://localhost:8000/cinema/dates', {
                                    headers: { 'Authorization': `Bearer ${token}` }
                                });
                                if (datesResponse.ok) {
                                    const datesData = await datesResponse.json();
                                    setAvailableDates(datesData.available_dates || []);
                                    setTodayDate(datesData.today);
                                    // Auto-navigate to today
                                    setSelectedDate(datesData.today);
                                }
                            } catch (err) {
                                console.error('Error refreshing dates:', err);
                            }
                        }, 1000);
                    }
                }
            } catch (err) {
                console.error('Error polling progress:', err);
            }
        };

        pollProgress(); // Initial poll
        const interval = setInterval(pollProgress, 2000); // Poll every 2 seconds

        return () => clearInterval(interval);
    }, [isRefreshing, isSyncing]);

    const fetchCinemaFilms = async (forDate?: string) => {
        try {
            const token = localStorage.getItem('token');
            const dateParam = forDate ? `?date=${forDate}` : '';
            const response = await fetch(`http://localhost:8000/cinema/films${dateParam}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data: CinemaResponse = await response.json();
                setFilms(data.films);
                setProvince(data.province);
                setLastUpdate(data.last_update);
                setIsRefreshing(data.is_refreshing);
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

    // Date navigation functions - jump to available dates
    const currentIndex = availableDates.indexOf(selectedDate);

    const goToPreviousDay = () => {
        if (currentIndex > 0) {
            setSelectedDate(availableDates[currentIndex - 1]);
        }
    };

    const goToNextDay = () => {
        if (currentIndex < availableDates.length - 1) {
            setSelectedDate(availableDates[currentIndex + 1]);
        }
    };

    const formatDisplayDate = (dateStr: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' };
        return date.toLocaleDateString('it-IT', options);
    };

    const isToday = selectedDate === todayDate;
    const canGoPrevious = currentIndex > 0;
    const canGoNext = currentIndex < availableDates.length - 1;

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
                    <div className="date-navigation">
                        <button
                            className="date-nav-btn"
                            onClick={goToPreviousDay}
                            disabled={!canGoPrevious}
                            title="Giorno precedente"
                        >
                            ◀
                        </button>
                        <span className="current-date">
                            {isToday ? 'Oggi' : formatDisplayDate(selectedDate)}
                        </span>
                        <button
                            className="date-nav-btn"
                            onClick={goToNextDay}
                            disabled={!canGoNext}
                            title="Giorno successivo"
                        >
                            ▶
                        </button>
                    </div>
                    <p>{error || 'Nessun film in programmazione per questa data'}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="cinema-page">
            <div className="page-header">
                <h1>🎭 Al Cinema Ora</h1>
                <div className="date-navigation">
                    <button
                        className="date-nav-btn"
                        onClick={goToPreviousDay}
                        disabled={!canGoPrevious}
                        title="Giorno precedente"
                    >
                        ◀
                    </button>
                    <span className="current-date">
                        {isToday ? 'Oggi' : formatDisplayDate(selectedDate)}
                    </span>
                    <button
                        className="date-nav-btn"
                        onClick={goToNextDay}
                        disabled={!canGoNext}
                        title="Giorno successivo"
                    >
                        ▶
                    </button>
                </div>
                <p>
                    Film in programmazione a <strong>{province}</strong>
                    {isRefreshing && (
                        <span className="refreshing-badge">
                            🔄 Aggiornamento in corso {refreshProgress}%{refreshProvince && ` - ${refreshProvince}`}
                        </span>
                    )}
                    {isSyncing && (
                        <span className="refreshing-badge sync-badge">
                            🎬 Recupero film{syncFilm && `: ${syncFilm}`}
                        </span>
                    )}
                </p>
            </div>

            <div className="cinema-layout">
                {/* Film Principale Selezionato */}
                {selectedFilm && (
                    <div className="featured-movie">
                        <div className="featured-poster-container">
                            <div className="featured-poster">
                                <img
                                    src={selectedFilm.poster}
                                    alt={selectedFilm.title}
                                    loading="eager"
                                />
                                {selectedFilm.rating && (
                                    <div className="poster-overlay">
                                        <div className="rating-badge">
                                            <span className="star">★</span> {selectedFilm.rating.toFixed(1)}
                                        </div>
                                    </div>
                                )}
                            </div>
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
                                {selectedFilm.cinemas.map((cinema, idx) => {
                                    // Sort showtimes by time ascending
                                    const sortedShowtimes = [...cinema.showtimes].sort((a, b) => {
                                        const timeA = a.time.replace(':', '');
                                        const timeB = b.time.replace(':', '');
                                        return parseInt(timeA) - parseInt(timeB);
                                    });
                                    return (
                                        <div key={idx} className="cinema-block">
                                            <div className="cinema-name-header">
                                                🎬 {cinema.name}
                                            </div>
                                            <div className="showtimes-grid">
                                                {sortedShowtimes.map((show, sIdx) => (
                                                    <button key={sIdx} className="showtime-btn">
                                                        <span className="time">{show.time}</span>
                                                        {show.price && <span className="price">{show.price}</span>}
                                                        {show.sala && <span className="sala">{show.sala}</span>}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
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
                                <img
                                    src={film.poster}
                                    alt={film.title}
                                    className="list-poster"
                                    loading="lazy"
                                />
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
                    hideDetailsButton={true}
                    onClose={() => setIsWatchedModalOpen(false)}
                    onSave={handleAddToWatched}
                />
            )}
        </div>
    );
}
