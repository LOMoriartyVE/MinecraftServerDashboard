const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../../');
fs.readdirSync(rootDir).forEach(file => {
    if (file.endsWith('.py') || file.endsWith('.bat') || file.endsWith('.html')) {
        const fullPath = path.join(rootDir, file);
        try {
            fs.unlinkSync(fullPath);
            console.log(`Deleted: ${file}`);
        } catch(e) {}
    }
});
