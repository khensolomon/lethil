import { readFileSync } from "fs";
const json = JSON.parse(readFileSync("package.json", "utf8"));

if (json.type != undefined) {
  console.log("type property should not included in packaged!");
  console.log("\n");
  console.log("So npm run build before publishing");
  process.exit(2);
}
