import { fileURLToPath } from "url";

export default {
  mode: "production",
  entry: "./lib/index.js",
  output: {
    path: fileURLToPath(new URL("./dist", import.meta.url)),
    filename: "index.cjs",
    libraryTarget: "commonjs2",
  },
};
