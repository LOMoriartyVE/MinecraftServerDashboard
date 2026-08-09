const { execSync } = require('child_process');
const path = require('path');

const websiteDir = path.resolve(__dirname);

try {
    console.log('Running git add...');
    execSync('git add .', { cwd: websiteDir, stdio: 'inherit' });
    console.log('Running git commit...');
    execSync('git commit -m "Fix BlueMap Vercel iframe proxy and Cloudflare framing headers"', { cwd: websiteDir, stdio: 'inherit' });
    console.log('Running git push...');
    execSync('git push -u origin main --force', { cwd: websiteDir, stdio: 'inherit' });
    console.log('Git push completed successfully!');
} catch (e) {
    console.log('Git push output:', e.message);
}
