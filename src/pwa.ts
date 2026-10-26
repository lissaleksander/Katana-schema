import { registerSW } from 'virtual:pwa-register';
import { useStore } from './store/store';
import { flushNow } from './store/persistence';

// En ny version laddas inte in mitt i arbetet; en rad visas och användaren laddar om när det passar.
let updateSW: ((reload?: boolean) => Promise<void>) | undefined;

export function initPwa() {
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      useStore.setState({ updateAvailable: true });
    },
  });
}

export async function applyUpdate() {
  await flushNow();
  if (updateSW) await updateSW(true);
  else window.location.reload();
}
