
import { useState, useEffect } from 'react';
import { catalogAPI, type MovieRating, type CatalogMovie } from '../services/api';
import './MovieModal.css';

interface MovieModalProps {
    movie: MovieRating | CatalogMovie;
    mode: 'view' | 'edit'; // edit per film visti, view per catalogo
    onClose: () => void;
    onSave?: (rating: number, comment: string) => void;
    onDelete?: () => void;
    hideDetailsButton?: boolean;
}

export function MovieModal({ movie, mode, onClose, onSave, onDelete, hideDetailsButton }: MovieModalProps) {
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [showScheda, setShowScheda] = useState(mode === 'view');
    const [saving, setSaving] = useState(false);

    // Dati unificati
    const title = 'title' in movie ? movie.title : movie.name;
    const year = movie.year;
    const poster = catalogAPI.getPosterUrl(movie);

    // Campi dal catalogo (se disponibili)
    const description = 'description' in movie ? movie.description : (movie as MovieRating).description;
    const director = 'director' in movie ? movie.director : (movie as MovieRating).director;
    const actors = 'actors' in movie ? movie.actors : (movie as MovieRating).actors;
    const genres = movie.genres || [];

    useEffect(() => {
        if ('rating' in movie) {
            setRating(movie.rating);
            setComment(movie.comment || '');
        }
    }, [movie]);

    const handleSave = async () => {
        if (!onSave) return;
        setSaving(true);
        try {
            await onSave(rating, comment);
            onClose();
        } catch (error) {
            alert("Errore durante il salvataggio");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="movie-modal-overlay" onClick={onClose}>
            <div className="movie-modal-content" onClick={e => e.stopPropagation()}>
                <button className="modal-close-btn" onClick={onClose}>&times;</button>

                <div className="movie-detail-grid">
                    {/* Sinistra: Poster e Azioni */}
                    <div className="detail-left">
                        <img src={poster} alt={title} className="detail-poster" />

                        {(mode === 'edit' && !hideDetailsButton) && (
                            <div className="modal-sidebar-actions">
                                <button
                                    className="btn-scheda-toggle"
                                    onClick={() => setShowScheda(!showScheda)}
                                >
                                    {showScheda ? "📝 Torna a Recensione" : "🎬 Scheda Film"}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Destra: Info o Editor */}
                    <div className="detail-right">
                        <div className="detail-header">
                            <h2>{title}</h2>
                            <div className="detail-meta">
                                <span>{year}</span>
                                {('duration' in movie && movie.duration) && <span>• {movie.duration} min</span>}
                                {('avg_vote' in movie && movie.avg_vote) && <span>• ⭐ {movie.avg_vote.toFixed(1)}</span>}
                            </div>
                        </div>

                        {showScheda ? (
                            <div className="detail-info-mode animate-fade-in">
                                <div className="detail-genres">
                                    {genres.map(g => <span key={g} className="detail-genre-tag">{g}</span>)}
                                </div>

                                <div className="detail-section">
                                    <h3>Trama</h3>
                                    <p>{description || "Nessuna descrizione disponibile."}</p>
                                </div>

                                <div className="detail-crew">
                                    <div className="crew-item">
                                        <span>Regia</span>
                                        <b>{director || "N/A"}</b>
                                    </div>
                                    <div className="crew-item">
                                        <span>Cast Principale</span>
                                        <b>{actors?.split(',').slice(0, 3).join(', ') || "N/A"}</b>
                                    </div>
                                </div>


                            </div>
                        ) : (
                            <div className="detail-edit-mode animate-fade-in">
                                <div className="review-edit-section">
                                    <h3>La tua Recensione</h3>
                                    <div className="review-stars">
                                        {[1, 2, 3, 4, 5].map(star => (
                                            <span
                                                key={star}
                                                className={`star-input ${star <= rating ? 'active' : ''}`}
                                                onClick={() => setRating(star)}
                                            >
                                                ★
                                            </span>
                                        ))}
                                    </div>
                                    <textarea
                                        className="comment-textarea"
                                        placeholder="Cosa ne pensi di questo film? Scrivi qui il tuo commento..."
                                        value={comment}
                                        onChange={e => setComment(e.target.value)}
                                    />

                                    <div className="modal-actions">
                                        {onDelete && (
                                            <button className="btn-delete" title="Rimuovi dai visti" onClick={onDelete}>
                                                🗑️
                                            </button>
                                        )}
                                        <button
                                            className="btn-save"
                                            disabled={saving}
                                            onClick={handleSave}
                                        >
                                            {saving ? "Salvataggio..." : "Salva Esperienza"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
