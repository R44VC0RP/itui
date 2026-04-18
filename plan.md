# Web Client Plan For `itui`

## Intent

This plan is for building a browser-first web client on top of the existing `itui` architecture, while keeping the current Swift backend model intact.

Core decisions already made:

- Keep the current backend shape: `imsg` remains the macOS service that reads `chat.db`, resolves contacts, and sends via Messages automation.
- Keep runtime simple: production should still be a single `imsg` service on the host Mac.
- Treat the web app as bundled static assets served by `imsg`.
- Use `imessage-kit` as a reference and source of ideas, not as the primary backend.
- Use Vite + React + Tailwind + shadcn/ui for the frontend.
- Keep the chat interface hand-composed with shadcn primitives rather than leaning on AI-oriented component libraries.
- Do not do new TUI feature work in this plan.
- Keep Tailscale optional and explicit. Do not bake Tailscale assumptions into the open source default path.
- Stay away from private API features for now, but document them as a future expansion path.

Current direction update:

- AI Elements was evaluated during Phase 0 and rejected for the core chat UI.
- The reasons were practical, not ideological:
  - it pulled in AI SDK-oriented assumptions we do not need yet
  - it introduced markdown/highlighting-heavy bundle weight that is not appropriate for an iMessage-style client
  - the resulting surface felt more like an AI chat demo than a native-feeling messaging app
- The active frontend plan is now shadcn-only, with light custom layout code where needed.

## Current Status

- Phase 0 is effectively complete.
- Phase 1 is effectively complete for the current architecture.
- Phase 2 core client plumbing is now in place.
- Phase 4 is effectively complete for the current browser scope.
- Phase 5 is effectively complete for the current browser scope.
- The post-baseline product enhancement track is now in place for search quality, message actions, and conversation-detail polish.
- The repo now has a dedicated `web/` workspace with Vite, React, Tailwind, and shadcn/ui.
- The baseline browser shell is now shadcn-first and intentionally avoids AI-chat abstractions.
- The AI Elements and markdown-heavy prototype path has been removed from the active frontend implementation.
- `scripts/build-web.sh` builds the frontend and copies hashed assets into `Sources/imsg/Resources/web/`.
- The Swift app serves the generated bundle and `swift build -c debug --product imsg` completes with the copied web assets.
- The web client now talks directly to the existing `imsg` backend for:
  - chat list loading
  - message history loading
  - sending
  - live updates via `/api/events`
- The browser client is now split into a maintainable feature layer under `web/src/features/messages/`, with separate services, hooks, components, types, and pure utilities; `App.tsx` is now just a thin entrypoint.
- The message feature no longer relies on a single monolithic controller hook; it is now split into focused hooks for data/query state, realtime, compose picking, and composer/send flow, with `useMessagesController` reduced to orchestration.
- The composer stack is now further split so attachment interaction state and draft-conversation message state are separate hooks rather than being buried inside the send pipeline.
- Live reaction events are now reconciled into the affected message rows instead of only surfacing as hidden reaction-event messages.
- The thread view now renders inbound attachments in-line using the existing attachment-serving API, with image previews and file-download affordances.
- The browser client now has a new-message picker backed by the existing contacts endpoint, with direct-recipient sends for starting new 1:1 conversations.
- The browser composer now supports outbound attachment sending from the browser using a staged-upload flow on the Swift backend.
- Multi-select attachment sends now work in the browser client by sending queued files sequentially over the existing single-attachment backend contract.
- The browser composer now also supports drag-and-drop and paste-to-attach flows, plus explicit queued/uploading/sending/failed attachment states instead of a single opaque global spinner.
- SSE reconnect now performs a lightweight resync pass so chat ordering and the active thread recover more cleanly after interruptions.
- The staged-upload path now normalizes filename and MIME metadata more defensively and avoids reserved metadata filename collisions inside the upload cache.
- The mobile conversation list now uses a shadcn `Sheet` drawer instead of the earlier stacked mobile layout.
- Vite dev can proxy `/api` to a local or remote `imsg serve` instance through `VITE_IMSG_PROXY_TARGET`, keeping browser development same-origin even when the backend is elsewhere.
- The current browser shell is now data-backed rather than demo-backed.
- `/api/chats` now includes first-class preview text, so the sidebar no longer does per-thread latest-message hydration on initial load.
- Contact and avatar identity are now normalized more consistently across the sidebar, thread header, and compose flow, with group threads avoiding misleading single-person avatars.
- Thread identity presentation is now centralized in a dedicated module, so the sidebar, thread header, compose picker, and in-thread sender treatment all derive title, subtitle, avatar stack, and fallback behavior from one source of truth.
- Conversation message reconciliation is now centralized in a dedicated module, including optimistic-local message creation, local/server merge behavior, reaction-event reconciliation, and local delivery-state updates.
- Outgoing sends now create local timeline entries immediately, keep failed sends retryable in place, and reconcile cleanly against backend echoes instead of forcing all state through the composer surface.
- Group-thread rendering now avoids grouping adjacent incoming messages from different senders and shows sender identity more explicitly in the thread.
- The thread view now supports richer media behavior:
  - inline image preview with an in-app lightbox
  - inline video playback
  - inline audio playback
  - stronger file rows for non-previewable attachments
