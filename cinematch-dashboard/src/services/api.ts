// ============================================
// CINEMATCH - API SERVICE
// ============================================

const API_BASE_URL = 'http://localhost:8000';

// Interfacce per i dati
export interface UserStats {
  filmsWatched: number;
  averageRating: number;
  totalRatings: number;
  ratingDistribution: Record<number, number>;
  topRatedMovies: MovieRating[];
  recentMovies: MovieRating[];
}

export interface MovieRating {
  name: string;
  year: number;
  rating: number;
  date: string;
  letterboxdUri?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

export interface SentimentResult {
  movie: string;
  sentiment_score: number;
  timestamp: string;
  type: string;
}

// Helper per le richieste autenticate
const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
};

// ============================================
// AUTH API
// ============================================

export const authAPI = {
  async login(username: string, password: string): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Login fallito');
    }
    
    const data = await response.json();
    localStorage.setItem('token', data.access_token);
    return data;
  },

  async register(username: string, password: string): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Registrazione fallita');
    }
    
    return response.json();
  },

  logout(): void {
    localStorage.removeItem('token');
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem('token');
  }
};

// ============================================
// DATA API
// ============================================

export const dataAPI = {
  async uploadCSV(file: File): Promise<UserStats> {
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${API_BASE_URL}/upload-csv`, {
      method: 'POST',
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      body: formData
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Upload fallito');
    }
    
    return response.json();
  },

  async getUserStats(): Promise<UserStats | null> {
    const response = await fetch(`${API_BASE_URL}/user-stats`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Errore nel recupero delle statistiche');
    }
    
    return response.json();
  },

  async getUserHistory(): Promise<SentimentResult[]> {
    const response = await fetch(`${API_BASE_URL}/user-history`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Errore nel recupero della cronologia');
    }
    
    const data = await response.json();
    return data.history || [];
  }
};

// ============================================
// SENTIMENT API
// ============================================

export const sentimentAPI = {
  async analyzeMovie(title: string): Promise<SentimentResult> {
    const response = await fetch(`${API_BASE_URL}/analyze-movie-sentiment/${encodeURIComponent(title)}`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Errore nell\'analisi del sentiment');
    }
    
    const data = await response.json();
    return data.result;
  }
};

// ============================================
// CATALOG API (Film Database)
// ============================================

export interface CatalogMovie {
  imdb_id: string;
  title: string;
  original_title?: string;
  year?: number;
  genres: string[];
  duration?: number;
  country?: string;
  language?: string;
  director?: string;
  actors?: string;
  description?: string;
  avg_vote?: number;
  votes?: number;
  poster_url: string;
  has_real_poster: boolean;
}

export interface CatalogSearchResult {
  results: CatalogMovie[];
  query: string;
}

export interface CatalogGenre {
  name: string;
  count: number;
}

export const catalogAPI = {
  // URL immagine stock di fallback
  STOCK_POSTER_URL: 'https://via.placeholder.com/500x750/1a1a2e/e50914?text=No+Poster',

  async getMovies(params?: {
    skip?: number;
    limit?: number;
    genre?: string;
    year?: number;
    min_rating?: number;
    search?: string;
  }): Promise<{ movies: CatalogMovie[]; total: number }> {
    const queryParams = new URLSearchParams();
    if (params?.skip) queryParams.append('skip', params.skip.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.genre) queryParams.append('genre', params.genre);
    if (params?.year) queryParams.append('year', params.year.toString());
    if (params?.min_rating) queryParams.append('min_rating', params.min_rating.toString());
    if (params?.search) queryParams.append('search', params.search);

    const response = await fetch(`${API_BASE_URL}/catalog/movies?${queryParams}`);
    if (!response.ok) throw new Error('Errore nel recupero dei film');
    return response.json();
  },

  async getMovie(imdbId: string): Promise<CatalogMovie> {
    const response = await fetch(`${API_BASE_URL}/catalog/movie/${imdbId}`);
    if (!response.ok) throw new Error('Film non trovato');
    return response.json();
  },

  async searchMovies(query: string, limit = 20): Promise<CatalogSearchResult> {
    const response = await fetch(`${API_BASE_URL}/catalog/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    if (!response.ok) throw new Error('Errore nella ricerca');
    return response.json();
  },

  async getGenres(): Promise<CatalogGenre[]> {
    const response = await fetch(`${API_BASE_URL}/catalog/genres`);
    if (!response.ok) throw new Error('Errore nel recupero dei generi');
    const data = await response.json();
    return data.genres;
  },

  async getPoster(imdbId: string): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/catalog/poster/${imdbId}`);
    if (!response.ok) return this.STOCK_POSTER_URL;
    const data = await response.json();
    return data.poster_url || this.STOCK_POSTER_URL;
  },

  async getStats(): Promise<{
    total_movies: number;
    with_real_poster: number;
    with_stock_poster: number;
    top_genres: CatalogGenre[];
    by_decade: { decade: number; count: number }[];
  }> {
    const response = await fetch(`${API_BASE_URL}/catalog/stats`);
    if (!response.ok) throw new Error('Errore nel recupero delle statistiche');
    return response.json();
  },

  // Helper per ottenere il poster con fallback
  getPosterUrl(movie: CatalogMovie | { poster_url?: string }): string {
    return movie?.poster_url || this.STOCK_POSTER_URL;
  }
};

export default { authAPI, dataAPI, sentimentAPI, catalogAPI };
