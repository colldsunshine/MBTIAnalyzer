import { useCallback, useMemo, useState, memo } from "react";
import ReactMarkdown from "react-markdown";
import "./styles.css";

const API = "http://localhost:8000/analyze";

const QUESTIONS = [
    {
        title: "Восстановление энергии",
        label: "E / I",
        desc: "После тяжелой недели Вам обычно хочется провести время с людьми и сменить обстановку или остаться одному и восстановиться в тишине?"
    },
    {
        title: "Восприятие информации",
        label: "S / N",
        desc: "Когда Вы изучаете что-то новое, Вам легче воспринимать конкретные факты и примеры или искать скрытые смыслы и общую картину?"
    },
    {
        title: "Принятие решений",
        label: "T / F",
        desc: "При сложном выборе Вы чаще опираетесь на логику и объективность или на чувства и внутренние ценности?"
    },
    {
        title: "Организация жизни",
        label: "J / P",
        desc: "Вам комфортнее, когда всё заранее спланировано, или когда остается пространство для спонтанности и изменений?"
    },
    {
        title: "Реакция на стресс",
        label: "J / P • T / F",
        desc: "Когда ситуация выходит из-под контроля, Вы стараетесь быстро всё структурировать или сначала проживаете эмоции и только потом действуете?"
    },
    {
        title: "Свободное описание",
        label: "free text",
        desc: "Расскажите немного о себе: что для Вас важно, как Вы принимаете решения, что вдохновляет или утомляет Вас."
    }
];

const TYPE_COLORS = {
    green: "#7E7845",
    purple: "#534E6E",
    yellow: "#C39300",
    blue: "#0D3855",
};

const GROUPS = {
    green: ["INFJ", "INFP", "ENFJ", "ENFP"],
    purple: ["INTJ", "INTP", "ENTJ", "ENTP"],
    yellow: ["ISTP", "ISFP", "ESTP", "ESFP"],
    blue: ["ISTJ", "ISFJ", "ESTJ", "ESFJ"],
};

function getTypeColor(type) {
    if (GROUPS.green.includes(type)) return TYPE_COLORS.green;
    if (GROUPS.purple.includes(type)) return TYPE_COLORS.purple;
    if (GROUPS.yellow.includes(type)) return TYPE_COLORS.yellow;
    if (GROUPS.blue.includes(type)) return TYPE_COLORS.blue;
    return "#7E7845";
}

const Sidebar = memo(function Sidebar({
                                          currentQuestion,
                                          answers,
                                          setCurrentQuestion
                                      }) {
    return (
        <aside className="sidebar">
            <div>
                <div className="logo">MBTI</div>
                <div className="sidebar-sub">
                    AI-психологический портрет
                </div>
            </div>

            <div className="questions-nav">
                {QUESTIONS.map((q, i) => {
                    const active = i === currentQuestion;
                    const filled = answers[i]?.trim().length > 0;

                    return (
                        <button
                            key={i}
                            className={`nav-item ${active ? "active-nav" : ""}`}
                            onClick={() => setCurrentQuestion(i)}
                        >
                            <div className="nav-left">
                                <div className={`nav-dot ${filled ? "filled" : ""}`}/>
                                <span>{q.title}</span>
                            </div>

                            <span className="nav-index">
                0{i + 1}
              </span>
                        </button>
                    );
                })}
            </div>

            <div className="sidebar-footer">
                Анализ носит исследовательский и ознакомительный характер
                и не заменяет профессиональную психологическую диагностику.
            </div>
        </aside>
    );
});

const Scale = ({left, right, percent, color}) => {
    const isRight = percent >= 50;
    const power = Math.abs(percent - 50) * 2;

    return (
        <div className="scale">
            <div className="scale-head">
                <span>{left}</span>
                <span>{power.toFixed(0)}%</span>
                <span>{right}</span>
            </div>

            <div className="scale-track">
                <div
                    className={`scale-fill ${isRight ? "right" : "left"}`}
                    style={{
                        width: `${power / 2}%`,
                        background: color
                    }}
                />
            </div>
        </div>
    );
};

