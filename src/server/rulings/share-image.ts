import fs from 'node:fs/promises';
import path from 'node:path';

import { ImageResponse } from '@vercel/og';
import { createElement, type CSSProperties, type ReactElement } from 'react';

import {
  RULING_SHARE_IMAGE_HEIGHT,
  RULING_SHARE_IMAGE_PRIVATE_CACHE_CONTROL,
  RULING_SHARE_IMAGE_PUBLIC_CACHE_CONTROL,
  RULING_SHARE_IMAGE_TYPE,
  SANTA_ARTWORK_IMAGE_TYPE,
  RULING_SHARE_IMAGE_WIDTH,
  SNOW_PATTERN_IMAGE_TYPE,
  SANTA_ARTWORK_BROWSER_PATH,
} from '@/config/share-images';
import type { PublicRuling } from '@/utils/rulings';
import type { SeasonalPresentationMode } from '@/utils/seasonal';

const SANTA_ARTWORK_FILE_PATH = path.join(
  process.cwd(),
  'public',
  'images',
  'santa-solo.png',
);
const SNOW_PATTERN_FILE_PATH = path.join(
  process.cwd(),
  'public',
  'images',
  'snow-black.png',
);
const SUCCESS_HEADERS = {
  'content-type': RULING_SHARE_IMAGE_TYPE,
  'x-content-type-options': 'nosniff',
} as const;

const ERROR_HEADERS = {
  'content-type': 'text/plain; charset=utf-8',
  'x-content-type-options': 'nosniff',
} as const;

let santaArtworkDataUrlPromise: Promise<string> | null = null;
let snowPatternDataUrlPromise: Promise<string> | null = null;

export type ShareImageVariant = 'short' | 'medium' | 'long';
export type ShareImageVisibility = 'public' | 'hidden';

export type PreparedShareImageText = {
  text: string;
  lines: string[];
  variant: ShareImageVariant;
};

export type ShareImageTreatment = {
  tone: 'approved' | 'coal';
  headline: string;
  decisionLabel: string;
  accentBackground: string;
  accentText: string;
  accentBorder: string;
  surfaceBackground: string;
  surfaceBorder: string;
};

export type PreparedRulingShareImage = {
  treatment: ShareImageTreatment;
  visibility: ShareImageVisibility;
  isFeatured: boolean;
  seasonalMode: SeasonalPresentationMode;
  displayName: PreparedShareImageText;
  requestText: PreparedShareImageText;
  santaResponse: PreparedShareImageText;
};

type ShareImageFieldConstraints = Record<
  ShareImageVariant,
  {
    maxCharsPerLine: number;
    maxLines: number;
  }
>;

const NAME_CONSTRAINTS: ShareImageFieldConstraints = {
  short: { maxCharsPerLine: 22, maxLines: 2 },
  medium: { maxCharsPerLine: 24, maxLines: 2 },
  long: { maxCharsPerLine: 26, maxLines: 3 },
};

const REQUEST_CONSTRAINTS: ShareImageFieldConstraints = {
  short: { maxCharsPerLine: 25, maxLines: 3 },
  medium: { maxCharsPerLine: 27, maxLines: 4 },
  long: { maxCharsPerLine: 29, maxLines: 4 },
};

const RESPONSE_CONSTRAINTS: ShareImageFieldConstraints = {
  short: { maxCharsPerLine: 32, maxLines: 3 },
  medium: { maxCharsPerLine: 34, maxLines: 4 },
  long: { maxCharsPerLine: 36, maxLines: 4 },
};

function getCharacterLength(value: string): number {
  return Array.from(value).length;
}

function splitCharacters(value: string): string[] {
  return Array.from(value);
}

function isDisallowedControlCharacter(character: string): boolean {
  const codePoint = character.codePointAt(0) ?? 0;

  return (
    (codePoint >= 0x00 && codePoint <= 0x08) ||
    codePoint === 0x0b ||
    codePoint === 0x0c ||
    (codePoint >= 0x0e && codePoint <= 0x1f) ||
    codePoint === 0x7f
  );
}

function isBidirectionalControlCharacter(character: string): boolean {
  const codePoint = character.codePointAt(0) ?? 0;

  return (
    codePoint === 0x200e ||
    codePoint === 0x200f ||
    (codePoint >= 0x202a && codePoint <= 0x202e) ||
    (codePoint >= 0x2066 && codePoint <= 0x2069)
  );
}

