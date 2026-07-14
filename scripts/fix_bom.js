const fs = require('fs');
const files = [
  'supabase/migrations/20240101000000_init.sql',
  'supabase/migrations/20240101000001_security_fixes.sql'
];
for(const file of files) {
  if (fs.existsSync(file)) {
    let buf = fs.readFileSync(file);
    if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
      fs.writeFileSync(file, buf.slice(3));
      console.log('Fixed BOM for', file);
    } else {
      console.log('No BOM for', file);
    }
  }
}
