(function(){
  const { useState, useEffect } = React;
  function App(){
    const [active, setActive] = useState({});
    useEffect(()=>{
      const ws = new WebSocket((location.protocol==='https:'?'wss':'ws')+'://'+location.host);
      ws.onmessage = (m)=>{
        try{ const msg = JSON.parse(m.data); if (msg.type==='button'){ setActive(a=>({ ...a, [msg.id]: msg.value===1 })); } }
        catch(e){ console.error(e); }
      };
      return ()=> ws.close();
    },[]);

    const make = (id, cx, cy, r=18) => React.createElement('circle',{ key:id, id, cx, cy, r, className: 'btn ' + (active[id] ? 'active' : '') });
    return React.createElement('div',{style:{padding:20}},[
      React.createElement('h1',{key:'h1'},'DualShock 4 — React UI'),
      React.createElement('svg',{key:'sv', viewBox:'0 0 600 300', width:'100%'},[
        make('triangle',450,80), make('circle',485,110), make('cross',415,110), make('square',450,140),
        React.createElement('rect',{ key:'r1', id:'l1', className:'btn '+(active['l1']?'active':''), x:90, y:20, width:120, height:16, rx:6 }),
        React.createElement('rect',{ key:'r2', id:'r1', className:'btn '+(active['r1']?'active':''), x:390, y:20, width:120, height:16, rx:6 }),
        React.createElement('rect',{ key:'s', id:'share', className:'btn '+(active['share']?'active':''), x:260, y:90, width:24, height:18, rx:3 }),
        React.createElement('circle',{ key:'ps', id:'ps', className:'btn '+(active['ps']?'active':''), cx:295, cy:140, r:16 }),
        React.createElement('rect',{ key:'dup', id:'dpad_up', className:'btn '+(active['dpad_up']?'active':''), x:120, y:70, width:30, height:30 }),
        React.createElement('rect',{ key:'dleft', id:'dpad_left', className:'btn '+(active['dpad_left']?'active':''), x:90, y:100, width:30, height:30 }),
        React.createElement('rect',{ key:'dright', id:'dpad_right', className:'btn '+(active['dpad_right']?'active':''), x:150, y:100, width:30, height:30 }),
        React.createElement('rect',{ key:'ddown', id:'dpad_down', className:'btn '+(active['dpad_down']?'active':''), x:120, y:130, width:30, height:30 })
      ])
    ]);
  }
  ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
})();
