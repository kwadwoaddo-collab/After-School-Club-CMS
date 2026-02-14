const fs = require('fs');
const path = require('path');
const envPath = path.resolve(__dirname, '.env.local');

console.log('Reading .env.local from:', envPath);

try {
    const content = fs.readFileSync(envPath, 'utf8');
    console.log('Raw content length:', content.length);

    const lines = content.split('\n');
    lines.forEach((line, i) => {
        if (line.startsWith('AUTH_GOOGLE_ID')) {
            console.log(`Line ${i + 1}:`, line);
            console.log('Value length:', line.split('=')[1].trim().length);
        }
        if (line.startsWith('AUTH_GOOGLE_SECRET')) {
            console.log(`Line ${i + 1}:`, line);
        }
    });

} catch (err) {
    console.error('Error reading file:', err);
}
