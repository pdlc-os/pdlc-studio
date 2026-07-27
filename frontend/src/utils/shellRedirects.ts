/**
 * Best-effort extraction of files a shell command writes via redirection.
 *
 * This exists because a file created with `printf ... > out.txt` has no
 * structured path anywhere — the tool input is one opaque command string — so
 * the Files tab would otherwise miss it entirely.
 *
 * It is deliberately conservative. A missed file is a gap; a *wrong* file is a
 * row pointing at something that was never written, which is worse. So this
 * recognises the common shapes and declines everything else rather than
 * guessing.
 *
 * Known and accepted limits: it cannot tell whether the command actually ran
 * or succeeded, it does not expand variables or globs, and it does not follow
 * `cp`, `mv`, `tee`, or heredocs.
 */

/** Targets that are not files worth listing. */
const NON_FILE_TARGETS = /^\/dev\//;

interface Token {
  value: string;
  /** True when the token was a bare operator outside quotes. */
  isOperator: boolean;
}

/**
 * Splits a command into words and redirection operators.
 *
 * Quote-aware on purpose: `echo "a > b"` contains no redirection, and a regex
 * over the raw string cannot tell the difference.
 */
function tokenize(command: string): Token[] {
  const tokens: Token[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;

  const push = () => {
    if (current !== "") {
      tokens.push({ value: current, isOperator: false });
      current = "";
    }
  };

  for (let i = 0; i < command.length; i++) {
    const char = command[i];

    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    // A backslash escapes the next character, including a would-be operator.
    if (char === "\\" && i + 1 < command.length) {
      current += command[i + 1];
      i++;
      continue;
    }

    if (char === ">") {
      const isAppend = command[i + 1] === ">";
      // A file descriptor may be glued to the operator: `2>`, `1>>`.
      const fd = /(\d)$/.exec(current)?.[1];
      if (fd) current = current.slice(0, -1);
      push();
      tokens.push({
        value: `${fd ?? ""}${isAppend ? ">>" : ">"}`,
        isOperator: true,
      });
      if (isAppend) i++;
      continue;
    }

    if (/\s/.test(char) || char === ";" || char === "|" || char === "&") {
      push();
      continue;
    }

    current += char;
  }

  push();
  return tokens;
}

/**
 * Paths the command redirects stdout into.
 *
 * Only stdout counts: `2> log` is diagnostics, and listing it as a produced
 * file would misrepresent what the command did.
 */
export function parseRedirectTargets(command: string | undefined): string[] {
  if (!command) return [];

  const tokens = tokenize(command);
  const targets: string[] = [];

  tokens.forEach((token, index) => {
    if (!token.isOperator) return;

    // Bare `>`/`>>` are stdout; an explicit `1>` is the same thing. Any other
    // descriptor is not the command's output.
    const operator = token.value;
    if (operator !== ">" && operator !== ">>" && !operator.startsWith("1")) {
      return;
    }

    const next = tokens[index + 1];
    if (!next || next.isOperator) return;

    const target = next.value;
    // `>&1` style duplication leaves an ampersand-led token; and an empty or
    // device target is not a file.
    if (
      target === "" ||
      target.startsWith("&") ||
      NON_FILE_TARGETS.test(target)
    ) {
      return;
    }

    if (!targets.includes(target)) targets.push(target);
  });

  return targets;
}

/**
 * Makes a redirect target absolute so it can be opened.
 *
 * A relative target is resolved against the working directory, which is where
 * the CLI runs commands. Without a working directory a relative path cannot be
 * placed at all, so it is dropped rather than guessed at — the file endpoint
 * would refuse it anyway.
 */
export function resolveRedirectTargets(
  targets: string[],
  workingDirectory?: string,
): string[] {
  const resolved: string[] = [];

  for (const target of targets) {
    if (target.startsWith("/")) {
      resolved.push(target);
    } else if (target.startsWith("~/")) {
      // Left alone: expanding it needs a home directory the browser lacks.
      continue;
    } else if (workingDirectory) {
      const base = workingDirectory.replace(/\/+$/, "");
      resolved.push(`${base}/${target.replace(/^\.\//, "")}`);
    }
  }

  return resolved;
}
