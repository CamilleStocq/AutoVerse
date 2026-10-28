/**
 * Questionnaire F1 / WEC / WRC : 5 questions tirées des vraies données de l'application.
 * Un sans-faute rapporte un booster bonus (dans la limite fixée par collection.ts).
 */
import { useEffect, useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import type { WecSeason, WrcSeason } from '@shared/sport';
import { useF1, useSeries } from '../hooks/queries';
import { buildQuiz, QUIZ_LENGTH, QUIZ_PASS, type QuizDiscipline } from '../lib/quiz';
import { formatDate } from '../lib/format';

const NAMES: Record<QuizDiscipline, string> = { f1: 'Formule 1', wec: 'Endurance (WEC)', wrc: 'Rallye (WRC)' };

interface Props {
  discipline: QuizDiscipline;
  /** Appelé en cas de sans-faute ; renvoie false si le bonus n'est plus disponible. */
  onPerfect: () => boolean;
  onClose: () => void;
}

export function Quiz({ discipline, onPerfect, onClose }: Props) {
  const f1 = useF1();
  const wec = useSeries('wec');
  const wrc = useSeries('wrc');
  const loading = discipline === 'f1' ? f1.isLoading : discipline === 'wec' ? wec.isLoading : wrc.isLoading;
  const asOf = discipline === 'f1' ? f1.data?.fetchedAt : discipline === 'wec' ? wec.data?.fetchedAt : wrc.data?.fetchedAt;

  // Les questions sont figées une fois les données chargées.
  const questions = useMemo(() => (loading ? null : buildQuiz(discipline, {
    f1: f1.data?.data,
    wec: wec.data?.data as WecSeason | undefined,
    wrc: wrc.data?.data as WrcSeason | undefined,
  })), [loading, discipline]);

  const [step, setStep] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [result, setResult] = useState<'won' | 'missed' | 'capped' | null>(null);

  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; };
  }, []);

  const q = questions?.[step];
  const answer = (option: string) => {
    if (chosen || !q) return;
    setChosen(option);
    if (option === q.answer) setScore((s) => s + 1);
  };
  const next = () => {
    if (!questions) return;
    if (step < questions.length - 1) {
      setStep(step + 1);
      setChosen(null);
      return;
    }
    const final = score;
    if (final >= QUIZ_PASS) setResult(onPerfect() ? 'won' : 'capped');
    else setResult('missed');
  };

  return (
    <div className="quiz" role="dialog" aria-modal="true" aria-label={`Questionnaire ${NAMES[discipline]}`}>
      <div className="quiz-card">
        <header className="row between gap-3">
          <span className="eyebrow">Questionnaire · {NAMES[discipline]}</span>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fermer le questionnaire"><X size={18} /></button>
        </header>

        {loading && <div className="skeleton" style={{ height: 220 }} />}
        {!loading && !questions && (
          <p className="muted">Pas assez de données publiées pour générer un questionnaire {NAMES[discipline]} pour l’instant. Essayez une autre discipline.</p>
        )}

        {q && !result && (
          <>
            <div className="quiz-progress" aria-hidden="true">
              {questions!.map((_, i) => <i key={i} className={i < step ? 'done' : i === step ? 'current' : undefined} />)}
            </div>
            <p className="subtle num" style={{ fontSize: 'var(--text-xs)' }}>Question {step + 1} / {QUIZ_LENGTH}</p>
            <h3 className="quiz-question">{q.prompt}</h3>
            <div className="quiz-options" role="group" aria-label="Réponses">
              {q.options.map((o) => {
                const state = !chosen ? '' : o === q.answer ? 'right' : o === chosen ? 'wrong' : 'dim';
                return (
                  <button key={o} type="button" className={`quiz-option ${state}`} onClick={() => answer(o)} disabled={!!chosen}>
                    <span>{o}</span>
                    {state === 'right' && <Check size={18} aria-label="Bonne réponse" />}
                    {state === 'wrong' && <X size={18} aria-label="Mauvaise réponse" />}
                  </button>
                );
              })}
            </div>
            {chosen && (
              <button type="button" className="btn btn-primary" onClick={next} autoFocus>
                {step < QUIZ_LENGTH - 1 ? 'Question suivante' : 'Voir mon résultat'}
              </button>
            )}
            {asOf && <p className="provenance">Questions tirées des données de l’application au {formatDate(asOf)}.</p>}
          </>
        )}

        {result && (
          <div className="quiz-result">
            <strong className="quiz-score num">{score} / {QUIZ_LENGTH}</strong>
            {result === 'won' && <p><b>Sans-faute ! Un booster bonus vous attend.</b></p>}
            {result === 'capped' && <p>Sans-faute, mais vous avez déjà gagné vos 2 boosters bonus de cette période de 2 heures.</p>}
            {result === 'missed' && <p>Il faut un sans-faute ({QUIZ_LENGTH}/{QUIZ_LENGTH}) pour gagner un booster bonus. Retentez votre chance plus tard.</p>}
            <button type="button" className="btn btn-primary" onClick={onClose} autoFocus>Continuer</button>
          </div>
        )}
      </div>
    </div>
  );
}
