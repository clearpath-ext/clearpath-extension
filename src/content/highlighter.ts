// Word-level highlighting during TTS playback.
// Phase 1: stub — word-by-word highlighting is implemented in Phase 3
// alongside Reading Mode. The boundary events from tts.ts feed into this
// module once the Reading Mode DOM is available.

export function init(): void {
  // no-op in Phase 1
}

// Called on each word boundary event from tts.ts
// charIndex: character offset in the spoken string
// text: the full spoken string
export function onWordBoundary(_charIndex: number, _text: string): void {
  // no-op in Phase 1
}

export function clear(): void {
  // no-op in Phase 1
}
