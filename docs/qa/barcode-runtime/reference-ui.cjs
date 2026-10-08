/* Use only inside verify.cjs's named disposable fixture lifecycle. */
const path=require('path');
module.exports=async function({p,check,out}) {
  const base='http://127.0.0.1:18085';
  for(const shell of ['apps','qapps']) {
    await p.setViewportSize({width:1440,height:1000});
    await p.goto(`${base}/${shell}/zenith/barcode/BarcodeDashboard`,{waitUntil:'networkidle'});
    check(`${shell} Barcode reference asset registered`,await p.locator('link[href*="barcode-reference.css?v=1"]').count()>0);
    const exportCard=p.getByRole('link',{name:/Barcode Exports/});
    check(`${shell} export card names its real working destination`,await exportCard.isVisible()&&(await exportCard.getAttribute('href')).endsWith('/zenith/barcode/FindBarcode'));
    await p.screenshot({path:path.join(out,`${shell}-reference-dashboard-1440.png`),fullPage:true});
    for(const width of [1440,390]) {
      await p.setViewportSize({width,height:1000});
      await p.goto(`${base}/${shell}/zenith/barcode/LabelTemplates`,{waitUntil:'networkidle'});
      const group=p.locator('.lt-tg').first();
      const shape=await group.evaluate(e=>{const b=[...e.querySelectorAll('button')];const a=b[0].getBoundingClientRect(),z=b[1].getBoundingClientRect();return {gap:z.left-a.right,width:a.width+z.width,aligned:Math.abs(a.top-z.top)<1}});
      check(`${shell} template flags form connected usable controls at ${width}`,shape.gap<=1&&shape.gap>=-2&&shape.aligned&&shape.width>=100,shape);
      await p.getByRole('button',{name:/New Template/}).click();
      const modal=p.locator('#nlt-modal');await modal.waitFor({state:'visible'});
      const size=await modal.evaluate(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,viewport:innerWidth,client:e.clientWidth,scroll:e.scrollWidth}});
      check(`${shell} label template fields and preview fit ${width}`,size.left>=-2&&size.right<=size.viewport+2&&size.scroll<=size.client+2,size);
      await p.locator('.nlt-tg[data-k="showPrice"] button[data-v="N"]').click();
      check(`${shell} preview flag remains functional`,await p.locator('#nlt-showPrice').inputValue()==='N');
      await p.screenshot({path:path.join(out,`${shell}-reference-template-${width}.png`),fullPage:true});
      await p.keyboard.press('Escape');
      check(`${shell} dialog closes without submitting`,await p.locator('#nlt-overlay').evaluate(e=>e.style.display==='none'));
      await p.goto(`${base}/${shell}/zenith/barcode/FindBarcode`,{waitUntil:'networkidle'});
      await p.getByRole('button',{name:/Add Barcode/}).first().click();
      const addSize=await p.locator('#ab-modal').evaluate(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,viewport:innerWidth,client:e.clientWidth,scroll:e.scrollWidth}});
      check(`${shell} Add Barcode controls fit ${width}`,addSize.left>=-2&&addSize.right<=addSize.viewport+2&&addSize.scroll<=addSize.client+2,addSize);
      await p.locator('.ab-tg button[data-v="N"]').click();
      check(`${shell} primary barcode selector remains functional`,await p.locator('#ab-primary').inputValue()==='N');
      await p.keyboard.press('Escape');
    }
  }
};