- The thread UI now includes message-level action menus for copy/open/download/retry workflows instead of leaving those affordances implicit.
- Conversation search and compose search now use ranked matching instead of plain substring filtering, with better priority for exact handles, titles, and participant identity.
- The shell now has a real conversation-details surface for inspecting participants, copying handles, and understanding the active thread at a glance.
- Rich-link URL balloons are now treated as links in the browser client instead of as opaque downloadable file rows, and plain URL text is clickable in-thread.
- The browser client now supports URL-level deep linking for thread selection through query state, so a specific conversation can be reopened directly from a shared browser URL.
- Browser-unsafe Messages media now has a derived-preview path:
  - HEIC/HEIF images
  - sticker and memoji media that lives under `~/Library/Messages/StickerCache`
  - non-inline video formats like QuickTime `.mov`
- The attachment-serving layer now safely allows both `~/Library/Messages/Attachments` and `~/Library/Messages/StickerCache`, instead of assuming every attachment lives under the normal attachments tree.
- Thread service presentation now distinguishes RCS from iMessage instead of collapsing every non-SMS conversation into the blue/iMessage bucket.
- The new-message flow now supports direct keyboard-first phone/email entry more explicitly, including Enter-to-compose behavior and safer dialog remount/reset behavior on reopen.
- Draft conversations no longer hardcode blue `iMessage` styling for unknown direct-recipient sends; draft transport can now stay `auto` until the real thread resolves.
- Direct `service=auto` sends on the Swift backend now attempt iMessage first and fall back to SMS for phone-number recipients when the iMessage direct-send path fails.
- The web workspace now has a lightweight Vitest harness covering thread identity, message reconciliation, and utility behavior that is critical to previews, optimistic send flow, and realtime updates.
- Root README, `web/README.md`, and `AGENTS.md` now document the browser runtime, Vite proxy workflow, and the standard local/remote development loop.
- The current frontend build, Swift build, frontend tests, and full Swift test suite are all green in the fork.

## Primary Outcomes

- A modern web UI served directly by `imsg serve`.
- A clean frontend build pipeline that produces assets embedded into the Swift bundle.
- An optional documented Tailscale Serve path that users can enable locally without becoming a core project assumption.
- A repo structure that stays understandable for upstreaming or long-lived fork maintenance.

## Key Constraints

- The backend must run in the logged-in macOS user session, not as a system daemon.
- Messages access, Contacts access, and AppleEvents automation remain user-context concerns.
- The repo is open source, so defaults must stay generic:
  - no secrets in repo
  - no user-specific hostnames or tailnet names in tracked files
  - no Tailscale-only assumptions in the normal startup path
- The current repo already has a minimal web UI under `Sources/imsg/Resources/web/`; this plan replaces that with a real frontend build system instead of layering ad hoc JavaScript on top of it.

## References

- Fork: `https://github.com/rblalock/itui`
- Upstream: `https://github.com/R44VC0RP/itui`
- `imessage-kit`: `https://github.com/photon-hq/imessage-kit`
- shadcn/ui installation: `https://ui.shadcn.com/docs/installation`
- shadcn/ui CLI: `https://ui.shadcn.com/docs/cli`
- shadcn/ui skills: `https://ui.shadcn.com/docs/skills`
- Tailscale Serve docs: `https://tailscale.com/docs/features/tailscale-serve`

