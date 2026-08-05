const fs = require('fs');
const path = require('path');

const modsDir = 'B:\\VS Code Projects\\MC_Server\\Servers\\Server1\\mods';

const filesToDisable = [
    'waystones-neoforge-26.2-26.2.0.7.jar',
    'Essential_1-4-0-3_neoforge_1-21-1.jar'
];

filesToDisable.forEach(fname => {
    const fullPath = path.join(modsDir, fname);
    if (fs.existsSync(fullPath)) {
        console.log(`Disabling incompatible mod: ${fname}`);
        fs.renameSync(fullPath, fullPath + '.disabled');
    }
});

console.log('Server1 mods cleaned successfully.');
