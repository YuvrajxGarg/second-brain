# Device capture: iPhone, Mac and Windows

Save things to the brain without opening Claude: share a link or screenshot from any
iPhone app, press the Action Button and talk, or hit a hotkey on the Mac or PC.

Everything goes to one small endpoint, `https://brainy.pxlvzn.in/api/capture`
(`api/capture.js`), which drops the capture into `inbox/` with `status: unsorted`,
exactly like the browser extension. The next Claude thread (or "sort my inbox") files
it with a topic, tags and a summary. If the link is already in the brain, nothing new
is filed; your note gets added to the existing one instead.

| Device | What you get | Time |
|---|---|---|
| iPhone | **Save to Brain** in the Share Sheet (links, text, screenshots, photos) | 5 min |
| iPhone | **Brain voice note** on the Action Button (speak, it's transcribed and saved) | 3 min |
| Mac | ⌃⌥⌘B saves the clipboard, ⌃⌥⇧⌘B takes a screenshot and saves it | 5 min |
| Mac | Right-click → **Save to Brain** in any app (selected text, links, images in Finder) | 1 min |
| Windows | Ctrl+Alt+B saves the clipboard, Ctrl+Alt+Shift+B snips, orange **B** tray icon, right-click → **Send to → Second Brain** for files | 3 min |

## Your key

All of these use the same **capture key** as the brain connector's write tools. Find it
in claude.ai → Settings → Connectors → your Second Brain connector: it's the part of the
link after `?key=`. It stays on your devices (inside the shortcut, or a file in your home
folder). Never paste it into this repo; the repo is public.

If the key ever leaks, change `CAPTURE_KEY` in Vercel, redeploy, and update it in the
connector link, both iPhone shortcuts, `~/.config/brain-capture/key` on the Mac and
`%USERPROFILE%\.brain-capture\key` on Windows.

---

## iPhone: Save to Brain (Share Sheet)

Open the **Shortcuts** app → **+** (new shortcut). Name it **Save to Brain**. Add these
actions in order (search for each name in the action search bar):

1. Tap the **ⓘ** (or the shortcut name at the top) → **Details**: turn on **Show in Share
   Sheet**. Back in the editor, the first block now reads *Receive **Any** input from
   **Share Sheet***. Tap **Any** and keep only **Images**, **Text** and **URLs**. Tap
   *If there's no input: **Continue*** and pick **Get Clipboard**.
2. **Get URLs from Input** (input: *Shortcut Input*). This only reads a shared link;
   it doesn't open it.
3. **If** *URLs* **does not have any value** (so a shared link never gets opened to look
   for pictures: Instagram, X and YouTube links bounce to their apps and the shortcut
   fails with "Redirection to URL with a scheme that is not HTTP(S)"). Inside it:
   - **Get Images from Input** (input: *Shortcut Input*).
   - **Get Item from List**: *First Item* from *Images*.
   - **If** *Item from List* **has any value**:
     - **Convert Image**: *Item from List* to **JPEG** (tap the arrow: Quality about 0.7,
       Preserve Metadata off).
     - **Resize Image**: *Converted Image* to width **1600** (height *Auto*).
     - **Base64 Encode**: *Resized Image*. Tap the arrow → Line Breaks: **None**.
     - **Otherwise**: leave empty. **End If**.
4. **Otherwise**: leave empty. **End If** (the outer one).

   It reads:
   ```
   Get URLs from Shortcut Input
   If URLs does not have any value
      Get Images from Shortcut Input
      Get First Item from Images
      If Item from List has any value
         Convert Item from List to JPEG
         Resize Converted Image to 1600 x Auto
         Base64 Encode Resized Image
      Otherwise
      End If
   Otherwise
   End If
   ```
5. **Ask for Input**: Text, prompt `Why save this? (optional)`. You can leave it blank
   when it asks.
6. **Get Contents of URL**: URL `https://brainy.pxlvzn.in/api/capture`. Tap the arrow:
   - Method: **POST**
   - Headers → Add new header: Key `Authorization`, Text `Bearer YOUR_KEY`
     (the word Bearer, a space, then your key). Only this one header: an empty
     extra header row makes the request fail with "network connection was lost".
   - Request Body: **JSON**, then add four Text fields:
     - `text` → *Shortcut Input* (pick it from the variables bar)
     - `note` → *Provided Input*
     - `image` → *If Result* of the inner If (tap **Select Variable**, then the inner
       **End If** block)
     - `via` → `iPhone share sheet`
7. **Show Notification**: *Contents of URL*.

Test it: in Safari tap Share → **Save to Brain**. You should see "Saved to inbox: <page
title>". Also try it on a screenshot (Photos → Share) and on a copied piece of text (run
the shortcut from the Shortcuts app with no input and it takes the clipboard).

Tips: in the Share Sheet, tap **Edit Actions** at the bottom and add Save to Brain to
your Favourites so it sits at the top. Only the first image is sent when you share
several. Instagram and X links are read properly later with the Social Reader
connector when the note is filed.

Because Shortcuts sync over iCloud, **Save to Brain** also shows up in the Share menu on
your Mac.

## iPhone: Brain voice note (Action Button)

New shortcut, name it **Brain voice note**:

1. **Dictate Text**: tap the arrow, Stop Listening: **After Pause** (or *On Tap* for long
   thoughts). Language: whichever you think in.
2. **If** *Dictated Text* **does not have any value** → **Stop This Shortcut**, then
   **End If**.
3. **Get Contents of URL**: same as step 6 above (URL, POST, the Authorization header),
   with JSON fields:
   - `text` → *Dictated Text*
   - `via` → `iPhone voice`
