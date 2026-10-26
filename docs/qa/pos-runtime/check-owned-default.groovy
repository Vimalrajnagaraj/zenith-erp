// Execute the actual TerminalModes script with bounded synthetic entity results.
// Pass an old PosModeServices.xml to demonstrate the pre-fix duplicate-default bug.
import groovy.xml.XmlParser

class ModeQuery {
    List rows
    ModeQuery condition(String name, Object value) { rows = rows.findAll { it[name] == value }; this }
    ModeQuery orderBy(String ignored) { this }
    List list() { rows }
    def one() { rows ? rows[0] : null }
}
def source = new XmlParser().parse(new File(args[0]))
def script = source.service.find { it.@verb == 'get' && it.@noun == 'TerminalModes' }.actions.script.text()
def definitions = [
    [salesModeId:'RETAIL',organizationPartyId:null,isActive:'Y',isDefault:'Y',modeName:'Retail'],
    [salesModeId:'WHOLESALE',organizationPartyId:null,isActive:'Y',isDefault:'N',modeName:'Wholesale'],
    [salesModeId:'OWN_R',organizationPartyId:'CLEAN_QA_A',isActive:'Y',isDefault:'Y',modeName:'Retail'],
    [salesModeId:'OWN_W',organizationPartyId:'CLEAN_QA_A',isActive:'Y',isDefault:'N',modeName:'Wholesale'],
    [salesModeId:'FOREIGN_R',organizationPartyId:'CLEAN_QA_B',isActive:'Y',isDefault:'Y',modeName:'Foreign']
]
def run = { org ->
    def data = [
        'zenith.erp.pos.PosTerminal':[[terminalId:'T',facilityId:'F']],
        'zenith.erp.pos.PosSalesModeShop':[],
        'zenith.erp.pos.PosSalesModeOrgRemoval':[[organizationPartyId:'CLEAN_QA_A',salesModeId:'WHOLESALE'],[organizationPartyId:'CLEAN_QA_A',salesModeId:'RETAIL']],
        'zenith.erp.pos.PosTerminalSalesMode':[],
        'zenith.erp.pos.PosSalesMode':definitions
    ]
    def binding = new Binding([terminalId:'T',access:[organizationPartyId:org],ec:[entity:[find:{ name -> new ModeQuery(rows:new ArrayList(data[name])) }]]])
    new GroovyShell(binding).evaluate(script)
    binding.getVariable('modes')*.salesModeId as Set
}
assert run('CLEAN_QA_A') == (['OWN_R','OWN_W'] as Set): 'An owned default must replace the shared fallback at this tenant only'
assert run('UNRELATED_QA') == (['RETAIL','WHOLESALE'] as Set): 'Tenants without an owned default retain shared modes'
println 'PASS: owned default replaces shared fallback; unrelated tenant unchanged'
