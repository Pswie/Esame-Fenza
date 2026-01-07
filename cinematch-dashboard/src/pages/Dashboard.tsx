import { useState, useEffect, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, ScatterChart, Scatter, ZAxis, Legend, ReferenceLine } from 'recharts';
import { StatsCard } from '../components/StatsCard';
import './Dashboard.css';

interface DashboardData {
    total_watched: number;
    avg_rating: number;
    favorite_genre: string;
    monthly_data: any[];
    genre_data: any[];
    top_years?: { year: number; count: number }[];
    // Nuove statistiche
    rating_chart_data?: { rating: string; count: number; stars: number }[];
    watch_time_hours?: number;
    watch_time_minutes?: number;
    avg_duration?: number;
    top_directors?: { name: string; count: number; avg_rating: number }[];
    top_actors?: { name: string; count: number }[];
    rating_vs_imdb?: { title: string; user_rating: number; user_rating_10: number; imdb_rating: number; difference: number }[];
}

interface MonthlyStats {
    year: number;
    monthly_data: any[];
    total_films: number;
    available_years: number[];
}

export function Dashboard() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [noData, setNoData] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadMessage, setUploadMessage] = useState<string | null>(null);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [monthlyStats, setMonthlyStats] = useState<MonthlyStats | null>(null);
    const [activeRatingIndex, setActiveRatingIndex] = useState<number | null>(null);
    const [activeYearIndex, setActiveYearIndex] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchStats = () => {
        fetch('http://localhost:8000/user-stats', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        })
            .then(res => {
                if (res.status === 404) {
                    setNoData(true);
                    setLoading(false);
                    return null;
                }
                return res.json();
            })
            .then(stats => {
                if (stats && !stats.detail) {
                    setData(stats);
                    setNoData(false);
                    localStorage.setItem('has_data', 'true');
                }
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    };

    const fetchMonthlyStats = (year: number) => {
        fetch(`http://localhost:8000/monthly-stats/${year}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        })
            .then(res => res.json())
            .then(stats => {
                if (stats && !stats.detail) {
                    setMonthlyStats(stats);
                }
            })
            .catch(err => console.error('Errore caricamento stats mensili:', err));
    };

    useEffect(() => {
        fetchStats();
        fetchMonthlyStats(selectedYear);
    }, []);

    useEffect(() => {
        fetchMonthlyStats(selectedYear);
    }, [selectedYear]);

    const handleFileUpload = async (file: File) => {
        if (!file.name.endsWith('.csv')) {
            setUploadMessage('❌ Per favore carica un file CSV');
            return;
        }

        setUploading(true);
        setUploadMessage(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('http://localhost:8000/upload-csv', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                setUploadMessage(`✅ Caricati ${result.count} film con successo!`);
                localStorage.setItem('has_data', 'true');
                setTimeout(() => {
                    fetchStats();
                }, 1000);
            } else {
                setUploadMessage(`❌ ${result.detail || 'Errore durante il caricamento'}`);
            }
        } catch (err) {
            setUploadMessage('❌ Errore di connessione al server');
        } finally {
            setUploading(false);
        }
    };

    if (loading) return <div className="loading-screen">Caricamento dati...</div>;

    // Se non ci sono dati, mostra il form di upload
    if (noData) {
        return (
            <div className="dashboard-page">
                <div className="page-header">
                    <h1>Dashboard</h1>
                    <p>Benvenuto! Carica i tuoi dati Letterboxd per iniziare</p>
                </div>

                <div className="upload-section">
                    <div 
                        className={`upload-zone ${uploading ? 'uploading' : ''}`}
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); }}
                        onDrop={(e) => {
                            e.preventDefault();
                            const file = e.dataTransfer.files[0];
                            if (file) handleFileUpload(file);
                        }}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFileUpload(file);
                            }}
                        />
                        
                        {uploading ? (
                            <div className="upload-loading">
                                <div className="spinner"></div>
                                <p>Analizzando i tuoi film...</p>
                            </div>
                        ) : (
                            <>
                                <div className="upload-icon">📁</div>
                                <h3>Carica il tuo export Letterboxd</h3>
                                <p>Trascina qui il file ratings.csv o clicca per selezionarlo</p>
                            </>
                        )}
                    </div>

                    {uploadMessage && (
                        <div className={`upload-message ${uploadMessage.startsWith('✅') ? 'success' : 'error'}`}>
                            {uploadMessage}
                        </div>
                    )}

                    <div className="upload-instructions">
                        <h4>📋 Come esportare da Letterboxd:</h4>
                        <ol>
                            <li>Vai su <strong>letterboxd.com</strong> → Il tuo profilo</li>
                            <li>Clicca su <strong>Settings</strong> → <strong>Import & Export</strong></li>
                            <li>Scarica <strong>Export your data</strong></li>
                            <li>Carica qui il file <code>ratings.csv</code></li>
                        </ol>
                    </div>
                </div>
            </div>
        );
    }

    // Mostra la dashboard con i dati
    const displayData = data || {
        total_watched: 0,
        avg_rating: 0,
        favorite_genre: 'Nessuno',
        monthly_data: [],
        genre_data: [],
        top_years: [],
        rating_chart_data: [],
        watch_time_hours: 0,
        watch_time_minutes: 0,
        avg_duration: 0,
        top_directors: [],
        top_actors: [],
        rating_vs_imdb: []
    };

    // Colori per le barre
    const yearColors = ['#E50914', '#FF6B35', '#00529B', '#8B5CF6', '#06B6D4'];
    const ratingColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981'];

    // Anno corrente come limite massimo
    const currentYear = new Date().getFullYear();
    const minYear = 2015;

    const goToPreviousYear = () => {
        if (selectedYear > minYear) {
            setSelectedYear(selectedYear - 1);
        }
    };

    const goToNextYear = () => {
        if (selectedYear < currentYear) {
            setSelectedYear(selectedYear + 1);
        }
    };

    const monthlyDataForYear = monthlyStats?.monthly_data || displayData.monthly_data;
    const filmsInSelectedYear = monthlyStats?.total_films || 0;

    // Formatta ore totali
    const totalHours = displayData.watch_time_hours || 0;
    const totalMinutes = displayData.watch_time_minutes || 0;
    const watchTimeDisplay = totalHours > 0 ? `${totalHours}h ${totalMinutes}m` : `${displayData.total_watched * 2}h`;

    // Rating distribution data (con fallback)
    const ratingChartData = displayData.rating_chart_data || [
        { rating: "⭐1", count: Math.round(displayData.total_watched * 0.05), stars: 1 },
        { rating: "⭐2", count: Math.round(displayData.total_watched * 0.1), stars: 2 },
        { rating: "⭐3", count: Math.round(displayData.total_watched * 0.25), stars: 3 },
        { rating: "⭐4", count: Math.round(displayData.total_watched * 0.35), stars: 4 },
        { rating: "⭐5", count: Math.round(displayData.total_watched * 0.25), stars: 5 },
    ];

    return (
        <div className="dashboard-page">
            <div className="page-header">
                <h1>Dashboard</h1>
                <p>Panoramica del tuo storico cinematografico</p>
            </div>

            {/* ============================================
                SEZIONE 1: STATS CARDS PRINCIPALI
                ============================================ */}
            <div className="stats-row">
                <StatsCard
                    icon="🎬"
                    label="Film Visti"
                    value={displayData.total_watched}
                    trend="up"
                    trendValue={`${filmsInSelectedYear} nel ${selectedYear}`}
                />
                <StatsCard
                    icon="⭐"
                    label="Rating Medio"
                    value={displayData.avg_rating}
                    subtitle="su 5.0"
                />
                <StatsCard
                    icon="🎭"
                    label="Genere Preferito"
                    value={displayData.favorite_genre}
                    subtitle="Basato sui tuoi film"
                />
                <StatsCard
                    icon="⏱️"
                    label="Tempo Totale"
                    value={watchTimeDisplay}
                    subtitle={`Media: ${displayData.avg_duration || 120} min/film`}
                />
            </div>

            {/* ============================================
                SEZIONE 2: GRAFICI PRINCIPALI (esistenti)
                ============================================ */}
            <div className="charts-section">
                {/* Grafico Film per Mese */}
                <div className="chart-container">
                    <div className="chart-header">
                        <h3>📈 Film Visti nel {selectedYear} <span className="year-count-badge">{filmsInSelectedYear} film</span></h3>
                        <div className="year-selector">
                            <button className="year-nav-btn" onClick={goToPreviousYear} disabled={selectedYear <= minYear}>◀</button>
                            <span className="year-display">{selectedYear}</span>
                            <button className="year-nav-btn" onClick={goToNextYear} disabled={selectedYear >= currentYear}>▶</button>
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={monthlyDataForYear}>
                            <defs>
                                <linearGradient id="colorFilms" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#E50914" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#E50914" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                            <XAxis dataKey="month" stroke="#757575" />
                            <YAxis stroke="#757575" />
                            <Tooltip
                                contentStyle={{ background: '#1a1a1a', border: '2px solid #E50914', borderRadius: '8px' }}
                                itemStyle={{ color: '#ffffff' }}
                                labelStyle={{ color: '#E50914', fontWeight: '700' }}
                            />
                            <Area type="monotone" dataKey="films" stroke="#E50914" fillOpacity={1} fill="url(#colorFilms)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Grafico Distribuzione Generi */}
                <div className="chart-container">
                    <h3>🎭 Distribuzione Generi</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={displayData.genre_data}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={100}
                                paddingAngle={5}
                                dataKey="value"
                                nameKey="name"
                            >
                                {displayData.genre_data.map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{ background: '#1a1a1a', border: '2px solid #E50914', borderRadius: '8px' }}
                                itemStyle={{ color: '#ffffff' }}
                                labelStyle={{ color: '#E50914', fontWeight: '700' }}
                                formatter={(value: number, name: string) => [`${value}%`, name]}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="genre-legend">
                        {displayData.genre_data.map((genre: any) => (
                            <div key={genre.name} className="legend-item">
                                <span className="legend-color" style={{ background: genre.color }}></span>
                                <span>{genre.name}</span>
                                <span className="legend-value">{genre.value}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ============================================
                SEZIONE 3: DISTRIBUZIONE RATING + TOP ANNI
                ============================================ */}
            <div className="charts-section">
                {/* Distribuzione Rating */}
                <div className="chart-container">
                    <h3>⭐ Come Voti i Film</h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart 
                            data={ratingChartData} 
                            layout="vertical"
                            onMouseLeave={() => setActiveRatingIndex(null)}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                            <XAxis type="number" stroke="#757575" />
                            <YAxis type="category" dataKey="rating" stroke="#757575" width={50} />
                            <Tooltip
                                contentStyle={{ background: '#1a1a1a', border: '2px solid #E50914', borderRadius: '8px' }}
                                itemStyle={{ color: '#ffffff' }}
                                labelStyle={{ color: '#E50914', fontWeight: '700' }}
                                formatter={(value: number) => [`${value} film`, 'Totale']}
                                cursor={{ fill: 'transparent' }}
                            />
                            <Bar 
                                dataKey="count" 
                                radius={[0, 8, 8, 0]}
                                onMouseEnter={(_, index) => setActiveRatingIndex(index)}
                            >
                                {ratingChartData.map((_, index) => (
                                    <Cell 
                                        key={`cell-${index}`} 
                                        fill={activeRatingIndex === null || activeRatingIndex === index 
                                            ? ratingColors[index] 
                                            : '#3a3a3a'} 
                                        style={{ transition: 'fill 0.2s ease' }}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                    <div className="rating-summary">
                        <span className="rating-insight">
                            {(ratingChartData[4]?.count || 0) > (ratingChartData[0]?.count || 0) 
                                ? "🎉 Sei un appassionato generoso!" 
                                : "🎯 Sei un critico esigente!"}
                        </span>
                    </div>
                </div>

                {/* Top 5 Anni */}
                <div className="chart-container">
                    <h3>🏆 Top 5 Anni Più Visti</h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart 
                            data={displayData.top_years || []} 
                            layout="vertical" 
                            margin={{ left: 60 }}
                            onMouseLeave={() => setActiveYearIndex(null)}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                            <XAxis type="number" stroke="#757575" />
                            <YAxis type="category" dataKey="year" stroke="#757575" tick={{ fill: '#fff', fontWeight: 600 }} />
                            <Tooltip
                                contentStyle={{ background: '#1a1a1a', border: '2px solid #E50914', borderRadius: '8px' }}
                                itemStyle={{ color: '#ffffff' }}
                                labelStyle={{ color: '#E50914', fontWeight: '700' }}
                                formatter={(value: number) => [`${value} film`, 'Visti']}
                                cursor={{ fill: 'transparent' }}
                            />
                            <Bar 
                                dataKey="count" 
                                radius={[0, 8, 8, 0]}
                                onMouseEnter={(_, index) => setActiveYearIndex(index)}
                            >
                                {(displayData.top_years || []).map((_, index) => (
                                    <Cell 
                                        key={`cell-${index}`} 
                                        fill={activeYearIndex === null || activeYearIndex === index 
                                            ? yearColors[index % yearColors.length] 
                                            : '#3a3a3a'} 
                                        style={{ transition: 'fill 0.2s ease' }}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* ============================================
                SEZIONE 4: TUO RATING VS IMDB (NUOVO)
                ============================================ */}
            {displayData.rating_vs_imdb && displayData.rating_vs_imdb.length > 0 && (
                <div className="chart-container full-width">
                    <h3>📊 I Tuoi Voti vs IMDb - Film Più Controversi</h3>
                    <p className="chart-subtitle">Film dove il tuo giudizio differisce di più dal pubblico</p>
                    <ResponsiveContainer width="100%" height={350}>
                        <ScatterChart margin={{ top: 20, right: 30, bottom: 40, left: 50 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                            <XAxis 
                                type="number" 
                                dataKey="imdb_rating" 
                                name="IMDb" 
                                stroke="#757575"
                                domain={[0, 10]}
                                label={{ value: 'Rating IMDb', position: 'bottom', fill: '#757575', offset: 0 }}
                            />
                            <YAxis 
                                type="number" 
                                dataKey="user_rating_10" 
                                name="Tuo voto" 
                                stroke="#757575"
                                domain={[0, 10]}
                                label={{ value: 'Tuo Rating (scala 10)', angle: -90, position: 'insideLeft', fill: '#757575' }}
                            />
                            <ZAxis type="number" range={[100, 400]} />
                            <ReferenceLine 
                                segment={[{ x: 0, y: 0 }, { x: 10, y: 10 }]} 
                                stroke="#E50914" 
                                strokeDasharray="5 5"
                                strokeWidth={2}
                            />
                            <Tooltip
                                contentStyle={{ background: '#1a1a1a', border: '2px solid #E50914', borderRadius: '8px', padding: '12px' }}
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const data = payload[0].payload;
                                        return (
                                            <div style={{ background: '#1a1a1a', border: '2px solid #E50914', borderRadius: '8px', padding: '12px' }}>
                                                <p style={{ color: '#E50914', fontWeight: 700, margin: '0 0 8px 0' }}>{data.title}</p>
                                                <p style={{ color: '#fff', margin: '4px 0' }}>Tuo voto: ⭐{data.user_rating}/5 ({data.user_rating_10}/10)</p>
                                                <p style={{ color: '#fff', margin: '4px 0' }}>IMDb: {data.imdb_rating}/10</p>
                                                <p style={{ color: data.difference > 0 ? '#22c55e' : '#ef4444', margin: '4px 0' }}>
                                                    Differenza: {data.difference > 0 ? '+' : ''}{data.difference}
                                                </p>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Scatter 
                                name="Film" 
                                data={displayData.rating_vs_imdb.slice(0, 15)} 
                                fill="#E50914"
                            />
                        </ScatterChart>
                    </ResponsiveContainer>
                    <div className="scatter-legend">
                        <span>📍 Linea rossa = perfetto accordo con IMDb</span>
                        <span>⬆️ Sopra = ti è piaciuto più del pubblico</span>
                        <span>⬇️ Sotto = ti è piaciuto meno</span>
                    </div>
                </div>
            )}

            {/* ============================================
                SEZIONE 5: TOP REGISTI E ATTORI (NUOVO)
                ============================================ */}
            <div className="rankings-section">
                {/* Top Registi */}
                <div className="ranking-card">
                    <h3>🎬 Top 5 Registi</h3>
                    <div className="ranking-list">
                        {(displayData.top_directors || []).map((director, index) => (
                            <div key={director.name} className="ranking-item">
                                <span className="rank-position">#{index + 1}</span>
                                <div className="rank-info">
                                    <span className="rank-name">{director.name}</span>
                                    <span className="rank-stats">{director.count} film • ⭐ {director.avg_rating}</span>
                                </div>
                                <div className="rank-bar">
                                    <div 
                                        className="rank-bar-fill" 
                                        style={{ 
                                            width: `${(director.count / (displayData.top_directors?.[0]?.count || 1)) * 100}%`,
                                            background: yearColors[index % yearColors.length]
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                        {(!displayData.top_directors || displayData.top_directors.length === 0) && (
                            <p className="no-data">Dati non ancora disponibili</p>
                        )}
                    </div>
                </div>

                {/* Top Attori */}
                <div className="ranking-card">
                    <h3>🌟 Top 8 Attori</h3>
                    <div className="ranking-list">
                        {(displayData.top_actors || []).map((actor, index) => (
                            <div key={actor.name} className="ranking-item">
                                <span className="rank-position">#{index + 1}</span>
                                <div className="rank-info">
                                    <span className="rank-name">{actor.name}</span>
                                    <span className="rank-stats">{actor.count} film</span>
                                </div>
                                <div className="rank-bar">
                                    <div 
                                        className="rank-bar-fill" 
                                        style={{ 
                                            width: `${(actor.count / (displayData.top_actors?.[0]?.count || 1)) * 100}%`,
                                            background: `hsl(${index * 45}, 70%, 50%)`
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                        {(!displayData.top_actors || displayData.top_actors.length === 0) && (
                            <p className="no-data">Dati non ancora disponibili</p>
                        )}
                    </div>
                </div>
            </div>

            {/* ============================================
                SEZIONE 6: QUICK STATS (esistente)
                ============================================ */}
            <div className="quick-stats">
                <div className="quick-stat-card">
                    <span className="quick-stat-value">{displayData.total_watched}</span>
                    <span className="quick-stat-label">Totale Film</span>
                </div>
                <div className="quick-stat-card">
                    <span className="quick-stat-value">{displayData.avg_rating}</span>
                    <span className="quick-stat-label">Rating Medio</span>
                </div>
                <div className="quick-stat-card">
                    <span className="quick-stat-value">{displayData.avg_duration || 120}</span>
                    <span className="quick-stat-label">Durata Media (min)</span>
                </div>
                <div className="quick-stat-card">
                    <span className="quick-stat-value">{displayData.top_directors?.length || 0}</span>
                    <span className="quick-stat-label">Registi Diversi</span>
                </div>
            </div>
        </div>
    );
}