4. **Show Notification**: *Contents of URL*.

Put it on the Action Button: **Settings → Action Button**, swipe to **Shortcut**, choose
**Brain voice note**. Press and hold the button, talk, stop talking, done. Voice notes
land in the inbox tagged `voice-note`.

No Action Button handy (or want a second trigger)? **Settings → Accessibility → Touch →
Back Tap → Double Tap → Brain voice note**. You can also add either shortcut to the Home
Screen or Lock Screen as a widget.

---

## Mac: clipboard and screenshot hotkeys

1. In Terminal, one time:

   ```sh
   curl -fsSL https://raw.githubusercontent.com/YuvrajxGarg/second-brain/main/tools/device-capture/mac/install.sh | bash
   ```

   It copies `brain-capture.sh` to `~/.brain-capture/`, asks for your key (paste it,
   nothing shows while you type) and runs a test that should print **Key OK**.

2. Open the **Shortcuts** app on the Mac. **Settings → Advanced → Allow Running Scripts**
   on.
3. New shortcut **Brain: save clipboard**, one action **Run Shell Script**:

   ```sh
   ~/.brain-capture/brain-capture.sh clip
   ```

   Click **ⓘ** (Shortcut Details) → **Add Keyboard Shortcut** → press **⌃⌥⌘B**.
4. New shortcut **Brain: screenshot**, **Run Shell Script**:

   ```sh
   ~/.brain-capture/brain-capture.sh shot
   ```

   Keyboard shortcut **⌃⌥⌘⇧B**. The first time, macOS asks to let Shortcuts record the
   screen: allow it (System Settings → Privacy & Security → Screen & System Audio
   Recording).

Using it: copy a link, some text or an image (or a file in Finder) and press ⌃⌥⌘B. A box
asks for an optional note (Enter to skip, Esc to cancel), then a notification says
"Saved to inbox: ...". For a screenshot, press ⌃⌥⌘⇧B and drag over what you want (Space
switches to picking a window).

Other modes: `brain-capture.sh text "some thought"` and `--no-note` to skip the box.

## Mac: right-click "Save to Brain" (no hotkey needed)

Your iPhone **Save to Brain** shortcut syncs to the Mac through iCloud. Turn it into a
right-click item:

1. Open the **Shortcuts** app on the Mac, double-click **Save to Brain**, click **ⓘ**
   (Shortcut Details, top right) and tick **Use as Quick Action**, then **Finder** and
   **Services Menu**.
2. Use it:
   - **Selected text or a link in any app:** select it → right-click → **Services → Save
     to Brain** (on some apps it's listed straight in the menu).
   - **An image file in Finder:** right-click → **Quick Actions → Save to Brain**.
   - **Safari / Chrome page:** Share → Save to Brain, or the browser extension's
     right-click *Save to Second Brain*.
3. If Save to Brain doesn't show under Services: **System Settings → Keyboard → Keyboard
   Shortcuts → Services → Text** and tick it.

## Windows: hotkeys and tray icon

1. Open **PowerShell** (Start → type PowerShell) and paste, one time:

   ```powershell
   irm https://raw.githubusercontent.com/YuvrajxGarg/second-brain/main/tools/device-capture/windows/install.ps1 -OutFile $env:TEMP\brain-install.ps1; powershell -ExecutionPolicy Bypass -File $env:TEMP\brain-install.ps1
   ```

   It copies the scripts to `%LOCALAPPDATA%\BrainCapture`, asks for your key, tests it
   (**Key OK**), makes the hotkeys and starts the tray icon (and adds it to startup).

2. Done. Using it:
   - **Ctrl+Alt+B**: saves the clipboard (text, a link, an image, or a copied image file).
   - **Ctrl+Alt+Shift+B**: opens the snip overlay; drag a box and it's saved.
   - The orange **B** in the tray (click **^** near the clock if it's hidden): right-click
     for Save clipboard, Snip to brain, Type a thought, Open brain site, Test key.
     Double-click it to snip.

   A small box asks for an optional note each time (Enter to skip). A notification says
   "Saved to inbox: ...".

**Right-click files:** in File Explorer, right-click an image or a text file → **Send to →
Second Brain** (Windows 11: **Show more options** first, or Shift+right-click). Images go
as images, `.txt`/`.md`/`.url` files as their text. For pages, links, images and selected
text in the browser, use the browser extension's right-click *Save to Second Brain*
([tools/quick-capture](../quick-capture/)). Windows has no right-click menu that works
in every app, so the clipboard hotkey covers the rest.

The hotkeys are Start Menu shortcuts (Start → Second Brain), so to change one,
right-click it → Open file location → Properties → Shortcut key. Hotkeys can take a
second to fire the first time after login.

---

## The endpoint (for anything else)

```sh
# test the key
curl -H "Authorization: Bearer $KEY" https://brainy.pxlvzn.in/api/capture
# save something
curl -X POST -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"text":"https://example.com","note":"why I saved it","via":"curl"}' \
  https://brainy.pxlvzn.in/api/capture
```

JSON fields: `text` (a link, text or a voice transcript), `note` (your words about it),
`url` (optional, else the first link in `text`), `image` (base64 png/jpg/gif/webp, up to
4 MB; HEIC is refused, convert first), `via` (where it came from). `text_b64` and
`note_b64` take base64 UTF-8 for scripts that don't want to escape JSON. A plain-text
body works too. The reply is one line of text for a notification: 201 when saved, 200
when the link was already there, 401/403 for a missing or wrong key.
