import { santaSettings } from '@/config/santa-settings';

export class TimedRequestError extends Error {
  constructor(message = "Santa's workshop took too long to answer.") {
    super(message);
    this.name = 'TimedRequestError';
  }
}

export async function fetchJsonWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = window.__SANTA_TEST__?.requestTimeoutMs ??
    santaSettings.network.requestTimeoutMs,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort(new TimedRequestError());
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new TimedRequestError();
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}
