const fs = require('fs');
const path = require('path');
const utils = require('../server/auto_map_utils');

function testSaveMappingCreatesBackup() {
  const tmpPath = path.join(process.cwd(), '.ds4map.test.json');
  // ensure a file exists
  fs.writeFileSync(tmpPath, JSON.stringify({ old: true }));
  // call save with backup
  utils.saveMappingWithBackup({ buttons: { x: [0,1] } }, tmpPath);
  // check there is a backup file
  const bak = fs.readdirSync(process.cwd()).find(f => f.startsWith('.ds4map.test.json.bak'));
  if (!bak) throw new Error('Backup not created');
  const data = JSON.parse(fs.readFileSync(tmpPath,'utf8'));
  if (!data.buttons || !data.buttons.x) throw new Error('New mapping not saved');
  // cleanup
  fs.unlinkSync(tmpPath);
  try { fs.unlinkSync(bak); } catch(_){}
}

module.exports = { testSaveMappingCreatesBackup };