## Project-Specific Recommendations

### 1. Keep Swift At Runtime

The cleanest deployment shape for this fork is:

- Swift backend at runtime
- frontend compiled ahead of time
- static web assets embedded into the `imsg` bundle
- a single `imsg` process serving both API and frontend

This avoids requiring Node or Bun on the host Mac in production just to host the UI.

### 2. Add A Dedicated Frontend Workspace

The current repo should gain a real frontend app instead of continuing to edit files directly under `Sources/imsg/Resources/web/`.

Recommended target:

- `web/` for the Vite app
- built output copied into `Sources/imsg/Resources/web/`
- the Swift package continues to bundle files from `Sources/imsg/Resources/web/`

### 3. Keep Tailscale User-Managed By Default

The default plan should not make `itui` responsible for managing Tailscale itself.

The cleaner open source shape is:

- `imsg serve` for normal runtime
- docs and hint text showing users what `tailscale serve` command to run locally if they want tailnet browser access

This keeps Tailscale optional, avoids inflating the base runtime command, and avoids turning the project into a Tailscale lifecycle manager.

If we later find a strong reason to add helper commands or a `--tailscale` mode, that should come after the core service model is stable.

### 4. Keep The Chat UI Shadcn-First

The web client should be composed directly from shadcn primitives plus a small amount of custom layout code.

That means:

- no AI SDK dependency in the baseline messaging client
- no markdown- or syntax-highlighting-oriented message renderer in the baseline client
- no AI-chat visual language leaking into the default product surface
- use shadcn as the design system and composition layer, then write the messaging-specific chrome ourselves

## Proposed Repo Evolution

Target repo shape after the first several phases:

- `web/`
- `web/src/...`
- `web/public/...`
- `web/components.json`
- `Sources/imsg/Resources/web/...` as generated build output only
- `scripts/build-web.sh`
- `scripts/dev-web.sh`
- `docs/web-architecture.md`
- `docs/tailscale.md`

The goal is to make it obvious which files are hand-authored frontend source and which files are bundled output.

## Phase 0 - Foundation And Proofs

### Goal

Establish the frontend workspace and prove the build boundary between Vite and `imsg`.

### Work

- Clone the forked repo structure into a stable local dev environment.
- Add a dedicated `web/` app.
- Initialize Vite + React + TypeScript.
- Add Tailwind.
- Add shadcn/ui in the frontend app, not at repo root.
- Use your shadcn preset `bKsE3ZA0`, but do it carefully:
  - generate in a temp directory first
  - inspect the produced files
  - copy in the parts we actually want
  - do not blindly scaffold over repo root
- Install the shadcn skill after `components.json` exists.
- Decide how frontend aliases map into repo structure.
- Decide where Vite build output lands before it is copied into `Sources/imsg/Resources/web/`.
- Add a simple bundling script that turns `web/dist` into the embedded asset directory.
- Validate that the initial chat shell can be built cleanly with shadcn components alone.
- Keep the dependency graph appropriate for a non-AI messaging client.

### Exit Criteria

- `web/` exists and builds.
- shadcn is working with the chosen theme.
- the frontend can be built and copied into the existing Swift asset bundle location.
- the repo has a clear source-vs-generated boundary.
- the browser shell reads like a messaging product surface, not an architecture demo.

## Phase 1 - Frontend Build And Runtime Integration

### Goal

Turn the proof into a durable development and production workflow.

### Work

- Add a development workflow for:
  - Vite dev server
  - local or remote `imsg serve`
  - API proxying during frontend development
- Decide whether frontend development will proxy to:
  - local `imsg serve`
  - SSH tunnel to the remote host
  - direct tailnet URL during remote development
- Add a production build workflow that:
  - builds the frontend
  - copies output into `Sources/imsg/Resources/web/`
  - ensures the Swift package serves the generated files
- Replace the current hand-written `index.html`, `app.js`, and `styles.css` workflow with generated assets.
- Confirm cache behavior for generated assets and hashed filenames.
- Confirm the Swift static file serving path still works cleanly with a modern frontend bundle.

### Exit Criteria

- `imsg serve` can serve the compiled Vite app.
- the frontend can be developed with a real local dev loop.
- there is no ambiguity about how assets move from `web/` into the Swift bundle.

### Phase Notes