function truncateWithEllipsis(value: string, maxLength: number): string {
  const characters = splitCharacters(value);

  if (characters.length <= maxLength) {
    return value;
  }

  if (maxLength <= 3) {
    return characters.slice(0, maxLength).join('');
  }

  return `${characters.slice(0, maxLength - 3).join('')}...`;
}

function appendEllipsis(value: string, maxLength: number): string {
  return truncateWithEllipsis(
    value.endsWith('...') ? value : `${value}...`,
    maxLength,
  );
}

function splitToken(token: string, maxCharsPerLine: number): string[] {
  const characters = splitCharacters(token);
  const chunks: string[] = [];

  for (let index = 0; index < characters.length; index += maxCharsPerLine) {
    chunks.push(characters.slice(index, index + maxCharsPerLine).join(''));
  }

  return chunks.length > 0 ? chunks : [''];
}

export function normalizeShareImageText(value: string): string {
  return Array.from(value.replace(/\r\n?/g, '\n'))
    .filter(
      (character) =>
        !isDisallowedControlCharacter(character) &&
        !isBidirectionalControlCharacter(character),
    )
    .join('')
    .replace(/\t/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

export function selectShareImageVariant(value: string): ShareImageVariant {
  const length = getCharacterLength(normalizeShareImageText(value));

  if (length <= 36) {
    return 'short';
  }

  if (length <= 96) {
    return 'medium';
  }

  return 'long';
}

export function wrapShareImageText(
  value: string,
  options: {
    maxCharsPerLine: number;
    maxLines: number;
  },
): string[] {
  const normalized = normalizeShareImageText(value);

  if (!normalized) {
    return [];
  }

  const rawTokens = normalized.split(' ').filter(Boolean);
  const tokens = rawTokens.flatMap((token) =>
    getCharacterLength(token) > options.maxCharsPerLine
      ? splitToken(token, options.maxCharsPerLine)
      : [token],
  );
  const lines: string[] = [];
  let currentLine = '';

  for (const token of tokens) {
    if (!currentLine) {
      currentLine = token;
      continue;
    }

    const candidate = `${currentLine} ${token}`;

    if (getCharacterLength(candidate) <= options.maxCharsPerLine) {
      currentLine = candidate;
      continue;
    }

    lines.push(currentLine);
    currentLine = token;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  if (lines.length <= options.maxLines) {
    return lines;
  }

  return [
    ...lines.slice(0, options.maxLines - 1),
    appendEllipsis(lines[options.maxLines - 1] ?? '', options.maxCharsPerLine),
  ];
}

function prepareShareImageText(
  value: string,
  constraints: ShareImageFieldConstraints,
): PreparedShareImageText {
  const normalized = normalizeShareImageText(value);
  const variant = selectShareImageVariant(normalized);

  return {
    text: normalized,
    lines: wrapShareImageText(normalized, constraints[variant]),
    variant,
  };
}

export function selectShareImageTreatment(
  decision: PublicRuling['decision'],
): ShareImageTreatment {
  if (decision === 'approved') {
    return {
      tone: 'approved',
      headline: 'SANTA COMMANDS IT!',
      decisionLabel: 'APPROVED BY SANTA',
      accentBackground: '#dff2e7',
      accentText: '#194c34',
      accentBorder: '#9fc9b1',
      surfaceBackground: 'rgba(255, 255, 255, 0.94)',
      surfaceBorder: 'rgba(118, 152, 136, 0.22)',
    };
  }

  return {
    tone: 'coal',
    headline: 'COAL',
    decisionLabel: 'SANTA CHOSE COAL',
    accentBackground: '#f5d9dd',
    accentText: '#6f2030',
    accentBorder: '#d798a4',
    surfaceBackground: 'rgba(255, 255, 255, 0.94)',
    surfaceBorder: 'rgba(95, 112, 126, 0.26)',
  };
}

export function prepareRulingShareImage(
  ruling: PublicRuling,
  options: {
    visibility?: ShareImageVisibility;
    seasonalMode?: SeasonalPresentationMode;
  } = {},
): PreparedRulingShareImage {
  return {
    treatment: selectShareImageTreatment(ruling.decision),
    visibility: options.visibility ?? 'public',
    isFeatured: ruling.isFeatured,
    seasonalMode: options.seasonalMode ?? 'standard',
    displayName: prepareShareImageText(ruling.displayName, NAME_CONSTRAINTS),
    requestText: prepareShareImageText(ruling.requestText, REQUEST_CONSTRAINTS),
    santaResponse: prepareShareImageText(
      ruling.santaResponse,
      RESPONSE_CONSTRAINTS,
    ),
  };
}

async function getSantaArtworkDataUrl(): Promise<string> {
  if (!santaArtworkDataUrlPromise) {
    santaArtworkDataUrlPromise = fs
      .readFile(SANTA_ARTWORK_FILE_PATH)
      .then((file) => {
        return `data:${SANTA_ARTWORK_IMAGE_TYPE};base64,${file.toString('base64')}`;
      });
  }

  return santaArtworkDataUrlPromise;
}

async function getSnowPatternDataUrl(): Promise<string> {
  if (!snowPatternDataUrlPromise) {
    snowPatternDataUrlPromise = fs
      .readFile(SNOW_PATTERN_FILE_PATH)
      .then((file) => {
        return `data:${SNOW_PATTERN_IMAGE_TYPE};base64,${file.toString('base64')}`;
      });
  }

  return snowPatternDataUrlPromise;
}

function getNameFontSize(variant: ShareImageVariant): number {
  if (variant === 'short') {
    return 46;
  }

  if (variant === 'medium') {
    return 40;
  }

  return 34;
}

function getRequestFontSize(variant: ShareImageVariant): number {
  if (variant === 'short') {
    return 37;
  }

  if (variant === 'medium') {
    return 33;
  }

  return 30;
}

function getResponseFontSize(variant: ShareImageVariant): number {
  if (variant === 'short') {
    return 30;
  }

  if (variant === 'medium') {
    return 27;
  }

  return 24;
}

function createTextLines(
  lines: string[],
  style: CSSProperties,
  keyPrefix: string,
): ReactElement[] {
  return lines.map((line, index) =>
    createElement(
      'span',
      {
        key: `${keyPrefix}-${index}`,
        style,
      },
      line,
    ),
  );
}

function createShareImageElement(
  prepared: PreparedRulingShareImage,
  santaArtworkDataUrl: string,
  snowPatternDataUrl: string,
): ReactElement {
  const { treatment } = prepared;
  const seasonalLabel =
    prepared.seasonalMode === 'christmas-eve'
      ? 'CHRISTMAS EVE'
      : prepared.seasonalMode === 'post-christmas'
        ? 'POST CHRISTMAS'
        : prepared.seasonalMode === 'festive'
          ? 'FESTIVE'
          : null;
  const background =
    prepared.seasonalMode === 'festive'
      ? 'linear-gradient(135deg, #edf6f2 0%, #dcebee 42%, #f9f4f1 100%)'
      : prepared.seasonalMode === 'christmas-eve'
        ? 'linear-gradient(135deg, #f4f0f0 0%, #e8edf3 42%, #faf4f2 100%)'
        : prepared.seasonalMode === 'post-christmas'
          ? 'linear-gradient(135deg, #f3f7fb 0%, #dde7ef 42%, #f8fbfd 100%)'
          : 'linear-gradient(135deg, #eef5f8 0%, #dbe8ef 42%, #f5faf8 100%)';

  return createElement(
    'div',
    {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        overflow: 'hidden',
        background,
        color: '#162a2d',
        fontFamily: '"Noto Sans", sans-serif',
        padding: '42px',
      },
    },
    ...[0, 1, 2, 3].map((index) =>
      createElement('img', {
        key: `snow-left-${index}`,
        src: snowPatternDataUrl,
        alt: '',
        width: 250,
        height: 250,
        style: {
          position: 'absolute',
          left: `${index % 2 === 0 ? -32 : 188}px`,
          top: `${-28 + Math.floor(index / 2) * 232}px`,
          opacity: 0.13,
        },
      }),
    ),
    createElement('img', {
      src: snowPatternDataUrl,
      alt: '',
      width: 230,
      height: 230,
      style: {
        position: 'absolute',
        right: '34px',
        top: '26px',
        opacity: 0.08,
      },
    }),
    createElement(
      'div',
      {
        style: {
          display: 'flex',
          width: '100%',
          height: '100%',
          gap: '28px',
        },
      },
      createElement(
        'div',
        {
          style: {
            width: '306px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '22px',
          },
        },
        createElement(
          'div',
          {
            style: {
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            },
          },
          createElement(
            'div',
            {
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              },
            },
            createElement('div', {
              style: {
                width: '16px',
                height: '16px',
                borderRadius: '9999px',
                background:
                  treatment.tone === 'approved' ? '#2f7d56' : '#b54759',
              },
            }),
            createElement(
              'span',
              {
                style: {
                  fontSize: '18px',
                  letterSpacing: 0,
                  fontWeight: 700,
                  color: '#294146',
                },
              },
              'SANTA COMMANDS IT!',
            ),
          ),
          createElement(
            'div',
            {
              style: {
                display: 'flex',
                flexDirection: 'column',
                borderRadius: '30px',
                padding: '18px',
                background: 'rgba(255, 255, 255, 0.7)',
                border: '2px solid rgba(112, 146, 158, 0.18)',
                boxShadow: '0 18px 42px rgba(46, 78, 81, 0.1)',
              },
            },
            createElement('img', {
              src: santaArtworkDataUrl,
              alt: '',
              width: 270,
              height: 310,
              style: {
                objectFit: 'contain',
              },
            }),
          ),
        ),
        createElement(
          'div',
          {
            style: {
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              padding: '20px',
              borderRadius: '26px',
              background: 'rgba(21, 60, 62, 0.9)',
              color: '#f4fbfc',
            },
          },
          createElement(
            'span',
            {
              style: {
                fontSize: '15px',
                letterSpacing: 0,
                fontWeight: 700,
                color: '#c8e3e7',
              },
            },
            'A PROJECT FROM',
          ),
          createElement(
            'span',
            {
              style: {
                fontSize: '18px',
                fontWeight: 700,
              },
            },
            'Argon Collective LLC',
          ),
        ),
      ),
      createElement(
        'div',
        {
          style: {
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '22px',
          },
        },
        createElement(
          'div',
          {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '18px',
            },
          },
          createElement(
            'div',
            {
              style: {
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              },
            },
            createElement(
              'span',
              {
                style: {
                  fontSize: '18px',
                  letterSpacing: 0,
                  fontWeight: 700,
                  color: '#466166',
                },
              },
              'PUBLIC HOLIDAY RULING',
            ),
            createElement(
              'h1',
              {
                style: {
                  margin: 0,
                  fontSize: treatment.tone === 'approved' ? '74px' : '80px',
                  lineHeight: 0.95,
                  letterSpacing: 0,
                  color: '#14343b',
                },
              },
              treatment.headline,
            ),
            createElement(
              'div',
              {
                style: {
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '12px',
                },
              },
              createElement(
                'span',
                {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 18px',
                    borderRadius: '9999px',
                    border: `2px solid ${treatment.accentBorder}`,
                    background: treatment.accentBackground,
                    color: treatment.accentText,
                    fontSize: '22px',
                    fontWeight: 800,
                    letterSpacing: 0,
                  },
                },
                treatment.decisionLabel,
              ),
              prepared.visibility === 'hidden'
                ? createElement(
                    'span',
                    {
                      style: {
                        display: 'flex',
                        alignItems: 'center',
                        padding: '12px 18px',
                        borderRadius: '9999px',
                        border: '2px solid rgba(48, 72, 82, 0.2)',
                        background: 'rgba(255, 255, 255, 0.82)',
                        color: '#294146',
                        fontSize: '22px',
                        fontWeight: 800,
                        letterSpacing: 0,
                      },
                    },
                    'PRIVATE HIDDEN PREVIEW',
                  )
                : null,
              prepared.isFeatured
                ? createElement(
                    'span',
                    {
                      style: {
                        display: 'flex',
                        alignItems: 'center',
                        padding: '12px 18px',
                        borderRadius: '9999px',
                        border: '2px solid rgba(73, 99, 84, 0.24)',
                        background: 'rgba(255, 255, 255, 0.86)',
                        color: '#355043',
                        fontSize: '22px',
                        fontWeight: 800,
                        letterSpacing: 0,
                      },
                    },
                    'FEATURED',
                  )
                : null,
              seasonalLabel
                ? createElement(
                    'span',
                    {
                      style: {
                        display: 'flex',
                        alignItems: 'center',
                        padding: '12px 18px',
                        borderRadius: '9999px',
                        border: '2px solid rgba(64, 92, 92, 0.18)',
                        background: 'rgba(255, 255, 255, 0.7)',
                        color: '#355043',
                        fontSize: '20px',
                        fontWeight: 800,
                        letterSpacing: 0,
                      },
                    },
                    seasonalLabel,
                  )
                : null,
            ),
          ),
          createElement(
            'div',
            {
              style: {
                width: '250px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '18px 20px',
                borderRadius: '24px',
                background: 'rgba(255, 255, 255, 0.72)',
                border: '2px solid rgba(112, 146, 158, 0.16)',
              },
            },
            createElement(
              'span',
              {
                style: {
                  fontSize: '16px',
                  letterSpacing: 0,
                  fontWeight: 700,
                  color: '#4a666d',
                },
              },
              'REQUESTED BY',
            ),
            ...createTextLines(
              prepared.displayName.lines,
              {
                fontSize: `${getNameFontSize(prepared.displayName.variant)}px`,
                lineHeight: 1.08,
                fontWeight: 800,
                color: '#173840',
              },
              'display-name',
            ),
          ),
        ),
        createElement(
          'div',
          {
            style: {
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              flex: 1,
            },
          },
          createElement(
            'div',
            {
              style: {
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                padding: '24px 26px',
                borderRadius: '28px',
                background: treatment.surfaceBackground,
                border: `2px solid ${treatment.surfaceBorder}`,
                boxShadow: '0 20px 44px rgba(47, 79, 82, 0.1)',
              },
            },
            createElement(
              'span',
              {
                style: {
                  fontSize: '17px',
                  letterSpacing: 0,
                  fontWeight: 700,
                  color: '#516b72',
                },
              },
              'THE REQUEST',
            ),
            ...createTextLines(
              prepared.requestText.lines,
              {
                fontSize: `${getRequestFontSize(prepared.requestText.variant)}px`,
                lineHeight: 1.18,
                fontWeight: 700,
                color: '#173840',
              },
              'request-text',
            ),
          ),
          createElement(
            'div',
            {
              style: {
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                padding: '24px 26px',
                borderRadius: '28px',
                background: '#173840',
                color: '#f4fbfc',
                boxShadow: '0 22px 48px rgba(23, 56, 64, 0.22)',
              },
            },
            createElement(
              'span',
              {
                style: {
                  fontSize: '17px',
                  letterSpacing: 0,
                  fontWeight: 700,
                  color: '#c0dde2',
                },
              },
              'SANTA RESPONDED',
            ),
            ...createTextLines(
              prepared.santaResponse.lines,
              {
                fontSize: `${getResponseFontSize(prepared.santaResponse.variant)}px`,
                lineHeight: 1.22,
                fontWeight: 700,
                color: '#f7fbfc',
              },
              'response-text',
            ),
          ),
        ),
      ),
    ),
  );
}

