import { createInterface } from 'node:readline';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { BlobBucket } from '../lib/blob-bucket.mjs';

console.log('Ready for the private storage credential on stdin.');
const input = createInterface({ input: process.stdin });
const token = await new Promise(resolve => input.once('line', resolve));
input.close();
const storage = new BlobBucket(token.trim());
async function retry(task) {
  for (let attempt = 0; ; attempt++) {
    try { return await task(); }
    catch (error) { if (attempt === 3) throw error; await new Promise(resolve => setTimeout(resolve, 1000)); }
  }
}
const bucket = { get: key => retry(() => storage.get(key)), put: (...args) => retry(() => storage.put(...args)) };
const origin = 'https://anton-sheludko.goodlycow1.chatgpt.site';
const response = await retry(() => fetch(origin + '/api/achievements'));
if (!response.ok) throw new Error('Could not read the published collection.');
const { achievements } = await response.json();
if (achievements.length !== 5) throw new Error('Unexpected collection count; inspect before migration.');
await mkdir('work/migration-backup', { recursive: true });
await writeFile('work/migration-backup/public-records.json', JSON.stringify(achievements, null, 2));
const manifest = [];
for (const original of achievements) {
  const record = { ...original };
  for (const field of ['file', 'preview']) {
    const attachment = original[field];
    if (!attachment) continue;
    const source = new URL(attachment.url, origin);
    if (source.origin !== origin) throw new Error('Unexpected attachment origin.');
    let bytes;
    try { bytes = await readFile(`work/migration-backup/${record.id}-${field}`); }
    catch {
      bytes = await retry(async () => {
        const res = await fetch(source);
        if (!res.ok) throw new Error('Could not download an attachment.');
        return Buffer.from(await res.arrayBuffer());
      });
    }
    if (bytes.length !== attachment.size) throw new Error('Attachment size mismatch.');
    const key = `achievements/files/${record.id}/${field}`;
    await writeFile(`work/migration-backup/${record.id}-${field}`, bytes);
    await bucket.put(key, bytes, { httpMetadata: { contentType: attachment.type } });
    const uploaded = await bucket.get(key);
    const actual = Buffer.from(await uploaded.arrayBuffer());
    const hash = createHash('sha256').update(bytes).digest('hex');
    if (createHash('sha256').update(actual).digest('hex') !== hash) throw new Error('Uploaded bytes differ.');
    record[field] = { key, name: attachment.name, type: attachment.type, size: attachment.size };
    manifest.push({ id: record.id, field, name: attachment.name, size: bytes.length, sha256: hash });
  }
  await bucket.put(`achievements/records/${record.id}.json`, JSON.stringify(record), { httpMetadata: { contentType: 'application/json' } });
  console.log('Migrated and verified:', record.title);
}
await writeFile('work/migration-backup/checksums.json', JSON.stringify(manifest, null, 2));
console.log('Completed:', achievements.length, 'records and', manifest.length, 'verified attachments.');