- This phase is effectively complete in the fork as it exists now.
- `web/` is the source workspace, `Sources/imsg/Resources/web/` is generated output, and `scripts/build-web.sh` is the build/copy boundary.
- Vite development now supports a simple same-origin proxy path through `VITE_IMSG_PROXY_TARGET` for local, SSH-tunneled, or tailnet-hosted `imsg serve` instances.

## Phase 2 - Browser Client Architecture

### Goal

Create the real application shell and establish a maintainable browser client architecture before deep feature work.

### Work

- Build a thin frontend client layer around the existing `imsg` backend contract, similar in spirit to the current TUI client.
- Do not introduce a second backend, proxy server, or alternate API service for the browser app.
- Define TypeScript types for:
  - chats
  - messages
  - reactions
  - contacts
  - attachments
  - stream events
- Wrap the existing `imsg` REST endpoints and event stream in typed frontend helpers and/or hooks so UI components are not doing raw `fetch` and stream parsing directly.
- Evaluate event transport for the browser client:
  - SSE as primary browser-friendly path
  - WebSocket as an available path for future richer interaction
- Decide whether the web client standardizes on SSE, WebSocket, or supports both internally.
- Build app-wide state management for:
  - current chat
  - chat list
  - message history
  - stream lifecycle
  - composer state
  - optimistic send state
- Add proper loading, reconnect, and error boundaries.
- Define mobile vs desktop navigation behavior up front.

### Exit Criteria

- the web app has a stable internal client architecture
- stream handling is not coupled to view components
- transport choice is explicit, not accidental

### Phase Notes

- The thin typed frontend client layer now exists and is aligned with the existing TUI approach, not a second backend.
- The current implementation standardizes on SSE for browser live updates.
- The browser client is now organized as a real feature slice, with separate service, controller-hook, component, type, and utility layers instead of continuing to grow `App.tsx`.
- The controller layer itself is now decomposed into focused hooks:
  - data/query state
  - realtime stream lifecycle
  - compose picker state
  - composer/send state
- The composer/send layer is now also decomposed:
  - attachment queue and drag/paste interaction state
  - draft-conversation optimistic message state
  - send/reconciliation orchestration
- State is now split cleanly between:
  - chat list
  - per-chat message history
  - unread counts
  - composer state
  - stream lifecycle
- `/api/chats` now exposes a first-class preview field, and the browser client uses that as the initial sidebar source of truth instead of hydrating previews with extra per-thread history calls.

## Phase 3 - Conversation Shell And Core UX

### Goal

Replace the current minimal web UI with a polished, browser-native conversation experience.

### Work

- Build the main app layout using shadcn primitives.
- Implement:
  - conversation list
  - conversation header
  - message timeline
  - composer area
  - empty/loading/error states
- Keep the surface dense, direct, and iMessage-like:
  - less ornamental chrome
  - fewer nested rounded containers
  - stronger message-first hierarchy
  - minimal explanatory copy in the user-facing UI
- Prefer transport-aware timeline styling over transport badges in the header:
  - outgoing iMessage bubbles should read as blue
  - outgoing SMS bubbles should read as green
  - incoming bubbles stay neutral
- Implement the messaging-specific pieces directly rather than importing AI-chat abstractions.
- Keep the design grounded in your chosen shadcn preset instead of generic defaults.
- Preserve good mobile behavior:
  - sidebar collapse
  - touch-friendly controls
  - narrow-screen composer behavior
- Add sensible keyboard behavior for desktop web.
- Preserve feature parity with the existing simple web client for:
  - loading chats
  - opening threads
  - sending plain text
  - receiving live updates

### Exit Criteria

- the browser client is a credible daily-use interface for text messaging
- mobile and desktop both work well
- the app feels like a real product surface, not a debug page

## Phase 4 - Message Flow, Realtime, And Reliability

### Goal

Make the chat experience trustworthy and resilient under real usage.

### Work

- Implement live incoming message updates.
- Implement outgoing message UX with clear send states.
- Add a new-conversation compose flow for direct 1:1 sends using the existing `POST /api/send` path with `to`.
- Add optimistic UI carefully, without creating duplicate messages on stream replay.
- Handle reconnect behavior cleanly:
  - refresh missed messages
  - recover after stream interruption
  - avoid duplicate inserts
