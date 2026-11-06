// The small Chrome API surface used by this spike (no broad ambient `any`).
declare namespace chrome {
  namespace runtime {
    interface MessageSender { id?: string; url?: string; documentId?: string; tab?: { id?: number; windowId?: number } }
    const id: string;
    function getURL(path: string): string;
    function sendMessage(message: unknown): Promise<unknown>;
    const onMessage: { addListener(listener: (message: unknown, sender: MessageSender, respond: (value: unknown) => void) => boolean | void): void };
  }
  namespace storage {
    interface Area {
      get(key: string | null): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
      remove(key: string): Promise<void>;
    }
    const local: Area;
    const session: Area;
  }
  namespace permissions {
    function request(permissions: { origins: string[] }): Promise<boolean>;
    function contains(permissions: { origins: string[] }): Promise<boolean>;
    function remove(permissions: { origins: string[] }): Promise<boolean>;
  }
  namespace windows {
    function create(options: { url: string; type: 'popup'; width: number; height: number }): Promise<{ id?: number }>;
    function remove(id: number): Promise<void>;
    const onRemoved: { addListener(listener: (windowId: number) => void): void };
  }
}
