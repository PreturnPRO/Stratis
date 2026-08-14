import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * Whether a meeting is capturing audio right now.
 *
 * The shell needs to know because the meeting screen must not unmount while the
 * microphone is open. Leaving the page used to leave a recorder with no owner:
 * the tracks stayed live and kept uploading, the React state that drove the UI
 * was gone, and coming back mounted a second recorder beside the first.
 *
 * Stopping the capture on unmount would have been the other wrong answer — a
 * facilitator who clicks Docket mid-meeting to check something would lose the
 * recording. So the recording outranks navigation: App keeps the meeting
 * mounted for as long as this says true, and hides it instead of dropping it.
 */
interface RecordingValue {
  recording: boolean;
  setRecording: (value: boolean) => void;
}

const RecordingContext = createContext<RecordingValue>({
  recording: false,
  setRecording: () => {},
});

export function RecordingProvider({ children }: { children: ReactNode }) {
  const [recording, setRecordingState] = useState(false);

  const setRecording = useCallback((value: boolean) => {
    setRecordingState(value);
  }, []);

  const value = useMemo(() => ({ recording, setRecording }), [recording, setRecording]);

  return <RecordingContext.Provider value={value}>{children}</RecordingContext.Provider>;
}

export function useRecording(): RecordingValue {
  return useContext(RecordingContext);
}