- Add message grouping, timestamps, and sender labeling where appropriate.
- Add chat list freshness rules so the sidebar updates correctly on new activity.
- Make live updates work even when the active chat is not the one receiving a message.
- Decide how message ordering is handled when send confirmation and stream delivery race each other.
- Carry over any useful ideas from `imessage-kit` around watcher confirmation and message matching.
- Be explicit about scope:
  - starting a new 1:1 conversation is supported by the current backend because `send` accepts a direct recipient handle
  - creating an empty thread with no first message is not a separate backend primitive today
  - new group-conversation compose is a separate problem and is not covered by the current single-recipient send contract

### Exit Criteria

- live updates are stable
- outgoing sends are understandable to the user
- reconnect behavior does not create a broken or confusing timeline

### Phase Notes

- Realtime inserts are now deduplicated at the message row level in the browser client.
- Live reaction events now update the target message's reaction rail instead of requiring a full thread reload to show tapbacks.
- Stream reconnect now reuses `since_rowid` replay and also triggers a lightweight chat/thread refresh pass so the browser state heals after interruptions.
- Outgoing send errors now surface backend error text instead of collapsing to opaque status-only failures.
- The composer now exposes clearer outgoing send states, including queued/uploading/sending/failed attachment feedback instead of relying only on the submit-button spinner.
- Attachment removal is now intentionally disabled while a send is in flight so the queued payload cannot mutate underneath the send pipeline.
- New-conversation compose now exists for direct 1:1 sends, using `to` on the existing send endpoint.
- Outgoing sends now create optimistic local timeline entries immediately, rather than waiting for a refresh pass before the user sees their message in the thread.
- The browser no longer inserts a transient `Sending…` status line under optimistic outgoing bubbles, avoiding a visible layout jump as sends complete.
- The composer text area now stays focusable during send, so keyboard flow can continue into the next draft instead of blurring on every send.
- The optimistic-send layer now mirrors the real backend send contract more closely:
  - text-only sends become a single optimistic message
  - multi-attachment sends become multiple optimistic messages, matching the current single-attachment send pipeline on the backend
- Failed local messages now stay in the timeline with explicit retry affordances instead of disappearing back into the composer.
- Shared thread identity and shared message reconciliation logic now live in dedicated pure modules instead of being reimplemented piecemeal in hooks and components.
- Group-thread message grouping now accounts for sender identity, so adjacent messages from different people no longer collapse into one visual run.
- Direct-send transport is now less misleading and more resilient:
  - new draft conversations can keep an `auto` transport state instead of pretending to be iMessage up front
  - backend direct sends with `service=auto` now try iMessage first and retry as SMS for phone-number recipients when appropriate
- Existing 1:1 thread sends now prefer the chat GUID over a phone-like chat identifier, so SMS/RCS threads keep routing through the existing Messages conversation instead of accidentally falling back to the direct auto/iMessage send path.
- The remaining open question is broader conversation bootstrapping, especially new-group compose.

## Phase 5 - Attachments, Contacts, And Media

### Goal

Complete the browser client so it handles the media and identity parts of iMessage, not just text.

### Work

- Improve avatar and contact presentation using the existing contact endpoints.
- Use the existing contacts/resolve surfaces to support recipient lookup and confirmation in the new-conversation flow.
- Render attachments in-thread using the existing attachment-serving API.
- Support image preview and file download behavior.
- Decide how to represent unsupported or unknown attachment types.
- Add browser-side attachment sending support.

Browser attachment sending required explicit server work because the current send API is path-based for local files. The chosen design in this fork is:

- a staged upload endpoint that accepts raw file bytes from the browser
- an opaque `upload_id` passed into the existing send request
- server-side cleanup of staged uploads after send success or failure
- browser multi-select handled as sequential sends on top of the existing single-attachment backend contract

- Confirm that attachment handling never allows arbitrary filesystem reads outside the intended Messages attachment and controlled temp-file paths.

### Exit Criteria

- the web client supports the full normal messaging flow:
  - text
  - inbound attachments
  - outbound attachments
  - contacts/avatars

### Phase Notes

