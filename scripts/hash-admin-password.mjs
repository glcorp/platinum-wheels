/**
 * hash-admin-password.mjs — prints the `ADMIN_PASSWORD_HASH` value for the
 * admin sign-in (D95).
 *
 *   npm run admin:hash-password
 *
 * Asks for the password twice, without echoing it, and prints one line:
 * `scrypt:<cost>:<blockSize>:<parallelization>:<salt>:<hash>`. Paste that into
 * the Vercel project as `ADMIN_PASSWORD_HASH` (Production and Preview), then
 * delete `ADMIN_PASSWORD`. `src/features/admin/session.ts` `parsePasswordHash()`
 * reads this exact format; change one, change both.
 *
 * The password is read from the keyboard only, never from an argument or a
 * pipe, so it cannot land in shell history or a process listing.
 */

import { randomBytes, scrypt } from "node:crypto";
import process from "node:process";

/** 2^15 with r=8 is 32 MiB and roughly 50-100ms per check: slow enough to
 *  make guessing expensive, fast enough that sign-in does not feel it. */
const COST = 2 ** 15;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
/** One shared account guards the admin and there is no failed-login limit
 *  (D95), so length is the password's whole defence. */
const MIN_LENGTH = 12;

/**
 * Reads one line per prompt with echo off. All prompts share one raw-mode
 * session, so typed-ahead or pasted input that arrives in a single chunk is
 * split across the prompts instead of the tail being dropped.
 */
function readHiddenLines(prompts) {
  const { stdin, stderr } = process;
  if (!stdin.isTTY) {
    return Promise.reject(
      new Error("Run this in a terminal. The password is read from the keyboard, never from a pipe."),
    );
  }
  return new Promise((resolve) => {
    const answers = [];
    let value = "";
    let previousWasCarriageReturn = false;
    const finish = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
    };
    const onData = (chunk) => {
      for (const char of chunk) {
        const isNewline = char === "\r" || char === "\n";
        // A pasted "\r\n" is one line break, not two.
        if (char === "\n" && previousWasCarriageReturn) {
          previousWasCarriageReturn = false;
          continue;
        }
        previousWasCarriageReturn = char === "\r";
        if (isNewline) {
          stderr.write("\n");
          answers.push(value);
          value = "";
          if (answers.length === prompts.length) {
            finish();
            resolve(answers);
            return;
          }
          stderr.write(prompts[answers.length]);
        } else if (char === "\u0003") {
          finish();
          stderr.write("\n");
          process.exit(130);
        } else if (char === "\u007f" || char === "\b") {
          value = value.slice(0, -1);
        } else {
          value += char;
        }
      }
    };
    // Echo goes off before the prompt appears, so nothing typed after seeing
    // it can be echoed by the terminal.
    stdin.setRawMode(true);
    stdin.setEncoding("utf8");
    stdin.resume();
    stdin.on("data", onData);
    stderr.write(prompts[0]);
  });
}

function scryptAsync(password, salt) {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      KEY_LENGTH,
      { N: COST, r: BLOCK_SIZE, p: PARALLELIZATION, maxmem: 256 * COST * BLOCK_SIZE },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

async function main() {
  const [password, confirmation] = await readHiddenLines(["Admin password: ", "Type it again: "]);
  if (password.length < MIN_LENGTH) {
    throw new Error(`Use at least ${MIN_LENGTH} characters.`);
  }
  if (confirmation !== password) {
    throw new Error("The two entries do not match.");
  }

  const salt = randomBytes(SALT_LENGTH);
  const hash = await scryptAsync(password, salt);
  process.stdout.write(
    `scrypt:${COST}:${BLOCK_SIZE}:${PARALLELIZATION}:${salt.toString("base64url")}:${hash.toString("base64url")}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
