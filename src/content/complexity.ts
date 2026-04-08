// Word complexity — underlines hard words in the reading mode content area and
// shows a simpler alternative on hover via a CSS tooltip.
// Word map sourced from plainlanguage.gov A–Z list + common medical/legal/academic jargon.

// ── Word map ──────────────────────────────────────────────────────────────────

const COMPLEX_WORDS: Readonly<Record<string, string>> = {
  // A
  abandon: 'leave',
  abbreviate: 'shorten',
  abide: 'follow',
  accelerate: 'speed up',
  accommodate: 'help',
  accomplish: 'do',
  accumulate: 'gather',
  acknowledge: 'admit',
  acquire: 'get',
  adhere: 'follow',
  adjacent: 'next to',
  administer: 'manage',
  adverse: 'harmful',
  alleviate: 'ease',
  allocate: 'assign',
  ameliorate: 'improve',
  ambiguous: 'unclear',
  ambivalent: 'unsure',
  ancillary: 'extra',
  anticipate: 'expect',
  apparent: 'clear',
  approximately: 'about',
  articulate: 'express',
  ascertain: 'find out',
  assist: 'help',
  attempt: 'try',
  attain: 'reach',
  authorize: 'allow',
  // B
  bandwidth: 'capacity',
  beneficial: 'helpful',
  // C
  cease: 'stop',
  clarify: 'explain',
  collaborate: 'work together',
  commence: 'start',
  compensate: 'pay',
  comprehend: 'understand',
  comprehensive: 'complete',
  compulsory: 'required',
  conceptualize: 'think up',
  concurrent: 'at the same time',
  concerning: 'about',
  consequently: 'so',
  consolidate: 'combine',
  constitute: 'make up',
  corroborate: 'confirm',
  // D
  demonstrate: 'show',
  delineate: 'outline',
  determine: 'decide',
  disclose: 'share',
  discontinue: 'stop',
  discretionary: 'optional',
  disseminate: 'share',
  // E
  eliminate: 'remove',
  emphasize: 'stress',
  encounter: 'meet',
  endeavor: 'try',
  ensure: 'make sure',
  enumerate: 'list',
  establish: 'set up',
  evaluate: 'review',
  exacerbate: 'worsen',
  expedite: 'speed up',
  explicit: 'clear',
  extrapolate: 'predict',
  // F
  facilitate: 'help',
  finalize: 'finish',
  // G
  germane: 'relevant',
  // H
  henceforth: 'from now on',
  heretofore: 'until now',
  holistic: 'whole',
  // I
  implement: 'carry out',
  inadvertent: 'unintentional',
  incentivize: 'encourage',
  indicate: 'show',
  inform: 'tell',
  initiate: 'start',
  inquire: 'ask',
  insufficient: 'not enough',
  interpolate: 'estimate',
  investigate: 'look into',
  // L
  leverage: 'use',
  // M
  maintain: 'keep',
  mandatory: 'required',
  methodology: 'method',
  mitigate: 'reduce',
  modify: 'change',
  monitor: 'watch',
  myriad: 'many',
  // N
  necessitate: 'require',
  notify: 'tell',
  numerous: 'many',
  notwithstanding: 'despite',
  // O
  obtain: 'get',
  occur: 'happen',
  optimize: 'improve',
  operationalize: 'put into practice',
  // P
  paradigm: 'model',
  participate: 'take part',
  perform: 'do',
  personnel: 'staff',
  pertinent: 'relevant',
  possess: 'have',
  precipitate: 'cause',
  preclude: 'prevent',
  preliminary: 'first',
  prioritize: 'rank',
  proceed: 'go',
  prohibit: 'ban',
  proliferate: 'spread',
  promulgate: 'publish',
  provide: 'give',
  purchase: 'buy',
  // R
  redundant: 'repeated',
  regarding: 'about',
  reiterate: 'repeat',
  require: 'need',
  reside: 'live',
  retain: 'keep',
  robust: 'strong',
  // S
  salient: 'important',
  scalable: 'able to grow',
  scrutinize: 'examine',
  sequential: 'in order',
  streamline: 'simplify',
  subsequent: 'later',
  substantiate: 'support',
  sufficient: 'enough',
  superfluous: 'unnecessary',
  synthesize: 'combine',
  // T
  terminate: 'end',
  transmit: 'send',
  // U
  ubiquitous: 'everywhere',
  unprecedented: 'never seen before',
  utilize: 'use',
  // V
  verify: 'check',
  viable: 'workable',
  // Medical
  hypertension: 'high blood pressure',
  benign: 'not harmful',
  malignant: 'harmful',
  chronic: 'long-lasting',
  prognosis: 'outlook',
  contraindicated: 'not recommended',
  prophylactic: 'preventive',
  intravenous: 'into a vein',
  subcutaneous: 'under the skin',
  pathology: 'disease study',
  etiology: 'cause',
  // Legal
  aforementioned: 'mentioned above',
  hereinafter: 'from now on',
  indemnify: 'protect',
  arbitration: 'dispute resolution',
  jurisdiction: 'authority',
  pursuant: 'following',
  // Academic
  empirical: 'evidence-based',
  elucidate: 'explain',
  hypothesis: 'theory',
  amalgamate: 'merge',
  cogent: 'convincing',
  concomitant: 'alongside',
}

