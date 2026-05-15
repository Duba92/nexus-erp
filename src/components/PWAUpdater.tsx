import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';
import { Button } from '@/src/components/ui/button';

export function PWAUpdater() {
  const sw = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ' + r);
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  const offlineReadyArray = sw?.offlineReady;
  const needUpdateArray = sw?.needUpdate;
  const updateServiceWorker = sw?.updateServiceWorker;

  const [offlineReady, setOfflineReady] = Array.isArray(offlineReadyArray) 
    ? offlineReadyArray 
    : [false, () => {}];
    
  const [needUpdate, setNeedUpdate] = Array.isArray(needUpdateArray) 
    ? needUpdateArray 
    : [false, () => {}];

  useEffect(() => {
    if (offlineReady) {
      toast.success('App is ready to work offline');
      setOfflineReady(false);
    }
  }, [offlineReady, setOfflineReady]);

  useEffect(() => {
    if (needUpdate) {
      toast('A new version is available!', {
        action: {
          label: 'Update',
          onClick: () => updateServiceWorker?.(true),
        },
        duration: Infinity,
      });
    }
  }, [needUpdate, updateServiceWorker]);

  return null;
}
