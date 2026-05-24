import React, { useCallback, useMemo, useState } from 'react';
import { generateQuiz, isAnswerCorrect } from '../lib/quiz/generateQuiz';
import type { QuizFocus, QuizQuestion } from '../lib/quiz/types';

const base = import.meta.env.BASE_URL;

type Phase = 'setup' | 'quiz' | 'results';

type Answers = Record<string, unknown>;

function questionTypeLabel(type: QuizQuestion['type']): string {
  switch (type) {
    case 'multiple_choice':
      return 'Multiple choice';
    case 'true_false':
      return 'True / False';
    case 'yes_no':
      return 'Yes / No';
    case 'match':
      return 'Match';
    default:
      return '';
  }
}

export default function QuizPage() {
  const [phase, setPhase] = useState<Phase>('setup');
  const [focus, setFocus] = useState<QuizFocus>('ci');
  const [count, setCount] = useState(12);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Answers>({});
  const [index, setIndex] = useState(0);

  const startQuiz = useCallback(() => {
    const { questions: qs } = generateQuiz({ count, focus });
    setQuestions(qs);
    setAnswers({});
    setIndex(0);
    setPhase(qs.length > 0 ? 'quiz' : 'setup');
  }, [count, focus]);

  const current = questions[index];
  const progress = questions.length > 0 ? ((index + 1) / questions.length) * 100 : 0;

  const score = useMemo(() => {
    let correct = 0;
    for (const q of questions) {
      if (isAnswerCorrect(q, answers[q.id])) correct++;
    }
    return { correct, total: questions.length };
  }, [questions, answers]);

  const setMcqAnswer = (questionId: string, optionId: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  };

  const setBoolAnswer = (questionId: string, value: boolean) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const setMatchAnswer = (questionId: string, left: string, right: string) => {
    setAnswers((prev) => {
      const existing = (prev[questionId] as Record<string, string>) ?? {};
      return { ...prev, [questionId]: { ...existing, [left]: right } };
    });
  };

  const currentAnswered = current ? answers[current.id] !== undefined : false;
  const matchComplete =
    current?.type === 'match' &&
    current.pairs.every((p) => {
      const map = answers[current.id] as Record<string, string> | undefined;
      return map?.[p.left];
    });

  const canAdvance =
    current &&
    (current.type === 'match' ? matchComplete : currentAnswered);

  const goNext = () => {
    if (index < questions.length - 1) setIndex((i) => i + 1);
    else setPhase('results');
  };

  const goPrev = () => {
    if (index > 0) setIndex((i) => i - 1);
  };

  if (phase === 'setup') {
    return (
      <div className="quiz-page">
        <div className="quiz-setup-card">
          <h2 className="quiz-setup-title">Study quiz</h2>
          <p className="quiz-setup-desc">
            Questions are generated from your <strong>models</strong>, <strong>constructs</strong>,{' '}
            <strong>academics</strong>, <strong>literature notes</strong>, and <strong>research question</strong> —
            with emphasis on continuance intention (CI), ECM-IS, ECT, TPC, and how they relate to adoption models
            like TAM and UTAUT.
          </p>

          <fieldset className="quiz-fieldset">
            <legend>Focus</legend>
            <label className="quiz-radio">
              <input
                type="radio"
                name="focus"
                checked={focus === 'ci'}
                onChange={() => setFocus('ci')}
              />
              <span>
                <strong>CI &amp; continuance</strong> — ECM, ECT, thesis models, TPC, ISSM, plus comparison with
                TAM / UTAUT
              </span>
            </label>
            <label className="quiz-radio">
              <input
                type="radio"
                name="focus"
                checked={focus === 'all'}
                onChange={() => setFocus('all')}
              />
              <span>
                <strong>All models</strong> — full model library including DOI, TOE, SCT, etc.
              </span>
            </label>
          </fieldset>

          <fieldset className="quiz-fieldset">
            <legend>Number of questions</legend>
            <div className="quiz-count-row">
              {[8, 12, 16, 20].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`quiz-count-btn${count === n ? ' quiz-count-btn-active' : ''}`}
                  onClick={() => setCount(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </fieldset>

          <p className="quiz-types-note">
            Question types: multiple choice, true/false, yes/no, and matching (constructs ↔ models, scholars ↔
            models, abbreviations).
          </p>

          <button type="button" className="quiz-primary-btn" onClick={startQuiz}>
            Start quiz
          </button>
        </div>

        <p className="quiz-links">
          Review material:{' '}
          <a href={`${base}models/`}>Models</a> · <a href={`${base}constructs/`}>Constructs</a> ·{' '}
          <a href={`${base}academics/`}>Academics</a>
        </p>
      </div>
    );
  }

  if (phase === 'results') {
    const pct = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;
    return (
      <div className="quiz-page">
        <div className="quiz-results-card">
          <h2 className="quiz-results-title">Results</h2>
          <p className="quiz-score-line">
            <span className="quiz-score-big">
              {score.correct}/{score.total}
            </span>{' '}
            correct ({pct}%)
          </p>

          <ul className="quiz-review-list">
            {questions.map((q, i) => {
              const ok = isAnswerCorrect(q, answers[q.id]);
              return (
                <li key={q.id} className={`quiz-review-item${ok ? '' : ' quiz-review-wrong'}`}>
                  <span className="quiz-review-badge">{ok ? '✓' : '✗'}</span>
                  <div>
                    <p className="quiz-review-q">
                      {i + 1}. {q.prompt}
                    </p>
                    <p className="quiz-review-explanation">{q.explanation}</p>
                    <p className="quiz-review-source">Source: {q.source}</p>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="quiz-results-actions">
            <button type="button" className="quiz-primary-btn" onClick={startQuiz}>
              New quiz
            </button>
            <button type="button" className="quiz-secondary-btn" onClick={() => setPhase('setup')}>
              Change settings
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="quiz-page">
        <p className="quiz-empty">No questions could be generated. Try &ldquo;All models&rdquo; or fewer filters.</p>
        <button type="button" className="quiz-secondary-btn" onClick={() => setPhase('setup')}>
          Back
        </button>
      </div>
    );
  }

  const matchAnswers = (answers[current.id] as Record<string, string>) ?? {};

  return (
    <div className="quiz-page">
      <div className="quiz-progress-wrap">
        <div className="quiz-progress-bar" style={{ width: `${progress}%` }} />
      </div>
      <p className="quiz-progress-text">
        Question {index + 1} of {questions.length}
      </p>

      <article className="quiz-question-card">
        <span className="quiz-type-badge">{questionTypeLabel(current.type)}</span>
        <h2 className="quiz-question-prompt">{current.prompt}</h2>

        {current.type === 'multiple_choice' && (
          <ul className="quiz-options">
            {current.options.map((opt) => (
              <li key={opt.id}>
                <label className="quiz-option-label">
                  <input
                    type="radio"
                    name={current.id}
                    checked={answers[current.id] === opt.id}
                    onChange={() => setMcqAnswer(current.id, opt.id)}
                  />
                  <span>{opt.label}</span>
                </label>
              </li>
            ))}
          </ul>
        )}

        {(current.type === 'true_false' || current.type === 'yes_no') && (
          <div className="quiz-bool-row">
            {current.type === 'true_false' ? (
              <>
                <button
                  type="button"
                  className={`quiz-bool-btn${answers[current.id] === true ? ' quiz-bool-btn-selected' : ''}`}
                  onClick={() => setBoolAnswer(current.id, true)}
                >
                  True
                </button>
                <button
                  type="button"
                  className={`quiz-bool-btn${answers[current.id] === false ? ' quiz-bool-btn-selected' : ''}`}
                  onClick={() => setBoolAnswer(current.id, false)}
                >
                  False
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={`quiz-bool-btn${answers[current.id] === true ? ' quiz-bool-btn-selected' : ''}`}
                  onClick={() => setBoolAnswer(current.id, true)}
                >
                  Yes
                </button>
                <button
                  type="button"
                  className={`quiz-bool-btn${answers[current.id] === false ? ' quiz-bool-btn-selected' : ''}`}
                  onClick={() => setBoolAnswer(current.id, false)}
                >
                  No
                </button>
              </>
            )}
          </div>
        )}

        {current.type === 'match' && (
          <ul className="quiz-match-list">
            {current.pairs.map((pair) => (
              <li key={pair.left} className="quiz-match-row">
                <span className="quiz-match-left">{pair.left}</span>
                <select
                  className="quiz-match-select"
                  value={matchAnswers[pair.left] ?? ''}
                  onChange={(e) => setMatchAnswer(current.id, pair.left, e.target.value)}
                >
                  <option value="">Select…</option>
                  {current.rightOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        )}

        <p className="quiz-source-hint">Based on: {current.source}</p>
      </article>

      <div className="quiz-nav">
        <button type="button" className="quiz-secondary-btn" onClick={goPrev} disabled={index === 0}>
          Previous
        </button>
        <button type="button" className="quiz-primary-btn" onClick={goNext} disabled={!canAdvance}>
          {index < questions.length - 1 ? 'Next' : 'See results'}
        </button>
      </div>
    </div>
  );
}
