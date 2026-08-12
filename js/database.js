/**
 * SweetDream
 * Local IndexedDB Interface
 */

let dbInstance = null;
const DB_NAME = "SweetDream_RuntimeDB";
const STORE_NAME = "playerProfile";

/**
 * 初始化并打开数据库
 */
function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "id" });
            }
        };

        request.onsuccess = (event) => {
            dbInstance = event.target.result;
            resolve();
        };

        request.onerror = (event) => {
            console.error("数据库打开失败:", event.target.error);
            reject(event.target.error);
        };
    });
}

/**
 * 存储玩家创建好的角色对象
 */
function saveCharacterDB(playerObject) {
    return new Promise((resolve, reject) => {
        if (!dbInstance) {
            reject(new Error("数据库未初始化"));
            return;
        }

        const transaction = dbInstance.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);

        // 统一赋予主键 id: "main_player" 方便后续 Runtime 单档读取
        const dataToSave = { id: "main_player", ...playerObject };
        const request = store.put(dataToSave);

        request.onsuccess = () => {
            console.log("玩家特征数据已写入 IndexedDB");
            resolve();
        };

        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}
