import { h } from '../dom';

export type ToastKind = 'info' | 'success' | 'warning' | 'error';

/** Show a transient notification in the bottom-right corner. */
export function showToast(message: string, kind: ToastKind = 'info', durationMs = 4500): void {
  const container = document.getElementById('toasts');
  if (!container) {
    console.log(`[toast:${kind}] ${message}`);
    return;
  }
  const toast = h('div', { class: `toast toast-${kind}`, role: kind === 'error' ? 'alert' : 'status' }, message);
  container.append(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, durationMs);
}