export default function App() {
    const [answers, setAnswers] = useState(Array(6).fill(""));
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState("");

    const currentData = QUESTIONS[currentQuestion];
    const isLast = currentQuestion === 5;

    const progress = useMemo(
        () => ((currentQuestion + 1) / 6) * 100,
        [currentQuestion]
    );

    const handleChange = useCallback(
        (e) => {
            const value = e.target.value;

            setAnswers((prev) => {
                const copy = [...prev];
                copy[currentQuestion] = value;
                return copy;
            });
        },
        [currentQuestion]
    );

    const handleNext = async () => {
        if (!isLast) {
            setCurrentQuestion((p) => p + 1);
            return;
        }

        setLoading(true);
        setError("");

        try {
            const res = await fetch(API, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    answers: answers.slice(0, 5),
                    free_text: answers[5],
                }),
            });

            if (!res.ok) throw new Error();

            const data = await res.json();

            setResult(data);

            setTimeout(() => {
                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });
            }, 50);

        } catch {
            setError("Ошибка анализа.");
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const currentColor = result
        ? getTypeColor(result.mbti_type)
        : "#7E7845";

    if (result) {
        return (
            <div className="results">
                <div className="report-container">
                    <div className="result-type" style={{ color: currentColor }}>
                        {result.mbti_type}
                    </div>

                    <div className="analytics-section">
                        <Scale left="Интроверсия" right="Экстраверсия" percent={result.percent.E} color={currentColor} />
                        <Scale left="Сенсорика" right="Интуиция" percent={result.percent.N} color={currentColor} />
                        <Scale left="Этика" right="Логика" percent={result.percent.T} color={currentColor} />
                        <Scale left="Иррациональность" right="Рациональность" percent={result.percent.J} color={currentColor} />
                    </div>

                    {/* НОВЫЙ БЛОК — AI-портрет + дисклеймер */}
                    <div className="ai-portrait-header">
                        <div className="ai-label">
                            AI-психологический портрет. Портрет сгенерирован искусственным интеллектом на основе ваших ответов.
                            Результаты носят ознакомительный характер и не заменяют профессиональную консультацию психолога.
                        </div>
                    </div>

                    <div className="portrait-section">
                        <ReactMarkdown>
                            {result.portrait}
                        </ReactMarkdown>
                    </div>

                </div>

                <div className="print-button-wrapper">
                    <button className="download-btn" onClick={handlePrint}>
                        Сохранить как PDF
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="layout">
            <Sidebar
                currentQuestion={currentQuestion}
                answers={answers}
                setCurrentQuestion={setCurrentQuestion}
            />

            <main className="content">
                <div className="question-wrapper">

                    <div className="progress">
                        <div
                            className="progress-fill"
                            style={{ width: `${progress}%` }}
                        />
                    </div>

                    <div className="question-label">
                        {currentData.label}
                    </div>

                    <h1 className="question-title">
                        {currentData.title}
                    </h1>

                    <p className="question-desc">
                        {currentData.desc}
                    </p>

                    <textarea
                        value={answers[currentQuestion]}
                        onChange={handleChange}
                        placeholder="Напишите свободно."
                    />

                    {error && (
                        <div className="error">
                            {error}
                        </div>
                    )}

                    <div className="actions">
                        <button
                            className="ghost-btn"
                            onClick={() =>
                                setCurrentQuestion((p) =>
                                    Math.max(0, p - 1)
                                )
                            }
                        >
                            Назад
                        </button>

                        <button
                            className="main-btn"
                            onClick={handleNext}
                            disabled={loading}
                        >
                            {isLast
                                ? loading
                                    ? "Анализ..."
                                    : "Построить портрет"
                                : "Далее"}
                        </button>
                    </div>

                </div>
            </main>
        </div>
    );
}