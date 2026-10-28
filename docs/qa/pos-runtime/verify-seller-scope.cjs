const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = process.env.POS_SELLER_SOURCE || path.resolve(__dirname, '../../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const services = read('component/zenith-erp-pos/service/zenith/pos/PosServices.xml');
const sync = read('component/zenith-erp-pos/service/zenith/pos/PosSyncServices.xml');
const terminals = read('component/zenith-erp-pos/screen/zenith/pos/Pos/PosTerminals.xml');

const open = services.split('<service verb="open" noun="PosSession">')[1].split('</service>')[0];
const create = services.split('<service verb="create" noun="PosTransaction">')[1].split('</service>')[0];
const edit = terminals.split('<transition name="updateTerminal"')[1].split('</transition>')[0];
for (const [source, pattern, caseName] of [
    [open, /_sellerFacility\.ownerPartyId != _posAccess\.organizationPartyId/, 'session facility owner'],
    [open, /registrations\.containsAll\(gstins\)/, 'session seller GSTIN'],
    [create, /terminal\.organizationPartyId != session\.organizationPartyId/, 'cart seller'],
    [sync, /_sess\.organizationPartyId != org \|\| _term\.organizationPartyId != org/, 'invoice seller'],
    [sync, /_facility\.ownerPartyId != org/, 'invoice facility owner'],
    [sync, /_registered\.containsAll\(_gstins\)/, 'invoice GSTIN'],
    [edit, /<set field="organizationPartyId" from="posOrganizationPartyId"\/>/, 'terminal edit seller'],
    [terminals, /Invoice seller: \$\{invoiceSeller\?\.organizationName/, 'visible legal seller'],
]) assert.ok(pattern.test(source), `Missing ${caseName} safeguard`);
console.log('POS seller and shop safeguards are present at session, cart, invoice and terminal setup');
