export default {
  async fetch(request, env) {
    const url  = new URL(request.url);
    const file = url.searchParams.get('file');

    // Accept:
    //   manifest.json / ryan_seg00.mp3          → lesson 1 (backwards compat)
    //   lesson2/manifest.json / lesson2/ryan_seg00.mp3 → lesson 2
    if (!file || !/^(lesson\d+\/)?(manifest\.json|[a-z0-9_]+\.mp3)$/i.test(file)) {
      return new Response('Invalid file', { status: 400 });
    }

    let r2Key;
    if (file.startsWith('lesson3/')) {
      r2Key = 'lessons/lesson3/audio/' + file.slice('lesson3/'.length);
    } else if (file.startsWith('lesson2/')) {
      r2Key = 'lessons/lesson2/audio/' + file.slice('lesson2/'.length);
    } else {
      r2Key = 'lessons/lesson1/audio_v2/' + file;
    }

    const object = await env.EKLIPSES_VIDEOS.get(r2Key);

    if (!object) {
      return new Response('Not found', { status: 404 });
    }

    const contentType = file.endsWith('.json') ? 'application/json' : 'audio/mpeg';

    return new Response(object.body, {
      headers: {
        'Content-Type':                contentType,
        'Content-Length':              String(object.size),
        'Access-Control-Allow-Origin': '*',
        'Cache-Control':               'public, max-age=31536000',
        'Accept-Ranges':               'bytes',
      },
    });
  }
};
