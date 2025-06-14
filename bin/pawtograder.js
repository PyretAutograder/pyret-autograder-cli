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
// @ts-check

import yaml from "yaml";
import { readFile } from "fs/promises";
import { spawn } from "child_process";
import path from "path";

/** @import { Config, Spec } from "pyret-autograder-pawtograder" */

export async function pawtograderAction(
  /** @type {string} */ submission,
  /** @type {{solution: string}}*/ options,
) {
  const submissionPath = path.resolve(submission);
  const solutionPath = path.resolve(options.solution);

  const rawConfig = await readFile(
    path.join(solutionPath, "pawtograder.yml"),
    "utf8",
  );
  /** @type { Config } */
  const config = yaml.parse(rawConfig);

  /** @type { Spec } */
  const spec = {
    solution_dir: solutionPath,
    submission_dir: submissionPath,
    config,
  };

  const result = await new Promise((resolve, reject) => {
    const autograder = spawn("node", [
      path.join(import.meta.dirname, "../src/pawtograder.cjs"),
    ]);

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
      // HACK: remove once npm import stops logging shit
      const hopefullyJson = output.trim().split("\n").at(-1);
      try {
        resolve(JSON.parse(hopefullyJson));
      } catch (e) {
        reject(new Error(`Invalid JSON from grader: ${hopefullyJson}\n${e}`));
      }
    });

    console.log(JSON.stringify(spec))

    autograder.stdin.write(JSON.stringify(spec));
    autograder.stdin.end();
  });

  console.dir(result);
}
