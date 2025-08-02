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

// prettier-ignore
({
  requires: [],
  provides: {
    values: {
      "get-stdin": ["arrow", [], "String"],
    },
  },
  nativeRequires: [],
  theModule: function (runtime, _, _) {
    let input = "";
    let eof = false;

    runtime.stdin.setEncoding("utf8");
    runtime.stdin.on("data", (chunk) => (input += chunk));
    runtime.stdin.on("end", () => (eof = true));

    function getStdin() {
      if (!eof) {
        return runtime.pauseStack(async (restarter) => {
          runtime.stdin.on("end", () => {
            restarter.resume(runtime.makeString(input));
          });
        });
      }

      return runtime.makeString(input);
    }

    return runtime.makeModuleReturn({
      "get-stdin": runtime.makeFunction(getStdin, "get-stdin"),
    }, {});
  },
})
