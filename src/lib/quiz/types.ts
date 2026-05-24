export type QuizQuestionType = 'multiple_choice' | 'true_false' | 'yes_no' | 'match';

export type QuizFocus = 'ci' | 'all';

export interface QuizQuestionBase {
  id: string;
  type: QuizQuestionType;
  prompt: string;
  explanation: string;
  source: string;
}

export interface MultipleChoiceQuestion extends QuizQuestionBase {
  type: 'multiple_choice';
  options: { id: string; label: string }[];
  correctOptionId: string;
}

export interface TrueFalseQuestion extends QuizQuestionBase {
  type: 'true_false';
  correct: boolean;
}

export interface YesNoQuestion extends QuizQuestionBase {
  type: 'yes_no';
  correct: boolean;
}

export interface MatchQuestion extends QuizQuestionBase {
  type: 'match';
  /** Correct left → right pairings */
  pairs: { left: string; right: string }[];
  /** All options for the right column (includes distractors when used) */
  rightOptions: string[];
}

export type QuizQuestion =
  | MultipleChoiceQuestion
  | TrueFalseQuestion
  | YesNoQuestion
  | MatchQuestion;

export interface QuizOptions {
  count: number;
  focus: QuizFocus;
  seed?: number;
}

export interface QuizResult {
  questions: QuizQuestion[];
  seed: number;
}
