/* ─────────────────────────────────────────────────────────────
   src/components/QuizCard.jsx
   Quiz giornaliero della S.S. Lazio.
   - 5 domande/giorno per utente
   - 1 punto per ogni risposta corretta (max 5/giorno)
   - Non riprovabile nello stesso giorno
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  getDailyQuestions,
  getTodayResult,
  submitTodayQuiz,
  QUIZ_DAILY_COUNT,
  QUIZ_POINTS_PER_CORRECT,
} from "../utils/quiz";
import { QUIZ_QUESTIONS } from "../utils/quizQuestions";
import { playReact, playBell } from "../utils/soundDesign";

export default function QuizCard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [todayResult, setTodayResult] = useState(null);
  const [step, setStep] = useState(0); // 0 = intro, 1..5 = domanda, 6 = riepilogo
  const [answers, setAnswers] = useState([]); // [{questionId, userAnswer}]
  const [questions, setQuestions] = useState([]); // 5 domande del giorno
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const r = await getTodayResult(user.uid);
        if (cancelled) return;
        setTodayResult(r);
        // Carica le domande del giorno solo se non ha ancora giocato
        if (!r) {
          const qs = await getDailyQuestions(user.uid);
          if (!cancelled) setQuestions(qs);
        }
      } catch (e) {
        console.error("Errore caricamento quiz:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  if (!user) {
    return (
      <div className="rounded-2xl border border-border bg-bg-surface p-6 text-center">
        <div className="text-[10px] uppercase tracking-[0.3em] text-accent font-bold mb-2">
          Quiz Lazio
        </div>
        <h3
          className="text-2xl text-text-primary mb-2"
          style={{ fontFamily: "var(--font-display)" }}
        >
          5 domande al giorno
        </h3>
        <p className="text-sm text-text-secondary mb-4 max-w-md mx-auto">
          Quanto conosci la storia biancoceleste? Accedi per giocare e
          guadagnare punti per la classifica generale.
        </p>
        <Link
          to="/login"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-text-inverse rounded-md text-sm font-bold hover:shadow-[0_0_24px_-4px_rgba(56,189,248,0.6)] transition"
        >
          Accedi e gioca →
        </Link>
      </div>
    );
  }

  if (loading) return null;

  // Già giocato oggi → mostra risultato + breakdown domande
  if (todayResult) {
    const perfect = todayResult.score === QUIZ_DAILY_COUNT;
    const awarded = todayResult.awardedPoints ?? todayResult.score ?? 0;
    const wrongCount = QUIZ_DAILY_COUNT - (todayResult.score || 0);
    // Lookup diretto dal pool by id: dopo il submit, seenQuizIds è
    // aggiornato e getDailyQuestions restituirebbe domande diverse.
    const qMap = new Map(QUIZ_QUESTIONS.map((q) => [q.id, q]));
    return (
      <div className="rounded-2xl border border-border bg-bg-surface p-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-accent font-bold">
              Quiz Lazio · oggi
            </div>
            <h3
              className="mt-1 text-2xl text-text-primary"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Hai già giocato
            </h3>
          </div>
          <div
            className={`text-4xl font-black tabular-nums ${
              perfect ? "text-accent" : "text-text-primary"
            }`}
            style={{ fontFamily: "var(--font-display)" }}
          >
            {todayResult.score}/{QUIZ_DAILY_COUNT}
          </div>
        </div>

        {/* Riepilogo punti */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="rounded-lg bg-success/10 border border-success/30 px-3 py-2 text-center">
            <div className="text-xl font-black tabular-nums text-success leading-none">
              {todayResult.score}
            </div>
            <div className="mt-1 text-[9px] uppercase tracking-wider text-text-muted font-bold">
              Corrette
            </div>
          </div>
          <div className="rounded-lg bg-error/10 border border-error/30 px-3 py-2 text-center">
            <div className="text-xl font-black tabular-nums text-error leading-none">
              {wrongCount}
            </div>
            <div className="mt-1 text-[9px] uppercase tracking-wider text-text-muted font-bold">
              Sbagliate
            </div>
          </div>
          <div className="rounded-lg bg-accent/10 border border-accent/30 px-3 py-2 text-center">
            <div className="text-xl font-black tabular-nums text-accent leading-none">
              +{awarded}
            </div>
            <div className="mt-1 text-[9px] uppercase tracking-wider text-text-muted font-bold">
              Punti guadagnati
            </div>
          </div>
        </div>

        <div
          className={`p-3 rounded-md text-sm font-semibold ${
            perfect
              ? "bg-success/10 border border-success/30 text-success"
              : awarded > 0
              ? "bg-accent/10 border border-accent/30 text-accent"
              : "bg-bg-elevated border border-border text-text-secondary"
          }`}
        >
          {perfect
            ? `🎯 Cinque su cinque! Hai guadagnato +${awarded} punti nella classifica generale.`
            : awarded > 0
            ? `Hai guadagnato +${awarded} punti nella classifica generale in base al punteggio.`
            : "Nessun punto stavolta. Torna domani per altre 5 domande."}
        </div>

        {/* Breakdown delle domande */}
        {todayResult.answers?.length > 0 && (
          <div className="mt-5 space-y-2">
            <div className="text-[10px] uppercase tracking-[0.22em] text-text-muted font-bold mb-2">
              Le tue risposte
            </div>
            {todayResult.answers.map((a, i) => {
              const q = qMap.get(a.questionId) || todayQs[i];
              if (!q) return null;
              const right = !!a.correct;
              return (
                <div
                  key={a.questionId || i}
                  className={`p-3 rounded-lg border ${
                    right
                      ? "bg-success/10 border-success/30"
                      : "bg-error/10 border-error/30"
                  }`}
                >
                  <div className="text-xs font-bold text-text-primary mb-1.5">
                    {right ? "✓" : "✕"} {q.q}
                  </div>
                  {!right && (
                    <div className="text-[11px] text-text-secondary mb-1">
                      Tua risposta:{" "}
                      <span className="text-error font-semibold">
                        {q.options[a.userAnswer] ?? "—"}
                      </span>
                    </div>
                  )}
                  <div className="text-[11px] text-text-secondary">
                    Risposta corretta:{" "}
                    <span className="text-success font-semibold">
                      {q.options[q.answer]}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Intro: utente loggato, non ha ancora giocato
  if (step === 0) {
    return (
      <div className="rounded-2xl border border-accent/30 bg-gradient-to-br from-bg-surface via-bg-base to-bg-surface p-6 shadow-[0_0_40px_-12px_rgba(56,189,248,0.35)]">
        <div className="text-[10px] uppercase tracking-[0.3em] text-accent font-bold mb-2">
          Quiz Lazio del giorno
        </div>
        <h3
          className="text-3xl text-text-primary leading-none mb-3"
          style={{ fontFamily: "var(--font-display)" }}
        >
          5 DOMANDE. UNA SOLA OCCASIONE AL GIORNO.
        </h3>
        <p className="text-sm text-text-secondary mb-5 max-w-md">
          Ogni risposta corretta vale{" "}
          <span className="text-accent font-bold">
            +{QUIZ_POINTS_PER_CORRECT} punto
          </span>{" "}
          in classifica generale (fino a{" "}
          <span className="text-accent font-bold">
            +{QUIZ_DAILY_COUNT * QUIZ_POINTS_PER_CORRECT} punti al giorno
          </span>
          ). Domande sulla storia, scudetti, giocatori e curiosità biancocelesti.
        </p>
        <button
          onClick={() => setStep(1)}
          disabled={questions.length < QUIZ_DAILY_COUNT}
          className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-text-inverse rounded-md text-sm font-black uppercase tracking-wider hover:shadow-[0_0_28px_-4px_rgba(56,189,248,0.7)] transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {questions.length < QUIZ_DAILY_COUNT
            ? "Caricamento…"
            : "Inizia il quiz 🦅"}
        </button>
      </div>
    );
  }

  // Riepilogo finale dopo submit
  if (step > QUIZ_DAILY_COUNT) {
    const correctCount = answers.filter(
      (a, i) => Number(a.userAnswer) === questions[i].answer
    ).length;
    const wrongCount = QUIZ_DAILY_COUNT - correctCount;
    const awarded =
      todayResult?.awardedPoints ?? correctCount * QUIZ_POINTS_PER_CORRECT;
    const perfect = correctCount === QUIZ_DAILY_COUNT;
    return (
      <div className="rounded-2xl border border-border bg-bg-surface p-6">
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-[0.3em] text-accent font-bold mb-2">
            Risultato
          </div>
          <div
            className={`text-6xl font-black tabular-nums leading-none ${
              perfect ? "text-accent" : "text-text-primary"
            }`}
            style={{ fontFamily: "var(--font-display)" }}
          >
            {correctCount}/{QUIZ_DAILY_COUNT}
          </div>

          {/* Card riepilogo corrette / sbagliate / punti */}
          <div className="grid grid-cols-3 gap-2 mt-5">
            <div className="rounded-lg bg-success/10 border border-success/30 px-3 py-2.5 text-center">
              <div className="text-2xl font-black tabular-nums text-success leading-none">
                {correctCount}
              </div>
              <div className="mt-1 text-[9px] uppercase tracking-wider text-text-muted font-bold">
                Corrette
              </div>
            </div>
            <div className="rounded-lg bg-error/10 border border-error/30 px-3 py-2.5 text-center">
              <div className="text-2xl font-black tabular-nums text-error leading-none">
                {wrongCount}
              </div>
              <div className="mt-1 text-[9px] uppercase tracking-wider text-text-muted font-bold">
                Sbagliate
              </div>
            </div>
            <div className="rounded-lg bg-accent/10 border border-accent/30 px-3 py-2.5 text-center">
              <div className="text-2xl font-black tabular-nums text-accent leading-none">
                +{awarded}
              </div>
              <div className="mt-1 text-[9px] uppercase tracking-wider text-text-muted font-bold">
                Punti
              </div>
            </div>
          </div>

          <div
            className={`mt-4 p-3 rounded-md text-sm font-semibold ${
              perfect
                ? "bg-success/10 border border-success/30 text-success"
                : awarded > 0
                ? "bg-accent/10 border border-accent/30 text-accent"
                : "bg-bg-elevated border border-border text-text-secondary"
            }`}
          >
            {perfect
              ? `🎯 Perfetto! Hai guadagnato +${awarded} punti nella classifica.`
              : awarded > 0
              ? `Hai guadagnato +${awarded} punti nella classifica in base al punteggio.`
              : "Nessun punto stavolta. Torna domani per altre 5 domande."}
          </div>

          {awarded > 0 && (
            <Link
              to="/classifica"
              className="mt-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent hover:text-accent-hover transition"
            >
              Vai alla classifica generale →
            </Link>
          )}
        </div>

        <div className="mt-6 space-y-2">
          <div className="text-[10px] uppercase tracking-[0.22em] text-text-muted font-bold mb-2">
            Dettaglio risposte
          </div>
          {questions.map((q, i) => {
            const a = answers[i];
            const right = a && Number(a.userAnswer) === q.answer;
            return (
              <div
                key={q.id}
                className={`p-3 rounded-lg border ${
                  right
                    ? "bg-success/10 border-success/30"
                    : "bg-error/10 border-error/30"
                }`}
              >
                <div className="text-xs font-bold text-text-primary mb-1.5">
                  {right ? "✓" : "✕"} {q.q}
                </div>
                {!right && a && (
                  <div className="text-[11px] text-text-secondary mb-1">
                    Tua risposta:{" "}
                    <span className="text-error font-semibold">
                      {q.options[a.userAnswer] ?? "—"}
                    </span>
                  </div>
                )}
                <div className="text-[11px] text-text-secondary">
                  Risposta corretta:{" "}
                  <span className="text-success font-semibold">
                    {q.options[q.answer]}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Domanda corrente
  const idx = step - 1;
  const q = questions[idx];
  if (!q) return null;
  const currentAnswer = answers[idx]?.userAnswer;

  const pickAnswer = (i) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[idx] = { questionId: q.id, userAnswer: i };
      return next;
    });
  };

  const goNext = async () => {
    if (currentAnswer == null) return;
    playReact();
    if (step < QUIZ_DAILY_COUNT) {
      setStep(step + 1);
    } else {
      // SUBMIT
      setSubmitting(true);
      setError("");
      try {
        const result = await submitTodayQuiz(user.uid, answers);
        setTodayResult(result);
        if (result.awardedPoints > 0) playBell();
        setStep(QUIZ_DAILY_COUNT + 1);
      } catch (err) {
        setError(err.message || "Errore nel salvataggio");
      } finally {
        setSubmitting(false);
      }
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-bg-surface p-6">
      <div className="flex items-center justify-between mb-4 text-xs">
        <span className="text-[10px] uppercase tracking-[0.3em] text-accent font-bold">
          Domanda {step}/{QUIZ_DAILY_COUNT} · {q.cat}
        </span>
        <span className="text-text-muted tabular-nums">
          {answers.filter(Boolean).length}/{QUIZ_DAILY_COUNT}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-bg-elevated rounded-full overflow-hidden mb-5">
        <div
          className="h-full bg-accent transition-all duration-500"
          style={{ width: `${(step / QUIZ_DAILY_COUNT) * 100}%` }}
        />
      </div>

      <h3
        className="text-xl text-text-primary mb-5 leading-snug"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {q.q}
      </h3>

      <div className="space-y-2">
        {q.options.map((opt, i) => {
          const selected = currentAnswer === i;
          return (
            <button
              key={i}
              onClick={() => pickAnswer(i)}
              className={`w-full text-left px-4 py-3 rounded-lg border transition-all duration-200 ${
                selected
                  ? "bg-accent/15 border-accent/60 text-text-primary shadow-[0_0_18px_-4px_rgba(56,189,248,0.5)]"
                  : "bg-bg-elevated border-border text-text-secondary hover:border-accent/40 hover:text-text-primary"
              }`}
            >
              <span className="text-sm font-semibold">{opt}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="mt-4 p-3 rounded-md bg-error/10 border border-error/30 text-error text-xs">
          {error}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between">
        <span className="text-[11px] text-text-muted">
          {currentAnswer == null
            ? "Scegli una risposta per proseguire"
            : "Risposta salvata"}
        </span>
        <button
          onClick={goNext}
          disabled={currentAnswer == null || submitting}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-text-inverse text-sm font-bold uppercase tracking-wider rounded-md hover:shadow-[0_0_24px_-4px_rgba(56,189,248,0.6)] transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting && (
            <span className="w-4 h-4 border-2 border-text-inverse border-t-transparent rounded-full animate-spin" />
          )}
          {step === QUIZ_DAILY_COUNT
            ? submitting
              ? "Invio…"
              : "Finisci →"
            : "Avanti →"}
        </button>
      </div>
    </div>
  );
}
