import { mountFeedback, startRecorders } from './mount';

declare global {
  interface Window {
    __prevlyFeedback?: { open(): void; hide(): void };
  }
}

startRecorders();

const widget = mountFeedback({ endpoint: '/_prevly/api/feedback' });

window.__prevlyFeedback = {
  open: () => widget.open(),
  hide: () => widget.unmount(),
};
