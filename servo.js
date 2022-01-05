import { promises as fs } from "fs";
import * as webidl2 from "webidl2";

const directories = [
  new URL("../servo/components/script/dom/webidls/", import.meta.url),
];
for (const dir of directories) {
  for (const filename of await fs.readdir(dir)) {
    if (!filename.endsWith(".webidl")) {
      continue;
    }
    const content = await fs.readFile(new URL(filename, dir), "utf-8");
    const ast = webidl2.parse(content, {
      sourceName: filename,
      concrete: true,
    });
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
    const written = webidl2.write(ast);
    await fs.writeFile(new URL(filename, dir), written);
  }
}
