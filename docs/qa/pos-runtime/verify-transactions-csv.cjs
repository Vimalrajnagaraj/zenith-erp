// Parse and compare the actual standalone export with the disposable ledger.
const assert=require('node:assert/strict');
function csv(text) {
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++) {
  const ch=text[i];
  if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
  else if(ch===','&&!quoted){row.push(cell);cell='';}
  else if(ch==='\n'&&!quoted){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}
  else cell+=ch;
 }
 if(cell||row.length){row.push(cell.replace(/\r$/,''));rows.push(row);}
 assert(!quoted,'CSV has an unmatched quote');
 return rows.filter(row=>row.some(Boolean));
}
module.exports=async function({a,foreign,base,check,q,invoke}) {
 const session=await invoke('open',{terminalId:'POS_QA_A_TERM2',openingCash:'100'});
 const cart=await invoke('cart',{sessionId:session.sessionId,customerName:'POS QA, "CSV" customer'});
 await invoke('add',{transactionId:cart.transactionId,productId:'POS_QA_A_P18',quantity:'1'});
 await invoke('pay',{transactionId:cart.transactionId,paymentMethod:'Cash',amount:'118'});
 await invoke('complete',{transactionId:cart.transactionId});
 const ledger=q(`SELECT transaction_id,total_tax_amount,payable_amount,customer_name FROM pos_transaction WHERE transaction_id='${cart.transactionId}'`)[0];
 const snapshot=JSON.stringify(ledger);
 for(const shell of ['apps','qapps']) {
  const params=new URLSearchParams({renderMode:'csv',saveFilename:'AllTxnList.csv',pageNoLimit:'true',lastStandalone:'true'});
  const url=`${base}/${shell}/zenith/pos/PosTransactions?${params}`;
  const response=await a.c.request.get(url),text=await response.text();
  check(`${shell} Transactions CSV returns data rather than template errors`,response.status()===200&&/csv/.test(response.headers()['content-type'])&&!/Template Error|Cannot invoke/.test(text));
  const rows=csv(text),headers=['ID','Txn Number','Type','Date','Terminal','Customer','Tax','Payable','Status'];
  check(`${shell} Transactions CSV begins with the expected headers`,JSON.stringify(rows[0])===JSON.stringify(headers),{headers:rows[0]});
  const record=rows.slice(1).find(row=>row[0]===cart.transactionId);
  check(`${shell} CSV preserves quoted customer text and numeric amounts`,record&&record[5]===ledger.customer_name&&Number(record[6].replaceAll(',',''))===Number(ledger.total_tax_amount)&&Number(record[7].replaceAll(',',''))===Number(ledger.payable_amount));
  const ownIds=new Set(q("SELECT transaction_id FROM pos_transaction WHERE organization_party_id='POS_QA_A'").map(row=>row.transaction_id));
  check(`${shell} CSV rows exactly match the selected organization`,rows.length-1===ownIds.size&&rows.slice(1).every(row=>ownIds.has(row[0])));
  const filtered=await a.c.request.get(url+'&transactionNumber='+encodeURIComponent(q(`SELECT transaction_number FROM pos_transaction WHERE transaction_id='${cart.transactionId}'`)[0].transaction_number)+'&transactionNumber_op=equals');
  const filteredRows=csv(await filtered.text());
  check(`${shell} CSV honors the transaction-number filter`,filteredRows.length===2&&filteredRows[1][0]===cart.transactionId);
  const empty=await a.c.request.get(url+'&transactionNumber=POS_QA_NO_SUCH_BILL&transactionNumber_op=equals');
  check(`${shell} empty CSV retains a valid header`,csv(await empty.text()).length===1);
  const other=await foreign.c.request.get(url),otherRows=csv(await other.text());
  const foreignIds=new Set(q("SELECT transaction_id FROM pos_transaction WHERE organization_party_id='POS_QA_B'").map(row=>row.transaction_id));
  check(`${shell} other organization export contains only its own rows`,otherRows.slice(1).every(row=>foreignIds.has(row[0]))&&!otherRows.slice(1).some(row=>row[0]===cart.transactionId));
 }
 check('CSV export leaves the saved transaction and amounts unchanged',JSON.stringify(q(`SELECT transaction_id,total_tax_amount,payable_amount,customer_name FROM pos_transaction WHERE transaction_id='${cart.transactionId}'`)[0])===snapshot);
 await invoke('close',{sessionId:session.sessionId,closingCash:'218'});
 const closed=q(`SELECT status_id,cash_difference FROM pos_session WHERE session_id='${session.sessionId}'`)[0];
 check('CSV fixture closes its till with reconciled cash',closed.status_id==='PsClosed'&&Number(closed.cash_difference)===0);
};
