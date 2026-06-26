const PosDB = (function() {
    const DB_NAME = 'ZenithOfflinePosDB';
    const DB_VERSION = 1;
    let db = null;

    function init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            
            request.onerror = (event) => reject('IndexedDB error: ' + event.target.error);
            
            request.onsuccess = (event) => {
                db = event.target.result;
                resolve(db);
            };
            
            request.onupgradeneeded = (event) => {
                const upgradeDb = event.target.result;
                // Products Store
                if (!upgradeDb.objectStoreNames.contains('products')) {
                    const prodStore = upgradeDb.createObjectStore('products', { keyPath: 'productId' });
                    prodStore.createIndex('barcode', 'barcode', { unique: false });
                }
                // Customers Store
                if (!upgradeDb.objectStoreNames.contains('customers')) {
                    upgradeDb.createObjectStore('customers', { keyPath: 'partyId' });
                }
                // Offline Transactions Queue
                if (!upgradeDb.objectStoreNames.contains('syncQueue')) {
                    upgradeDb.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
                }
            };
        });
    }

    // Sync Catalog from Server
    async function syncCatalog(terminalId) {
        try {
            const response = await fetch('Terminal/exportPosCatalog', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ terminalId: terminalId })
            });
            if (!response.ok) throw new Error('Catalog fetch failed');
            
            const data = await response.json();
            
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(['products', 'customers'], 'readwrite');
                const prodStore = transaction.objectStore('products');
                const custStore = transaction.objectStore('customers');
                
                // Clear existing
                prodStore.clear();
                custStore.clear();
                
                // Add new
                if(data.products) data.products.forEach(p => prodStore.put(p));
                if(data.customers) data.customers.forEach(c => custStore.put(c));
                
                transaction.oncomplete = () => resolve(true);
                transaction.onerror = (e) => reject(e);
            });
        } catch(e) {
            console.error("Failed to sync catalog:", e);
            return false;
        }
    }

    // Search Product Local
    function searchProduct(barcodeOrName) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['products'], 'readonly');
            const store = transaction.objectStore('products');
            
            // Try by barcode index first
            const index = store.index('barcode');
            const request = index.get(barcodeOrName);
            
            request.onsuccess = () => {
                if (request.result) {
                    resolve(request.result);
                } else {
                    // Fallback to full scan for name search (simple approach)
                    const allReq = store.getAll();
                    allReq.onsuccess = () => {
                        const match = allReq.result.find(p => p.productName.toLowerCase().includes(barcodeOrName.toLowerCase()));
                        resolve(match || null);
                    };
                }
            };
            request.onerror = (e) => reject(e);
        });
    }

    // Add Offline Transaction
    function queueOfflineTransaction(txnObj) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['syncQueue'], 'readwrite');
            const store = transaction.objectStore('syncQueue');
            const request = store.add(txnObj);
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e);
        });
    }

    // Push Offline Queue to Server
    async function pushQueueToServer(terminalId) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['syncQueue'], 'readwrite');
            const store = transaction.objectStore('syncQueue');
            const allReq = store.getAll();
            
            allReq.onsuccess = async () => {
                const txns = allReq.result;
                if (txns.length === 0) return resolve(0); // Nothing to sync
                
                try {
                    const stringifiedTxns = txns.map(t => JSON.stringify(t));
                    const response = await fetch('Terminal/syncOfflineTransactions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ terminalId: terminalId, transactions: stringifiedTxns })
                    });
                    
                    if (response.ok) {
                        const resData = await response.json();
                        // Clear the queue on success
                        const clearTxn = db.transaction(['syncQueue'], 'readwrite');
                        clearTxn.objectStore('syncQueue').clear();
                        clearTxn.oncomplete = () => resolve(resData.syncedCount || txns.length);
                    } else {
                        throw new Error('Sync endpoint failed');
                    }
                } catch(e) {
                    console.error("Queue push failed", e);
                    reject(e);
                }
            };
        });
    }

    return {
        init,
        syncCatalog,
        searchProduct,
        queueOfflineTransaction,
        pushQueueToServer
    };
})();
