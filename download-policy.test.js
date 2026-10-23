import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveWithFallback, publicDownloadError } from './download-policy.js';

test('empty response retains diagnostic and triggers second attempt', async () => {
  const calls = [];
  const result = await resolveWithFallback('https://www.instagram.com/reel/test/', async (...args) => {
    calls.push(args);
    if (calls.length === 1) throw new Error('Instagram sent an empty media response. Check browser without being logged-in. Use cookies-from-browser');
    return 'https://example.com/video.mp4';
  });
  assert.equal(result, 'https://example.com/video.mp4');
  assert.deepEqual(calls[1][1], ['--extractor-args', 'instagram:app_id=ios']);
});

test('network and explicit access restrictions do not trigger API retries', async () => {
  for (const message of ['SSL_ERROR_SYSCALL', 'login required']) {
    let calls = 0;
    await assert.rejects(resolveWithFallback('https://www.instagram.com/reel/test/', async () => { calls++; throw new Error(message); }));
    assert.equal(calls, 1);
  }
});

test('empty response does not claim authentication is mandatory', () => {
  assert.doesNotMatch(publicDownloadError(new Error('empty media response; cookies-from-browser')), /exige|COOKIES_B64/);
});
