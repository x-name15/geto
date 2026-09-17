import { spawnSync } from 'node:child_process';
import * as path from 'node:path';

const examples = [
  '01-buffer-copy.mjs',
  '02-json-file-persistence.mjs',
  '03-stream-capture-replay.mjs',
  '04-process-supervision.mjs',
  '05-lazy-http-reference.mjs',
  '06-custom-compression-adapter.mjs'
];

console.log('Running all geto examples...\n');

for (const file of examples) {
  const filePath = path.resolve('examples', file);
  console.log(`> node examples/${file}`);
  const result = spawnSync(process.execPath, [filePath], { stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`\n❌ Example failed: examples/${file} (exit code ${result.status})`);
    process.exit(result.status ?? 1);
  }
}

console.log('\nAll examples executed successfully!');
