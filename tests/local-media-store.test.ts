import assert from 'node:assert/strict';
import test from 'node:test';

import {
  WEB_SESSION_MEDIA_LIMITATION,
  containsEmbeddedImageBytes,
  createWebSessionLocalMediaStore,
  isBrowserSessionMediaRuntime,
  isBrowserSessionMediaUri,
  localMediaSourceFromPickerAsset,
  nativeFilesystemCopyUri,
} from '../src/core/local-media-store';

test('web-style picker File is accepted and yields a same-session object URL', async () => {
  const file = new Blob([Uint8Array.from([0xff, 0xd8, 0xff])], {
    type: 'image/jpeg',
  });
  const source = localMediaSourceFromPickerAsset({
    uri: 'blob:https://localhost/picker',
    file,
  });
  assert.ok(source);
  assert.equal(source?.file, file);

  const store = createWebSessionLocalMediaStore();
  const uri = await store.copyFileIntoDirectory('listing.1', 'photo.1', source!);
  assert.equal(isBrowserSessionMediaUri(uri), true);
  assert.equal(containsEmbeddedImageBytes(uri), false);
});

test('native filesystem copy rejects browser File and blob URIs', () => {
  const file = new Blob(['img'], { type: 'image/jpeg' });
  assert.throws(
    () => nativeFilesystemCopyUri({ uri: 'blob:https://localhost/1', file }),
    /browser File\/blob/,
  );
  assert.throws(
    () => nativeFilesystemCopyUri({ uri: 'blob:https://localhost/1' }),
    /blob or data URI/,
  );
  assert.throws(
    () => nativeFilesystemCopyUri({ uri: 'data:image/jpeg;base64,aaaa' }),
    /blob or data URI/,
  );
  assert.equal(
    nativeFilesystemCopyUri('file:///var/mobile/Containers/photo.jpg'),
    'file:///var/mobile/Containers/photo.jpg',
  );
  assert.equal(
    nativeFilesystemCopyUri({ uri: 'file:///tmp/native.jpg' }),
    'file:///tmp/native.jpg',
  );
});

test('web session store does not persist data URIs or claim restart durability', async () => {
  const store = createWebSessionLocalMediaStore();
  await assert.rejects(
    () =>
      store.copyFileIntoDirectory('listing.1', 'photo.1', {
        uri: 'data:image/jpeg;base64,aaaa',
      }),
    /data: URIs/,
  );
  assert.match(WEB_SESSION_MEDIA_LIMITATION, /not restart-durable/);
  assert.equal(isBrowserSessionMediaRuntime(), false);
});

test('web blob URI without File is reused for same-session rendering', async () => {
  const store = createWebSessionLocalMediaStore();
  const uri = await store.copyFileIntoDirectory('listing.1', 'photo.1', {
    uri: 'blob:https://localhost/existing',
  });
  assert.equal(uri, 'blob:https://localhost/existing');
});

test('picker helper rejects embedded base64 data URLs', () => {
  assert.equal(
    localMediaSourceFromPickerAsset({
      uri: 'data:image/jpeg;base64,abcd',
    }),
    null,
  );
  assert.deepEqual(
    localMediaSourceFromPickerAsset({
      uri: 'file:///tmp/native.jpg',
    }),
    { uri: 'file:///tmp/native.jpg' },
  );
});
