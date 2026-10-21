/* Read-only native-control regressions. Called by ui.cjs in the disposable Tax profile. */
module.exports=async function({page,record,open,assert,out,shell}) {
    async function theme(dark) {
        await page.evaluate(d=>{
            document.body.classList.toggle('body--dark',d);
            document.body.classList.toggle('body--light',!d);
        },dark);
    }
    async function contrast(selector) {
        return page.$eval(selector,element=>{
            function rgb(value) { return (value.match(/[\d.]+/g)||[]).slice(0,3).map(Number); }
            function luminance(value) {
                const c=rgb(value).map(x=>{x/=255;return x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4;});
                return c[0]*0.2126+c[1]*0.7152+c[2]*0.0722;
            }
            const style=getComputedStyle(element);
            let node=element,background=style.backgroundColor;
            while((background==='transparent'||background==='rgba(0, 0, 0, 0)')&&node.parentElement) {
                node=node.parentElement;background=getComputedStyle(node).backgroundColor;
            }
            const a=luminance(style.color),b=luminance(background);
            return {color:style.color,background,ratio:(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05),scheme:style.colorScheme};
        });
    }
    for(const dark of [false,true]) await record(`${shell} registration dropdown contrast in ${dark?'dark':'light'} theme`,async()=>{
        await page.setViewport({width:1366,height:900});
        await open(`/${shell}/zenith/tax/FindTaxRegistration`);await theme(dark);
        await page.click('[data-tax-open="nr-overlay"]');await page.waitForSelector('#nr-overlay',{visible:true});
        const evidence=[];
        for(const id of ['nr-party','nr-auth','nr-regtype','nr-country','nr-region']) {
            for(const state of ['default','hover','focus','disabled']) {
                if(state==='hover')await page.hover('#'+id);
                if(state==='focus')await page.focus('#'+id);
                if(state==='disabled')await page.$eval('#'+id,e=>{e.disabled=true;});
                const sample=await contrast('#'+id);evidence.push({id,state,...sample});
                assert(sample.ratio>=4.5,`${id} ${state} text contrast ${sample.ratio.toFixed(2)}: ${sample.color} on ${sample.background}`);
                await page.$eval('#'+id,e=>{e.disabled=false;});
            }
            // Native popup paint varies by OS; verify the author colors offered to it.
            const option='#'+id+' option';const sample=await contrast(option);evidence.push({id,state:'option',...sample});
            assert(sample.ratio>=4.5,`${id} option contrast ${sample.ratio.toFixed(2)}`);
        }
        const label=await contrast('label[for="nr-auth"]');assert(label.ratio>=4.5,'Tax label is unreadable on the modal form');
        await page.screenshot({path:out+'/'+shell+'-dropdown-'+(dark?'dark':'light')+'.png',fullPage:false});
        await page.keyboard.press('Escape');return evidence;
    });
    await record(shell+' registration dropdown keyboard, selection and modal bounds',async()=>{
        await open(`/${shell}/zenith/tax/FindTaxRegistration`);await theme(true);
        await page.click('[data-tax-open="nr-overlay"]');await page.waitForSelector('#nr-overlay',{visible:true});
        await page.focus('#nr-regtype');await page.keyboard.press('Home');await page.keyboard.press('ArrowDown');
        const selected=await page.$eval('#nr-regtype',e=>({value:e.value,label:e.selectedOptions[0].textContent}));
        assert(selected.value&&selected.label.trim(),'Keyboard selection did not retain a visible label');
        const sample=await contrast('#nr-regtype option:checked');assert(sample.ratio>=4.5,'Selected option is unreadable');
        for(const width of [1366,800,390,320]) {
            await page.setViewport({width,height:900});
            assert(await page.$eval('#nr-overlay > div',e=>e.scrollWidth<=e.clientWidth+1&&e.getBoundingClientRect().width<=innerWidth),'Modal horizontal overflow');
            await page.focus('#nr-auth');await page.focus('#nr-create');
            await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
            assert(await page.$eval('#nr-create',e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),'Modal Create control cannot be reached by keyboard');
        }
        await page.keyboard.press('Escape');
        assert(await page.$eval('[data-tax-open="nr-overlay"]',e=>document.activeElement===e),'Closing did not restore focus');
        await theme(false);await page.setViewport({width:1366,height:900});return selected;
    });
};
