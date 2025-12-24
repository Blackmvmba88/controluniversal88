(function(){
  async function saveMapping(){
    try{
      const r = await fetch('/api/collect/status');
      const job = await r.json();
      if (!job || !job.result) { alert('No mapping to save'); return; }
      const confirmSave = confirm('Save inferred mapping to .ds4map.json? This will create a backup of the previous mapping.');
      if (!confirmSave) return;
      await fetch('/api/save-map', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(job.result) });
      alert('Mapping saved');
    } catch(e){ alert('Failed to save mapping: '+e); }
  }
  // expose global helper
  window.saveInferredMapping = saveMapping;
})();