let db;

function init() {
    let openRequest = indexedDB.open("audioMetadataDB", 1);
    openRequest.onupgradeneeded = function (event) {
        db = event.target.result;
        if (!db.objectStoreNames.contains("tracks")) {
            db.createObjectStore("tracks", { keyPath: "name" });
        }
    };
    openRequest.onsuccess = function (event) {
        db = event.target.result;
    };
    openRequest.onerror = function (event) {
        console.log("IndexedDB error: " + event.target.errorCode);
    };
}

function storeMetadata(metadata) {
    let tx = db.transaction("tracks", "readwrite");
    let store = tx.objectStore("tracks");
    store.add(metadata);
}

async function getMetadata(file) {
    let metadata;
    let tx = db.transaction("tracks", "readonly");
    let store = tx.objectStore("tracks");
    let request = store.get(file.relativePath);

    await new Promise((resolve, reject) => {
        request.onsuccess = function () {
            if (request.result) {
                metadata = request.result;
            }
            resolve();
        };
        request.onerror = function () {
            reject(request.error);
        };
    });

    return metadata;
}

export default {
    init: init,
    storeMetadata: storeMetadata,
    getMetadata: getMetadata
};