- Inbound attachments now render directly in the thread UI.
- Image attachments open in an in-app lightbox; video and audio attachments now render inline where the browser can play them; non-previewable attachments render as download rows.
- Recipient picking for new conversations now uses the existing contacts surface and also allows manual phone/email entry.
- The compose dialog now supports direct Enter-to-send recipient selection and remounts cleanly on reopen so repeated use does not preserve broken scroll/layout state.
- Browser-side attachment sending now exists through the staged upload flow on the Swift backend.
- The browser composer now supports selecting, removing, previewing, drag-dropping, pasting, and sending outbound attachments.
- The current implementation sends multi-selected attachments sequentially so it fits the existing single-attachment send contract without introducing a second backend.
- The staged upload path now defends against reserved metadata filename collisions and normalizes suspicious MIME metadata to a safe fallback before the file is handed off for send.
- Rich-link URL previews now render as actual clickable links in the timeline rather than masquerading as generic file attachments with unreadable downloaded payloads.
- The browser client now uses a dedicated attachment-preview path for media that the browser cannot render directly from the Messages store, instead of treating those files as broken inline media or opaque downloads:
  - HEIC/HEIF images render through a derived preview
  - sticker/memoji media stored in `StickerCache` can now be served safely and previewed
  - QuickTime `.mov` attachments now fall back to poster-card presentation instead of a broken inline player
- Thread identity is now more deliberate:
  - 1:1 threads prefer resolved contact names over raw handles when possible
  - group threads avoid reusing a single participant avatar as though it were the whole group
  - inline/base64 avatar data can now be consumed directly when present
- Thread identity is now rendered consistently in:
  - the sidebar
  - the thread header
  - the compose picker
  - in-thread group sender avatars and labels

## Enhancement Track - Search, Actions, And Conversation Detail Polish

### Goal

Take the browser client from feature-complete baseline to a more finished daily-use product surface.

### Work

- Add better ranked conversation search instead of simple substring filtering.
- Improve compose search so direct handle matches, contact identity, and existing-thread hits rank more sensibly.
- Show better search-result context in the sidebar when the query matches participant identity rather than only the latest preview.
- Add message-level action menus for realistic browser workflows:
  - copy text
  - copy sender handle
  - open attachment
  - download attachment
  - retry failed sends
- Add a conversation-details surface off the header so the active thread has inspectable metadata:
  - participant list
  - handles
  - service
  - message count
  - last activity
- Improve timeline polish where it supports readability rather than decoration:
  - sender-aware group message runs
  - sticky day dividers
  - clearer thread context

### Exit Criteria

- search results feel intentional instead of incidental
- message actions cover the common browser-side workflows
- the active thread has a proper details affordance instead of only a title/subtitle line

### Phase Notes

- Sidebar search is now ranked, with stronger priority on exact handles, titles, and participant identity.
- Compose search now uses the same general ranking direction rather than alphabetic-only ordering.
- The compose picker now dedupes duplicate contact handles before rendering and remounts its results viewport on query changes, so the visible list stays aligned with the option selected by pressing Enter instead of showing stale duplicate rows.
- Sidebar result rows now swap to participant/context text when that better explains why a match appeared.
- Message bubbles now expose a compact action menu for copy/open/download/retry flows.
- The header now opens a conversation-details sheet with participant and thread metadata.
- The active thread header/avatar region now also opens conversation details directly, matching the secondary `...` affordance.
- Sidebar rows now use a more stable avatar-plus-content grid, and the desktop conversation pane has an explicit basis width so long titles and previews clamp cleanly instead of getting squeezed into the edge.
- Thread switches now snap directly to the bottom of the timeline instead of doing a visible smooth-scroll catch-up from the previous scroll position.
- Thread scrolling now uses an explicit bottom-stickiness model:
  - switching conversations snaps to the bottom of the new thread
  - same-thread updates only auto-stick if the user was already near the bottom
  - media/layout growth no longer drags the viewport through the timeline after a thread switch
- Sticky day dividers now keep the timeline easier to scan while scrolling long conversations.
- The conversation-details sheet is now flatter and denser, with metadata shown as plain text rows instead of card-like stat blocks.
- The active thread is now URL-addressable through query state so browser navigation and direct deep links can target a specific conversation.

## Coordination Note - Service Management And Deployment

Launchd/service management and the concrete Tailscale deployment workflow are not active implementation phases in this plan. Ryan is handling that work upstream.

What stays in scope here:

