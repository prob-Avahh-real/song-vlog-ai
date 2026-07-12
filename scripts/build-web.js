const fs = require('fs');
const path = require('path');
const dist = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('❌ dist/index.html not found — run npm run build first');
  process.exit(1);
}
console.log('✅ Web assets ready');
