const assert = require('node:assert/strict');
const {parse} = require('csv-parse/sync');
(async () => {
 const base = process.env.RECEIPT_ROOM_URL || 'http://localhost:8091';
 async function json(path, options = {}) { const r = await fetch(base + path, options); assert.equal(r.status, 200, path); const d = await r.json(); assert.equal(d.success, true); return d.data; }
 const home = await fetch(base); assert.equal(home.status,200); const html = await home.text();
 for (const asset of [...html.matchAll(/(?:src|href)="([^"]+\/assets\/[^"]+|\/assets\/[^"]+)"/g)].map(m=>m[1])) assert.equal((await fetch(base+asset)).status,200,asset);
 assert.equal((await fetch(base+'/api/transactions')).status,401);
 const demo = await json('/api/demo',{method:'POST'});
 const headers={'X-Session-Id':demo.sessionId,'Content-Type':'application/json'};
 const txs=await json('/api/transactions',{headers});
 assert.equal(txs.length,demo.transactionCount);
 for(let i=0;i<txs.length;i++){
   const category=i===0?'Other':txs[i].suggestedCategory;
   const updated=await json('/api/review',{method:'POST',headers,body:JSON.stringify({transactionId:txs[i].id,category})});
   assert.equal(updated.reviewed,true);assert.equal(updated.confirmedCategory,category);
 }
 const progress=await json('/api/progress',{headers});assert.equal(progress.percentComplete,100);assert.equal(progress.reviewedCount,txs.length);
 const summary=await json('/api/summary',{headers});assert.equal(summary.unreviewed,0);
 const exported=await fetch(base+'/api/export/csv',{headers});assert.equal(exported.status,200);
 const rows=parse(await exported.text(),{columns:true,skip_empty_lines:true});
 assert.equal(rows.length,txs.length);
 rows.forEach((row,i)=>{assert.equal(row.Review_Status,'Reviewed');assert.equal(row.Reviewed_Category,i===0?'Other':txs[i].suggestedCategory);});
 const report=await fetch(base+'/api/export/summary',{headers});assert.equal(report.status,200);
 console.log(JSON.stringify({homepage:'200',assets:'200',sessionProtection:'401 without session',demoTransactions:txs.length,confirmedReviews:progress.reviewedCount,completion:progress.percentComplete,csvRows:rows.length,csvDecisions:'all match submitted categories',summary:'200'},null,2));
})().catch(e=>{console.error(e);process.exit(1)});