- keep the browser client runtime compatible with a localhost-bound `imsg serve`
- avoid hard-coding any user-specific network assumptions into tracked files
- document the supported user-managed Tailscale Serve approach without taking ownership of service management

## Phase 8 - Deployment Guidance And Safe Defaults

### Goal

Document the recommended remote-access path without adding built-in auth or app-managed deployment behavior right now.

### Work

- Keep the primary recommendation localhost-bound: `imsg serve --host 127.0.0.1 --port 8080`.
- Document the user-managed Tailscale Serve path in the root README as the preferred remote-access option.
- Make it explicit that this fork does not manage Tailscale lifecycle or ship built-in auth yet.
- Avoid documenting unsafe direct-exposure defaults just to make the setup look simpler.

### Exit Criteria

- the README shows a clear localhost-first story
- the README shows a clear optional Tailscale Serve story
- safe defaults are still the default

## Phase 9 - Docs And Release Readiness

### Goal

Keep the fork understandable, accurate, and easy to run.

### Work

- Tighten the root README so it stays succinct and reflects the current fork accurately:
  - browser client exists
  - TUI still exists
  - the browser bundle served by `imsg serve` is the primary current focus
- Document the difference between:
  - live frontend development via Vite
  - bundled frontend testing via `imsg serve`
- Add a short Tailscale Serve recipe to the root README.
- Keep `AGENTS.md` and `web/README.md` aligned with the real dev loop.
- Keep the frontend asset build requirement explicit wherever `imsg serve` is used for browser testing.

### Exit Criteria

- the fork has a short, accurate browser runbook
- the bundled-vs-dev distinction is documented clearly
- root README, `AGENTS.md`, and `web/README.md` do not drift

### Phase Notes

- The web workspace now includes a Vitest harness split along the same seams as the runtime code.
- The installer and docs are now more web-first:
  - common Homebrew/Bun/Tailscale locations are added to `PATH` during install so SSH shells are less fragile
  - Bun is now optional for the install when the user only wants the browser/server path
  - the installer refreshes bundled web assets when Node.js/npm are available, but can still fall back to checked-in assets
  - the Tailscale recipe now uses the current `tailscale serve --bg 8080` flow and points users at `tailscale serve status` for the final HTTPS URL
- Current frontend regression coverage includes:
  - thread summary identity and subtitle/avatar derivation
  - group-thread avatar overflow and title behavior
  - direct-handle thread matching
  - sender-aware bubble grouping rules
  - chat reordering on activity updates
  - optimistic-message replacement by backend echoes
  - failed-local-message retention across refresh merges
  - live reaction reconciliation into message rows
- The full Swift test suite is now green again; the previous `watch.subscribe` test failure was a test-level dependency issue and has been hardened so it exercises the notification path without depending on contact resolution timing.
- The remaining Phase 8 and Phase 9 scope is intentionally documentation-oriented for now; built-in auth and deployment automation are not part of the current fork goals.

## Future Phase - Private API Expansion

This is intentionally out of the current implementation plan, but it should be documented so the architecture does not block it later.

Possible future expansion areas:

- typing indicators
- tapbacks/reactions beyond database-derived display
- edit/unsend
- replies/threading enhancements
- group management operations
- richer delivery state

These would likely require a BlueBubbles-like private API path or another deeper Messages integration path, which carries significantly different operational and security tradeoffs.

For now:

- do not build the current plan around private APIs
- do not require SIP changes
- keep backend/client architecture flexible enough that richer event sources could be layered in later

## Cross-Phase Guardrails

- Do not regress the existing TUI just to make the web client work.
- Do not hand-edit generated frontend output in `Sources/imsg/Resources/web/`.
- Do not let local Tailscale choices shape tracked repo defaults.
- Do not put machine-specific values in checked-in config files.
- Keep frontend source of truth under `web/`.
- Keep production runtime down to the `imsg` service whenever possible.
- Do not let AI-oriented component libraries dictate the baseline chat experience.

## First Execution Order

When implementation starts, the first practical order should be:

1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 3
5. Phase 4
6. Phase 5
7. Enhancement Track
8. Phase 8
9. Phase 9

That sequence keeps the architecture honest:

- build boundary first
- UI shell second
- product completeness next
- product-polish enhancement pass after the baseline is real
- hardening after the app shape is real
- final docs and release prep after the active product work lands
