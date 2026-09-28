import { endpointFromScriptAttr } from './endpoint';
import { mountFeedback, startRecorders } from './mount';

declare global {
  interface Window {
    __prevlyFeedback?: { open(): void; hide(): void };
  }
}

// document.currentScript is only non-null while this script first executes:
// read it now, since it is null by the time any callback below runs.
const endpoint = endpointFromScriptAttr(
  (document.currentScript as HTMLScriptElement | null)?.getAttribute('data-endpoint'),
);

startRecorders();

const widget = mountFeedback({ endpoint });

window.__prevlyFeedback = {
  open: () => widget.open(),
  hide: () => widget.unmount(),
};
