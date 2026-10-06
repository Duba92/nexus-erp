import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ulee.app',
  appName: 'hullee-pos',
  webDir: 'dist'
  server: {
    androidScheme: 'https'
  }
};

export default config;
