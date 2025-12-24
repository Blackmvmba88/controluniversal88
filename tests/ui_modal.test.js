const fs = require('fs');

function testIndexContainsModal() {
  const html = fs.readFileSync('./web/index.html','utf8');
  if (!html.includes('id="cal-modal"')) throw new Error('modal markup missing');
  if (!html.includes('id="cal-guided"')) throw new Error('guided button missing');
  if (!html.includes('aria-modal="true"')) throw new Error('modal should include aria-modal');
  if (!html.includes('aria-labelledby="modal-title"')) throw new Error('modal should include aria-labelledby');
  if (!html.includes('data-action="accept"')) throw new Error('modal accept button should have data-action');
}

module.exports = { testIndexContainsModal };
