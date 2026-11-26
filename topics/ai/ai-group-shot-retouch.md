---
title: AI group shot retouch
type: note
topic: ai
tags: [workflow, claude, photo-compositing, retouching, reference]
kind: technique
why: what worked (and what didn't) fixing a 4-person album-cover group shot with Claude Code and Higgsfield
added: 2026-11-26
status: done
---

## Summary
How Claude Code and Higgsfield (FLUX 3, Nano Banana Pro) were used to finish a photoreal
group shot for a Revolio Media album-cover job, from an approved base frame through 134
versions. The rules below came out of his corrections along the way. Client and artist
names are left out because this repo is public.

**Generation rules**
- Generate at 2K in small batches; 4K costs too much. Upscale or patch at the end.
- Use FLUX 3 first for anything with people and faces. Nano Banana often fails or reframes.
- Never chain AI passes on the same image: each one drifts faces and light. Do all fixes
  in one pass from the clean approved base.
- To resize, give FLUX only the approved take plus a resize prompt, no other refs.

**Patching (AI pixels, patched in, never cut from the real photos)**
- Faces: crop the head about 2.6x the face size, blur only the face, give FLUX that crop
  plus the real shoot head crop, and ask it to restore the face. Align the result with
  SIFT plus a similarity fit, match brightness only (not colour) from a ring around it,
  and feather it back in.
- Colour keys: to get a clean mask of skin or hair, ask FLUX to paint just that area
  flat magenta or green, then register it back onto the frame. Colour thresholds on
  the real image always miss parts.
- Recolour skin and hair in Lab toward the shoot photo's values, keeping the AI
  image's shading and strands.
- Wall colour swaps: take the new wall from an AI take, align it with optical flow,
  even out its colour, then rebuild the ring around hair so no halo of the old colour
  shows.
- Check every patch at 100% (and with boosted contrast) for seams, halos and dirty
  patches before sending. Never restyle the approved image's own textures.

**Reference discipline**
- Each person has one "original" shoot frame. Use only that for face, skin, angle and
  hair comparisons; other frames from the shoot drift the likeness.
- Score likeness with a face-embedding model (YuNet + SFace) to compare takes rather
  than eyeballing.

**Organising**
- Every deliverable is copied to the "Composite photo" folder on the revolio 2 SSD,
  sorted JPG / PNG / Misc by version. Delete the `._*` files ExFAT leaves behind.

Where it stopped (v134): three wall colours (beige, cream, light pistachio) with
shoot-matched faces, skin and hair. Open: which wall colour, the logo layout, and
whether to smooth the hair texture.

## Raw
"log this to my brain" (said at the end of the session, after v134).

## Notes
- [[revolio-media-studio]]: the studio this job was for
- [[agent-mistakes-to-checks]]: same idea of turning agent mistakes into standing checks
