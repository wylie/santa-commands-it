export function json(
  body: Record<string, unknown>,
  init: ResponseInit = {},
): Response {
  const headers = new Headers(init.headers);
  headers.set('Cache-Control', 'no-store');

  return Response.json(body, {
    ...init,
    headers,
  });
}

export function methodNotAllowed(allow: string): Response {
  return new Response(null, {
    status: 405,
    headers: {
      Allow: allow,
      'Cache-Control': 'no-store',
    },
  });
}
