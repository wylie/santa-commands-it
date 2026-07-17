import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const projectRoot = process.cwd();
const santaPngPath = path.join(projectRoot, 'public', 'images', 'santa.png');
const portraitComponentPath = path.join(
  projectRoot,
  'src',
  'components',
  'SantaPortrait.astro',
);
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
  it('tracks the canonical santa.png asset at the exact required path', () => {
    expect(fs.existsSync(santaPngPath)).toBe(true);
  });

  it('renders the canonical browser path from the portrait component', () => {
    const source = readFile(portraitComponentPath);

    expect(source).toContain('src="/images/santa.png"');
    expect(source).not.toContain('portrait-frame__placeholder');
    expect(source).not.toContain('santa-artwork-status');
    expect(source).not.toMatch(/santa\.(jpg|jpeg)/i);
  });

  it('keeps the ruling page tied to the same Santa portrait component', () => {
    const source = readFile(rulingPagePath);

    expect(source).toContain(
      "import SantaPortrait from '@/components/SantaPortrait.astro'",
    );
  });

  it('documents the PNG as the committed canonical Santa asset', () => {
    const readme = readFile(readmePath);

    expect(readme).toContain(
      'Canonical filesystem path: `public/images/santa.png`',
    );
    expect(readme).toContain('Canonical browser URL: `/images/santa.png`');
    expect(readme).not.toContain('manual placement');
  });
});
