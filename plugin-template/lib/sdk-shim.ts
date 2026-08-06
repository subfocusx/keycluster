let _ctx: any = null;
export function __setCtx(ctx: any) { _ctx = ctx; }

export function useAppStore(selector?: (s: any) => any) {
  const state = _ctx?.store.getState();
  return selector ? selector(state) : state;
}
(useAppStore as any).getState = () => _ctx?.store.getState();
(useAppStore as any).setState = (partial: any) => _ctx?.store.setState(partial);

export function toast(options: { title?: string; description?: string; duration?: number }) {
  _ctx?.eventBus.emit('notify', { message: options.title ?? '' });
}
