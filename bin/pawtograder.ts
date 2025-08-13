/*
  Copyright (C) 2025 ironmoon <me@ironmoon.dev>

  This file is part of pyret-autograder-cli.

  pyret-autograder-cli is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or (at your
  option) any later version.

  pyret-autograder-cli is distributed in the hope that it will be useful, but
  WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
  FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License
  for more details.

  You should have received a copy of the GNU Affero General Public License
  with pyret-autograder-cli. If not, see <http://www.gnu.org/licenses/>.
*/

import yaml from "yaml";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { Config, Spec, z } from "pyret-autograder-pawtograder";
import chalk from "chalk";

const PKG_ROOT = path.resolve(import.meta.dirname, "..");
const DEFAULT_COMPILED_PATH =
  path.join(PKG_ROOT, "build/pyret/lib-compiled") +
  ":" +
  path.join(PKG_ROOT, "build/pyret/cpo");

async function resolveSpec(
  submission: string,
  { solution }: { solution: string },
) {
  const solutionPath = path.resolve(solution);

  const rawConfig = await readFile(
    path.join(solutionPath, "pawtograder.yml"),
    "utf8",
  );

  const config: Config = yaml.parse(rawConfig);

  const parseRes = Spec.safeParse({
    solution_dir: solutionPath,
    submission_dir: submission,
    config,
  });

  if (parseRes.success) {
    return parseRes.data;
  } else {
    const pretty = z.prettifyError(parseRes.error);
    const err =
      chalk.redBright.bold`Invalid specification provided` +
      `:\n${chalk.yellow(pretty)}\n\n` +
      chalk.bold`See the ` +
      chalk.blackBright.bold`cause` +
      chalk.bold` field for the full error.`;

    throw new Error(err, { cause: parseRes.error });
  }
}

export async function pawtograderAction(
  submission: string,
  options: { solution: string },
) {
  const submissionPath = path.resolve(submission);
  const spec = await resolveSpec(submissionPath, options);

  const result = await new Promise((resolve, reject) => {
    const env = {
      PA_PYRET_LANG_COMPILED_PATH: DEFAULT_COMPILED_PATH,
      PA_CURRENT_LOAD_PATH: submissionPath,
      ...process.env,
      PWD: submissionPath,
    };

    const autograder = spawn(
      process.execPath,
      [path.join(import.meta.dirname, "../src/pawtograder.cjs")],
      { env, cwd: submissionPath },
    );

    console.log("grader started");

    let output = "";
    let error = "";
    autograder.stdout.on("data", (data) => (output += data.toString()));
    autograder.stderr.on("data", (data) => (error += data.toString()));

    autograder.on("close", (code) => {
      console.log("grader ended");
      if (code !== 0) {
        return reject(new Error(`Grader failed: ${error}\noutput:\n${output}`));
      }
      const outputTail = output.trim().split("\n").at(-1)!;
      try {
        resolve(JSON.parse(outputTail));
      } catch (e) {
        reject(new Error(`Invalid JSON from grader: ${outputTail}\n${e}`));
      }
    });

    console.log(JSON.stringify(spec));

    autograder.stdin.write(JSON.stringify(spec));
    autograder.stdin.end();
  });

  console.dir(result);
}
