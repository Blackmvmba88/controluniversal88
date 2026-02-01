const fs = require('fs');

function testIndexContainsModal() {
  // modal for guided calibration lives in monitor.html (lightweight UI)
  const html = fs.readFileSync('./web/monitor.html', 'utf8');
  if (!html.includes('id="cal-modal"')) throw new Error('modal markup missing');
  if (!html.includes('id="cal-guided"')) throw new Error('guided button missing');
  if (!html.includes('aria-modal="true"')) throw new Error('modal should include aria-modal');
  if (!html.includes('aria-labelledby="modal-title"'))
    throw new Error('modal should include aria-labelledby');
  if (!html.includes('data-action="accept"'))
    throw new Error('modal accept button should have data-action');
}

module.exports = { testIndexContainsModal };
