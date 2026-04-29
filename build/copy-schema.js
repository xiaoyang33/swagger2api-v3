const fs = require('fs');
const path = require('path');

/**
 * 复制配置 JSON Schema 到 dist 目录
 */
function copySchema() {
  const rootDir = path.resolve(__dirname, '..');
  const sourcePath = path.join(rootDir, 'build', '.swagger2api.schema.json');
  const targetPath = path.join(rootDir, 'dist', '.swagger2api.schema.json');

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
}

copySchema();
