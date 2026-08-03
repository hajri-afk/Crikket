import { reportNonFatalError } from "@crikket/shared/lib/errors"
import { registerDebuggerBackgroundListeners } from "@/lib/bug-report-debugger/engine/background"
import { clearRecordingStateForClosedTab } from "@/lib/capture-context"
import { handleRecorderHotkeyCommand } from "@/lib/recorder-hotkey-commands"

export default defineBackground(() => {
  registerDebuggerBackgroundListeners()

  // Closing the recorder tab ends the recording. Without this the popup would
  // keep showing "Recording now" with no way to stop it.
  chrome.tabs.onRemoved.addListener((tabId) => {
    clearRecordingStateForClosedTab(tabId).catch((error: unknown) => {
      reportNonFatalError(
        `Failed to clear recording state after recorder tab ${tabId} closed`,
        error
      )
    })
  })

  chrome.commands.onCommand.addListener((command) => {
    handleRecorderHotkeyCommand(command).catch(async (error: unknown) => {
      reportNonFatalError("Failed to execute recorder hotkey command", error)
      try {
        await chrome.action.openPopup()
      } catch (openPopupError) {
        reportNonFatalError(
          "Failed to open popup after hotkey failure",
          openPopupError
        )
      }
    })
  })
})
