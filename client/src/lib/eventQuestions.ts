import type { QuestionType, RosterEvent, RosterQuestion } from "@/lib/types"
import { activeRows } from "@/lib/eventDrafts"

export const MAX_QUESTIONS = 10
export const MAX_OPTIONS = 20

export const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "ShortText", label: "Short text" },
  { value: "Phone", label: "Phone" },
  { value: "Dropdown", label: "Dropdown" },
]

export interface QuestionDraft {
  key: number
  id?: string
  label: string
  type: QuestionType
  required: boolean
  optionsText: string
}

export interface QuestionRow extends QuestionDraft {
  hasAnswers: boolean
  deleted: boolean
}

export function createEmptyQuestion(key: number): QuestionDraft {
  return {
    key,
    label: "",
    type: "ShortText",
    required: false,
    optionsText: "",
  }
}

export function parseOptions(optionsText: string): string[] {
  return optionsText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

export function validateQuestionBasics(question: QuestionDraft): string | null {
  if (!question.label.trim()) return "Label is required."
  if (question.type === "Dropdown") {
    const options = parseOptions(question.optionsText)
    if (options.length === 0) return "Add at least one option (one per line)."
    if (options.length > MAX_OPTIONS)
      return `At most ${MAX_OPTIONS} options are allowed.`
    if (options.some((o) => o.length > 100))
      return "Each option can be at most 100 characters."
  }
  return null
}

export function validateQuestionDrafts(
  questions: QuestionDraft[]
): Record<number, string> {
  const errors: Record<number, string> = {}
  for (const question of questions) {
    const err = validateQuestionBasics(question)
    if (err) errors[question.key] = err
  }
  return errors
}

/** Validate active (non-deleted) question rows in the Edit form. */
export function validateQuestionRows(
  questions: QuestionRow[]
): Record<number, string> {
  return validateQuestionDrafts(activeRows(questions))
}

export function questionIdsWithAnswers(event: RosterEvent): Set<string> {
  const ids = new Set<string>()
  for (const slot of event.slots) {
    for (const signup of slot.signups) {
      for (const answer of signup.answers ?? []) {
        ids.add(answer.questionId)
      }
    }
  }
  return ids
}

export function toQuestionDrafts(
  event: RosterEvent,
  keyOffset = 0
): QuestionRow[] {
  const answered = questionIdsWithAnswers(event)
  return event.questions
    .filter((q: RosterQuestion) => !q.isDeleted)
    .map((q: RosterQuestion, i) => ({
      key: keyOffset + i,
      id: q.id,
      label: q.label,
      type: q.type as QuestionType,
      required: q.required,
      optionsText: (q.options ?? []).join("\n"),
      hasAnswers: answered.has(q.id),
      deleted: false,
    }))
}

export function buildQuestionPayload(questions: QuestionDraft[]) {
  return questions.map((q) => ({
    id: q.id ?? null,
    label: q.label.trim(),
    type: q.type,
    required: q.required,
    options: q.type === "Dropdown" ? parseOptions(q.optionsText) : null,
  }))
}

/** Loose phone validation shared with the backend: digits, spaces, dashes,
 * parentheses, optional leading +; 7-15 digits total. */
export function isValidPhone(value: string): boolean {
  if (!/^\+?[\d\s\-().]{7,20}$/.test(value)) return false
  const digits = (value.match(/\d/g) ?? []).length
  return digits >= 7 && digits <= 15
}
