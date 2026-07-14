// Run with: node src/lib/metrics.test.mjs
// (plain assert test, no framework; kept as .mjs so it's excluded from the TS build)

function countBy(values) {
  return values.reduce((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1
    return acc
  }, {})
}

const result = countBy(["a", "b", "a", "c", "b", "a"])
const expected = { a: 3, b: 2, c: 1 }

for (const key of Object.keys(expected)) {
  if (result[key] !== expected[key]) {
    throw new Error(`countBy mismatch for "${key}": expected ${expected[key]}, got ${result[key]}`)
  }
}

console.log("metrics.test.mjs passed")
