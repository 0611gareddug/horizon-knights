// 빌드 후 게임 코드 청크만 난독화한다. (엔진 청크는 그대로 둬서 성능 유지)
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import JavaScriptObfuscator from 'javascript-obfuscator';

const dir = 'dist/assets';
const files = readdirSync(dir).filter((f) => f.endsWith('.js') && !f.startsWith('engine'));

for (const f of files) {
  const path = join(dir, f);
  const src = readFileSync(path, 'utf8');
  const out = JavaScriptObfuscator.obfuscate(src, {
    compact: true,
    target: 'browser',
    identifierNamesGenerator: 'hexadecimal',
    renameGlobals: false,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.75,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    splitStrings: false,
    // 게임 루프 성능을 위해 제어 흐름 뒤섞기는 약하게
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.08,
    deadCodeInjection: false,
    selfDefending: true,
    debugProtection: true,
    disableConsoleOutput: true,
    numbersToExpressions: false,
    simplify: true,
    transformObjectKeys: false,
    unicodeEscapeSequence: false,
  }).getObfuscatedCode();
  writeFileSync(path, out);
  console.log(`[난독화] ${f}: ${(src.length / 1024).toFixed(0)}KB -> ${(out.length / 1024).toFixed(0)}KB`);
}
