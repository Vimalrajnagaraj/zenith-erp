const openAudit=require('./client.cjs');
(async()=>{
 const x=await openAudit(),{a,q,quote,check}=x;
 try{
  const code='AUDITCURRENCY'+Date.now();
  const expected=q("SELECT setting_value FROM company_settings WHERE organization_party_id='AUDIT_QA_A' AND setting_key='CURRENCY_UOM_ID'")[0].setting_value;
  await a.post('subscriptions/Plans/createPlan',{planName:'Disposable currency test',planCode:code,billingFrequency:'BfMonthly',billingAmount:'9.95',taxRate:'0',trialDays:'0'});
  const plan=q(`SELECT * FROM subscription_plan WHERE plan_code=${quote(code)} AND organization_party_id='AUDIT_QA_A'`)[0];
  check('Plan form without a currency field uses the configured company currency',plan?.currency_uom_id===expected,{expected,stored:plan?.currency_uom_id});
  if(plan){
   const created=await a.invoke('subscription.create',{customerPartyId:'AUDIT_QA_CUST_A',planId:plan.plan_id});const id=created.result?.subscriptionId;
   check('New subscription retains configured company currency',id&&q(`SELECT currency_uom_id FROM zenith_subscription WHERE subscription_id=${quote(id)}`)[0]?.currency_uom_id===expected);
   if(id){const invoice=await a.invoke('subscription.invoice',{subscriptionId:id});check('Generated subscription invoice retains company currency',invoice.result?.subInvoiceId&&q(`SELECT currency_uom_id FROM subscription_invoice WHERE sub_invoice_id=${quote(invoice.result.subInvoiceId)}`)[0]?.currency_uom_id===expected);}
  }
 }finally{await x.finish('plan-currency-'+(process.env.AUDIT_QA_MODE||'baseline')+'.json');}
})().catch(e=>{console.error(e);process.exitCode=1;});
