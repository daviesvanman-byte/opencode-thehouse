const DB_NAME = 'TheHouseVideos';
const DB_VERSION = 1;
const STORE = 'videos';

interface VideoRecord {
  key: string;
  npcName: string;
  taskDesc: string;
  blob: Blob;
  avatarGLB: string;
  day: number;
  timestamp: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export class VideoCapture {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private recording = false;
  private dbReady: Promise<IDBDatabase>;

  constructor() {
    this.dbReady = openDB();
  }

  /** Start recording from a canvas element */
  startRecording(canvas: HTMLCanvasElement, fps = 15): boolean {
    if (this.recording) return false;
    try {
      if (!canvas.captureStream) return false;
      const stream = canvas.captureStream(fps);
      this.chunks = [];
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      this.mediaRecorder = new MediaRecorder(stream, { mimeType: mime });
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.chunks.push(e.data);
      };
      this.mediaRecorder.start();
      this.recording = true;
      return true;
    } catch (e) {
      console.warn('VideoCapture: not supported:', e);
      return false;
    }
  }

  /** Stop recording and return the blob */
  stopRecording(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || !this.recording) {
        resolve(null);
        return;
      }
      this.mediaRecorder.onstop = () => {
        this.recording = false;
        const blob = new Blob(this.chunks, { type: this.mediaRecorder?.mimeType ?? 'video/webm' });
        this.chunks = [];
        resolve(blob);
      };
      if (this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
      } else {
        this.recording = false;
        resolve(null);
      }
    });
  }

  get isRecording() { return this.recording; }

  /** Save a video blob + metadata to IndexedDB */
  async saveVideo(key: string, npcName: string, taskDesc: string, blob: Blob, avatarGLB: string, day: number): Promise<void> {
    const db = await this.dbReady;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const record: VideoRecord = { key, npcName, taskDesc, blob, avatarGLB, day, timestamp: Date.now() };
      tx.objectStore(STORE).put(record, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /** Load a video record from IndexedDB */
  async loadVideo(key: string): Promise<VideoRecord | null> {
    const db = await this.dbReady;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  /** List all saved video keys */
  async listVideos(): Promise<string[]> {
    const db = await this.dbReady;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAllKeys();
      req.onsuccess = () => resolve(req.result as string[]);
      req.onerror = () => reject(req.error);
    });
  }

  /** Delete a saved video */
  async deleteVideo(key: string): Promise<void> {
    const db = await this.dbReady;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
