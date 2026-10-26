// Fork-only build step: the add-on wraps the prebuilt application image, so the
// Healthkeep S11 (A7 result record) support from the pull request is applied to
// the compiled file here until it ships in an upstream release. Same logic as
// src/scales/robi-s9.ts on fix/healthkeep-s11-a7. Fails the build if the
// compiled code no longer has the expected shape.
import { readFileSync, writeFileSync } from 'node:fs';

const file = process.argv[2] ?? '/app/dist/scales/robi-s9.js';
let js = readFileSync(file, 'utf8');

if (js.includes('0xa7')) {
  console.log(`[patch] ${file} already handles A7, nothing to do`);
  process.exit(0);
}

const sessionAnchor = 'class RobiS9Session {';
const fieldAnchor = '\n    s = new RobiS9Session();';
const finalAnchor = 'if (this.s.final && this.s.cachedWeight > 0) {';
const completeAnchor = '\n    isComplete(reading) {';
for (const a of [sessionAnchor, fieldAnchor, finalAnchor, completeAnchor]) {
  if (js.split(a).length !== 2) {
    console.error(`[patch] anchor not found exactly once in ${file}: ${JSON.stringify(a)}`);
    process.exit(1);
  }
}

js = js.replace(sessionAnchor, `${sessionAnchor}\n    liveGrams = 0;`);
js = js.replace(fieldAnchor, `${fieldAnchor}\n    lastA7Stamp = 0;`);
js = js.replace(
  finalAnchor,
  `if (data[3] === 0xa2 && data[4] === 0x03 && data.length >= 9) {
            const grams = data.readUIntBE(6, 3);
            if (grams > 0)
                this.s.liveGrams = grams;
        }
        // Healthkeep S11: final result as the first packet of the A7 record.
        if (data[3] === 0xa7 && data.length >= 12) {
            const grams = data.readUIntBE(9, 3);
            const stamp = data.readUInt32BE(4);
            if (stamp !== 0 && stamp === this.lastA7Stamp) {
                bleLog.debug(\`Robi S9: A7 record \${stamp} was already exported, ignoring it\`);
            }
            else if (grams === 0 || grams !== this.s.liveGrams) {
                bleLog.debug(\`Robi S9: A7 record (\${grams} g) does not match this weigh-in (\${this.s.liveGrams} g), ignoring it\`);
            }
            else {
                this.lastA7Stamp = stamp;
                this.s.cachedWeight = grams / 1000;
                this.s.cachedImpedance = 0;
                this.s.final = true;
            }
        }
        ${finalAnchor}`,
);
js = js.replace(
  completeAnchor,
  `
    dedupMark() {
        return this.lastA7Stamp || undefined;
    }
    restoreDedupMark(mark) {
        if (!Number.isInteger(mark) || mark <= 0 || mark > 0xffffffff)
            return;
        this.lastA7Stamp = mark;
    }${completeAnchor}`,
);
writeFileSync(file, js);
console.log(`[patch] ${file}: Healthkeep S11 A7 support added`);
