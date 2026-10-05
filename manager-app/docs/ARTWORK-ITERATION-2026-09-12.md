# Artwork and navigation iteration

Removed Home's Run the bar and manual bar check-in sections. Removed opening/closing service links from manager and employee navigation, task search and relevant Help entries. Old /shift routes redirect to the waitlist; operational history is not deleted. Heartland remains the user's opening/closing system; no new Heartland integration was added.

Artwork opens in a simple view with three neutral layouts, editable text fields, photo selection/upload, picture shape, colour and a live canvas preview. Save, download, undo and redo remain visible. Advanced tools are available through More tools. Replacing a layout requires a clear confirmation and remains undoable. Food templates are omitted from the built-in picker. Starting templates contain prompts for approved copy rather than invented offers.

Fixed the save/reopen workflow: specials.editor_state now stores the editable document separately from its exported image. Local media is uploaded before saving so designs work across devices. Failed media/preview uploads abort the record update and leave the editor available for retry. Existing artwork loads once rather than resetting in-progress changes on realtime refresh. Date/time fields use local form values that round-trip the stored timestamp. New artwork defaults to unpublished; existing publication status is preserved. Copies retain the editable document.

Legacy specials only have flattened images. Their original layers cannot be reconstructed; the editor explains this and offers a new layout or text overlay. Previously saved artwork remains available.

Draft restoration is a persistent choice, with autosave and beforeunload writes paused until that choice is made. Empty untouched canvases do not create drafts. Saved designs can be loaded before any editing; missing records and load failures have explicit states.

Verification: 303 unit tests, TypeScript/Vite build and git diff checks passed. Browser tests at 390 and 1440 pixels covered layout selection, text editing, PNG downloads, unpublished save defaults, navigation removal, advanced/simple switching and undo after replacing a layout. A focused save flow covered create, reopen with editable text, upload failure without overwriting the saved record and successful retry. Another test held the draft prompt open past the autosave interval and verified that the existing draft remained intact. A transactional authenticated database write verified JSON document storage and was rolled back. Supabase advisors reported no specials-specific finding.

Database reference: [Supabase JSON documentation](https://supabase.com/docs/guides/database/json).

Published to https://iggysmanagement.netlify.app with Netlify deploy `6aa63fa19e2cb99f0ba0a97f`. Production bundle matches the tested build; the editor route still requires login.
