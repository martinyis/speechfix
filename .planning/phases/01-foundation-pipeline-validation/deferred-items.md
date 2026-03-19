# Deferred Items - Phase 01

## Pre-existing Issues (Out of Scope)

1. **TypeScript error in mobile/hooks/useRecording.ts:28** - `Property 'isRecording' does not exist on type 'RecordingStatus'`. The status listener callback references `status.isRecording` but `RecordingStatus` from expo-audio may not have this property. The callback body is a no-op so this has no runtime impact. Created in plan 01-02.
