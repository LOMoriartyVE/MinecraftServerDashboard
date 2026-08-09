const fs = require('fs');
const path = require('path');

const targetRouteFile = path.resolve(__dirname, 'src/app/api/proxy/route.js');

if (fs.existsSync(targetRouteFile)) {
    try {
        fs.unlinkSync(targetRouteFile);
        console.log('Successfully deleted conflicting route.js file');
    } catch (e) {
        console.error('Error deleting file:', e.message);
    }
} else {
    console.log('route.js already removed');
}
