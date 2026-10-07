import groovy.json.JsonOutput
import javax.xml.parsers.DocumentBuilderFactory

// Execute the existing tracked wrapper script with synthetic, isolated screen bindings.
def qapps = new File(args[0])
def xml = DocumentBuilderFactory.newInstance().newDocumentBuilder().parse(qapps)
String script = xml.getElementsByTagName('script').item(0).textContent
def rows = []
def paths = ['/', '/qapps', '/qapps/', '/qapps/zenith',
             '/qapps/zenith/Contacts/ContactsDashboard', '/qapps/zenith/Contacts/CustomerGroups']
String previousPurpose = System.getProperty('instance_purpose')
try {
    ['production', 'development'].each { purpose ->
        System.setProperty('instance_purpose', purpose)
        [false, true].each { authenticated ->
            paths.each { uri ->
                def redirects = []
                int saves = 0
                def htmlScripts = []
                def footerScripts = []
                def ec = [user: [userId: authenticated ? 'SYNTHETIC_QA_USER' : null,
                                 getPreference: { String preference -> null }],
                          web: [request: [requestURI: uri],
                                saveScreenLastInfo: { Object first, Object second -> saves++ }]]
                // The original broken image redirected when a resolved deep route had no extras.
                def sri = [screenUrlInfo: [extraPathNameList: []],
                           sendRedirectAndStopRender: { String target -> redirects << target }]
                new GroovyShell(new Binding([ec: ec, sri: sri, html_scripts: htmlScripts,
                                            footer_scripts: footerScripts])).evaluate(script)
                boolean bareRoot = ['/', '/qapps', '/qapps/'].contains(uri)
                def expectedRedirects = !authenticated ? ['/Login'] :
                                        bareRoot ? ['/qapps/zenith/Dashboard'] : []
                assert redirects == expectedRedirects : "Unexpected redirect for ${purpose}, auth=${authenticated}, path=${uri}"
                assert saves == (authenticated ? 0 : 1) : 'Anonymous route must save its requested path'
                boolean renderAssets = authenticated && !bareRoot
                assert htmlScripts.size() == (renderAssets ? 3 : 0)
                assert footerScripts.size() == (renderAssets ? 7 : 0)
                if (renderAssets) {
                    String expectedRuntime = purpose == 'production' ? '/js/WebrootVue.qvt.min.js' : '/js/WebrootVue.qvt.js'
                    assert footerScripts.contains(expectedRuntime)
                    assert !footerScripts.any { it.contains('qz-tray') }
                }
                rows << [purpose: purpose, authenticated: authenticated, path: uri,
                         redirects: redirects, requestedPathSaved: saves == 1,
                         assetsRendered: renderAssets, passed: true]
            }
        }
    }
} finally {
    if (previousPurpose == null) System.clearProperty('instance_purpose')
    else System.setProperty('instance_purpose', previousPurpose)
}
new File(args[1]).text = JsonOutput.prettyPrint(JsonOutput.toJson([
    kind: 'synthetic execution of unchanged tracked qapps pre-actions',
    totalCases: rows.size(), passedCases: rows.count { it.passed },
    extraPathNameList: 'empty in every case, including resolved deep paths',
    limitations: ['No live HTTP server, browser rendering, Docker daemon, or deployment was used.',
                  'CI clean candidate smoke overlays qapps separately and cannot prove deployment Dockerfile activation.'],
    cases: rows
])) + '\n'
println "Qapps route probe passed: ${rows.size()}/${rows.size()} cases"
