export const GOLDEN_ZONE_RATIO = 0.35;
export const CORE_SIZE = 64;
export const USE_NATIVE_DRIVER = true;

export function getGoldenZoneHeight(windowHeight: number): number {
  return windowHeight * GOLDEN_ZONE_RATIO;
}

export function getCoreAnchor(locationX: number, locationY: number) {
  return { left: locationX - CORE_SIZE / 2, top: locationY - CORE_SIZE / 2 };
}

export type GoldenZoneRuntime = {
  grant: (x: number, y: number) => { left: number; top: number };
  release: () => void;
  dispose: () => void;
};

export function createGoldenZoneRuntime(options: {
  onPttStart: () => void;
  onPttEnd: () => void;
  startSonar: () => { stop: () => void };
}): GoldenZoneRuntime {
  let armed = false;
  let sonar: { stop: () => void } | null = null;
  const halt = () => {
    sonar?.stop();
    sonar = null;
  };
  return {
    grant(x, y) {
      halt();
      armed = true;
      sonar = options.startSonar();
      options.onPttStart();
      return getCoreAnchor(x, y);
    },
    release() {
      if (!armed) return;
      armed = false;
      halt();
      options.onPttEnd();
    },
    dispose() {
      halt();
      if (!armed) return;
      armed = false;
      options.onPttEnd();
    },
  };
}
