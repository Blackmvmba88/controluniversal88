const fs = require('fs');
const path = require('path');

function saveMappingWithBackup(mappingObj, outPath = path.join(process.cwd(), '.ds4map.json')){
  try{
    if (fs.existsSync(outPath)){
      const bak = outPath + '.bak.' + Date.now();
      fs.copyFileSync(outPath, bak);
    }
  } catch(e){/* ignore */}
  fs.writeFileSync(outPath, JSON.stringify(mappingObj, null, 2));
  return outPath;
}

module.exports = { saveMappingWithBackup };
