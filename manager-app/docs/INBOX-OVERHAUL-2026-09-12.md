# Inbox and navigation overhaul — September 12, 2026

## Findings from stored email review

The manager database contained 107 messages, with the newest dated September 6.
Reviewed the non-notification correspondence and representative automated mail.
The connected Gmail connector did not expose this business mailbox, so the review
uses the app's imported emails, not a claim that every current Gmail message was read.

- Message 103: SEO audit sales pitch incorrectly marked high priority / needs reply.
- Comedy promotions and a performer suggestion were mixed with other enquiries.
- Bookkeeping, supplier and hiring correspondence lacked distinct categories.
- Message 27 was a group-visit heads-up, not a private-space booking request.
- Multiple inbound messages in the same Gmail thread inflated the reply queue.
- Gmail import repeatedly scanned only the first page and ignored later pages.
- A realtime read/status update could clear a composed reply.
- Several save paths depended on realtime delivery or reported success after failure.
- Operational actions appeared below several dashboard features; mobile navigation
  squeezed seven controls into the bottom bar.

## Delivered

18 stored classifications were corrected after review. Their prior classifications
are preserved under `luna_classification.review_previous`. No email was sent or archived.

Inbox: one latest row per actual Gmail thread, category filters, visible type and
reply status, manager corrections, clear sync errors, older-message pagination,
verified saves, draft retention during updates, and booking conversion only from
a private-booking classification. Contact forms remain separate enquiries.

Dashboard and navigation: prominent operational shortcuts and reply queue; distinct
Private bookings / Public events labels; five mobile tabs with the full menu reachable.

Gmail sync: paginates past imported mail, includes inbox mail regardless of Google's
Promotions/Social tab, looks back 90 days, and surfaces fetch failures. Sync remains
bounded to 40 new messages per pass; a partial import is explicitly displayed.

Classifier: explicit category definitions, real boolean validation, solicitation
cannot become an urgent reply, and an in-flight classification cannot overwrite a
manager correction. Live bridge changes were limited to the classification prompt
and classification function because the deployed bridge contains other changes.

## Validation and deployment

- 292 frontend unit tests passed; production TypeScript/Vite build passed.
- Three Python classifier tests passed.
- Browser checks at 390px and 1440px: thread grouping, category filter, saving a
  correction, retained reply draft, correct booking-action visibility, no page overflow.
- Production database verified manager message-write access in a rolled-back test.
- Frontend Netlify deploy: `6aa611857b730690e12ec99f`.
- `gmail-sync` deployed with its pagination helper.
- User service `luna-iggys-bridge.service` restarted and verified active. Live backup:
  `/home/bradley/projects/iggys-bridge/luna_iggys_bridge.py.before-inbox-20260912`.

## Follow-up for operations

Message 105 is the September 23 client's follow-up about pricing, karaoke, appetizers
and the drinks arrangement. Its reply flag remains in place. Message 107 requests
a logistics call for the September 22 enquiry but is already marked replied.
Check the current Gmail conversation before deciding either is overdue. Older
completed-event correspondence was not automatically archived or marked answered.

This pass covers inbox reliability, classification and primary navigation. It is
not a verification of every workflow on every management screen. Live authenticated
Gmail import/reply-history access still needs a manager session; no customer reply
was used as a test.
