import { installSnapshotArtefacts } from '../snapshot/android/project-snapshot-generator';
import * as utils from './utils';

export function afterPrepare($mobileHelper, $projectData, hookArgs) {
  const env = hookArgs.env || {};

  if (env.snapshot && utils.shouldSnapshot($mobileHelper, hookArgs.platform, hookArgs.appFilesUpdaterOptions.bundle)) {
    installSnapshotArtefacts($projectData.projectDir);
  }
}
