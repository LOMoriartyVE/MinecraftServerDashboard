const fs = require('fs');
const path = require('path');
const fp = path.resolve(__dirname, 'src/app/api/proxy/route.js');
if (fs.existsSync(fp)) {
    fs.unlinkSync(fp);
    console.log('Successfully deleted route.js');
}
