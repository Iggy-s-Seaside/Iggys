import { createContext, useContext, useCallback, useRef, type ReactNode } from 'react';

interface VideoRefRegistry {
  /** Register a video element for a layer (call on mount) */
  register: (layerId: string, el: HTMLVideoElement) => void;
  /** Unregister a video element (call on unmount) */
  unregister: (layerId: string) => void;
  /** Get all registered video elements */
  getAll: () => Map<string, HTMLVideoElement>;
  /** Get a single video element by layer ID */
  get: (layerId: string) => HTMLVideoElement | undefined;
  /** Seek all videos to a timestamp and wait for seeked events */
  seekAll: (time: number) => Promise<void>;
  /** Check if any video layers are registered */
  hasVideos: () => boolean;
}

const VideoRefContext = createContext<VideoRefRegistry | null>(null);

export function VideoRefProvider({ children }: { children: ReactNode }) {
  const refs = useRef<Map<string, HTMLVideoElement>>(new Map());

  const register = useCallback((layerId: string, el: HTMLVideoElement) => {
    refs.current.set(layerId, el);
  }, []);

  const unregister = useCallback((layerId: string) => {
    refs.current.delete(layerId);
  }, []);

  const getAll = useCallback(() => {
    return new Map(refs.current);
  }, []);

  const get = useCallback((layerId: string) => {
    return refs.current.get(layerId);
  }, []);

  const seekAll = useCallback(async (time: number): Promise<void> => {
    const promises: Promise<void>[] = [];

    for (const [, video] of refs.current) {
      if (video.readyState < 1) continue; // Skip unloaded videos

      promises.push(new Promise<void>((resolve) => {
        // If already at the right time, skip
        if (Math.abs(video.currentTime - time) < 0.01) {
          resolve();
          return;
        }

        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked);
          resolve();
        };
        video.addEventListener('seeked', onSeeked);
        video.currentTime = time;

        // Timeout safety — don't hang forever if seeked never fires
        setTimeout(() => {
          video.removeEventListener('seeked', onSeeked);
          resolve();
        }, 2000);
      }));
    }

    await Promise.all(promises);
  }, []);

  const hasVideos = useCallback(() => {
    return refs.current.size > 0;
  }, []);

  const registry: VideoRefRegistry = {
    register,
    unregister,
    getAll,
    get,
    seekAll,
    hasVideos,
  };

  return (
    <VideoRefContext.Provider value={registry}>
      {children}
    </VideoRefContext.Provider>
  );
}

export function useVideoRefs(): VideoRefRegistry {
  const ctx = useContext(VideoRefContext);
  if (!ctx) {
    throw new Error('useVideoRefs must be used within a VideoRefProvider');
  }
  return ctx;
}
