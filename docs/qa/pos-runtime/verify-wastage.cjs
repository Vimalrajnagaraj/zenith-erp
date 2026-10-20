// Real service/HTTP writes, with independent SELECT-only assertions on a disposable database.
const path=require('node:path');
module.exports=async function({a,foreign,base,check,q,invoke,post,out}) {
 const productId='POS_QA_A_WASTE',facilityId='POS_QA_A_FAC';
 const stock=(id=productId,fac=facilityId)=>Number(q(`SELECT coalesce(sum(quantity_on_hand_total),0) AS n FROM asset WHERE product_id='${id}' AND facility_id='${fac}'`)[0].n);
 const count=()=>Number(q(`SELECT count(*) AS n FROM pos_stock_wastage WHERE product_id='${productId}'`)[0].n);
 const params={productId,facilityId,quantity:'2.5',unitCost:'10',wastageReason:'WrDamage',requestId:'POS_QA_WASTE_PARTIAL'};
 check('wastage starts with isolated shop stock',stock()===100&&stock(productId,'POS_QA_A_FAC2')===50);
 for(const quantity of ['0','-1','101','garbage'])await invoke('wastage',{...params,quantity,requestId:'POS_QA_INVALID_'+quantity},true);
 await invoke('wastage',{...params,productId:'POS_QA_B_P18'},true);
 await invoke('wastage',{...params,facilityId:'POS_QA_B_FAC'},true);
 await invoke('wastage',{...params},true,foreign);
 await invoke('wastage',{...params,wastageReason:'bad'},true);
 await invoke('wastage',{...params,batchNumber:'QA_LOT2',quantity:'41'},true);
 check('all rejected wastage requests leave stock and loss ledger unchanged',stock()===100&&count()===0);
 const recorded=await invoke('wastage',params);
 let row=q(`SELECT * FROM pos_stock_wastage WHERE wastage_id='${recorded.wastageId}'`)[0];
 check('partial wastage persists canonical identity, shop, actor and exact loss',row.product_name==='Synthetic wastage item'&&row.product_id===productId&&row.facility_id===facilityId&&row.entered_by_party_id==='POS_QA_MANAGER'&&Number(row.total_loss)===25&&stock()===97.5);
 await invoke('wastage',params);
 await invoke('wastage',{...params,quantity:'3'},true);
 check('retries cannot duplicate or change a posted wastage',count()===1&&stock()===97.5);
 const expired=await post('Wastage/WastageEntry','recordExpiredWastage',{...params,quantity:'1',requestId:'POS_QA_EXPIRED'});
 check('expired helper reports committed stock movement',expired.status()===200&&(await expired.json()).success&&stock()===96.5&&count()===2);
 const rejected=await post('Wastage/WastageEntry','recordExpiredWastage',{...params,quantity:'100',requestId:'POS_QA_EXPIRED_REJECT'});
 check('expired helper cannot claim success on rejected stock',!(await rejected.json()).success&&stock()===96.5&&count()===2);
 await post('Wastage/WastageEntry','deleteWastage',{wastageId:recorded.wastageId});
 check('posted stock audit record cannot be silently deleted',count()===2&&stock()===96.5);
 // Different requests race for the same ten units: only one seven-unit write may commit.
 const concurrent=await Promise.all(['ONE','TWO'].map(suffix=>post('PosQaAcceptance','invoke',{op:'wastage',...params,productId:'POS_QA_A_WASTE_RACE',quantity:'7',requestId:'POS_QA_RACE_'+suffix})));
 const replies=await Promise.all(concurrent.map(r=>r.json()));
 check('concurrent wastage cannot oversell the shop',replies.filter(r=>!r.errors?.length).length===1&&stock('POS_QA_A_WASTE_RACE')===3);
 await invoke('wastage',{...params,quantity:'96.5',requestId:'POS_QA_EXACT'});
 check('exact remaining stock can be written off once',stock()===0&&count()===3&&stock(productId,'POS_QA_A_FAC2')===50);
 await invoke('wastage',{...params,quantity:'1',requestId:'POS_QA_EMPTY'},true);
 const movement=q(`SELECT sum(quantity_on_hand_diff) AS n FROM asset_detail WHERE product_id='${productId}' AND description LIKE 'POS wastage %'`)[0];
 check('stock movement ledger matches total recorded quantity exactly',Number(movement.n)===-100);
 const helper='POS_QA_A_WASTE_HELPER';
 const manual=await post('Wastage/WastageEntry','createWastage',{...params,productId:helper,productName:'Forged name ignored',quantity:'1',requestId:'POS_QA_MANUAL'});
 check('manual form uses the same atomic stock service and canonical name',manual.status()<400&&stock(helper)===9&&q("SELECT product_name FROM pos_stock_wastage WHERE request_id='POS_QA_MANUAL'")[0].product_name==='Synthetic expired stock');
 for(const shell of ['apps','qapps']){
  const page=await a.c.newPage();await page.goto(`${base}/${shell}/zenith/pos/Wastage/WastageEntry`);
  await page.getByText('Record Stock Wastage',{exact:true}).waitFor();
  check(`${shell} wastage shows product identity and location selector`,(await page.locator('body').innerText()).includes('Synthetic wastage item')&&(await page.locator('body').innerText()).includes('Shop / stock location *'));
  const root=page.locator('#wastage-expiring-root');await root.locator('.wexp-btn').first().waitFor();
  await root.locator('tr').filter({hasText:'Synthetic expired stock'}).getByRole('button',{name:'Record Wastage',exact:true}).click();
  await page.locator('#wexp-shop').selectOption(facilityId);await page.locator('#wexp-qty').fill('0.5');
  const response=page.waitForResponse(r=>r.url().includes('/recordExpiredWastage'));
  await page.locator('#wexp-confirm').click();
  check(`${shell} expired-stock button commits a real fractional write-off`,(await (await response).json()).success&&stock(helper)===(shell==='apps'?8.5:8));
  await page.waitForLoadState('networkidle');
  await page.screenshot({path:path.join(out,`${shell}-wastage-verified.png`),fullPage:true});await page.close();
 }
};
