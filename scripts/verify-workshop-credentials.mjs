import { scryptSync, timingSafeEqual } from 'node:crypto';
import process from 'node:process';

const PASSWORD_HASH_PREFIX = 'scrypt';

function parseArgs(argv) {
  const values = {
    username: null,
    password: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const part = argv[index];
    const next = argv[index + 1];

    if (part === '--username' && next) {
      values.username = next;
      index += 1;
      continue;
    }

    if (part === '--password' && next) {
      values.password = next;
      index += 1;
    }
  }

  return values;
}

function readLine(promptText, { hidden = false } = {}) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    const stdout = process.stdout;

    if (!stdin.isTTY || !stdout.isTTY) {
      reject(
        new Error(
          'This script requires an interactive terminal unless --username and --password are both provided.',
        ),
      );
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

      if (!hidden) {
        stdout.write(input);
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

function parsePasswordHash(value) {
  const parts = value.split('$');

  if (parts.length !== 6 || parts[0] !== PASSWORD_HASH_PREFIX) {
    return null;
  }

  const cost = Number.parseInt(parts[1] ?? '', 10);
  const blockSize = Number.parseInt(parts[2] ?? '', 10);
  const parallelization = Number.parseInt(parts[3] ?? '', 10);
  const salt = parts[4] ? Buffer.from(parts[4], 'base64url') : null;
  const derivedKey = parts[5] ? Buffer.from(parts[5], 'base64url') : null;

  if (
    !Number.isInteger(cost) ||
    !Number.isInteger(blockSize) ||
    !Number.isInteger(parallelization) ||
    !salt ||
    !derivedKey ||
    !salt.length ||
    !derivedKey.length
  ) {
    return null;
  }

  return {
    cost,
    blockSize,
    parallelization,
    salt,
    derivedKey,
  };
}

function verifyPassword(password, storedHash) {
  const parsed = parsePasswordHash(storedHash);

  if (!parsed) {
    return false;
  }

  const computed = scryptSync(password, parsed.salt, parsed.derivedKey.length, {
    N: parsed.cost,
    r: parsed.blockSize,
    p: parsed.parallelization,
  });

  if (computed.length !== parsed.derivedKey.length) {
    return false;
  }

  return timingSafeEqual(computed, parsed.derivedKey);
}

try {
  const configuredUsername = (process.env.WORKSHOP_USERNAME ?? '').trim();
  const configuredHash = (process.env.WORKSHOP_PASSWORD_HASH ?? '').trim();
  const args = parseArgs(process.argv.slice(2));

  if (!configuredUsername) {
    throw new Error(
      'WORKSHOP_USERNAME is missing from the current environment.',
    );
  }

  if (!configuredHash) {
    throw new Error(
      'WORKSHOP_PASSWORD_HASH is missing from the current environment.',
    );
  }

  const username =
    args.username ?? (await readLine('Workshop username to verify: '));
  const password =
    args.password ??
    (await readLine('Workshop password to verify: ', { hidden: true }));

  const usernameMatches = username === configuredUsername;
  const passwordMatches = verifyPassword(password, configuredHash);

  process.stdout.write(`Username match: ${usernameMatches ? 'yes' : 'no'}\n`);
  process.stdout.write(`Password match: ${passwordMatches ? 'yes' : 'no'}\n`);

  if (usernameMatches && passwordMatches) {
    process.stdout.write(
      'Workshop credentials match the current environment.\n',
    );
    process.exitCode = 0;
  } else {
    process.stdout.write(
      'Workshop credentials do not match the current environment.\n',
    );
    process.exitCode = 1;
  }
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'Unable to verify credentials.'}\n`,
  );
  process.exitCode = 1;
}
