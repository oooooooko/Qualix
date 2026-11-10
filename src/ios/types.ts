export type IosDeviceConfig = {
  id: string;
  name: string;
  wdaBaseUrl: string;
  mjpegUrl: string;
  sessionId?: string;
};

export type IosGeometry = {
  width: number;
  height: number;
  revision: number;
  coordinateSpace: 'wda-points';
};

export type IosPreview = {
  previewSessionId: string;
  deviceId: string;
  platform: 'ios';
  mode: 'native-mjpeg' | 'screenshot-polling';
  status: 'ready' | 'reconnecting' | 'unavailable' | 'closed';
  streamUrl: string;
  frameUrl: string;
  error: string;
  geometry: IosGeometry;
};
