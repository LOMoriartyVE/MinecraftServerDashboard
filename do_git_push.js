const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const websiteDir = path.resolve(__dirname);

// Delete conflicting route.js file if it exists
const conflictingFile = path.join(websiteDir, 'src/app/api/proxy/route.js');
if (fs.existsSync(conflictingFile)) {
    try {
        fs.unlinkSync(conflictingFile);
        console.log('Removed conflicting src/app/api/proxy/route.js');
    } catch (e) {}
}

try {
    console.log('Running git add -A...');
    execSync('git add -A', { cwd: websiteDir, stdio: 'inherit' });
    console.log('Running git commit...');
    execSync('git commit -m "Remove conflicting route.js and deploy optional catch-all proxy route"', { cwd: websiteDir, stdio: 'inherit' });
    console.log('Running git push...');
    execSync('git push -u origin main --force', { cwd: websiteDir, stdio: 'inherit' });
    console.log('Git push completed successfully!');
} catch (e) {
    console.log('Git push output:', e.message);
}
