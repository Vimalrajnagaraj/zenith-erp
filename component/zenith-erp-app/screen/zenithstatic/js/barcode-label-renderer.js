/* Never print an empty, invalid, or silently substituted barcode. */
(function(){'use strict';var errors=[],data=JSON.parse(document.getElementById('label-data').textContent);
 data.forEach(function(label,index){try{
  if(label.format==='QR'){
   var qr=document.getElementById('q'+index),box=qr.parentNode,style=getComputedStyle(box),qrStyle=getComputedStyle(qr);
   var other=Array.from(box.children).filter(function(child){return child!==qr}).reduce(function(sum,child){var cs=getComputedStyle(child);return sum+child.getBoundingClientRect().height+parseFloat(cs.marginTop)+parseFloat(cs.marginBottom)},0);
   var width=box.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)-parseFloat(qrStyle.paddingLeft)-parseFloat(qrStyle.paddingRight);
   var height=box.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom)-other-parseFloat(qrStyle.paddingTop)-parseFloat(qrStyle.paddingBottom);
   var size=Math.max(1,Math.floor(Math.min(width,height)));
   new QRCode(qr,{text:label.value,width:size,height:size,correctLevel:QRCode.CorrectLevel.M});
  }
  else JsBarcode('#b'+index,label.value,{format:label.format,height:38,fontSize:12,margin:10,valid:function(valid){if(!valid)throw Error('Invalid '+label.format+' value')}});
 }catch(error){errors.push(index+1);var box=document.querySelector('[data-index="'+index+'"]');var message=document.createElement('p');message.className='label-error';message.textContent='Cannot encode label '+(index+1)+' ('+label.format+').';box.appendChild(message);}});
 // Never hide a barcode behind overflowing name/SKU text or an undersized label.
 document.querySelectorAll('.lbl').forEach(function(box,index){
  var style=getComputedStyle(box),available=box.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom);
  var required=Array.from(box.children).reduce(function(sum,child){var cs=getComputedStyle(child);return sum+child.getBoundingClientRect().height+parseFloat(cs.marginTop)+parseFloat(cs.marginBottom)},0);
  if(required>available+1 || box.scrollWidth>box.clientWidth+1){if(errors.indexOf(index+1)<0)errors.push(index+1);}
 });
 var status=document.getElementById('label-status'),button=document.getElementById('print-labels');
 status.textContent=errors.length ? 'Correct invalid values or increase the label size before printing. Labels: '+errors.join(', ') : data.length ? 'Preview encoded. Print at actual size (100%) and confirm scanning on your printer.' : 'No labels to print.';
 button.disabled=!!errors.length || !data.length;button.addEventListener('click',function(){if(!button.disabled)window.print()});
 window.barcodeLabelsReady=!errors.length && !!data.length;
})();
