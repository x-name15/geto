/**
 * Example 02: Object Persistence to Disk (SERIALIZE Semantic)
 * 
 * Demonstrates persisting structured JavaScript objects to the local filesystem
 * using FileStorage and JsonAdapter.
 * 
 * Run: node examples/02-json-file-persistence.mjs
 */

import { GetoGateway, FileStorage, JsonAdapter } from '../dist/index.js';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

const STORAGE_DIR = path.resolve(process.cwd(), '.tmp-example-storage');

async function main() {
  console.log('=== Example 02: JSON File Persistence (SERIALIZE Semantic) ===\n');

  // Ensure clean directory
  await fs.rm(STORAGE_DIR, { recursive: true, force: true });

  const storage = new FileStorage(STORAGE_DIR);
  const gateway = new GetoGateway({ storage });
  const adapter = new JsonAdapter();

  // 1. Define a complex application domain object
  const userProfile = {
    userId: 'usr_89201',
    role: 'admin',
    settings: {
      theme: 'dark',
      notifications: { email: true, push: false },
      trustedIps: ['192.168.1.1', '10.0.0.5']
    },
    lastLoginAt: new Date().toISOString()
  };

  console.log('1. Consuming domain object into FileStorage...');
  const entity = await gateway.consume(userProfile, adapter, {
    metadata: { domain: 'auth', owner: userProfile.userId }
  });
  console.log('   Entity ID:', entity.id);
  console.log('   Storage Directory:', STORAGE_DIR);

  // 2. Verify disk representation is physically saved as JSON
  console.log('\n2. Verifying disk persistence...');
  const filesOnDisk = await fs.readdir(STORAGE_DIR);
  console.log('   Files created on disk:', filesOnDisk);

  // 3. Restore object through gateway
  const restoredProfile = await gateway.restore(entity, adapter);
  console.log('\n3. Object successfully rehydrated:');
  console.log('   User ID:', restoredProfile.userId);
  console.log('   Role:   ', restoredProfile.role);
  console.log('   Theme:  ', restoredProfile.settings.theme);
  console.log('   Deep equality check:', JSON.stringify(restoredProfile) === JSON.stringify(userProfile) ? 'PASSED' : 'FAILED');

  // 4. Cleanup
  await gateway.delete(entity.id);
  await fs.rm(STORAGE_DIR, { recursive: true, force: true });
  console.log('\n4. Entity deleted and temporary files cleaned up.');
}

main().catch((err) => {
  console.error('Example failed:', err);
  process.exit(1);
});
