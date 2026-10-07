// A run sheet for SOP-04's case IDs. A passing HTTP response alone is not
// accepted as functional evidence; entries refer to persisted-state/UI checks.
const fs=require('fs'),path=require('path');
const baseline={
 'SL-001':['SalesDashboard renders'],
 'SL-016':['quote converts to order'],
 'SL-022':['converted order is linked to invoice','quote-to-order-to-invoice retains line discount'],
 'SL-023':['competing order conversion retries keep one billing link'],
 'SL-031':['backdated invoice financial year 2026-01-15','backdated invoice financial year 2026-04-01'],
 'SL-032':['discounted intra-state invoice golden'],
 'SL-033':['discounted intra-state invoice golden','credit note decimal GST'],
 'SL-035':['deleting another item preserves discount and GST'],
 'SL-042':['discounted intra-state invoice golden','full discount stores authoritative zero'],
 'SL-046':['EditInvoice invalid input persists no line'],
 'SL-050':['SOP invoice InvoiceSent persists','SOP invoice InvoiceAcked persists'],
 'SL-051':['issued invoice survives addItem','issued invoice survives deleteItem','issued invoice survives updateItem','issued invoice survives updateInvoice'],
 'SL-052':['manual duplicate invoice number rejected'],
 'SL-073':['challan conversion produces linked invoice','challan goods tax golden','challan reconversion is idempotent'],
 'SL-080':['payment links use tax-inclusive total and distinct IDs'],
 'SL-081':['UPI amount includes GST and encoded merchant'],
 'SL-082':['payment callback settles once and late failure stays paid','cash settles remaining tax-inclusive balance once'],
 'SL-087':['claim is rejected','warranty claim returns real primary key'],
 'SL-091':['OrderPrint generates a PDF','CreditNotePrint generates a PDF','ChallanPrint generates a PDF'],
 'SL-104':['missing CSRF token denied'],
 'ISO-005':['WarrantyPolicies denies forged/no active organization','Commissions denies forged/no active organization','foreign commission and slabs are unchanged','forecast is rejected'],
 'XF-004':['challan conversion produces linked invoice','challan goods tax golden']
};
module.exports=function(report,scenarios,out){
 const source=fs.readFileSync(path.join(__dirname,'../SOP-04-Sales.md'),'utf8');
 const cases=[];
 for(const line of source.split(/\r?\n/)){
  const match=line.match(/^\| ((?:SL|ISO|XF)-\d{3}) \| ([^|]+) \| ([^|]+) \|/);if(!match)continue;
  const [_,id,type,title]=match;if(cases.some(x=>x.id===id))continue;
  const evidence=scenarios.filter(x=>x.ids.includes(id));
  const required=(baseline[id]||[]).map(text=>({required:text,matches:report.checks.filter(c=>c.name.includes(text))}));
  const found=required.every(x=>x.matches.length>0&&x.matches.every(c=>c.passed));
  const passed=(evidence.length>0||required.length>0)&&found&&evidence.every(x=>x.passed);
  const notes=[];
  if(id==='SL-017'||id==='SL-025')notes.push('Master intentionally retains cancelled quotations/orders for audit, unlike the older SOP status description. Status/search behavior is verified without deleting that history.');
  if(id==='SL-045')notes.push('Current master uses a local CGST/SGST fallback for missing buyer state, while the SOP describes IGST. Explicit place-of-supply retaxing is verified; senior confirmation of fallback policy is required.');
  cases.push({id,type:type.trim(),title:title.trim(),status:passed?(notes.length?'verified-with-deviation':'passed'):'unverified-or-failed',scenarios:evidence.map(x=>({name:x.name,passed:x.passed,error:x.error})),checks:required.map(x=>({required:x.required,names:x.matches.map(c=>c.name)})),notes});
 }
 const summary={total:cases.length,passed:cases.filter(x=>x.status==='passed').length,deviations:cases.filter(x=>x.status==='verified-with-deviation').length,unverified:cases.filter(x=>x.status==='unverified-or-failed').map(x=>x.id)};
 fs.writeFileSync(path.join(out,'sop-run-sheet.json'),JSON.stringify({source:'docs/qa/SOP-04-Sales.md',productionWrites:false,summary,cases},null,2));
 report.sopCoverage=summary;
 return summary;
};
