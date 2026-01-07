import { useState, useEffect, useCallback } from 'react';
import { catalogAPI, type CatalogMovie } from '../services/api';
import './CatalogoFilm.css';

interface UserMovie {
    name: string;
    year: number;
    rating: number;
    date: string;
    imdb_id?: string;
    poster_url?: string;
}

interface MoviesByYear {
    [year: string]: UserMovie[];
}

// Immagine stock di fallback
const STOCK_POSTER = 'https://via.placeholder.com/500x750/1a1a2e/e50914?text=No+Poster';

export function CatalogoFilm() {
    // Stati per la ricerca nel catalogo
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<CatalogMovie[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedMovie, setSelectedMovie] = useState<CatalogMovie | null>(null);
    const [selectedRating, setSelectedRating] = useState(0);
    const [showAddModal, setShowAddModal] = useState(false);
    const [addingMovie, setAddingMovie] = useState(false);

    // Stati per i film dell'utente (come FilmVisti originale)
    const [movies, setMovies] = useState<UserMovie[]>([]);
    const [loading, setLoading] = useState(true);
    const [groupedMovies, setGroupedMovies] = useState<MoviesByYear>({});
    const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set());
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
    const [filterRating, setFilterRating] = useState<number | null>(null);

    // Carica i film dell'utente
    useEffect(() => {
        fetchUserMovies();
    }, []);

    const fetchUserMovies = async () => {
        try {
            const response = await fetch('http://localhost:8000/user-movies', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            const moviesList = data.movies || [];
            setMovies(moviesList);
            groupByYear(moviesList);
        } catch (error) {
            console.error('Errore caricamento film utente:', error);
        } finally {
            setLoading(false);
        }
    };

    const groupByYear = (movieList: UserMovie[]) => {
        const grouped: MoviesByYear = {};
        movieList.forEach(movie => {
            const year = movie.year?.toString() || 'Sconosciuto';
            if (!grouped[year]) {
                grouped[year] = [];
            }
            grouped[year].push(movie);
        });
        
        // Ordina i film per rating all'interno di ogni anno
        Object.keys(grouped).forEach(year => {
            grouped[year].sort((a, b) => b.rating - a.rating);
        });
        
        setGroupedMovies(grouped);
        // Espandi i primi 3 anni di default
        const years = Object.keys(grouped).sort((a, b) => parseInt(b) - parseInt(a));
        setExpandedYears(new Set(years.slice(0, 3)));
    };

    const toggleYear = (year: string) => {
        const newExpanded = new Set(expandedYears);
        if (newExpanded.has(year)) {
            newExpanded.delete(year);
        } else {
            newExpanded.add(year);
        }
        setExpandedYears(newExpanded);
    };

    const expandAll = () => {
        setExpandedYears(new Set(Object.keys(groupedMovies)));
    };

    const collapseAll = () => {
        setExpandedYears(new Set());
    };

    const getSortedYears = () => {
        return Object.keys(groupedMovies).sort((a, b) => {
            return sortOrder === 'desc' 
                ? parseInt(b) - parseInt(a) 
                : parseInt(a) - parseInt(b);
        });
    };

    const getFilteredMovies = (yearMovies: UserMovie[]) => {
        if (filterRating === null) return yearMovies;
        return yearMovies.filter(m => m.rating === filterRating);
    };

    // Ricerca con debounce
    const searchMovies = useCallback(async (query: string) => {
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const results = await catalogAPI.searchMovies(query, 20);
            setSearchResults(results.results);
        } catch (error) {
            console.error('Errore ricerca:', error);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    }, []);

    // Debounce della ricerca
    useEffect(() => {
        const timer = setTimeout(() => {
            searchMovies(searchQuery);
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery, searchMovies]);

    // Apri modal per aggiungere film
    const openAddModal = (movie: CatalogMovie) => {
        // Verifica se il film è già nella collezione
        const alreadyAdded = movies.some(
            m => m.name.toLowerCase() === movie.title.toLowerCase() && m.year === movie.year
        );
        
        if (alreadyAdded) {
            alert('Hai già questo film nella tua collezione!');
            return;
        }

        setSelectedMovie(movie);
        setSelectedRating(0);
        setShowAddModal(true);
    };

    // Aggiungi film alla collezione
    const addMovieToCollection = async () => {
        if (!selectedMovie || selectedRating === 0) {
            alert('Seleziona un rating per il film!');
            return;
        }

        setAddingMovie(true);
        try {
            const response = await fetch('http://localhost:8000/user-movies/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    name: selectedMovie.title,
                    year: selectedMovie.year,
                    rating: selectedRating,
                    imdb_id: selectedMovie.imdb_id,
                    poster_url: selectedMovie.poster_url || STOCK_POSTER
                })
            });

            if (!response.ok) {
                throw new Error('Errore nell\'aggiunta del film');
            }

            // Ricarica la lista film
            await fetchUserMovies();

            setShowAddModal(false);
            setSelectedMovie(null);
            setSearchQuery('');
            setSearchResults([]);

            alert(`"${selectedMovie.title}" aggiunto con ${selectedRating} stelle! ⭐`);
        } catch (error) {
            console.error('Errore:', error);
            alert('Errore nell\'aggiunta del film');
        } finally {
            setAddingMovie(false);
        }
    };

    // Renderizza stelle
    const renderStars = (rating: number) => {
        const stars = [];
        for (let i = 1; i <= 5; i++) {
            stars.push(
                <span key={i} className={`star ${i <= rating ? 'filled' : 'empty'}`}>
                    ★
                </span>
            );
        }
        return stars;
    };

    // Statistiche rapide
    const totalMovies = movies.length;
    const avgRating = totalMovies > 0
        ? (movies.reduce((sum, m) => sum + m.rating, 0) / totalMovies).toFixed(2)
        : '0';

    const sortedYears = getSortedYears();

    if (loading) return <div className="loading-screen">Caricamento film...</div>;

    return (
        <div className="catalogo-film-page">
            {/* Header */}
            <div className="page-header">
                <h1>🎬 Catalogo Film</h1>
                <p>Cerca film nel database e aggiungili alla tua collezione</p>
            </div>

            {/* Barra di ricerca */}
            <div className="search-section">
                <div className="search-box">
                    <span className="search-icon">🔍</span>
                    <input
                        type="text"
                        placeholder="Cerca un film da aggiungere..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="search-input"
                    />
                    {searchQuery && (
                        <button
                            className="clear-search"
                            onClick={() => {
                                setSearchQuery('');
                                setSearchResults([]);
                            }}
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* Risultati ricerca */}
                {(searchQuery.length >= 2 || searchResults.length > 0) && (
                    <div className="search-results">
                        {isSearching ? (
                            <div className="search-loading">
                                <span className="spinner">🔄</span> Ricerca in corso...
                            </div>
                        ) : searchResults.length > 0 ? (
                            <>
                                <div className="results-header">
                                    <span>🎯 {searchResults.length} risultati per "{searchQuery}"</span>
                                </div>
                                <div className="results-grid">
                                    {searchResults.map((movie) => (
                                        <div
                                            key={movie.imdb_id}
                                            className="search-result-card"
                                            onClick={() => openAddModal(movie)}
                                        >
                                            <div className="result-poster">
                                                {movie.poster_url && !movie.poster_url.includes('placeholder') ? (
                                                    <img
                                                        src={movie.poster_url}
                                                        alt={movie.title}
                                                        onError={(e) => {
                                                            e.currentTarget.style.display = 'none';
                                                            const placeholder = e.currentTarget.nextElementSibling as HTMLElement;
                                                            if (placeholder) placeholder.classList.remove('hidden');
                                                        }}
                                                    />
                                                ) : null}
                                                <div className={`poster-placeholder ${movie.poster_url && !movie.poster_url.includes('placeholder') ? 'hidden' : ''}`}>
                                                    <span className="poster-icon">🎬</span>
                                                    <span className="poster-year">{movie.year}</span>
                                                </div>
                                                <div className="add-overlay">
                                                    <span>➕ Aggiungi</span>
                                                </div>
                                            </div>
                                            <div className="result-info">
                                                <h4>{movie.title}</h4>
                                                <span className="result-year">{movie.year || 'N/A'}</span>
                                                {movie.avg_vote && (
                                                    <span className="result-vote">⭐ {movie.avg_vote.toFixed(1)}</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : searchQuery.length >= 2 ? (
                            <div className="no-results">
                                <span>😕</span>
                                <p>Nessun film trovato per "{searchQuery}"</p>
                            </div>
                        ) : null}
                    </div>
                )}
            </div>

            {/* Divider */}
            <div className="section-divider">
                <span>📚 La Tua Collezione</span>
            </div>

            {/* Stats Bar - come originale */}
            <div className="film-stats-bar">
                <div className="stat-chip">
                    <span className="stat-icon">🎬</span>
                    <span>{totalMovies} film totali</span>
                </div>
                <div className="stat-chip">
                    <span className="stat-icon">⭐</span>
                    <span>Media {avgRating}/5</span>
                </div>
            </div>

            {/* Controlli - come originale */}
            <div className="controls-bar">
                <div className="sort-controls">
                    <button 
                        className={`control-btn ${sortOrder === 'desc' ? 'active' : ''}`}
                        onClick={() => setSortOrder('desc')}
                    >
                        Più recenti
                    </button>
                    <button 
                        className={`control-btn ${sortOrder === 'asc' ? 'active' : ''}`}
                        onClick={() => setSortOrder('asc')}
                    >
                        Più vecchi
                    </button>
                </div>

                <div className="filter-controls">
                    <span className="filter-label">Filtra per rating:</span>
                    <button 
                        className={`rating-filter ${filterRating === null ? 'active' : ''}`}
                        onClick={() => setFilterRating(null)}
                    >
                        Tutti
                    </button>
                    {[5, 4, 3, 2, 1].map(r => (
                        <button 
                            key={r}
                            className={`rating-filter ${filterRating === r ? 'active' : ''}`}
                            onClick={() => setFilterRating(r)}
                        >
                            {r}★
                        </button>
                    ))}
                </div>

                <div className="expand-controls">
                    <button className="control-btn" onClick={expandAll}>
                        Espandi tutto
                    </button>
                    <button className="control-btn" onClick={collapseAll}>
                        Comprimi tutto
                    </button>
                </div>
            </div>

            {/* Film raggruppati per anno - COME ORIGINALE */}
            {movies.length === 0 ? (
                <div className="empty-collection">
                    <span className="empty-icon">🎬</span>
                    <h3>La tua collezione è vuota</h3>
                    <p>Cerca un film nella barra di ricerca e aggiungilo!</p>
                </div>
            ) : (
                <div className="years-container">
                    {sortedYears.map(year => {
                        const yearMovies = getFilteredMovies(groupedMovies[year]);
                        if (yearMovies.length === 0) return null;
                        
                        const isExpanded = expandedYears.has(year);
                        const yearAvg = (yearMovies.reduce((sum, m) => sum + m.rating, 0) / yearMovies.length).toFixed(1);

                        return (
                            <div key={year} className="year-section">
                                <div 
                                    className={`year-header ${isExpanded ? 'expanded' : ''}`}
                                    onClick={() => toggleYear(year)}
                                >
                                    <div className="year-info">
                                        <span className="year-number">{year}</span>
                                        <span className="year-count">{yearMovies.length} film</span>
                                        <span className="year-avg">⭐ {yearAvg}</span>
                                    </div>
                                    <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                                </div>

                                {isExpanded && (
                                    <div className="movies-grid">
                                        {yearMovies.map((movie, index) => (
                                            <div key={index} className="movie-card">
                                                <div className="movie-poster">
                                                    {movie.poster_url && movie.poster_url !== STOCK_POSTER ? (
                                                        <img 
                                                            src={movie.poster_url} 
                                                            alt={movie.name}
                                                            onError={(e) => {
                                                                e.currentTarget.style.display = 'none';
                                                                const placeholder = e.currentTarget.nextElementSibling as HTMLElement;
                                                                if (placeholder) placeholder.classList.remove('hidden');
                                                            }}
                                                        />
                                                    ) : null}
                                                    <div className={`poster-placeholder ${movie.poster_url && movie.poster_url !== STOCK_POSTER ? 'hidden' : ''}`}>
                                                        <span className="poster-icon">🎬</span>
                                                        <span className="poster-year">{movie.year}</span>
                                                    </div>
                                                </div>
                                                <div className="movie-card-info">
                                                    <h4 className="movie-title">{movie.name}</h4>
                                                    <div className="movie-rating">
                                                        {renderStars(movie.rating)}
                                                    </div>
                                                    <div className="movie-date">
                                                        {movie.date ? new Date(movie.date).toLocaleDateString('it-IT', {
                                                            day: 'numeric',
                                                            month: 'short',
                                                            year: 'numeric'
                                                        }) : ''}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal per aggiungere film */}
            {showAddModal && selectedMovie && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="add-movie-modal" onClick={(e) => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => setShowAddModal(false)}>
                            ✕
                        </button>
                        
                        <div className="modal-content">
                            <div className="modal-poster">
                                {selectedMovie.poster_url && !selectedMovie.poster_url.includes('placeholder') ? (
                                    <img
                                        src={selectedMovie.poster_url}
                                        alt={selectedMovie.title}
                                        onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                            const placeholder = e.currentTarget.nextElementSibling as HTMLElement;
                                            if (placeholder) placeholder.classList.remove('hidden');
                                        }}
                                    />
                                ) : null}
                                <div className={`modal-poster-placeholder ${selectedMovie.poster_url && !selectedMovie.poster_url.includes('placeholder') ? 'hidden' : ''}`}>
                                    <span className="poster-icon">🎬</span>
                                    <span className="poster-year">{selectedMovie.year}</span>
                                </div>
                            </div>
                            
                            <div className="modal-info">
                                <h2>{selectedMovie.title}</h2>
                                <p className="modal-year">{selectedMovie.year}</p>
                                
                                {selectedMovie.genres && selectedMovie.genres.length > 0 && (
                                    <div className="modal-genres">
                                        {selectedMovie.genres.slice(0, 3).map(genre => (
                                            <span key={genre} className="genre-tag">{genre}</span>
                                        ))}
                                    </div>
                                )}
                                
                                {selectedMovie.description && (
                                    <p className="modal-description">
                                        {selectedMovie.description.slice(0, 200)}
                                        {selectedMovie.description.length > 200 ? '...' : ''}
                                    </p>
                                )}
                                
                                {selectedMovie.director && (
                                    <p className="modal-director">
                                        <strong>Regia:</strong> {selectedMovie.director}
                                    </p>
                                )}
                                
                                <div className="rating-section">
                                    <h3>Quanto ti è piaciuto?</h3>
                                    <div className="rating-selector">
                                        {[1, 2, 3, 4, 5].map(star => (
                                            <span
                                                key={star}
                                                className={`rating-star ${star <= selectedRating ? 'selected' : ''}`}
                                                onClick={() => setSelectedRating(star)}
                                            >
                                                ★
                                            </span>
                                        ))}
                                    </div>
                                    {selectedRating > 0 && (
                                        <span className="rating-label">
                                            {selectedRating === 5 ? 'Capolavoro!' :
                                             selectedRating === 4 ? 'Ottimo!' :
                                             selectedRating === 3 ? 'Buono' :
                                             selectedRating === 2 ? 'Così così' : 'Non mi è piaciuto'}
                                        </span>
                                    )}
                                </div>
                                
                                <button
                                    className="add-btn"
                                    onClick={addMovieToCollection}
                                    disabled={selectedRating === 0 || addingMovie}
                                >
                                    {addingMovie ? '⏳ Aggiunta...' : '➕ Aggiungi alla Collezione'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
