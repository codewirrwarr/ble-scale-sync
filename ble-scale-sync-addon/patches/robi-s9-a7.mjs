// Fork-only build step: the add-on wraps the prebuilt application image, so the
// Healthkeep S11 (A7 result record) support from src/scales/robi-s9.ts is
// applied to the compiled file here until it ships in an upstream release.
// Fails the build if the compiled code no longer has the expected shape.
import { readFileSync, writeFileSync } from 'node:fs';

const file = process.argv[2] ?? '/app/dist/scales/robi-s9.js';
let js = readFileSync(file, 'utf8');

if (js.includes('0xa7')) {
  console.log(`[patch] ${file} already handles A7, nothing to do`);
  process.exit(0);
}

const fieldAnchor = 'class RobiS9Session {';
const finalAnchor = 'if (this.s.final && this.s.cachedWeight > 0) {';
if (js.split(fieldAnchor).length !== 2 || js.split(finalAnchor).length !== 2) {
  console.error(`[patch] anchors not found exactly once in ${file}`);
  process.exit(1);
}

// Same logic as the pull request: an A7 record is taken only when its weight
// equals the A2 live weight of the same session, so a record the scale offers
// from an earlier weigh-in (also after an add-on restart) is never exported.
js = js.replace(fieldAnchor, `${fieldAnchor}\n    liveGrams = 0;`);
js = js.replace(
  finalAnchor,
  `if (data[3] === 0xa2 && data.length >= 9) {
            this.s.liveGrams = data.readUIntBE(6, 3);
        }
        // Healthkeep S11: final result as the first packet of the A7 record.
        if (data[3] === 0xa7 && data.length >= 12) {
            const grams = data.readUIntBE(9, 3);
            if (grams === 0 || grams !== this.s.liveGrams) {
                bleLog.debug(\`Robi S9: A7 record (\${grams} g) does not match this weigh-in (\${this.s.liveGrams} g), ignoring it\`);
            }
            else {
                this.s.cachedWeight = grams / 1000;
                this.s.cachedImpedance = 0;
                this.s.final = true;
            }
        }
        ${finalAnchor}`,
);
writeFileSync(file, js);
console.log(`[patch] ${file}: Healthkeep S11 A7 support added`);
