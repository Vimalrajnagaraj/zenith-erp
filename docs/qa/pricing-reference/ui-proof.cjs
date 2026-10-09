/* Called only inside the existing disposable Price List fixture lifecycle. No production access. */
const path=require('path');
module.exports=async function(p,check,base,out){
  for(const shell of ['apps','qapps']) {
    for(const screen of ['PricingDashboard','FindPriceList','FindPricingRule','PriceChangeHistory']) {
      await p.goto(`${base}/${shell}/zenith/pricing/${screen}`,{waitUntil:'networkidle'});
      check(`${shell} ${screen} reference asset loads`,await p.locator('link[href*="pricing-reference.css?v=1"]').count()>0);
      for(const width of [1440,768,390]) {
        await p.setViewportSize({width,height:1000});
        await p.waitForFunction(()=>[...document.querySelectorAll('#z-sidebar,#zq-sidebar')].every(e=>e.getAnimations().every(a=>a.playState!=='running')));
        const size=await p.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
        check(`${shell} ${screen} reference page fits ${width}`,size.scroll<=size.client+2,size);
        if(screen==='PricingDashboard'&&width===1440) {
          const grid=await p.locator('.zprf-dashboard-grid').evaluate(e=>{const c=[...e.children].map(x=>x.getBoundingClientRect());return {display:getComputedStyle(e).display,sideBySide:c.length===2&&Math.abs(c[0].top-c[1].top)<2&&c[0].right<=c[1].left+2}});
          check(`${shell} Dashboard shows changes and trends side by side`,grid.display==='grid'&&grid.sideBySide,grid);
          await p.screenshot({path:path.join(out,`${shell}-reference-dashboard-1440.png`),fullPage:true});
        }
      }
      await p.setViewportSize({width:1440,height:1000});
      if(screen!=='PricingDashboard') {
        const find=p.getByText('Find Options',{exact:true}).filter({visible:true}).first();
        check(`${shell} ${screen} server filter is visible`,await find.isVisible());
        await find.click();
        // Bootstrap's legacy modal keeps aria-hidden on its wrapper; address the actual native form.
        const submit=p.locator('form[id$="_header"] [type="submit"]').filter({visible:true}).first();
        await submit.waitFor({state:'visible'});
        check(`${shell} ${screen} server filter has a usable Find submit`,await submit.isVisible()&&await submit.isEnabled());
        await submit.click();
        await p.waitForLoadState('networkidle');
        check(`${shell} ${screen} native Find submits the read route`,p.url().includes('/pricing/'+screen));
        // Leave through the native route even if this framework keeps its dialog mounted.
        await p.goto(`${base}/${shell}/zenith/pricing/${screen}`,{waitUntil:'networkidle'});
        check(`${shell} ${screen} native CSV destination retained`,await p.locator('.zprf-list a[href*="renderMode=csv"]').count()>0);
        check(`${shell} ${screen} page-only search shim does not replace native filters`,await p.locator('.zprf-list .zlc-search').count()===0);
      }
    }
    for(const [screen,label,form] of [['FindPriceList','New Price List','CreatePriceListForm'],['FindPricingRule','New Rule','CreateRuleForm']]) {
      for(const width of [1440,768,390]) {
        await p.setViewportSize({width,height:1000});
        await p.goto(`${base}/${shell}/zenith/pricing/${screen}`,{waitUntil:'networkidle'});
        await p.getByRole('button',{name:new RegExp(label)}).first().click();
        const f=p.locator('#'+form);await f.waitFor({state:'visible'});
        const geometry=await f.evaluate(e=>{const r=e.getBoundingClientRect();const buttons=[...e.querySelectorAll('button[type=submit],input[type=submit]')].filter(x=>x.getClientRects().length);return {left:r.left,right:r.right,viewport:innerWidth,submitVisible:buttons.some(b=>{const a=b.getBoundingClientRect();return a.width>0&&a.left>=0&&a.right<=innerWidth+2})}});
        check(`${shell} ${label} native fields and submit fit ${width}`,geometry.left>=-2&&geometry.right<=geometry.viewport+2&&geometry.submitVisible,geometry);
        if(width===390)await p.screenshot({path:path.join(out,`${shell}-${form}-390.png`),fullPage:true});
        await p.keyboard.press('Escape');
      }
    }
  }
};
