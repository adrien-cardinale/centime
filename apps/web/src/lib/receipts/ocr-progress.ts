type ProgressPhase = { start: number; end: number }

const PHASES: Record<string, ProgressPhase> = {
  "loading tesseract core": { start: 0, end: 0.05 },
  "initializing tesseract": { start: 0.05, end: 0.1 },
  "loading language traineddata": { start: 0.1, end: 0.4 },
  "initializing api": { start: 0.4, end: 0.45 },
  "recognizing text": { start: 0.45, end: 1 },
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

export function ocrProgressRatio(status: string, progress: number): number | null {
  const phase = PHASES[status]
  if (!phase) return null
  return phase.start + (phase.end - phase.start) * clampRatio(progress)
}
