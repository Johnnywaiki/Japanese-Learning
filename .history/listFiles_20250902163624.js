// listFiles.js
const fs = require("fs");
const path = require("path");

const IGNORE = new Set(["node_modules", ".git", ".expo", "dist", "build", ".cache"]);

function listDir(dir, prefix = "") {
  let entries = fs.readdirSync(dir, { withFileTypes: true })
    .filter(e => !IGNORE.has(e.name)) // 忽略不需要嘅資料夾
    .sort((a, b) => (b.isFile() - a.isFile()) || a.name.localeCompare(b.name));

  for (const e of entries) {
    console.log(prefix + e.name);
    if (e.isDirectory()) {
      listDir(path.join(dir, e.name), prefix + "  ");
    }
  }
}

// 從專案根目錄開始
listDir(".");
