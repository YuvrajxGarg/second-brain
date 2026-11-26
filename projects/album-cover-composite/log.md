# Album cover composite: log

Dated entries, newest first: status, what was learned, mistakes and fixes, taste notes.

## 2026-11-26 · v134, wall colour still open

**Status:** v134 delivered in three wall colours (beige, cream, light pistachio) with shoot-matched faces, skin and hair. Files in "Composite photo" on the revolio 2 SSD (JPG / PNG / Misc by version).

**Learned**
- Generate at 2K in small batches, FLUX 3 first for people, never chain AI passes; full rules in [[2026-11-26-ai-group-shot-retouch]].
- Score likeness with a face-embedding model against one "original" shoot frame per person.

**Mistakes and fixes**
- Stacked AI passes drifted faces and light -> redo every fix in one pass from the clean approved base.
- Colour-threshold masks missed skin and hair -> have FLUX paint the area flat magenta/green and register it back.

**Next**
- Client picks the wall colour.
- Logo layout.
- Decide whether to smooth the hair texture.
