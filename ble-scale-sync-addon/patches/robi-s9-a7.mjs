// Fork-only build step: the add-on wraps the prebuilt application image, so the
// Healthkeep S11 (A7 result record) support from src/scales/robi-s9.ts is
// applied to the compiled file here until it ships in an upstream release.
// Fails the build if the compiled code no longer has the expected shape.
import { readFileSync, writeFileSync } from 'node:fs';

const file = process.argv[2] ?? '/app/dist/scales/robi-s9.js';
let js = readFileSync(file, 'utf8');

if (js.includes('0xa7') || js.includes('lastA7Stamp')) {
  console.log(`[patch] ${file} already handles A7, nothing to do`);
  process.exit(0);
}

const fieldAnchor = '\n    s = new RobiS9Session();';
const finalAnchor = 'if (this.s.final && this.s.cachedWeight > 0) {';
if (js.split(fieldAnchor).length !== 2 || js.split(finalAnchor).length !== 2) {
  console.error(`[patch] anchors not found exactly once in ${file}`);
  process.exit(1);
}

js = js.replace(fieldAnchor, `${fieldAnchor}\n    lastA7Stamp = null;`);
js = js.replace(
  finalAnchor,
  `// Healthkeep S11: final result as the first packet of the A7 record.
        if (data[3] === 0xa7 && data.length >= 12) {
            const w = data.readUIntBE(9, 3) / 1000;
            const stamp = data.readUInt32BE(4);
            if (stamp === this.lastA7Stamp) {
                bleLog.debug('Robi S9: A7 record already exported, ignoring the resend');
                return null;
            }
            if (w > 0 && Number.isFinite(w)) {
                this.lastA7Stamp = stamp;
                this.s.cachedWeight = w;
                this.s.cachedImpedance = 0;
                this.s.final = true;
            }
        }
        ${finalAnchor}`,
);
writeFileSync(file, js);
console.log(`[patch] ${file}: Healthkeep S11 A7 support added`);
