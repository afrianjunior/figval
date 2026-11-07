export {
  ensureActivation,
  clearActivation,
  clearIfOriginChanged,
  reinjectIfActive,
} from './activation';
export { captureShots, captureCurrent, CAPTURE_GAP, noShots, type CaptureTarget } from './capture';
export { createNote, updateNote, deleteNote, identityLock, type Lock } from './note-service';
export {
  createSession,
  renameSession,
  deleteSession,
  activateSession,
  updateSettings,
} from './sessions';
export { handle, asHandler, type HandleEnv } from './router';
export { activationKey, missingKey } from './keys';
export { main, program, BackgroundLive } from './main';
