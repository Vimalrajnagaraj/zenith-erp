import groovy.json.JsonOutput
import groovy.json.JsonSlurper
import java.security.MessageDigest
import org.apache.commons.validator.routines.EmailValidator

// The active-org preference is not authorization. Only a platform administrator may
// provision another organization or explicitly grant it non-expiring manual access.
result = null
if (!ec.user.isInGroup('ADMIN')) {
    ec.message.addError('Only the platform administrator can create a clean workspace.'); return
}
def require = { boolean ok, String message -> if (!ok) throw new IllegalArgumentException(message) }
def keys = { value, allowed ->
    require(value instanceof Map && (value.keySet() - allowed).isEmpty(), 'Unexpected migration fields. Use a catalog-only bundle.')
}
def text = { value, int max -> value instanceof String && value.trim() && value.length() <= max }
def call = { String name, Map params ->
    def out = ec.service.sync().name(name).parameters(params).call()
    if (ec.message.hasError()) throw new IllegalStateException('Migration service failed: ' + name)
    out
}
def oldOrg = ec.user.getPreference('ACTIVE_ORGANIZATION')
def oldShop = ec.user.getPreference('ACTIVE_SHOP')
def oldScope = ['activeOrgId', 'userOrgIds', 'filterOrgIds'].collectEntries { [(it): ec.user.context.get(it)] }
boolean scopeChanged = false
try {
    require(bundleJson instanceof String && bundleJson.getBytes('UTF-8').length <= 10_000_000, 'Bundle must be at most 10 MB.')
    def b = new JsonSlurper().parseText(bundleJson)
    keys(b, ['schemaVersion','source','workspace','shops','terminals','cashiers','pricesIncludeGst','modeNames','products','excluded','issues'])
    require(b.schemaVersion == 1 && b.pricesIncludeGst instanceof Boolean, 'Unsupported bundle version or unreviewed price basis.')
    require(b.issues instanceof List && b.issues.isEmpty(), 'Resolve all source issues before creating a workspace.')
    keys(b.source, ['sha256','companyId','companyName','productCount','orphanPriceCount','duplicateDisplayCodeCount'])
    require(b.source.sha256 ==~ /[a-f0-9]{64}/, 'Source checksum is required.')
    require(b.source.companyId instanceof Number && b.source.companyId > 0, 'Select a source company.')
    def w = b.workspace
    keys(w, ['name','code','planId','adminEmail','adminFirstName','adminLastName','regionGeoId','permanentAccessReason'])
    require(text(w.name,100) && text(w.adminFirstName,50) && text(w.adminLastName,50), 'Workspace and administrator names are required.')
    require(text(w.permanentAccessReason,500), 'Record the reason for non-expiring access.')
    require(w.adminEmail instanceof String && EmailValidator.getInstance().isValid(w.adminEmail), 'Enter a valid new administrator email.')
    def subdomain = call('zenith.saas.SaasServices.validate#Subdomain', [subdomain:w.code])
    require(subdomain.valid && subdomain.available, 'The new workspace code is invalid or already used.')
    require(w.regionGeoId instanceof String && ec.entity.find('zenith.erp.india.IndiaState').condition('stateCode',w.regionGeoId).one() != null, 'Choose a real Indian shop state code.')
    def plan = ec.entity.find('zenith.erp.saas.SaasPlan').condition('planId',w.planId).one()
    require(plan != null && plan.isActive == 'Y', 'Choose an active plan.')
    require(b.products instanceof List && b.products.size() in 1..50000, 'Import 1–50,000 reviewed products.')
    require(b.excluded instanceof List && b.source.productCount == b.products.size() + b.excluded.size(), 'Reconcile every source product as imported or explicitly excluded.')
    def excludedKeys = [] as Set
    b.excluded.each { row ->
        keys(row,['sourceId','reason'])
        require(row.sourceId instanceof String && row.sourceId ==~ /[0-9]+/ && excludedKeys.add(row.sourceId) && row.reason in ['operator exclusion','source inactive flag'], 'Review exact excluded source IDs and reasons.')
    }
    [['maxUsers',3],['maxPosTerminals',3],['maxStores',2],['maxProductsSku',b.products.size()]].each { limit ->
        require(plan[limit[0]] != null && (plan[limit[0]] == 0 || plan[limit[0]] >= limit[1]), 'The chosen plan does not cover this migration: ' + limit[0])
    }
    require(b.shops instanceof List && b.shops.size() == 2 && b.terminals instanceof List && b.terminals.size() == 3, 'Exactly two shops and three counters are required.')
    b.shops.each { s -> keys(s,['key','name']); require(text(s.key,20) && text(s.name,100), 'Shop keys and names are required.') }
    def shopKeys = b.shops*.key as Set
    require(shopKeys.size() == 2, 'Shop keys must be unique.')
    b.terminals.each { t -> keys(t,['key','name','shopKey']); require(text(t.key,20) && text(t.name,100) && shopKeys.contains(t.shopKey), 'Each counter needs a valid shop.') }
    require((b.terminals*.key as Set).size() == 3 && (b.terminals*.shopKey as Set) == shopKeys, 'Use unique counters and at least one counter per shop.')
    require(b.cashiers instanceof List && b.cashiers.size() == 2, 'Provide two cashier logins (plus the workspace owner = three logins).')
    b.cashiers.each { u ->
        keys(u,['username','fullName','shopKey'])
        require(text(u.username,100) && u.username ==~ /(?=.*\p{L})[^\s]{3,100}/ && text(u.fullName,100) && u.fullName.find(/\p{L}/) && shopKeys.contains(u.shopKey), 'Each cashier needs a valid username, name and shop.')
    }
    def usernames = [w.adminEmail.trim().toLowerCase(Locale.ROOT)] + b.cashiers.collect { it.username.trim().toLowerCase(Locale.ROOT) }
    require((usernames as Set).size() == 3, 'The three usernames must be distinct.')
    usernames.each { username -> require(!ec.entity.find('moqui.security.UserAccount').condition('username',username).disableAuthz().count(), 'A proposed login already exists. Use a new login; existing users are never adopted.') }
    require(b.modeNames instanceof List && b.modeNames.size() == 2 && b.modeNames.every { text(it,100) }, 'Provide the two source mode names.')
    def productKeys = [] as Set; def skus = [] as Set; def barcodes = [] as Set
    def slabs = [:]; def uoms = [] as Set
    b.products.each { p ->
        keys(p,['sourceId','sku','name','sourceCode','localName','barcode','hsn','amountUomId','sourceUnit','category','cgst','sgst','retail','wholesale','sourceMrp'])
        require(p.sourceId instanceof String && p.sourceId ==~ /[0-9]+/ && !excludedKeys.contains(p.sourceId) && productKeys.add(p.sourceId), 'Source product IDs must be numeric and unique.')
        require(p.sku == 'SRC-' + b.source.companyId + '-' + p.sourceId && p.sku.length() <= 60 && skus.add(p.sku), 'Use unique source-derived SKUs, not duplicate display codes.')
        require(text(p.name,100) && (p.localName ?: '').size() <= 255 && (p.category ?: '').size() <= 100 && (p.hsn ?: '').size() <= 40, 'Product metadata exceeds supported lengths.')
        ['retail','wholesale'].each { field ->
            def amount = new BigDecimal(p[field].toString())
            require(amount > 0 && amount.scale() <= 2 && amount.precision() <= 15, 'Prices must be positive with at most two decimals. Review free items separately.')
        }
        require(text(p.amountUomId,40), 'Review every source unit.')
        uoms.add(p.amountUomId)
        def cg = new BigDecimal(p.cgst.toString()); def sg = new BigDecimal(p.sgst.toString())
        require(cg >= 0 && sg >= 0 && cg + sg <= 100, 'Invalid source GST rates.')
        def taxKey = cg.toPlainString() + ':' + sg.toPlainString()
        if (!slabs[taxKey]) {
            def matches = ec.entity.find('zenith.erp.india.IndiaGstSlab').condition('isActive','Y').condition('cgstRate',cg).condition('sgstRate',sg).condition('gstRate',cg+sg).condition('igstRate',cg+sg).condition('cessRate',0).list()
            require(matches.size() == 1, 'Source GST must match exactly one active zero-cess slab.')
            slabs[taxKey] = matches[0].gstSlabId
        }
        if (p.barcode) {
            require(p.barcode instanceof String && barcodes.add(p.barcode) && !skus.contains(p.barcode), 'Source barcodes must be unambiguous.')
            def checked = call('zenith.barcode.BarcodeServices.validate#BarcodeValue', [barcodeTypeEnumId:'BctCode128',barcodeValue:p.barcode])
            require(checked.valid == true, 'Review the source barcode format.')
        }
    }
    require((barcodes.intersect(skus)).isEmpty(), 'A source barcode conflicts with a generated SKU.')
    uoms.each { id -> require(ec.entity.find('moqui.basic.Uom').condition('uomId',id).count() == 1, 'A mapped UOM does not exist.') }
    def digest = MessageDigest.getInstance('SHA-256').digest(bundleJson.getBytes('UTF-8')).encodeHex().toString()
    result = [preview:!apply, bundleDigest:digest, sourceDigest:b.source.sha256, products:b.products.size(), shops:2, logins:3, terminals:3, copiedTestTransactions:0]
    if (!apply) {
        ec.message.addMessage('Preview only: '+b.products.size()+' products, 2 shops, 3 logins, 3 counters; no old transactions. Bundle SHA-256: '+digest)
        return
    }
    require(confirmationDigest == digest, 'Preview this exact bundle, then submit its SHA-256 digest to apply.')
    require([adminPassword,cashierOnePassword,cashierTwoPassword].every { it instanceof String && it.length() >= 12 }, 'Supply three new passwords of at least 12 characters; framework password policy also applies.')

    // All provisioning and catalog writes join this service's transaction. Do not call
    // force-new upsert#PosProduct: a late error must roll back the ENTIRE new workspace.
    def created = call('zenith.saas.SaasServices.provision#Tenant', [tenantName:w.name,subdomain:subdomain.canonical,
        adminEmail:usernames[0],adminFirstName:w.adminFirstName,adminLastName:w.adminLastName,
        adminPassword:adminPassword,planId:w.planId,countryGeoId:'IND',currencyUomId:'INR'])
    def org = created.organizationPartyId
    require(org != null, 'Provisioning returned no new organization.')
    require(org != '100000', 'The reserved organization ID cannot be used for a migration workspace.')
    require(org != oldOrg, 'Provisioning must not reuse the current organization.')
    scopeChanged = true
    ec.user.setPreference('ACTIVE_ORGANIZATION',org)
    ec.user.setPreference('ACTIVE_SHOP','')
    ec.user.context.activeOrgId = org; ec.user.context.userOrgIds = [org]; ec.user.context.filterOrgIds = [org]
    def facilities = ec.entity.find('mantle.facility.Facility').condition('ownerPartyId',org).condition('facilityTypeEnumId','FcTpRetailStore').list()
    require(facilities.size() == 1, 'Expected exactly one newly provisioned default facility.')
    def shops = [:]
    b.shops.eachWithIndex { s, i ->
        def facilityId = i == 0 ? facilities[0].facilityId : null
        if (facilityId) call('update#mantle.facility.Facility',[facilityId:facilityId,facilityName:s.name])
        def store = call('zenith.stores.StoreServices.create#Store',[storeName:s.name,storeTypeEnumId:'StOwned',facilityId:facilityId])
        shops[s.key] = ec.entity.find('zenith.erp.stores.Store').condition('storeId',store.storeId).condition('organizationPartyId',org).one().facilityId
    }
    def terminalIds = b.terminals.collect { t -> call('create#zenith.erp.pos.PosTerminal',[terminalName:t.name,organizationPartyId:org,facilityId:shops[t.shopKey],isActive:'Y',countryGeoId:'IND',regionGeoId:w.regionGeoId]).terminalId }
    def newUserIds = [created.userId]
    b.cashiers.eachWithIndex { u, i ->
        def password = i == 0 ? cashierOnePassword : cashierTwoPassword
        def account = call('org.moqui.impl.UserServices.create#UserAccount',[username:usernames[i+1],userFullName:u.fullName,newPassword:password,newPasswordVerify:password])
        def user = ec.entity.find('moqui.security.UserAccount').condition('userId',account.userId).one()
        newUserIds.add(user.userId)
        require(user?.partyId != null, 'The cashier account needs an employee party.')
        call('store#mantle.party.PartyRole',[partyId:user.partyId,roleTypeId:'Employee'])
        call('create#mantle.party.PartyRelationship',[fromPartyId:user.partyId,fromRoleTypeId:'Employee',toPartyId:org,toRoleTypeId:'OrgInternal',relationshipTypeEnumId:'PrtEmployee',fromDate:ec.user.nowTimestamp])
        ['ZENITH_ALL','ZENITH_CASHIER','TENANT_'+subdomain.canonical.toUpperCase(Locale.ROOT)].each { group -> call('create#moqui.security.UserGroupMember',[userId:user.userId,userGroupId:group,fromDate:ec.user.nowTimestamp]) }
        ['ACTIVE_ORGANIZATION':org,'ACTIVE_SHOP':shops[u.shopKey]].each { key,value -> call('store#moqui.security.UserPreference',[userId:user.userId,preferenceKey:key,preferenceValue:value]) }
    }
    def modeIds = []
    b.modeNames.eachWithIndex { name, i ->
        modeIds.add(call('create#zenith.erp.pos.PosSalesMode',[organizationPartyId:org,modeName:name,modeCode:i == 0 ? 'RTL' : 'WSL',priceSource:'PpsFixedProduct',
            isTaxInclusive:b.pricesIncludeGst ? 'Y' : 'N',requireCustomer:'N',isDefault:i == 0 ? 'Y' : 'N',isActive:'Y']).salesModeId)
    }
    ec.entity.find('zenith.erp.pos.PosSalesMode').list().findAll { !it.organizationPartyId }.each { shared ->
        call('store#zenith.erp.pos.PosSalesModeOrgRemoval',[organizationPartyId:org,salesModeId:shared.salesModeId])
    }
    newUserIds.each { id -> call('store#moqui.security.UserPreference',[userId:id,preferenceKey:'POS_PRODUCT_PRICE_MODES_'+org,preferenceValue:modeIds.join(',')]) }
    terminalIds.each { id ->
        def available = call('zenith.pos.PosModeServices.get#TerminalModes',[terminalId:id]).modes*.salesModeId as Set
        require(available == (modeIds as Set), 'Each new counter must expose exactly the two imported sales modes.')
    }
    def categories = [:]
    def sourceCodeCounts = b.products.countBy { it.sourceCode }
    int legacyAliases = 0
    b.products.each { p ->
        def taxKey = new BigDecimal(p.cgst.toString()).toPlainString() + ':' + new BigDecimal(p.sgst.toString()).toPlainString()
        def product = call('create#mantle.product.Product',[productTypeEnumId:'PtAsset',ownerPartyId:org,pseudoId:p.sku,productName:p.name,amountUomId:p.amountUomId,
            mrpAmount:new BigDecimal(p.retail),hsnCode:p.hsn,productTaxCode:p.hsn,gstSlabId:slabs[taxKey],
            description:JsonOutput.toJson([legacySourceId:p.sourceId,legacyCode:p.sourceCode,localName:p.localName,legacyMrp:p.sourceMrp,legacyUnit:p.sourceUnit])])
        [p.retail,p.wholesale].eachWithIndex { price,i -> call('zenith.pos.PosServices.set#PosModePrice',[productId:product.productId,salesModeId:modeIds[i],price:new BigDecimal(price)]) }
        if (p.category) {
            if (!categories[p.category]) categories[p.category] = call('create#mantle.product.category.ProductCategory',[ownerPartyId:org,categoryName:p.category]).productCategoryId
            call('create#mantle.product.category.ProductCategoryMember',[productCategoryId:categories[p.category],productId:product.productId,fromDate:ec.user.nowTimestamp])
        }
        if (p.barcode) call('zenith.barcode.BarcodeServices.add#ProductBarcode',[productId:product.productId,barcodeTypeEnumId:'BctCode128',barcodeValue:p.barcode,isPrimary:'N'])
        // Preserve unambiguous letter-prefixed legacy SKUs (e.g. printed labels).
        // Numeric codes can have GTIN aliases; leave those to the explicit barcode field.
        if (p.sourceCode instanceof String && p.sourceCode ==~ /[A-Za-z][A-Za-z0-9_-]{0,59}/ &&
            sourceCodeCounts[p.sourceCode] == 1 && !skus.contains(p.sourceCode) && !barcodes.contains(p.sourceCode)) {
            call('zenith.barcode.BarcodeServices.add#ProductBarcode',[productId:product.productId,barcodeTypeEnumId:'BctCode128',barcodeValue:p.sourceCode,isPrimary:'N'])
            legacyAliases++
        }
    }
    // Permanent access is an explicit, audited grant for THIS new tenant only.
    // Never change shared plans, the protected old organization, or global expiry policy.
    ec.entity.find('zenith.erp.saas.SaasSubscription').condition('tenantId',created.tenantId).list().each { sub ->
        call('update#zenith.erp.saas.SaasSubscription',[subscriptionId:sub.subscriptionId,statusId:'SubExpired',autoRenew:'N'])
    }
    def subscription = call('create#zenith.erp.saas.SaasSubscription',[tenantId:created.tenantId,planId:w.planId,statusId:'SubActive',billingCycle:'Manual',startDate:ec.user.nowTimestamp,autoRenew:'N',amount:0,currencyUomId:'INR'])
    call('store#zenith.erp.saas.SaasTenantConfig',[tenantId:created.tenantId,configKey:'MANUAL_PLAN_SUBSCRIPTION',configValue:subscription.subscriptionId])
    call('store#zenith.erp.saas.SaasTenantConfig',[tenantId:created.tenantId,configKey:'MANUAL_PLAN_PERMANENT_SUBSCRIPTION',configValue:subscription.subscriptionId])
    call('update#zenith.erp.saas.SaasTenant',[tenantId:created.tenantId,statusId:'SaasTenantActive'])
    call('create#zenith.erp.saas.SaasAuditLog',[tenantId:created.tenantId,eventType:'CLEAN_WORKSPACE_CREATED',eventDate:ec.user.nowTimestamp,userId:ec.user.userId,
        description:'Catalog-only migration '+digest+'; source '+b.source.sha256+'; non-expiring manual access: '+w.permanentAccessReason])
    result = result + [organizationPartyId:org,tenantId:created.tenantId,workspaceCode:subdomain.canonical,nonExpiringAccess:true,legacyScanAliases:legacyAliases]
    ec.message.addMessage('New workspace '+subdomain.canonical+' created with '+b.products.size()+' products, 2 shops, 3 logins and 3 counters. No existing account was changed or deleted.')
} catch (Exception failure) {
    // A reported validation or service error marks the force-new transaction rollback-only.
    // Never clear errors and continue into a partially provisioned organization.
    result = null
    if (!ec.message.hasError()) ec.message.addError(failure instanceof IllegalArgumentException ? failure.message : 'Clean workspace creation failed; all migration writes were rolled back.')
    ec.transaction.setRollbackOnly('Clean workspace migration failed', failure)
} finally {
    if (scopeChanged) {
        ec.user.setPreference('ACTIVE_ORGANIZATION',oldOrg ?: '')
        ec.user.setPreference('ACTIVE_SHOP',oldShop ?: '')
        oldScope.each { key,value -> ec.user.context.put(key,value) }
    }
}
