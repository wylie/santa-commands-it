import { randomBytes, scryptSync } from 'node:crypto';
import process from 'node:process';

function readHiddenLine(promptText) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    const stdout = process.stdout;

    if (!stdin.isTTY || !stdout.isTTY) {
      reject(new Error('This script requires an interactive terminal.'));
      return;
    }

    let value = '';
    const onData = (chunk) => {
      const input = chunk.toString('utf8');

      if (input === '\u0003') {
        cleanup();
        reject(new Error('Canceled.'));
        return;
      }

      if (input === '\r' || input === '\n') {
        stdout.write('\n');
        cleanup();
        resolve(value);
        return;
      }

      if (input === '\u007f') {
        value = value.slice(0, -1);
        return;
      }

      value += input;
    };

    const cleanup = () => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
    };

    stdout.write(promptText);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}

function createPasswordHash(password) {
  const salt = randomBytes(16);
  const derivedKey = scryptSync(password, salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
  });

  return [
    'scrypt',
    '16384',
    '8',
    '1',
    salt.toString('base64url'),
    derivedKey.toString('base64url'),
  ].join('$');
}

try {
  const password = await readHiddenLine('New workshop password: ');
  const confirmation = await readHiddenLine('Confirm password: ');

  if (!password) {
    throw new Error('A password is required.');
  }

  if (password !== confirmation) {
    throw new Error('Passwords did not match.');
  }

  process.stdout.write(`${createPasswordHash(password)}\n`);
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'Unable to generate hash.'}\n`,
  );
  process.exitCode = 1;
}
