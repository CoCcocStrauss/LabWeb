/** 音频使用IndexedDB保存Blob；localStorage只保存元数据。 */
let connection: Promise<IDBDatabase> | undefined;
function database(): Promise<IDBDatabase> {
  if (!connection) connection = new Promise((resolve, reject) => {
    const request = indexedDB.open("labweb-audio-v1", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("recordings");
      request.result.createObjectStore("chunks");
    };
    request.onsuccess = () => { request.result.onversionchange = () => { request.result.close(); connection = undefined; }; resolve(request.result); };
    request.onerror = () => { connection = undefined; reject(request.error); };
    request.onblocked = () => { connection = undefined; reject(new Error("录音存储被其他页面占用")); };
  });
  return connection;
}
async function write(store: string, key: string | [string, number], value: Blob): Promise<void> {
  const db = await database();
  // ArrayBuffer的结构化克隆兼容性比直接持久化Blob更稳定，读取时再还原。
  const saved = { bytes: await value.arrayBuffer(), type: value.type };
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(store, "readwrite");
    transaction.objectStore(store).put(saved, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = transaction.onabort = () => reject(transaction.error ?? new Error("录音保存失败"));
  });
}
export const saveAudioBlob = (id: string, blob: Blob) => write("recordings", id, blob);
export const saveAudioChunk = (id: string, index: number, blob: Blob) => write("chunks", [id, index], blob);
export async function readAudioBlob(id: string): Promise<Blob | null> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("recordings", "readonly");
    const request = transaction.objectStore("recordings").get(id);
    request.onsuccess = () => {
      const saved = request.result;
      resolve(saved instanceof Blob ? saved : saved?.bytes instanceof ArrayBuffer ? new Blob([saved.bytes], { type: saved.type }) : null);
    };
    request.onerror = () => reject(request.error);
    transaction.onabort = () => reject(transaction.error ?? new Error("录音读取中断"));
  });
}
export async function deleteAudioDraft(id: string): Promise<void> {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(["recordings", "chunks"], "readwrite");
    transaction.objectStore("recordings").delete(id);
    transaction.objectStore("chunks").delete(IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER]));
    transaction.oncomplete = () => resolve();
    transaction.onerror = transaction.onabort = () => reject(transaction.error);
  });
}
export async function blobSha256(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, "0")).join("");
}
