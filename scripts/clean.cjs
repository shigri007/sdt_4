const fs = require('node:fs');
for (const target of ['dist', 'coverage']) fs.rmSync(target, { recursive: true, force: true });