// ── Module state ──────────────────────────────────────────────────────────────

let enabled = false
let attachedContainer: Element | null = null

// ── Helpers ───────────────────────────────────────────────────────────────────

function wrapTextNode(textNode: Text): void {
  /* v8 ignore next -- textContent is never null on a Text node */
  const text = textNode.textContent ?? ''
  /* v8 ignore next -- whitespace-only text nodes are skipped */
  if (!text.trim()) return

  const frag = document.createDocumentFragment()
  const wordRegex = /(\S+)/g
  let lastIdx = 0
  let m: RegExpExecArray | null

  while ((m = wordRegex.exec(text)) !== null) {
    const word = m[1]
    const lower = word.replace(/[^a-zA-Z]/g, '').toLowerCase()
    const simpler = COMPLEX_WORDS[lower]

    if (m.index > lastIdx) {
      frag.appendChild(document.createTextNode(text.slice(lastIdx, m.index)))
    }

    if (simpler) {
      const span = document.createElement('span')
      span.className = 'cp-complex'
      span.dataset.simpler = simpler
      span.textContent = word
      frag.appendChild(span)
    } else {
      frag.appendChild(document.createTextNode(word))
    }

    lastIdx = m.index + word.length
  }

  if (lastIdx < text.length) {
    frag.appendChild(document.createTextNode(text.slice(lastIdx)))
  }

  textNode.replaceWith(frag)
}

// ── Public API ────────────────────────────────────────────────────────────────

export function init(): void {
  console.debug('[ClearPath] Complexity: init')
  enabled = false
  attachedContainer = null
}

export function attach(contentEl: Element): void {
  detach()
  console.debug('[ClearPath] Complexity: attaching to content element')
  attachedContainer = contentEl

  const walker = document.createTreeWalker(contentEl, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  let node: Node | null
  while ((node = walker.nextNode())) {
    textNodes.push(node as Text)
  }

  let wrapped = 0
  for (const textNode of textNodes) {
    wrapTextNode(textNode)
    wrapped++
  }
  console.debug('[ClearPath] Complexity: wrapped', wrapped, 'text nodes')
}

export function detach(): void {
  if (attachedContainer) {
    console.debug('[ClearPath] Complexity: detaching')
    attachedContainer.querySelectorAll('.cp-complex').forEach((span) => {
      /* v8 ignore next -- textContent is never null on an Element */
      span.replaceWith(document.createTextNode(span.textContent ?? ''))
    })
    attachedContainer = null
  }
}

export function setEnabled(value: boolean): void {
  console.debug('[ClearPath] Complexity: setEnabled —', value)
  enabled = value
}

export function isEnabled(): boolean {
  return enabled
}
