import { create } from "zustand"
import type { Attachment } from "../components/chat/ImageAttachments"

// Content shared from another app, waiting for the chat screen to pick it up.
export interface PendingShare {
  text: string
  attachments: Attachment[]
}
interface ShareState {
  pending: PendingShare | null
  setPending: (p: PendingShare) => void
  take: () => PendingShare | null
}
export const useShare = create<ShareState>((set, get) => ({
  pending: null,
  setPending: (pending) => set({ pending }),
  take: () => {
    const p = get().pending
    if (p) set({ pending: null })
    return p
  },
}))
