export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const file = url.searchParams.get('file');

    if (!file || !/^(manifest\.json|[a-z0-9_]+\.mp3)$/i.test(file)) {
      return new Response('Invalid file', { status: 400 });
    }

    const r2Key = 'lessons/lesson1/audio_v2/' + file;
    const object = await env.EKLIPSES_VIDEOS.get(r2Key);

    if (!object) {
      return new Response('Not found', { status: 404 });
    }

    const contentType = file.endsWith('.json') ? 'application/json' : 'audio/mpeg';

    return new Response(object.body, {
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=31536000',
        'Accept-Ranges': 'bytes',
      },
    });
  }
};
