(() => {
  const tables=[...document.querySelectorAll('.budget-table')]; if(!tables.length)return;
  const key=`the-budget:${location.pathname}:v3`;
  const fmt=new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',minimumFractionDigits:2,maximumFractionDigits:2});
  const pct=v=>`${v.toFixed(1)}%`;
  const num=v=>{const n=Number(String(v).replace(/[^0-9.-]/g,''));return Number.isFinite(n)?n:0};
  const style=document.createElement('style');style.textContent=`
    .edit-notice{display:flex;justify-content:space-between;align-items:center;gap:18px;margin:18px 0;padding:16px 18px;border:1px solid rgba(84,225,207,.22);background:rgba(84,225,207,.07);border-radius:16px;color:#dce8ee}.edit-notice strong{display:block;color:#54e1cf;margin-bottom:4px}.edit-notice span{display:block;color:#98a8ba;font-size:12px}.reset-budget{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#dce8ee;padding:9px 12px;border-radius:10px;cursor:pointer;white-space:nowrap}.editable-cell{cursor:text;outline:none}.editable-cell:hover{background:rgba(108,185,255,.08)}.editable-cell:focus{background:rgba(108,185,255,.13);box-shadow:inset 0 0 0 1px rgba(108,185,255,.45)}.editable-money{font-weight:800;color:#6cb9ff}.calculated-row td{opacity:.86}.allocation-status{margin-top:12px;padding:12px 14px;border-radius:12px;font-size:12px}.allocation-status.balanced{background:rgba(92,225,154,.08);border:1px solid rgba(92,225,154,.22);color:#b9efd1}.allocation-status.unbalanced{background:rgba(255,199,100,.08);border:1px solid rgba(255,199,100,.22);color:#f3dca8}.allocation-chart{margin-top:18px;padding:22px;border:1px solid rgba(255,255,255,.09);border-radius:22px;background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.02))}.allocation-chart h2{margin:0 0 5px;font-size:18px}.allocation-chart .chart-sub{color:#98a8ba;font-size:12px;margin-bottom:18px}.allocation-chart-grid{display:grid;grid-template-columns:minmax(260px,.85fr) 1.15fr;gap:26px;align-items:center}.allocation-donut{width:min(100%,360px);aspect-ratio:1;margin:auto}.allocation-donut svg{width:100%;height:100%;display:block}.allocation-legend{display:grid;gap:10px}.allocation-legend-row{display:grid;grid-template-columns:12px 1fr auto;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.05)}.allocation-dot{width:10px;height:10px;border-radius:50%}.allocation-legend-name{font-size:13px;color:#dce5ef}.allocation-legend-value{text-align:right}.allocation-legend-value b{display:block;font-size:13px}.allocation-legend-value span{display:block;color:#8294a7;font-size:11px;margin-top:2px}.allocation-negative{margin-top:14px;padding:11px 13px;border-radius:12px;background:rgba(255,119,133,.08);border:1px solid rgba(255,119,133,.18);color:#ffc2c9;font-size:12px}.allocation-center-main{font-size:11px;fill:#98a8ba}.allocation-center-value{font-size:16px;font-weight:800;fill:#f6f8fb}@media(max-width:760px){.allocation-chart-grid{grid-template-columns:1fr}.allocation-donut{max-width:290px}}@media(max-width:620px){.edit-notice{align-items:flex-start;flex-direction:column}}
  `;document.head.appendChild(style);
  const set=(row,a)=>{if(!row||row.cells.length<5)return;[a,a/12,a/26,a/52].forEach((v,i)=>{const c=row.cells[i+1];c.textContent=fmt.format(v);c.classList.toggle('negative',v<0);c.classList.toggle('positive',v>=0&&row.classList.contains('total-row'))})};
  const editable=t=>[...t.tBodies[0].rows].filter(r=>!r.classList.contains('total-row'));
  const find=(t,label)=>[...t.tBodies[0].rows].find(r=>r.cells[0]?.textContent.trim()===label);
  const save=()=>localStorage.setItem(key,JSON.stringify(tables.map(t=>editable(t).map(r=>({name:r.cells[0].textContent.trim(),annual:num(r.cells[1].textContent)})))));
  const load=()=>{try{const s=JSON.parse(localStorage.getItem(key)||'null');if(!Array.isArray(s))return;tables.forEach((t,ti)=>editable(t).forEach((r,ri)=>{const x=s[ti]?.[ri];if(x){r.cells[0].textContent=x.name;set(r,+x.annual||0)}}))}catch(e){}};

  if(tables[2] && !find(tables[2],'Total Allocation')){
    const tr=document.createElement('tr');tr.className='total-row calculated-row';tr.innerHTML='<td>Total Allocation</td><td>$0.00</td><td>$0.00</td><td>$0.00</td><td>$0.00</td>';tables[2].tBodies[0].appendChild(tr);
    const status=document.createElement('div');status.className='allocation-status';status.id='allocation-status';tables[2].closest('.card')?.appendChild(status);
  }

  let chartWrap=null;
  if(tables[2]){
    chartWrap=document.createElement('section');
    chartWrap.className='allocation-chart';
    chartWrap.innerHTML='<h2>Account Allocation</h2><div class="chart-sub">Percentage of annual net income allocated to each account.</div><div class="allocation-chart-grid"><div class="allocation-donut" id="allocation-donut"></div><div><div class="allocation-legend" id="allocation-legend"></div><div id="allocation-negative"></div></div></div>';
    tables[2].closest('.card')?.after(chartWrap);
  }

  const colors=['#6cb9ff','#54e1cf','#ffc764','#b99cff','#5ce19a','#ff9f6e','#ff7785'];
  const polar=(cx,cy,r,a)=>{const rad=(a-90)*Math.PI/180;return {x:cx+r*Math.cos(rad),y:cy+r*Math.sin(rad)}};
  const arcPath=(cx,cy,r,start,end)=>{const s=polar(cx,cy,r,end),e=polar(cx,cy,r,start),large=end-start<=180?'0':'1';return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y}`};
  const updateChart=(net)=>{
    if(!tables[2]||!chartWrap)return;
    const rows=editable(tables[2]).map(r=>({name:r.cells[0].textContent.trim(),value:num(r.cells[1].textContent)}));
    const positive=rows.filter(x=>x.value>0);
    const negative=rows.filter(x=>x.value<0);
    const positiveTotal=positive.reduce((s,x)=>s+x.value,0);
    let angle=0;
    const arcs=positive.map((x,i)=>{const sweep=positiveTotal?x.value/positiveTotal*360:0;const gap=positive.length>1?1.4:0;const start=angle+gap/2,end=angle+sweep-gap/2;angle+=sweep;return `<path d="${arcPath(100,100,72,start,end)}" fill="none" stroke="${colors[i%colors.length]}" stroke-width="34" stroke-linecap="butt"><title>${x.name}: ${fmt.format(x.value)} (${net?pct(x.value/net*100):'0.0%'})</title></path>`}).join('');
    document.getElementById('allocation-donut').innerHTML=`<svg viewBox="0 0 200 200" role="img" aria-label="Account allocation pie chart"><circle cx="100" cy="100" r="72" fill="none" stroke="rgba(255,255,255,.05)" stroke-width="34"/>${arcs}<text x="100" y="94" text-anchor="middle" class="allocation-center-main">NET INCOME</text><text x="100" y="116" text-anchor="middle" class="allocation-center-value">${fmt.format(net).replace('.00','')}</text></svg>`;
    document.getElementById('allocation-legend').innerHTML=rows.map((x,i)=>`<div class="allocation-legend-row"><span class="allocation-dot" style="background:${x.value<0?'#ff7785':colors[positive.findIndex(p=>p.name===x.name)%colors.length]}"></span><div class="allocation-legend-name">${x.name}</div><div class="allocation-legend-value"><b class="${x.value<0?'negative':''}">${net?pct(x.value/net*100):'0.0%'}</b><span>${fmt.format(x.value)}</span></div></div>`).join('');
    const neg=document.getElementById('allocation-negative');
    neg.innerHTML=negative.length?`<div class="allocation-negative">${negative.map(x=>`${x.name} is ${pct(x.value/net*100)} of net income (${fmt.format(x.value)}). Negative allocations are shown in the legend but are not drawn as pie slices.`).join(' ')}</div>`:'';
  };

  load();
  const calc=()=>{
    if(tables.length<2)return;
    const incomeRows=editable(tables[0]);
    const spendingRows=editable(tables[1]);
    const net=incomeRows.reduce((s,r)=>s+num(r.cells[1].textContent),0);
    const out=spendingRows.reduce((s,r)=>s+num(r.cells[1].textContent),0);
    const sav=net-out;
    set(find(tables[0],'Net Income'),net);set(find(tables[1],'Total Outgoing'),out);set(find(tables[1],'Savings'),sav);
    if(tables[2]){
      const valueOf=label=>num(find(tables[1],label)?.cells[1]?.textContent||0);
      const foodFuel=valueOf('Fuel')+valueOf('Groceries');
      const splurge=valueOf('Splurge');
      const home=valueOf('Home Loan Repayment');
      const hb=valueOf('HB Tax Income + Shortfall');
      const bills=out-foodFuel-splurge-home-hb;
      set(find(tables[2],'Food and Fuel'),foodFuel);
      set(find(tables[2],'Bills'),bills);
      set(find(tables[2],'Savings'),sav);
      set(find(tables[2],'Splurge'),splurge);
      set(find(tables[2],'Home Loan Repayment'),home);
      set(find(tables[2],'HB Tax Income + Shortfall'),hb);
      const allocationTotal=foodFuel+bills+sav+splurge+home+hb;
      set(find(tables[2],'Total Allocation'),allocationTotal);
      const diff=net-allocationTotal;
      const status=document.getElementById('allocation-status');
      if(status){const balanced=Math.abs(diff)<0.01;status.className=`allocation-status ${balanced?'balanced':'unbalanced'}`;status.textContent=balanced?`Balanced: account allocations equal NET income (${fmt.format(net)} annually). Splurge is separate from Bills.`:`${diff>0?'Unallocated':'Over-allocated'} versus NET income: ${fmt.format(Math.abs(diff))} annually (${fmt.format(Math.abs(diff)/26)} per fortnight).`;}
      updateChart(net);
    }
    [sav,sav/12,sav/26,sav/52].forEach((v,i)=>{const el=document.querySelectorAll('.hero .kpi .value')[i];if(el){el.textContent=fmt.format(v);el.classList.toggle('negative',v<0);el.classList.toggle('positive',v>=0)}});
  };

  tables.forEach((t,ti)=>editable(t).forEach(r=>{
    const n=r.cells[0],a=r.cells[1];
    if(ti===2){r.classList.add('calculated-row');return;}
    n.contentEditable='true';a.contentEditable='true';n.classList.add('editable-cell');a.classList.add('editable-cell','editable-money');n.title='Click to edit item name';a.title='Click to edit annual amount';n.addEventListener('input',save);a.addEventListener('focus',()=>{a.textContent=String(num(a.textContent));const rg=document.createRange();rg.selectNodeContents(a);const s=window.getSelection();s.removeAllRanges();s.addRange(rg)});a.addEventListener('input',()=>{const v=num(a.textContent);r.cells[2].textContent=fmt.format(v/12);r.cells[3].textContent=fmt.format(v/26);r.cells[4].textContent=fmt.format(v/52);calc();save()});a.addEventListener('blur',()=>{set(r,num(a.textContent));calc();save()});a.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();a.blur()}})
  }));
  const note=document.createElement('div');note.className='edit-notice';note.innerHTML='<div><strong>Editable budget</strong><span>Edit item names or Annual amounts in Income and Household Spending. Account Allocation updates automatically: Food + Fuel, Bills, Savings, Splurge, Home Loan and HB are kept as separate buckets.</span></div><button class="reset-budget" type="button">Reset edits</button>';document.querySelector('.budget-card')?.before(note);note.querySelector('button').addEventListener('click',()=>{localStorage.removeItem(key);location.reload()});
  calc();save();
})();