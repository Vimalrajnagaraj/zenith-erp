// Exercise the new billing boundary and concurrent invoice guard, using actual transactions.
const openAudit=require('./client.cjs');
(async()=>{const x=await openAudit(),{a,admin,q,quote,check}=x;try{
 const before=JSON.stringify(q('SELECT * FROM subscription_invoice ORDER BY sub_invoice_id'));
 const denied=await a.invoke('subscription.due',{organizationPartyId:'AUDIT_QA_A'});
 check('Non-platform caller cannot execute recurring billing',denied.errors.length>0&&JSON.stringify(q('SELECT * FROM subscription_invoice ORDER BY sub_invoice_id'))===before);
 const allowed=await admin.invoke('subscription.due',{organizationPartyId:'AUDIT_QA_A'});
 check('Authenticated platform billing can process an organization with no due periods',!allowed.errors.length&&Number(allowed.result.billedCount)===0,{errors:allowed.errors,result:allowed.result});
 const created=await a.invoke('subscription.create',{customerPartyId:'AUDIT_QA_CUST_A',planId:'AUDIT_QA_PLAN_ZERO'}),id=created.result.subscriptionId;
 check('Concurrency fixture is created by the owned subscription workflow',!!id&&!created.errors.length);
 if(id){const responses=await Promise.all([a.invoke('subscription.invoice',{subscriptionId:id}),a.invoke('subscription.invoice',{subscriptionId:id})]);
 check('Concurrent invoice requests return the same invoice identifier',responses.every(r=>!r.errors.length)&&responses[0].result.subInvoiceId===responses[1].result.subInvoiceId,{responses});
 check('Independent SQL confirms exactly one invoice for that period',Number(q(`SELECT count(*) n FROM subscription_invoice WHERE subscription_id=${quote(id)}`)[0].n)===1);}
 }catch(e){check('Billing guard verifier completes',false,{error:e.stack});}finally{await x.finish('billing-guards.json')}})().catch(e=>{console.error(e);process.exitCode=1});
