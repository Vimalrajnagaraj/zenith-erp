// Real HTTP/UI pricing saves on disposable fixtures; restore every changed price.
const path=require('node:path');
module.exports=async function({a,foreign,base,check,q,out}) {
 const originals={};
 const read=id=>Number(q(`SELECT mrp_amount FROM product WHERE product_id='${id}'`)[0].mrp_amount);
 const save=async(actor,id,price,shell='apps')=>actor.c.request.post(`${base}/${shell}/zenith/pos/ProductPricing/savePrices`,{form:{moquiSessionToken:actor.t,productId:id,modePricesJson:JSON.stringify({RETAIL:String(price)}),modeThresholdsJson:'{}'}});
 for(const id of ['POS_QA_A_P18','POS_QA_B_P18']) originals[id]=read(id);
 const page=await a.c.newPage();page.setDefaultTimeout(60000);
 let posts=0;page.on('request',r=>{if(r.method()==='POST'&&r.url().includes('/ProductPricing/savePrices'))posts++;});
 try {
  const other=await save(foreign,'POS_QA_B_P18',600);
  check('independent second-shop price saves',other.status()===200&&(await other.json()).success&&read('POS_QA_B_P18')===600);
  for(const shell of ['apps','qapps']) {
   await page.goto(`${base}/${shell}/zenith/pos/ProductPricing?modeIds=RETAIL&searchTerm=POS_QA_A_P18`);
   const root=page.locator('#posProductPricing'),row=root.locator('tr[data-pid="POS_QA_A_P18"]');
   await row.waitFor();await page.waitForFunction(()=>window.ZPosProductPricing===true);
   const input=row.locator('[data-mode-id=RETAIL]'),button=row.locator('.pp-save');
   await input.fill('500');const before=posts;
   const response=page.waitForResponse(r=>r.url().includes('/ProductPricing/savePrices'));
   await button.click();const result=await response;
   check(`${shell} Save returns real JSON with session token`,result.status()===200&&(await result.json()).success);
   await row.locator('.pp-save-message').getByText('Saved',{exact:true}).waitFor();
   check(`${shell} row Save posts once and commits only its shop price`,posts===before+1&&read('POS_QA_A_P18')===500&&read('POS_QA_B_P18')===600);
   await page.reload();await row.waitFor();
   check(`${shell} saved price survives refresh`,await input.inputValue()==='500');
   if(shell==='qapps')await page.locator('a[href*="/pos/SalesMode"]').first().click();
   else await page.goto(`${base}/${shell}/zenith/pos/SalesMode`);
   await page.locator('.smode-h1').waitFor();await page.waitForLoadState('networkidle');await page.goBack();await row.waitFor();
   check(`${shell} Back restores saved selected-mode price`,await input.inputValue()==='500'&&await root.locator('[data-mode-id=WHOLESALE]').count()===0);
   await page.goForward();await page.locator('.smode-h1').waitFor();await page.waitForLoadState('networkidle');await page.goBack();await row.waitFor();
   const historyPosts=posts;await input.fill('501');const second=page.waitForResponse(r=>r.url().includes('/ProductPricing/savePrices'));
   await button.click();check(`${shell} Save after Back/Forward succeeds`,(await (await second).json()).success&&read('POS_QA_A_P18')===501);
   await row.locator('.pp-save-message').getByText('Saved',{exact:true}).waitFor();
   check(`${shell} history navigation does not duplicate Save handlers`,posts===historyPosts+1);
   await input.fill('-1');const invalid=page.waitForResponse(r=>r.url().includes('/ProductPricing/savePrices'));
   await button.click();check(`${shell} invalid price has a controlled validation response`,(await (await invalid).json()).success===false&&read('POS_QA_A_P18')===501);
   await row.locator('.pp-save-message').filter({hasText:'non-negative'}).waitFor();
   const token=root.locator('[name=moquiSessionToken]');await token.evaluate(node=>{node.value='invalid-disposable-token';});
   const rejected=page.waitForResponse(r=>r.url().includes('/ProductPricing/savePrices'));
   await button.click();check(`${shell} invalid session token remains denied`,(await rejected).status()===401&&read('POS_QA_A_P18')===501);
   await row.locator('.pp-save-message').filter({hasText:'Refresh this page and check your permission'}).waitFor();
   await page.screenshot({path:path.join(out,`${shell}-pricing-session-message.png`),fullPage:true});
   await page.reload();await row.waitFor();
   const foreignWrite=await save(foreign,'POS_QA_A_P18',700,shell);
   check(`${shell} second shop cannot overwrite first-shop price`,foreignWrite.status()===403&&read('POS_QA_A_P18')===501&&read('POS_QA_B_P18')===600);
  }
 } catch(error) {
  await page.screenshot({path:path.join(out,'pricing-save-failure.png'),fullPage:true});
  error.message += `; URL=${page.url()}; body=${(await page.locator('body').innerText()).slice(-1200)}`;
  throw error;
 } finally {
  for(const [id,price] of Object.entries(originals)) {
   const response=await save(id.includes('_B_')?foreign:a,id,price);
   if(response.status()!==200||!(await response.json()).success||read(id)!==price)throw Error('Disposable price restoration failed: '+id);
  }
  await page.close();
 }
};
