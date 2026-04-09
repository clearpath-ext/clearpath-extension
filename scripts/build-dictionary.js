#!/usr/bin/env node
/**
 * build-dictionary.js
 *
 * Parses a Simple English Wiktionary XML dump and extracts plain-English
 * word definitions, outputting a compact JSON file for bundling with the
 * ClearPath extension.
 *
 * Usage:
 *   1. Download the dump:
 *      curl -L -o /tmp/simplewiktionary.xml.bz2 \
 *        https://dumps.wikimedia.org/simplewiktionary/latest/simplewiktionary-latest-pages-articles.xml.bz2
 *   2. Decompress:
 *      bzip2 -d /tmp/simplewiktionary.xml.bz2
 *   3. Run:
 *      node scripts/build-dictionary.js /tmp/simplewiktionary.xml [public/dictionary.json]
 *
 * Output format: { "word": "plain-English definition", ... }
 *
 * No npm dependencies required — uses Node.js built-ins only.
 */

'use strict'

const fs = require('node:fs')
const readline = require('node:readline')
const path = require('node:path')

const inputFile = process.argv[2]
const outputFile = process.argv[3] ?? path.join(__dirname, '..', 'public', 'dictionary.json')

if (!inputFile) {
  console.error('Usage: node scripts/build-dictionary.js <dump.xml> [output.json]')
  process.exit(1)
}

if (!fs.existsSync(inputFile)) {
  console.error(`File not found: ${inputFile}`)
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Wiki markup stripper
// ---------------------------------------------------------------------------

function stripMarkup(raw) {
  return raw
    // {{lc|Word}} / {{label|en|...}} / {{context|foo}} → keep first arg if useful, else drop
    .replace(/\{\{(?:lc|label|context|sense|lb)\|(?:[^|{}]+\|)*([^|{}]+)\}\}/gi, '$1')
    // {{ti verb}} / {{transitive}} / {{intransitive}} / {{BNC...}} / other templates → remove
    .replace(/\{\{[^{}]*\}\}/g, '')
    // [[link|display text]] → display text
    .replace(/\[\[(?:[^\]|]+\|)([^\]]+)\]\]/g, '$1')
    // [[link]] → link text
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    // '''bold''' / ''italic''
    .replace(/'{2,3}([^']*?)'{2,3}/g, '$1')
    // <ref>...</ref>
    .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, '')
    // remaining XML/HTML tags
    .replace(/<[^>]+>/g, '')
    // XML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    // collapse whitespace
    .replace(/\s+/g, ' ')
    .trim()
}

// Parts of speech we care about — used to find the right section
const POS_HEADERS = new Set([
  'noun', 'verb', 'adjective', 'adverb', 'pronoun',
  'preposition', 'conjunction', 'interjection', 'article', 'determiner',
])

function extractDefinition(text) {
  const lines = text.split('\n')

  // Strategy: find the first definition line (# ...) that isn't a
  // cross-reference form. Prefer lines inside a recognised PoS section.
  // Simple English Wiktionary often omits ==English== headers entirely.

  let inPoS = false

  for (const line of lines) {
    // Track PoS sections like == Verb == or === Noun ===
    const sectionMatch = line.match(/^==+\s*([^=]+?)\s*==+$/)
    if (sectionMatch) {
      const header = sectionMatch[1].toLowerCase()
      inPoS = POS_HEADERS.has(header)
      continue
    }

    // Only accept top-level definition lines (# ...), not sub-definitions (## ...)
    // and not examples (#: ...)
    if (/^# /.test(line)) {
      const raw = line.slice(2)

      // Skip pure inflection redirects like "{{form of|en|eat}}"
      if (/^\{\{[^}]*(form of|inflection of|plural of|past tense of|comparative of)[^}]*\}\}$/i.test(raw.trim())) continue
      // Skip lines that are just a template with nothing else
      if (/^\{\{[^}]*\}\}$/.test(raw.trim())) continue

      const def = stripMarkup(raw)
      if (def.length < 8) continue

      // Capitalise first letter, ensure ends with period
      const cleaned = def.charAt(0).toUpperCase() + def.slice(1)
      return cleaned.endsWith('.') || cleaned.endsWith('?') || cleaned.endsWith('!')
        ? cleaned
        : cleaned + '.'
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// State machine — streams XML line by line
// ---------------------------------------------------------------------------

const dictionary = {}
let pagesProcessed = 0
let definitionsFound = 0
let skipped = 0

