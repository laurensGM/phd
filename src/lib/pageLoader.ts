type PhDLoaderApi = {
  show: () => void;
  hide: () => void;
  ready: () => void;
};

declare global {
  interface Window {
    PhDLoader?: PhDLoaderApi;
  }
}

export function showPageLoader(): void {
  if (typeof window === 'undefined') return;
  window.PhDLoader?.show();
}

export function hidePageLoader(): void {
  if (typeof window === 'undefined') return;
  window.PhDLoader?.hide();
}

export function readyPageLoader(): void {
  if (typeof window === 'undefined') return;
  window.PhDLoader?.ready();
}
