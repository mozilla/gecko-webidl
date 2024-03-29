import * as fs from "fs/promises";
import * as webidl2 from "webidl2";
import { join } from "path";
import { program } from "commander";

import { parse, write } from "../lib/index.js";


/**
 * Parse and fixup webidls.
 *
 * Rewrites content to the original location.
 *
 * @param {string[]} directories
 */
async function rewrite(directories) {
  for (const dir of directories) {
    for (const filename of await fs.readdir(dir)) {
      if (!filename.endsWith(".webidl")) {
        continue;
      }

      const content = await fs.readFile(join(dir, filename), "utf-8");
      const ast = parse(content, filename);
      const validations = webidl2.validate(ast);
      if (!validations.length) {
        continue;
      }
      let autofixed = false;
      for (const validation of validations) {
        if (validation.ruleName === "replace-void") {
          validation.autofix();
          autofixed = true;
        }
      }
      if (!autofixed) {
        continue;
      }

      const written = write(ast);
      await fs.writeFile(new URL(filename, dir), written);
    }
  }
}

program
  .argument("<path-to-webidl>")
  .action(async () => {
    await rewrite(program.args);
  })
  .showHelpAfterError()
  .parse();
