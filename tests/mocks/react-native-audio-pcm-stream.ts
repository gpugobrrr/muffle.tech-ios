const listeners: Array<(data: string) => void> = [];

const LiveAudioStream = {
  init: () => undefined,
  start: () => undefined,
  stop: async () => '',
  on: (_event: 'data', callback: (data: string) => void) => {
    listeners.push(callback);
  },
};

export default LiveAudioStream;
