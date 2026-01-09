import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Auth.css';

export function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const response = await fetch('http://localhost:8000/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('token', data.access_token);
                localStorage.setItem('username', data.username || username);
                localStorage.setItem('has_data', data.has_data ? 'true' : 'false');
                navigate('/dashboard');
            } else {
                setError('Credenziali non valide');
            }
        } catch (err) {
            setError('Errore di connessione');
        }
    };

    return (
        <div className="auth-page" data-theme="netflix">
            <div className="auth-card">
                <h1>Accedi a CineMatch</h1>
                {error && <div className="auth-error">{error}</div>}
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Username o Email</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="auth-button">Entra</button>
                </form>
                <p className="auth-footer">
                    Non hai un account? <Link to="/register">Registrati</Link>
                </p>
            </div>
        </div>
    );
}

const CAMPANIA_PROVINCES = [
    { value: 'napoli', label: 'Napoli' },
    { value: 'salerno', label: 'Salerno' },
    { value: 'caserta', label: 'Caserta' },
    { value: 'avellino', label: 'Avellino' },
    { value: 'benevento', label: 'Benevento' },
];

export function Register() {
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        confirmPassword: '',
        email: '',
        full_name: '',
        address: '',
        city: '',
        province: 'napoli',
        region: 'Campania'
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validazioni
        if (formData.password !== formData.confirmPassword) {
            setError('Le password non coincidono');
            return;
        }

        if (formData.password.length < 6) {
            setError('La password deve essere di almeno 6 caratteri');
            return;
        }

        try {
            const response = await fetch('http://localhost:8000/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: formData.username,
                    password: formData.password,
                    email: formData.email,
                    full_name: formData.full_name,
                    address: formData.address,
                    city: formData.city,
                    province: formData.province,
                    region: formData.region
                }),
            });

            if (response.ok) {
                setSuccess(true);
                setTimeout(() => navigate('/login'), 2000);
            } else {
                const data = await response.json();
                setError(data.detail || 'Errore durante la registrazione');
            }
        } catch (err) {
            setError('Errore di connessione');
        }
    };

    return (
        <div className="auth-page" data-theme="netflix">
            <div className="auth-card register-card">
                <h1>Crea il tuo Account</h1>
                {error && <div className="auth-error">{error}</div>}
                {success && <div className="auth-success">Registrazione completata! Reindirizzamento...</div>}
                <form onSubmit={handleSubmit}>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Username *</label>
                            <input
                                type="text"
                                name="username"
                                value={formData.username}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Email *</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Nome Completo</label>
                        <input
                            type="text"
                            name="full_name"
                            value={formData.full_name}
                            onChange={handleChange}
                            placeholder="Mario Rossi"
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Password *</label>
                            <input
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                required
                                minLength={6}
                            />
                        </div>
                        <div className="form-group">
                            <label>Conferma Password *</label>
                            <input
                                type="password"
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-section-title">📍 Indirizzo di Residenza</div>

                    <div className="form-group">
                        <label>Indirizzo</label>
                        <input
                            type="text"
                            name="address"
                            value={formData.address}
                            onChange={handleChange}
                            placeholder="Via Roma, 123"
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Città</label>
                            <input
                                type="text"
                                name="city"
                                value={formData.city}
                                onChange={handleChange}
                                placeholder="Pompei"
                            />
                        </div>
                        <div className="form-group">
                            <label>Provincia</label>
                            <select
                                name="province"
                                value={formData.province}
                                onChange={handleChange}
                            >
                                {CAMPANIA_PROVINCES.map(p => (
                                    <option key={p.value} value={p.value}>{p.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Regione</label>
                        <input
                            type="text"
                            name="region"
                            value={formData.region}
                            onChange={handleChange}
                            disabled
                        />
                    </div>

                    <button type="submit" className="auth-button">Registrati</button>
                </form>
                <p className="auth-footer">
                    Hai già un account? <Link to="/login">Accedi</Link>
                </p>
            </div>
        </div>
    );
}
