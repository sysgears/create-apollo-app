import * as os from 'os';

const shouldSnapshot = ($mobileHelper, platform, bundle) => {
  const platformSupportsSnapshot = $mobileHelper.isAndroidPlatform(platform);
  const osSupportsSnapshot = os.type() !== 'Windows_NT';
  return bundle && platformSupportsSnapshot && osSupportsSnapshot;
};

export { shouldSnapshot };
