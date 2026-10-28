#!/usr/bin/env node
/**
 * fetch-symbols.js
 *
 * Downloads the ARASAAC pictograms the Symbol Overlay uses into
 * public/symbols/<filename>.png, one per filename in src/content/symbolData.ts.
 *
 * The chosen ARASAAC pictogram id for each file is recorded in
 * public/symbols/index.json. Ids already listed there are reused, so a
 * re-run is reproducible; to swap a symbol that matched badly, edit its id
 * in index.json and run the script again.
 *
 * Usage:
 *   node scripts/fetch-symbols.js
 *
 * Symbols: ARASAAC (https://arasaac.org), by Sergio Palao, owned by the
 * Government of Aragón, licensed CC BY-NC-SA 4.0.
 *
 * No npm dependencies required — uses Node.js built-ins only (Node 18+).
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const DATA = path.join(ROOT, 'src/content/symbolData.ts')
const OUT = path.join(ROOT, 'public/symbols')
const INDEX = path.join(OUT, 'index.json')

const filenames = [...new Set([...fs.readFileSync(DATA, 'utf8').matchAll(/:\s*'([^']+)'/g)].map((m) => m[1]))].sort()
const index = fs.existsSync(INDEX) ? JSON.parse(fs.readFileSync(INDEX, 'utf8')) : {}

async function findId(word) {
  const res = await fetch(`https://api.arasaac.org/api/pictograms/en/bestsearch/${encodeURIComponent(word)}`)
  if (!res.ok) throw new Error(`search "${word}": HTTP ${res.status}`)
  const results = await res.json()
  if (!results.length) throw new Error(`search "${word}": no results`)
  return results[0]._id
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const failed = []
  for (const name of filenames) {
    try {
      const id = index[name] ?? (await findId(name.replace(/-/g, ' ')))
      const res = await fetch(`https://static.arasaac.org/pictograms/${id}/${id}_300.png`)
      if (!res.ok) throw new Error(`image ${id}: HTTP ${res.status}`)
      fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(await res.arrayBuffer()))
      index[name] = id
      console.log(`${name} -> ${id}`)
    } catch (err) {
      failed.push(name)
      console.error(`FAILED ${name}: ${err.message}`)
    }
  }
  fs.writeFileSync(INDEX, JSON.stringify(index, null, 2) + '\n')
  console.log(`\n${filenames.length - failed.length}/${filenames.length} symbols written to public/symbols/`)
  if (failed.length) process.exitCode = 1
}

main()
