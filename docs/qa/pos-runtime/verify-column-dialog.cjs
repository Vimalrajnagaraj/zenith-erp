const path=require('node:path');
module.exports=async function({a,base,check,out}) {
 const page=await a.c.newPage();page.setDefaultTimeout(60000);await page.setViewportSize({width:1440,height:1000});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 try {
  for(const shell of ['apps','qapps']) {
   await page.goto(`${base}/${shell}/zenith/pos/PosTransactions`);await page.waitForLoadState('networkidle');
   const columns=page.locator('.zlc-toolbar button').filter({hasText:'Columns'}).first();await columns.click();
   const dialog=page.locator('.modal:visible,.q-dialog:visible').first();await dialog.waitFor();
   await page.waitForTimeout(300);
   const samples=[];
   for(const point of [[100,200],[1000,600],[600,300],[650,400],[700,500],[500,250],[700,500],[100,200]]) {
    await page.mouse.move(...point);await page.waitForTimeout(100);samples.push(await dialog.boundingBox());
   }
   const initial=samples[0];
   check(`${shell} Column Fields stays viewport-fixed during pointer movement`,samples.every(rect=>rect&&['x','y','width','height'].every(key=>Math.abs(rect[key]-initial[key])<1)),{samples});
   check(`${shell} list-card hover never creates a modal containing block`,await page.locator('.z-txntable').evaluate(el=>getComputedStyle(el).transform)==='none');
   const save=shell==='apps'?dialog.locator('[name=SaveColumns]'):dialog.getByRole('button',{name:'Save Changes',exact:true});await save.focus();
   check(`${shell} Column Fields Save remains keyboard-focusable`,await save.evaluate(el=>el===document.activeElement));
   await page.screenshot({path:path.join(out,`${shell}-transaction-columns-stable.png`),timeout:90000});
   const saved=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('formSelectColumns'));
   await page.keyboard.press('Enter');check(`${shell} Save Columns posts successfully`,(await saved).status()<400);await page.waitForLoadState('networkidle');
   await page.locator('.zlc-toolbar button').filter({hasText:'Columns'}).first().click();await dialog.waitFor();
   const reset=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('formSelectColumns'));
   const resetButton=shell==='apps'?dialog.locator('[name=ResetColumns]'):dialog.getByRole('button',{name:'Reset to Default',exact:true});
   await resetButton.click();check(`${shell} Reset to Default posts successfully`,(await reset).status()<400);await page.waitForLoadState('networkidle');
   check(`${shell} transaction headers remain readable after reset`,(await page.locator('.z-txntable').innerText()).includes('Txn Number'));
  }
  check('repeated Column Fields hover and saves produce no browser errors',errors.length===0,{errors});
 } finally {await page.close();}
};
