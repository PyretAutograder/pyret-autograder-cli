#!/usr/bin/env node

/*
	This file launches the ts file since there is no way currently to provide
	node cli flags to shebangs.

	Once --experimental-strip-types is stabilized into an LTS node release, this
	file can be removed and package.json can be updated to point to index.ts
	directly.
*/

// @ts-check

import path from "node:path";
import { spawn } from "node:child_process";

const script = path.join(import.meta.dirname, "index.ts");

const child = spawn(
  process.execPath,
  ["--experimental-strip-types", script, ...process.argv.slice(2)],
  {
    stdio: "inherit",
  },
);
child.on("exit", (code) => process.exit(code));
