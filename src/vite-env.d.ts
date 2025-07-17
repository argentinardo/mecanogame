/// <reference types="vite/client" />

interface VirtualKeyboard {
  show: () => void;
  hide: () => void;
  boundingRect: DOMRectReadOnly;
  overlaysContent: boolean;
  ongeometrychange: ((this: VirtualKeyboard, ev: Event) => any) | null;
}

interface Navigator {
  virtualKeyboard?: VirtualKeyboard;
}
