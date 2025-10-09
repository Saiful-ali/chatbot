import fs from "fs";
import path from "path";

// Set the root for your client src folder
const SRC_DIR = path.resolve("client/src");

// Walk through all files recursively
function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith(".tsx") || fullPath.endsWith(".ts")) {
      checkImports(fullPath);
    }
  }
}

// Check each file for @/... imports
function checkImports(file) {
  const content = fs.readFileSync(file, "utf-8");
  const regex = /import\s+.*\s+from\s+["'](@\/.*?)["']/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const importPath = match[1]; // e.g. "@/components/ui/toaster"
    const relativePath = importPath.replace("@", SRC_DIR);
    const fullPathTsx = path.resolve(relativePath + ".tsx");
    const fullPathTs = path.resolve(relativePath + ".ts");
    const fullPathIndex = path.resolve(relativePath, "index.tsx");
    const fullPathIndexTs = path.resolve(relativePath, "index.ts");

    if (
      !fs.existsSync(fullPathTsx) &&
      !fs.existsSync(fullPathTs) &&
      !fs.existsSync(fullPathIndex) &&
      !fs.existsSync(fullPathIndexTs)
    ) {
      console.log(`Missing import in ${file}: ${importPath}`);
    } else {
      console.log(`Found import in ${file}: ${importPath}`);
    }
  }
}

walk(SRC_DIR);