export function buildShareImageErrorResponse(
  status: 404 | 405 | 503,
  message = 'Share image unavailable.',
): Response {
  return new Response(message, {
    status,
    headers: {
      ...ERROR_HEADERS,
      'cache-control': RULING_SHARE_IMAGE_PRIVATE_CACHE_CONTROL,
    },
  });
}

export async function renderRulingShareImage(
  ruling: PublicRuling,
  options: {
    visibility?: ShareImageVisibility;
    seasonalMode?: SeasonalPresentationMode;
    cacheControl?: string;
  } = {},
): Promise<Response> {
  const prepared = prepareRulingShareImage(ruling, {
    visibility: options.visibility,
    seasonalMode: options.seasonalMode,
  });
  const [santaArtworkDataUrl, snowPatternDataUrl] = await Promise.all([
    getSantaArtworkDataUrl(),
    getSnowPatternDataUrl(),
  ]);

  return new ImageResponse(
    createShareImageElement(prepared, santaArtworkDataUrl, snowPatternDataUrl),
    {
      width: RULING_SHARE_IMAGE_WIDTH,
      height: RULING_SHARE_IMAGE_HEIGHT,
      headers: {
        ...SUCCESS_HEADERS,
        'cache-control':
          options.cacheControl ?? RULING_SHARE_IMAGE_PUBLIC_CACHE_CONTROL,
      },
    },
  );
}

export {
  RULING_SHARE_IMAGE_HEIGHT,
  RULING_SHARE_IMAGE_PRIVATE_CACHE_CONTROL,
  RULING_SHARE_IMAGE_PUBLIC_CACHE_CONTROL,
  RULING_SHARE_IMAGE_WIDTH,
  SANTA_ARTWORK_BROWSER_PATH,
  SANTA_ARTWORK_FILE_PATH,
  SNOW_PATTERN_FILE_PATH,
};
