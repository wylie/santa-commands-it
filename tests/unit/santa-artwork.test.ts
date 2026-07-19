import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const projectRoot = process.cwd();
const santaArtworkPath = path.join(
  projectRoot,
  'public',
  'images',
  'santa-solo.png',
);
const snowBackgroundPath = path.join(
  projectRoot,
  'public',
  'images',
  'snow-black.png',
);
const portraitComponentPath = path.join(
  projectRoot,
  'src',
  'components',
  'SantaPortrait.astro',
);
const globalStylesPath = path.join(projectRoot, 'src', 'styles', 'global.css');
const rulingPagePath = path.join(
  projectRoot,
  'src',
  'pages',
  'rulings',
  '[publicId].astro',
);
const readmePath = path.join(projectRoot, 'README.md');

function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

describe('Santa artwork integration', () => {
  it('tracks the canonical Santa artwork and snow background assets at the exact required paths', () => {
    expect(fs.existsSync(santaArtworkPath)).toBe(true);
    expect(fs.existsSync(snowBackgroundPath)).toBe(true);
    expect(fs.readFileSync(santaArtworkPath).subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  });

  it('renders the canonical browser path from the portrait component', () => {
    const source = readFile(portraitComponentPath);

    expect(source).toContain('src="/images/santa-solo.png"');
    expect(source).not.toContain('portrait-frame__placeholder');
    expect(source).not.toContain('santa-artwork-status');
    expect(source).not.toContain('/images/santa.png');
    for (const extension of ['jpeg', 'jpg']) {
      expect(source).not.toContain(`/images/santa-solo.${extension}`);
    }
  });

  it('keeps the ruling page tied to the same Santa portrait component', () => {
    const source = readFile(rulingPagePath);

    expect(source).toContain("import PublicShell from '@/components/PublicShell.astro'");
    expect(source).toContain('<PublicShell current="browse-requests">');
  });

  it('uses the repeating snow background with a centralized background-size token', () => {
    const styles = readFile(globalStylesPath);
    const normalizedStyles = styles.replace(/\s+/g, ' ');

    expect(styles).toContain('--background-pattern-size: 400px;');
    expect(styles).toContain("url('/images/snow-black.png')");
    expect(normalizedStyles).toContain('background-repeat: no-repeat, repeat');
    expect(normalizedStyles).toContain(
      'var(--background-pattern-size) var(--background-pattern-size)',
    );
    expect(styles).not.toContain("url('/images/snow-white.png')");
    expect(styles).not.toContain('/images/santa.png');
    expect(styles).not.toContain('background-size: cover');
  });

  it('documents the committed canonical Santa and snow assets', () => {
    const readme = readFile(readmePath);

    expect(readme).toContain(
      'Canonical filesystem path: `public/images/santa-solo.png`',
    );
    expect(readme).toContain('Canonical browser URL: `/images/santa-solo.png`');
    expect(readme).toContain(
      'Background filesystem path: `public/images/snow-black.png`',
    );
    expect(readme).toContain(
      'Background browser URL: `/images/snow-black.png`',
    );
    expect(readme).not.toContain('manual placement');
  });
});