let currentTitle = null
let currentNs = null
let insidePage = false
let insideText = false
let textLines = []

function processPage(title, ns, text) {
  pagesProcessed++

  // Only process main namespace (ns=0)
  if (ns !== '0') { skipped++; return }

  const word = title.trim()
  if (!word) { skipped++; return }

  // Skip pages with colons (Category:, Template:, etc. — shouldn't reach here after ns check)
  if (word.includes(':')) { skipped++; return }

  // Skip entries whose titles contain emoji or non-printable characters
  if (/\p{Emoji_Presentation}/u.test(word)) { skipped++; return }

  const wordLower = word.toLowerCase()
  if (dictionary[wordLower]) return // first-seen wins

  const def = extractDefinition(text)
  if (def) {
    dictionary[wordLower] = def
    definitionsFound++
  } else {
    skipped++
  }
}

// ---------------------------------------------------------------------------
// Stream the XML file
// ---------------------------------------------------------------------------

console.log(`Reading: ${inputFile}`)

const rl = readline.createInterface({
  input: fs.createReadStream(inputFile, { encoding: 'utf8' }),
  crlfDelay: Infinity,
})

rl.on('line', (line) => {
  const trimmed = line.trim()

  if (trimmed === '<page>') {
    insidePage = true
    currentTitle = null
    currentNs = null
    textLines = []
    insideText = false
    return
  }

  if (trimmed === '</page>') {
    if (currentTitle && textLines.length > 0) {
      processPage(currentTitle, currentNs, textLines.join('\n'))
    }
    insidePage = false
    insideText = false
    currentTitle = null
    currentNs = null
    textLines = []
    return
  }

  if (!insidePage) return

  // <title>
  const titleMatch = trimmed.match(/^<title>(.+?)<\/title>$/)
  if (titleMatch) { currentTitle = titleMatch[1]; return }

  // <ns>
  const nsMatch = trimmed.match(/^<ns>(\d+)<\/ns>$/)
  if (nsMatch) { currentNs = nsMatch[1]; return }

  // <text ...> — content may start on the same line as the opening tag
  if (!insideText && (trimmed.startsWith('<text ') || trimmed === '<text>')) {
    insideText = true
    const afterOpen = trimmed.replace(/^<text[^>]*>/, '')
    if (afterOpen.endsWith('</text>')) {
      textLines.push(afterOpen.slice(0, -7))
      insideText = false
    } else {
      if (afterOpen) textLines.push(afterOpen)
    }
    return
  }

  if (trimmed === '</text>') { insideText = false; return }

  if (insideText) {
    if (trimmed.endsWith('</text>')) {
      textLines.push(trimmed.slice(0, -7))
      insideText = false
    } else {
      textLines.push(line) // preserve original indentation for wiki markup
    }
  }
})

rl.on('close', () => {
  console.log(`\nResults:`)
  console.log(`  Pages processed  : ${pagesProcessed.toLocaleString()}`)
  console.log(`  Definitions found: ${definitionsFound.toLocaleString()}`)
  console.log(`  Skipped          : ${skipped.toLocaleString()}`)

  const sorted = Object.fromEntries(
    Object.entries(dictionary).sort(([a], [b]) => a.localeCompare(b))
  )

  const json = JSON.stringify(sorted)
  const bytes = Buffer.byteLength(json, 'utf8')

  fs.mkdirSync(path.dirname(outputFile), { recursive: true })
  fs.writeFileSync(outputFile, json, 'utf8')

  console.log(`\nOutput: ${outputFile}`)
  console.log(`  Entries : ${Object.keys(sorted).length.toLocaleString()}`)
  console.log(`  Size    : ${(bytes / 1024).toFixed(1)} KB uncompressed`)
  console.log(`  Avg def : ${(bytes / Object.keys(sorted).length).toFixed(0)} bytes/word`)

  const sample = Object.entries(sorted).slice(0, 10)
  console.log(`\nSample entries:`)
  for (const [word, def] of sample) {
    console.log(`  ${word}: ${def.slice(0, 90)}${def.length > 90 ? '…' : ''}`)
  }

  // Also spot-check a few known words
  console.log(`\nSpot checks:`)
  for (const w of ['eat', 'happy', 'run', 'beautiful', 'the', 'go', 'house', 'computer']) {
    console.log(`  ${w}: ${sorted[w] ?? '(not found)'}`)
  }
})

rl.on('error', (err) => {
  console.error('Error reading file:', err.message)
  process.exit(1)
})
