import { sha256 } from "js-sha256";

let db;

function init() {
  let openRequest = indexedDB.open("audioMetadataDB", 1);
  openRequest.onupgradeneeded = function (event) {
    db = event.target.result;
    if (!db.objectStoreNames.contains("tracks")) {
      db.createObjectStore("tracks", { keyPath: "name" });
    }
    if (!db.objectStoreNames.contains("artwork")) {
      db.createObjectStore("artwork", { keyPath: "hash" });
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

async function storeCoverArtGetHash(coverArtData) {
  const coverArtHash = await sha256(coverArtData);
  let tx = db.transaction("artwork", "readwrite");
  let store = tx.objectStore("artwork");
  let request = store.get(coverArtHash);
  await new Promise((resolve, reject) => {
    request.onsuccess = function () {
      if (!request.result) {
        store.add({ hash: coverArtHash, data: coverArtData });
      }
      resolve();
    };
    request.onerror = function () {
      reject(request.error);
    };
  });
  return coverArtHash;
}

async function getCoverArt(hash) {
  let coverArtData;
  let tx = db.transaction("artwork", "readonly");
  let store = tx.objectStore("artwork");
  let request = store.get(hash);
  await new Promise((resolve, reject) => {
    request.onsuccess = function () {
      if (request.result) {
        coverArtData = request.result.data;
      }
      resolve();
    };
    request.onerror = function () {
      reject(request.error);
    };
  });
  return coverArtData;
}

export default {
  init: init,
  storeMetadata: storeMetadata,
  getMetadata: getMetadata,
  storeCoverArtGetHash: storeCoverArtGetHash,
  getCoverArt: getCoverArt,
};
