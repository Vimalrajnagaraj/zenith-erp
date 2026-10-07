import javax.xml.parsers.DocumentBuilderFactory
import freemarker.template.*
import groovy.json.JsonSlurper
import java.sql.Timestamp

// Run with Groovy 5 + groovy-json and FreeMarker 2.3.34 on the classpath:
// groovy -cp freemarker.jar docs/qa/check-contacts-dashboard.groovy . [rendered-core.html]
// Runs the actual screen action and templates with isolated synthetic rows; never opens a DB connection.
def repo = new File(args[0])
def source = new File(repo, 'component/zenith-erp-contacts/screen/zenith/contacts/Contacts/ContactsDashboard.xml')
def doc = DocumentBuilderFactory.newInstance().newDocumentBuilder().parse(source)
def action = (0..<doc.getElementsByTagName('script').length).collect { doc.getElementsByTagName('script').item(it).textContent }.find { it.contains('import org.moqui.entity.EntityCondition') }
def loader = new GroovyClassLoader(getClass().classLoader)
loader.parseClass('''package org.moqui.entity
class EntityCondition { static final IN='in', GREATER_THAN_EQUAL_TO='gte', LESS_THAN='lt', GREATER_THAN='gt', IS_NOT_NULL='notnull', EQUALS='eq', OR='or' }''')
def scriptClass = loader.parseClass(action)
def stamp = { String date -> Timestamp.valueOf(date+' 12:00:00') }
def tables = [
 'mantle.account.invoice.Invoice': [
  [fromPartyId:'ORG',toPartyId:'C1',invoiceTypeEnumId:'InvoiceSales',statusId:'InvoiceFinalized',invoiceDate:stamp('2025-03-01'),totalTaxableAmount:100G],
  [fromPartyId:'ORG',toPartyId:'C2',invoiceTypeEnumId:'InvoiceSales',statusId:'InvoiceFinalized',invoiceDate:stamp('2026-02-01'),totalTaxableAmount:200G],
  [fromPartyId:'ORG',toPartyId:'C2',invoiceTypeEnumId:'InvoiceSales',statusId:'InvoicePmtRecvd',invoiceDate:stamp('2026-10-01'),totalTaxableAmount:400G],
  [fromPartyId:'OTHER',toPartyId:'FOREIGN',invoiceTypeEnumId:'InvoiceSales',statusId:'InvoiceFinalized',invoiceDate:stamp('2026-10-01'),totalTaxableAmount:999999G]],
 'mantle.party.Organization':[[partyId:'C2',organizationName:'O\'Brien "<&>\\ Shop\nNorth']],
 'zenith.erp.pos.PosTransaction':[
  [organizationPartyId:'ORG',isCredit:'Y',statusId:'PtCompleted',payableAmount:100G,paidAmount:20G,entryDate:stamp('2026-08-01'),customerPartyId:'C2',transactionNumber:'SAMPLE-1'],
  [organizationPartyId:'ORG',isCredit:'Y',statusId:'PtCompleted',payableAmount:50G,paidAmount:0G,entryDate:stamp('2026-09-25'),customerPartyId:'C1',transactionNumber:'SAMPLE-2'],
  [organizationPartyId:'OTHER',isCredit:'Y',statusId:'PtCompleted',payableAmount:999999G,entryDate:stamp('2026-01-01')]],
 'mantle.party.contact.PartyContactMechPostalAddress':[[partyId:'C2',city:'Bengaluru'],[partyId:'C2',city:'Delhi'],[partyId:'ORG',city:'Chennai']]
]
class Query {
 List rows
 Query condition(Object... params) {
  if(params.length < 2) return this
  def field=params[0]; def op=params.length==2?'eq':params[1]; def value=params[-1]
  rows=rows.findAll { r -> def v=r[field]; switch(op) {case 'in':return value.contains(v);case 'gte':return v!=null&&v>=value;case 'lt':return v!=null&&v<value;case 'gt':return v!=null&&v>value;case 'notnull':return v!=null;default:return v==value} }; this
 }
 Query selectField(String f){this}
 List list(){rows}
 Map one(){rows?rows[0]:null}
 long count(){rows.size()}
}
def run = { Map extra=[:], boolean empty=false ->
 def data=empty ? [:] : tables
 def ec=[entity:[find:{String name->new Query(rows:new ArrayList(data[name]?:[]))}],user:[nowTimestamp:(extra.nowTimestamp ?: stamp('2026-10-01')),getPreference:{String name->null},isInGroup:{String name->true}],l10n:[format:{v,f->v.toString()}]]
 def b=new Binding([ec:ec,orgId:'ORG',zinr:[inr:{v->v}],customerList:empty ? [] : [[partyId:'C1'],[partyId:'C2']],vendorList:[],totalVendors:0,dashDate:'',dashDateTo:'',dateMode:null,growthYear:null]+extra)
 def script=scriptClass.newInstance();script.binding=b;script.run();b.variables
}
def normal=run()
assert normal.totalContacts==2 && normal.growthTotal==2 && normal.mapLocatedCount==1
assert normal.totalReceivable==130G && normal.overdueBills.size()==1 && normal.overdueBills[0].days>30
assert normal.acActiveInRange==1 && normal.acInvCount==1
assert new JsonSlurper().parseText(normal.tcLabelsJson)[0].contains("O'Brien")
assert normal.healthMetrics.size()==5 && normal.presetActive=='week' && normal.urlSettings.contains('growthYear=2026')
def reversed=run([dashDate:'2026-10-01',dashDateTo:'2026-09-01',dateMode:'custom'])
assert reversed.dashDate=='2026-09-01' && reversed.dashDateTo=='2026-10-01'
for (String bad : ['garbage','2026-02-30','2026-13-01','0001-01-01','9999-12-31']) {
 def result=run([dashDate:bad]);assert result.dateError && result.dayStart==null
}
assert run([nowTimestamp:stamp('2026-09-27')]).presetActive=='week'
assert run([nowTimestamp:stamp('2026-10-01'),dashDate:'2026-10-01',dashDateTo:'2026-10-01',dateMode:'month']).presetActive=='month'
assert run([orgId:null,customerList:[],vendorList:[]]).growthTotal==0
def directories=doc.getElementsByTagName('entity-find')
assert (0..<directories.length).every { directories.item(it).parentNode.nodeName=='if' && directories.item(it).parentNode.getAttribute('condition')=='orgId' }
def previous=run([growthYear:'2025'])
assert previous.growthTotal==1 && previous.growthDots.size()==12
assert run([growthYear:'<script>']).growthYear==2026
def empty=run([orgId:null],true)
assert empty.totalContacts==0 && !empty.growthHasData && !empty.mapHasData && empty.totalReceivable==0G && !empty.healthHasData
// Compile and render all FreeMarker template text using actual action context, including hostile customer labels.
def cfg=new Configuration(Configuration.VERSION_2_3_34)
cfg.numberFormat='computer';cfg.booleanFormat='c';cfg.defaultEncoding='UTF-8'
def rendered=[]
def texts=doc.getElementsByTagName('text')
for(int i=0;i<texts.length;i++) {
 def n=texts.item(i)
 if(n.getAttribute('template')!='true')continue
 def t=new Template('screen-'+i,new StringReader(n.textContent),cfg)
 for(def ctx:[normal,previous,empty]) {
  def writer=new StringWriter()
  t.process(ctx+[ec:[web:[request:[requestURI:'/qapps/zenith/Contacts/ContactsDashboard']]]],writer)
  if(ctx.is(normal)) rendered.add(writer.toString())
 }
}
assert rendered.join('').contains('O&#39;Brien') || rendered.join('').contains('O\'Brien')
if(args.length>1) new File(args[1]).text=rendered.find { it.contains('zc-dashboard-controls') }+rendered.find { it.contains('<main class="zc-dashboard"') }
println 'PASS: org separation, aggregate parity, date validation/reversal, growth periods, empty states, map deduplication, JSON escaping, and all FreeMarker template renders.'

// The Contacts content must never restyle or hide shared ERP shell controls.
def css=new File(repo, 'component/zenith-erp-app/screen/zenithstatic/css/contacts-dashboard.css').text
assert !(css =~ /(?m)(^|[},\s])body[:\s{]/).find() && !css.contains('#z-') && !css.contains('#zq-') && !css.contains('#footer')
def selectors = (css.replaceAll(/(?s)\/\*.*?\*\//, '') =~ /([^{}]+)\{/).collect { it[1].trim() }.findAll { !it.startsWith('@') }
assert selectors.every { it.split(',').every { part -> part.trim().startsWith('.zc-dashboard-page') } }
assert !source.text.contains('zc-dashboard-footer')
assert source.text.contains('class="zc-dashboard-page"')
println 'PASS: dashboard CSS is content-scoped; shared shell and footer are untouched.'
