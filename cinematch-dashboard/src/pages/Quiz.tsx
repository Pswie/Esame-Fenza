import { useState, useEffect } from 'react';
import './Quiz.css';

export function Quiz() {
    const [questions, setQuestions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [score, setScore] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [showResult, setShowResult] = useState(false);
    const [isAnswered, setIsAnswered] = useState(false);
    const [quizComplete, setQuizComplete] = useState(false);

    useEffect(() => {
        fetchQuestions();
    }, []);

    const fetchQuestions = async () => {
        try {
            setLoading(true);
            const response = await fetch('http://localhost:8000/quiz/questions');
            if (!response.ok) throw new Error('Failed to fetch questions');

            const data = await response.json();

            if (Array.isArray(data)) {
                setQuestions(data);
            } else if (data.questions && Array.isArray(data.questions)) {
                setQuestions(data.questions);
            } else {
                setQuestions([]);
                console.log("No questions available:", data);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong');
            console.error("Quiz fetch error:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setSelectedAnswer(null);
        setShowResult(false);
        setIsAnswered(false);
    }, [currentQuestion]);

    const handleAnswerClick = (answerId: string, isCorrect: boolean) => {
        if (isAnswered) return;

        setSelectedAnswer(answerId);
        setIsAnswered(true);
        setShowResult(true);

        if (isCorrect) {
            setScore(score + 1);
        }
    };

    const goNext = () => {
        if (currentQuestion < questions.length - 1) {
            setCurrentQuestion(currentQuestion + 1);
        } else {
            // Quiz complete - submit results
            // Note: score is already updated by handleAnswerClick, so we use it directly
            submitResults(score, questions.length - score);
            setQuizComplete(true);
        }
    };

    const submitResults = async (correct: number, wrong: number) => {
        try {
            const token = localStorage.getItem('token');
            const today = new Date().toISOString().split('T')[0];

            await fetch('http://localhost:8000/quiz/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    correct,
                    wrong,
                    quiz_date: today
                })
            });
            console.log(`Quiz submitted: ${correct} correct, ${wrong} wrong`);
        } catch (err) {
            console.error('Failed to submit quiz results:', err);
        }
    };

    const goPrevious = () => {
        if (currentQuestion > 0) {
            setCurrentQuestion(currentQuestion - 1);
        }
    };

    const resetQuiz = () => {
        setCurrentQuestion(0);
        setScore(0);
        setSelectedAnswer(null);
        setShowResult(false);
        setIsAnswered(false);
        setQuizComplete(false);
        fetchQuestions();
    };

    const getButtonClass = (answer: { id: string; isCorrect: boolean }) => {
        if (!showResult) return '';
        if (answer.id === selectedAnswer) {
            return answer.isCorrect ? 'correct' : 'incorrect';
        }
        if (answer.isCorrect) return 'correct';
        return 'dimmed';
    };

    if (loading) return (
        <div className="quiz-page">
            <div className="quiz-card">
                <h1>Loading Quiz... 🎬</h1>
                <p>Generating fresh questions for you...</p>
            </div>
        </div>
    );

    if (error) return (
        <div className="quiz-page">
            <div className="quiz-card">
                <h1>Error loading quiz 😢</h1>
                <p>{error}</p>
                <button className="restart-btn" onClick={fetchQuestions}>Retry</button>
            </div>
        </div>
    );

    if (questions.length === 0) return (
        <div className="quiz-page">
            <div className="quiz-card">
                <h1>No questions for today yet! 🍿</h1>
                <p>Check back later or check the backend generation.</p>
                <button className="restart-btn" onClick={fetchQuestions}>Check Again</button>
            </div>
        </div>
    );

    const question = questions[currentQuestion];

    if (quizComplete) {
        const percentage = Math.round((score / questions.length) * 100);
        let message = '';

        if (percentage === 100) {
            message = "Perfect! You're a true Ghibli expert!";
        } else if (percentage >= 80) {
            message = "Great job! Totoro is proud of you!";
        } else if (percentage >= 60) {
            message = "Good work! Keep watching Ghibli films!";
        } else {
            message = "There's still much to discover in the Ghibli world!";
        }

        return (
            <div className="quiz-page">
                <div className="quiz-card complete-card">
                    <h1>Quiz Complete! 🌟</h1>
                    <div className="score-big">{score}/{questions.length}</div>
                    <p className="message">{message}</p>
                    <button className="restart-btn" onClick={resetQuiz}>
                        🌸 Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="quiz-page">
            <div className="quiz-card">
                <img src="/totoro.svg" alt="Totoro" className="totoro-character" />
                <div className="question-label">Question {currentQuestion + 1}:</div>
                {question.movie_title && (
                    <h3 className="movie-title-label">🎬 {question.movie_title} ({question.movie_year})</h3>
                )}
                <h2 className="question-text">{question.question}</h2>
            </div>

            <div className="answers-grid">
                {question.answers.map((answer: any) => (
                    <button
                        key={answer.id}
                        className={`answer-btn ${getButtonClass(answer)}`}
                        onClick={() => handleAnswerClick(answer.id, answer.isCorrect)}
                        disabled={isAnswered}
                    >
                        <span className="answer-text">{answer.text}</span>
                    </button>
                ))}
            </div>

            {showResult && (
                <div className={`explanation-box ${selectedAnswer && question.answers.find((a: any) => a.id === selectedAnswer)?.isCorrect ? 'correct' : 'incorrect'}`}>
                    <div className="explanation-header">
                        {selectedAnswer && question.answers.find((a: any) => a.id === selectedAnswer)?.isCorrect
                            ? '✨ Correct!'
                            : '💫 Not quite!'}
                    </div>
                    <p className="explanation-text">{question.explanation}</p>

                    <div className="nav-buttons">
                        <button
                            className="nav-btn prev-btn"
                            onClick={goPrevious}
                            disabled={currentQuestion === 0}
                        >
                            ← Previous
                        </button>
                        <button
                            className="nav-btn next-btn"
                            onClick={goNext}
                        >
                            {currentQuestion < questions.length - 1 ? 'Next →' : 'Finish 🌟'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
