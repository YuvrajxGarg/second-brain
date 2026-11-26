# Taste profile

What Yuvraj likes, distilled from everything he has saved. Any AI helping him should
read this first and lean toward it: match the look, reach for the libraries and tools
he already saved, and build on his own ideas. The part above the generated block is
curated by Claude and updated whenever a new entry shifts the picture; the evidence
below is rebuilt from the notes on every filing.

_Last curated: 2026-11-15 (added pixel art in 3D: gaussian splat dioramas and sprite stacking; glyph-grid data viz)._

## Who he is

- Video editor and builder at **Revolio Media**, a creative studio in Mumbai (see
  Revolio Media studio). Makes launch films, motion and effects, and also builds the
  studio's internal tools (ledger, SSD desk, Saturday-off tracker, website).
- Builds **Revolio Labs**, the experiments arm of Revolio: an AI creative studio app
  (live with a waitlist), a cozy 3D desk-diorama website, and many small games and
  toys. Wants an in-browser VFX feature like Ladybug.
- Ships his own desktop tools under **PXLVZN** (pxlvzn.in): a utility app hub
  (downloader, stem splitter, LUT matcher, file transfer, AI-tag remover), CanvasFlow,
  Vinyl for Windows (paid), and pxlengine, a Rust/Vulkan ray-traced 3D engine.
- Has shipped a lot: about 40 projects in [catalog/projects.md](catalog/projects.md).
  Most are browser games (PEAKD, SLANGDAQ, Punchline, Sixer, Bonk Court, Rohit Learns
  Ball, Munde Mode) and tools for editors. Build on these before starting fresh.
- Builds with AI agents a lot: Claude Code, MCP servers (he wrote Social Reader),
  agent-driven Blender and game tools. Prefers tools that ship an MCP server or a CLI
  agents can drive.

## Visual taste

- **Chunky, flat pixel art** with a tight two or three colour palette (orange, blue,
  periwinkle), pixel cursors and UI bits. See the Captcha launch film and the pixel
  mascots in the Ace Of Frames reel.
- **Pixel art in 3D**: small floating dioramas on black, each in one hue with a single
  accent, that stay crisp pixel art while the camera orbits (Pixel-art gaussian
  splats), and pixel sprites turned to any angle by stacking slices (Sprite stacking
  technique).
- **Textured, painterly illustration**: loose oil-pastel brushwork in warm sky blue,
  orange, ochre, olive and peach, set against calm off-white layouts with a bold
  grotesk wordmark and elegant serif copy (Second brand identity). Also code-made
  paintings with real brush strokes.
- **Bold product-launch motion**: big type, UI mockups animating, glowing cards,
  playful mascots, fast cuts. Launch films are a recurring save.
- **Clean stylised 3D**: low-poly or simple stylised models, readable top-down
  cameras, dark neutral floors with chunky coloured props, minimal HUDs
  (Lastmaglab shooter, Polyfork kits). Storybook proportions for characters (big
  head, small body, trailing scarf).
- **Stylised cartoon 3D, desi setting**: caricature Indian characters (big moustache,
  Gandhi cap, Nehru jacket) and everyday Indian street shopfronts in bottle green and
  marigold yellow with warm light (Sharma Sweets 3D style, the look for his Tukaram
  Munde game).
- **Painterly stylised 3D animation**: animated-feature look with chunky armoured
  characters, misty desaturated scenes, red ink outlines and bold red/blue accents
  (Impossible Weapon animation, made with Krea AI).
- **Polished dark utility UI**: a single compact dark card, glowing dot-matrix data
  viz, colour-coded categories, plain-language copy and playful particle feedback
  (Storage scanner UI). Also monospace caps, one blue accent and a scrubbable
  timeline over dot-matrix bands (Sleep alarm UI).
- **Hand-drawn line art in motion**: wobbly black-ink stick characters on cream
  paper, animated from mocap (Line art mocap workflow). For prototypes he likes
  blocky segmented mannequins in one flat pastel colour each (Toyxyz retarget add-on).
- **Generative data viz as branding**: dense grids of tiny dots, squares and crosses
  that animate into networks, swirls and treemaps, either bright multicolour on
  charcoal or one blue on white, with a serif title underneath (Neural network data viz).
- **Image effects as a look**: halftone, ASCII, dither, glitch, glow (Ladybug).
- **His own shipped looks** (from what he built): dark near-black UI with a single
  lime or yellow accent and hairline strokes (PXLVZN, PXL app hub, Revolio Labs,
  Punchline); cream-paper editorial with condensed ink serif (PEAKD); poster and
  stock-ticker typography (SLANGDAQ); film grain on dark teal and paper (Meter Down,
  NPCs on Strike); cozy golden-hour 3D dioramas (Revolio Labs site, Munde Mode).
- Not saved so far: photoreal, corporate stock, generic SaaS gradients.

## Games he likes

- Casual, free **browser games** with one clear hook, often **cricket**: daily
  Wordle-style guessing (Cricle), simulated chases (500-0), country face-offs.
- Daily challenge loops, shareable results, light humour.
- What he makes himself: **Indian, desi and Mumbai humour** (Munde Mode, Meter Down,
  SLANGDAQ, Sunny Sultan parody), cricket (Sixer, Rohit Learns Ball), party and
  social games (Punchline, Wedding co-op), and small music or stage toys (TV Stack,
  Runaway Light Rig).

## Stack and sources he reaches for

- **UI:** React with an open-source design system (Astryx). Wants agents to build
  better UI, so give them a real component library rather than ad-hoc CSS. For
  personality on his sites: draggable React stickers (Stick It Up stickers).
- **Web apps he ships:** Next.js + TypeScript on Vercel, Tailwind, Supabase or
  Postgres/Prisma; plain HTML and vanilla JS for quick sites and concepts.
- **Games:** three.js (most of his shipped games), Vite, Unity WebGL, Godot
  (shaders, 2D water, top-down 3D), Blender driven over MCP, Mixamo rigs.
- **Desktop apps:** Python (PyInstaller), SwiftUI and Electron, C#/WPF, Rust with
  Vulkan for pxlengine.
- **Assets:** Polyfork low-poly kits (MCP), Pixel sprite search, Patch, ARC's CC 3D
  files. Prefers free or Creative Commons assets with clear licences.
- **Mobile apps:** native Swift, no accounts, no cloud, when building solo.
- **Growth:** organic short-form video (TikTok slideshows), hook testing, paywall
  experiments.

## How to use this when helping him

- Designing anything visual: default to the looks above (pixel art, painterly
  pastel, bold launch-film motion, clean stylised 3D) and say which reference you
  drew from. Ask before going photoreal or corporate.
- Building UI or games: start from the saved libraries in
  [catalog/libraries.md](catalog/libraries.md) before suggesting new ones.
- Use his own words in each note's `why` and `## Raw` as the strongest signal.

<!-- GENERATED:START (scripts/build_index.py rewrites this block) -->

## Evidence (generated)

_From 120 entries, 56 with style notes. Rebuilt on every filing._

### What he saves, by kind

- `library`: 6
- `asset-source`: 2
- `style-ref`: 11
- `website-ref`: 5
- `game-ref`: 4
- `tool`: 13
- `technique`: 19
- `advice`: 6
- `idea`: 3
- `thought`: 3
- `todo`: 2
- `org`: 3
- `project`: 41

### Top tags

#own-project (42), #to-try (24), #inspiration (21), #claude (18), #open-source (17), #agents (16), #desktop-app (16), #reference (16), #browser-game (13), #pxlvzn (12), #ui (11), #visual-design (10), #mcp (9), #revolio-labs (9), #video-generation (7), #workflow (7), #3d-art (6), #blender (6), #game-inspiration (6), #pixel-art (6)

### Style notes and where they come from

- **film grain** ×3: [Runaway Light Rig](topics/gamedev/runaway-light-rig.md), [NPCs on Strike](topics/gamedev/npcs-on-strike-concept.md), [Idea Archive site](topics/revolio/idea-archive-site.md)
- **black and yellow** ×2: [Revolio Labs app](topics/revolio/revolio-labs-app.md), [Revolio Labs](topics/revolio/revolio-labs.md)
- **dark teal and paper** ×2: [NPCs on Strike](topics/gamedev/npcs-on-strike-concept.md), [Meter Down concept](topics/gamedev/meter-down-concept.md)
- **near-black surfaces** ×2: [PXLVZN label](topics/tech/pxlvzn-label.md), [PXL app hub](topics/tech/pxl-app-hub.md)
- **pixel art** ×2: [Rohit Learns Ball](topics/revolio/rohit-learns-ball.md), [Pixel sprite search](topics/gamedev/pixel-search-sprite-database.md)
- **r mark with animated eyes** ×2: [Revolio Labs app](topics/revolio/revolio-labs-app.md), [Revolio Labs](topics/revolio/revolio-labs.md)
- **red accent** ×2: [TV Stack toy](topics/gamedev/tv-stack-music-toy.md), [NPCs on Strike](topics/gamedev/npcs-on-strike-concept.md)
- **single lime accent** ×2: [PXLVZN label](topics/tech/pxlvzn-label.md), [PXL app hub](topics/tech/pxl-app-hub.md)
- **3d extruded towers**: [Flat Finder map](topics/design/flat-finder-map.md)
- **3d vinyl peel on hover**: [Stick It Up stickers](topics/design/stick-it-up-stickers.md)
- **acid green on near-black**: [Idea Archive site](topics/revolio/idea-archive-site.md)
- **airy off-white layouts**: [Second brand identity](topics/design/ayush-soni-visual-design-post.md)
- **animated snowfall**: [Claude Code reactive theme](topics/ai/claude-code-reactive-theme.md)
- **anton display type**: [Runaway Light Rig](topics/gamedev/runaway-light-rig.md)
- **archive photos with red string**: [Cinematic film skill](topics/video-editing/cinematic-film-skill.md)
- **ascii**: [Ladybug VFX app](topics/video-editing/ladybug-vfx-app.md)
- **beak-nosed stick characters**: [Line art mocap workflow](topics/animation/line-art-mocap-workflow.md)
- **big uppercase heading**: [People of Bengaluru](topics/design/people-of-bengaluru-site.md)
- **big-head proportions**: [Blender storybook hero](topics/animation/blender-mcp-storybook-hero-workflow.md)
- **black minimal landing page**: [TapMac trackpad app](topics/design/tapmac-trackpad-app.md)
- **black stage**: [TV Stack toy](topics/gamedev/tv-stack-music-toy.md)
- **blocky segmented mannequins**: [Toyxyz retarget add-on](topics/animation/toyxyz-blender-retargeter.md)
- **blue primary button**: [DIT offload checker](topics/video-editing/dit-offload-checker-idea.md)
- **bodycam first person view**: [Unity bodycam hands](topics/animation/unity-bodycam-ik-hands.md)
- **bold display type**: [Punchline party game](topics/gamedev/punchline-party-game.md)
- **bold headlines with italic emphasis**: [TapMac trackpad app](topics/design/tapmac-trackpad-app.md)
- **bold orange focal length type**: [Lens focal length guide](topics/ai/lens-focal-length-guide.md)
- **bold red and blue colour pops**: [Impossible Weapon animation](topics/animation/impossible-weapon-knight-animation.md)
- **bold type**: [Ace Of Frames reel](topics/video-editing/ace-of-frames-reel.md)
- **bottle green and marigold yellow**: [Sharma Sweets 3D style](topics/gamedev/sharma-sweets-3d-shopfront.md)
- **bright multicolour on charcoal**: [Neural network data viz](topics/design/neural-network-data-viz.md)
- **caricature character big head**: [Sharma Sweets 3D style](topics/gamedev/sharma-sweets-3d-shopfront.md)
- **caricature indian characters**: [Munde Mode game](topics/revolio/munde-mode-game.md)
- **chrome emblems**: [Stick It Up stickers](topics/design/stick-it-up-stickers.md)
- **chunky armoured knights**: [Impossible Weapon animation](topics/animation/impossible-weapon-knight-animation.md)
- **chunky flat pixel art**: [Captcha launch film](topics/design/captcha-launch-film.md)
- **chunky pixel art cars**: [Sprite stacking technique](topics/gamedev/sprite-stacking-pixel-art.md)
- **chunky pixel art tanks and props**: [Sprite stacking skill](topics/gamedev/sprite-stacking-canvas-skill.md)
- **chunky props**: [Lastmaglab shooter style](topics/gamedev/lastmaglab-top-down-shooter.md)
- **chunky skeuomorphic panel**: [Transition plugin idea](topics/video-editing/transition-plugin-idea.md)
- **cinematic letterbox grade**: [Escapement Blender film](topics/ai/escapement-blender-short-film.md)
- **clean sans type**: [Revolio Labs](topics/revolio/revolio-labs.md)
- **clean stylised 3d**: [Lastmaglab shooter style](topics/gamedev/lastmaglab-top-down-shooter.md)
- **colour-coded categories**: [Storage scanner UI](topics/design/storage-scanner-ui.md)
- **comedy club poster**: [Punchline party game](topics/gamedev/punchline-party-game.md)
- **condensed ink serif**: [PEAKD game](topics/revolio/peakd-game.md)
- **cork evidence wall**: [Cinematic film skill](topics/video-editing/cinematic-film-skill.md)
- **cozy 3d desk diorama**: [Revolio Labs site](topics/revolio/revolio-labs-site.md)
- **cozy winter night scene**: [Claude Code reactive theme](topics/ai/claude-code-reactive-theme.md)
- **cream paper card with torn edges**: [Blooming flowers site](topics/animation/mohamed-siddique-flower-site.md)
- **cream paper cards on yellow grid paper**: [Line art mocap workflow](topics/animation/line-art-mocap-workflow.md)
- **cream paper editorial**: [PEAKD game](topics/revolio/peakd-game.md)
- **dark compact utility card**: [Storage scanner UI](topics/design/storage-scanner-ui.md)
- **dark grey blender viewport grid**: [Toyxyz retarget add-on](topics/animation/toyxyz-blender-retargeter.md)
- **dark macro clockwork**: [Escapement Blender film](topics/ai/escapement-blender-short-film.md)
- **dark menu bar popover**: [DIT offload checker](topics/video-editing/dit-offload-checker-idea.md)
- **dark minimal dashboard**: [Strawhat homelab dashboard](topics/design/strawhat-homelab-dashboard.md)
- **dark minimal ui**: [Sleep alarm UI](topics/design/sleep-alarm-ui.md)
- **dark night map**: [Flat Finder map](topics/design/flat-finder-map.md)
- **dark slate grid floor**: [Lastmaglab shooter style](topics/gamedev/lastmaglab-top-down-shooter.md)
- **dark slate theme**: [People of Bengaluru](topics/design/people-of-bengaluru-site.md)
- **dark ui with bold white headline**: [Tabworthy site directory](topics/tech/tabworthy-site-directory.md)
- **dark ui with orange step numbers**: [Claude Blender samurai](topics/animation/claude-blender-samurai-build.md)
- **dense dots squares and crosses**: [Neural network data viz](topics/design/neural-network-data-viz.md)
- **desi street shopfront**: [Sharma Sweets 3D style](topics/gamedev/sharma-sweets-3d-shopfront.md)
- **dither**: [Ladybug VFX app](topics/video-editing/ladybug-vfx-app.md)
- **dot-matrix data viz**: [Sleep alarm UI](topics/design/sleep-alarm-ui.md)
- **dusk orange canyon**: [Escapement Blender film](topics/ai/escapement-blender-short-film.md)
- **dystopian concert stage**: [Runaway Light Rig](topics/gamedev/runaway-light-rig.md)
- **expressive mascot**: [TapMac trackpad app](topics/design/tapmac-trackpad-app.md)
- **fake 3d from 2d slices**: [Sprite stacking technique](topics/gamedev/sprite-stacking-pixel-art.md)
- **fake 3d from stacked 2d slices**: [Sprite stacking skill](topics/gamedev/sprite-stacking-canvas-skill.md)
- **floating islands on black**: [Pixel-art gaussian splats](topics/gamedev/pixel-art-gaussian-splats.md)
- **frosted glass chat panel**: [Claude Code reactive theme](topics/ai/claude-code-reactive-theme.md)
- **georgia serif**: [Wedding co-op game](topics/gamedev/wedding-co-op-game.md)
- **giant planet skies**: [Lens focal length guide](topics/ai/lens-focal-length-guide.md)
- **glass panel ui**: [TV Stack toy](topics/gamedev/tv-stack-music-toy.md)
- **glitch**: [Ladybug VFX app](topics/video-editing/ladybug-vfx-app.md)
- **glossy abstract 3d**: [ARC 3D art dataset](topics/design/arc-3d-art-dataset.md)
- **gloved hands with pistol**: [Unity bodycam hands](topics/animation/unity-bodycam-ik-hands.md)
- **glowing cards**: [Ace Of Frames reel](topics/video-editing/ace-of-frames-reel.md)
- **glowing dot-matrix storage bar**: [Storage scanner UI](topics/design/storage-scanner-ui.md)
- **glowing gold building clusters**: [Flat Finder map](topics/design/flat-finder-map.md)
- **glowing particles**: [Pixel-art gaussian splats](topics/gamedev/pixel-art-gaussian-splats.md)
- **glyph-grid data viz**: [Neural network data viz](topics/design/neural-network-data-viz.md)
- **golden hour window light**: [Revolio Labs site](topics/revolio/revolio-labs-site.md)
- **graffiti street court**: [Bonk Court game](topics/gamedev/bonk-court-game.md)
- **grid of category cards with counts**: [Tabworthy site directory](topics/tech/tabworthy-site-directory.md)
- **gritty scarred skin detail**: [MetaHuman Maker addon](topics/gamedev/metahuman-maker-agent-addon.md)
- **hairline strokes**: [PXLVZN label](topics/tech/pxlvzn-label.md)
- **halftone**: [Ladybug VFX app](topics/video-editing/ladybug-vfx-app.md)
- **halftone dither shadows**: [Sprite stacking skill](topics/gamedev/sprite-stacking-canvas-skill.md)
- **hand-drawn animation**: [AI tween harness](topics/animation/ai-tween-paint-harness.md)
- **hand-drawn flowers growing on a dot grid**: [Blooming flowers site](topics/animation/mohamed-siddique-flower-site.md)
- **hand-drawn pastel stickers**: [Stick It Up stickers](topics/design/stick-it-up-stickers.md)
- **hand-painted 3d look**: [Blender painterly leaf shader](topics/gamedev/blender-painterly-leaf-shader.md)
- **invented artist styles**: [Claude code paintings](topics/ai/claude-code-paintings.md)
- **launch film motion**: [Captcha launch film](topics/design/captcha-launch-film.md)
- **lime accent on dark**: [Punchline party game](topics/gamedev/punchline-party-game.md)
- **lime green go button**: [Transition plugin idea](topics/video-editing/transition-plugin-idea.md)
- **low-poly**: [Polyfork 3D assets](topics/gamedev/polyfork-3d-assets.md)
- **masked characters**: [Lens focal length guide](topics/ai/lens-focal-length-guide.md)
- **metallic gold and rose gold**: [ARC 3D art dataset](topics/design/arc-3d-art-dataset.md)
- **minimal dark sidebar filters**: [Flat Finder map](topics/design/flat-finder-map.md)
- **minimal hud**: [Lastmaglab shooter style](topics/gamedev/lastmaglab-top-down-shooter.md)
- **misty desaturated battlefield**: [Impossible Weapon animation](topics/animation/impossible-weapon-knight-animation.md)
- **monospace tags**: [Tabworthy site directory](topics/tech/tabworthy-site-directory.md)
- **monospace type**: [Sleep alarm UI](topics/design/sleep-alarm-ui.md)
- **mumbai kaali-peeli illustration**: [Meter Down concept](topics/gamedev/meter-down-concept.md)
- **node map of servers**: [Strawhat homelab dashboard](topics/design/strawhat-homelab-dashboard.md)
- **one continuous camera move**: [Cinematic film skill](topics/video-editing/cinematic-film-skill.md)
- **one flat pastel colour per character**: [Toyxyz retarget add-on](topics/animation/toyxyz-blender-retargeter.md)
- **one-hue monochrome palettes**: [Pixel-art gaussian splats](topics/gamedev/pixel-art-gaussian-splats.md)
- **orange and blue palette**: [Captcha launch film](topics/design/captcha-launch-film.md)
- **painted 2d backgrounds**: [AI tween harness](topics/animation/ai-tween-paint-harness.md)
- **painterly brushstroke leaves**: [Blender painterly leaf shader](topics/gamedev/blender-painterly-leaf-shader.md)
- **painterly brushwork**: [Claude code paintings](topics/ai/claude-code-paintings.md)
- **painterly landscape backdrop**: [Blooming flowers site](topics/animation/mohamed-siddique-flower-site.md)
- **painterly stylised 3d**: [Impossible Weapon animation](topics/animation/impossible-weapon-knight-animation.md)
- **particle dissolve on delete**: [Storage scanner UI](topics/design/storage-scanner-ui.md)
- **pastel blocks**: [ARC 3D art dataset](topics/design/arc-3d-art-dataset.md)
- **pastel pink hardware knob**: [Transition plugin idea](topics/video-editing/transition-plugin-idea.md)
- **photoreal metahuman faces**: [MetaHuman Maker addon](topics/gamedev/metahuman-maker-agent-addon.md)
- **pixel cursors and ui**: [Captcha launch film](topics/design/captcha-launch-film.md)
- **pixel-art 3d dioramas**: [Pixel-art gaussian splats](topics/gamedev/pixel-art-gaussian-splats.md)
- **pixel-art decals**: [Stick It Up stickers](topics/design/stick-it-up-stickers.md)
- **pixel-art mascots**: [Ace Of Frames reel](topics/video-editing/ace-of-frames-reel.md)
- **plain status sentence**: [DIT offload checker](topics/video-editing/dit-offload-checker-idea.md)
- **plain-language helper copy**: [Storage scanner UI](topics/design/storage-scanner-ui.md)
- **poster typography**: [SLANGDAQ game](topics/revolio/slangdaq-game.md)
- **product launch video**: [Ace Of Frames reel](topics/video-editing/ace-of-frames-reel.md)
- **real people as characters**: [People of Bengaluru](topics/design/people-of-bengaluru-site.md)
- **receipt cards**: [Meter Down concept](topics/gamedev/meter-down-concept.md)
- **red and black**: [Runaway Light Rig](topics/gamedev/runaway-light-rig.md)
- **red and black samurai armour on grey stage**: [Claude Blender samurai](topics/animation/claude-blender-samurai-build.md)
- **red ink outline accents**: [Impossible Weapon animation](topics/animation/impossible-weapon-knight-animation.md)
- **rolling counters**: [Cinematic film skill](topics/video-editing/cinematic-film-skill.md)
- **sandy top-down battlefield**: [Sprite stacking skill](topics/gamedev/sprite-stacking-canvas-skill.md)
- **scroll side-scroller**: [Revolio Labs site](topics/revolio/revolio-labs-site.md)
- **scrubbable timeline**: [Sleep alarm UI](topics/design/sleep-alarm-ui.md)
- **serif headings with mono stats**: [Strawhat homelab dashboard](topics/design/strawhat-homelab-dashboard.md)
- **serif italic accents**: [Idea Archive site](topics/revolio/idea-archive-site.md)
- **serif plus grotesk type**: [Second brand identity](topics/design/ayush-soni-visual-design-post.md)
- **serif titles with small caps labels**: [Neural network data viz](topics/design/neural-network-data-viz.md)
- **shared kit palettes**: [Polyfork 3D assets](topics/gamedev/polyfork-3d-assets.md)
- **single blue accent**: [Sleep alarm UI](topics/design/sleep-alarm-ui.md)
- **single-blue swirl on white**: [Neural network data viz](topics/design/neural-network-data-viz.md)
- **sky blue to sand gradient**: [Wedding co-op game](topics/gamedev/wedding-co-op-game.md)
- **small green accent button**: [Tabworthy site directory](topics/tech/tabworthy-site-directory.md)
- **soft serif headline**: [Blooming flowers site](topics/animation/mohamed-siddique-flower-site.md)
- **split screen code panel and blender viewport**: [Claude Blender samurai](topics/animation/claude-blender-samurai-build.md)
- **spray paint type**: [Bonk Court game](topics/gamedev/bonk-court-game.md)
- **stamps and highlighter swipes**: [Cinematic film skill](topics/video-editing/cinematic-film-skill.md)
- **stock ticker ui**: [SLANGDAQ game](topics/revolio/slangdaq-game.md)
- **striped test room**: [Unity bodycam hands](topics/animation/unity-bodycam-ik-hands.md)
- **stylised 2d water**: [Godot waterfall shader](topics/gamedev/godot-waterfall-texture-array-shader.md)
- **stylised cartoon 3d**: [Sharma Sweets 3D style](topics/gamedev/sharma-sweets-3d-shopfront.md)
- **stylised storybook 3d**: [Blender storybook hero](topics/animation/blender-mcp-storybook-hero-workflow.md)
- **surreal pastel wide fields**: [Lens focal length guide](topics/ai/lens-focal-length-guide.md)
- **tap-count diagram**: [TapMac trackpad app](topics/design/tapmac-trackpad-app.md)
- **teal and lime on deep crimson**: [Blender painterly leaf shader](topics/gamedev/blender-painterly-leaf-shader.md)
- **testimonial wall**: [TapMac trackpad app](topics/design/tapmac-trackpad-app.md)
- **textured pastel brushwork**: [Second brand identity](topics/design/ayush-soni-visual-design-post.md)
- **thin gold road lines**: [Flat Finder map](topics/design/flat-finder-map.md)
- **thin usage bars**: [Strawhat homelab dashboard](topics/design/strawhat-homelab-dashboard.md)
- **tick ruler numerals**: [PEAKD game](topics/revolio/peakd-game.md)
- **top-down camera**: [Lastmaglab shooter style](topics/gamedev/lastmaglab-top-down-shooter.md)
- **top-down racing track**: [Sprite stacking technique](topics/gamedev/sprite-stacking-pixel-art.md)
- **ui mockups in motion**: [Ace Of Frames reel](topics/video-editing/ace-of-frames-reel.md)
- **unreal editor viewport**: [MetaHuman Maker addon](topics/gamedev/metahuman-maker-agent-addon.md)
- **walkable stylised 3d city**: [People of Bengaluru](topics/design/people-of-bengaluru-site.md)
- **warm painterly palette**: [Second brand identity](topics/design/ayush-soni-visual-design-post.md)
- **warm soft lighting**: [Sharma Sweets 3D style](topics/gamedev/sharma-sweets-3d-shopfront.md)
- **warm toy diorama 3d**: [Munde Mode game](topics/revolio/munde-mode-game.md)
- **wine red accent**: [Wedding co-op game](topics/gamedev/wedding-co-op-game.md)
- **wobbly hand-drawn black line art**: [Line art mocap workflow](topics/animation/line-art-mocap-workflow.md)
- **wooden sign hud**: [Claude Code reactive theme](topics/ai/claude-code-reactive-theme.md)
- **yellow accent**: [SLANGDAQ game](topics/revolio/slangdaq-game.md)

### Every reference with his reason

- [Chris Nijhof designer](topics/design/chris-nijhof-ui-designer.md) (`style-ref`): His profile has some cool ui designs
- [Cascadeur 2026.3 update](topics/animation/cascadeur-2026-3-release.md) (`tool`): Cascadeur's big 2026.3 update with AI motion tools and an MCP, worth trying for character animation
- [Sprite stacking skill](topics/gamedev/sprite-stacking-canvas-skill.md) (`library`): Game art style
- [Skillsync skills marketplace](topics/ai/skillsync-skills-marketplace.md) (`tool`): a place to publish agent skills and get paid when people or agents use them
- [Tabworthy site directory](topics/tech/tabworthy-site-directory.md) (`tool`): directory of hidden-gem websites to explore
- [Flat Finder map](topics/design/flat-finder-map.md) (`website-ref`): map web app built with Claude, nice dark map with glowing buildings
- [MetaHuman Maker addon](topics/gamedev/metahuman-maker-agent-addon.md) (`tool`): give the repo to an agent and talk to it to make AAA MetaHumans for Unreal and web
- [Strawhat homelab dashboard](topics/design/strawhat-homelab-dashboard.md) (`style-ref`): clean dark dashboard design for a personal tool that tracks machines and AI subscriptions
- [Cloudflare Computer](topics/ai/cloudflare-computer-agent-sandbox.md) (`tool`): Cloudflare computer
- [Unslop UI skill](topics/design/unslop-ui-skill.md) (`tool`): the skill repo from the AI slop vs senior designer reel, turns AI-looking UI into a designed interface
- [Raea render engine](topics/ai/raea-render-engine.md) (`tool`): AI agents write the code and it renders videos, motion graphics, 3D and games on your own Mac
- [Pixel-art gaussian splats](topics/gamedev/pixel-art-gaussian-splats.md) (`style-ref`): pixel-art gaussian splats look mesmerising
- [Neural network data viz](topics/design/neural-network-data-viz.md) (`style-ref`): data visualization for a neural network brand exploration
- [Viggle Remake model](topics/video-editing/viggle-remake-open-model.md) (`tool`): Viggle AI's open weights to recast anybody in a video
- [Toyxyz retarget add-on](topics/animation/toyxyz-blender-retargeter.md) (`tool`): cool plugin, and also cool way to retarget motion between characters with different body proportions; also a very cool art style for showing prototype models in a game
- [Stick It Up stickers](topics/design/stick-it-up-stickers.md) (`library`): cool component to add to my websites, stickers for personality
- [Sleep alarm UI](topics/design/sleep-alarm-ui.md) (`style-ref`): cool design
- [RelayVSR video upscaler](topics/video-editing/relayvsr-video-upscaler.md) (`tool`): open weight video upscaler available in ComfyUI
- [Cinematic film skill](topics/video-editing/cinematic-film-skill.md) (`tool`): agent skill for explainer content
- [Blooming flowers site](topics/animation/mohamed-siddique-flower-site.md) (`website-ref`): nice calm website style with growing flower animation
- [TapMac trackpad app](topics/design/tapmac-trackpad-app.md) (`website-ref`): This is a cool app, and the website is also cool for building something similar
- [Storage scanner UI](topics/design/storage-scanner-ui.md) (`style-ref`): If I ever make a disk utility app to remove cache and disk cleanup, this UI is really nice for it.
- [Sharma Sweets 3D style](topics/gamedev/sharma-sweets-3d-shopfront.md) (`style-ref`): Art style reference for Tukaram Munde game
- [Perfolios portfolio directory](topics/design/perfolios-portfolio-directory.md) (`website-ref`): A website directory. For inspiration, design, layouts, etc.
- [People of Bengaluru](topics/design/people-of-bengaluru-site.md) (`website-ref`): insane idea, cool website
- [Impossible Weapon animation](topics/animation/impossible-weapon-knight-animation.md) (`style-ref`): Brilliant art style for animations
- [Procedural arm rig](topics/animation/procedural-arm-rig-demo.md) (`library`): open-source rigged arm to reuse in my games
- [Lastmaglab shooter style](topics/gamedev/lastmaglab-top-down-shooter.md) (`game-ref`): cool game visual style, art style
- [Captcha launch film](topics/design/captcha-launch-film.md) (`style-ref`): cool visuals, launch film
- [Ace Of Frames reel](topics/video-editing/ace-of-frames-reel.md) (`style-ref`): cool visual design
- [Roboflow re-ID tool](topics/ai/roboflow-reid-tool.md) (`library`): track one player across clips for sports video edits
- [Polyfork 3D assets](topics/gamedev/polyfork-3d-assets.md) (`library`): open-source three.js asset library agents can use over MCP
- [Patch gamedev tool](topics/gamedev/patch-gamedev-platform.md) (`tool`): game dev tools as one CLI and MCP, plus open-source assets
- [Ladybug VFX app](topics/video-editing/ladybug-vfx-app.md) (`tool`): benchmark for the Revolio Labs VFX feature
- [Astryx design system](topics/design/astryx-design-system.md) (`library`): hand to coding agents so they build better UI
- [ARC 3D art dataset](topics/design/arc-3d-art-dataset.md) (`asset-source`): free Creative Commons 3D art files to remix
- [Second brand identity](topics/design/ayush-soni-visual-design-post.md) (`style-ref`): cool visual design
- [Pixel sprite search](topics/gamedev/pixel-search-sprite-database.md) (`asset-source`): sprites database for games I build
- [MyCountryMogsYours game](topics/gamedev/my-country-mogs-yours.md) (`game-ref`): cool browser game I found
- [Cricle game](topics/gamedev/cricle-daily-cricket-guessing-game.md) (`game-ref`): fun cricket browser games
- [500-0 game](topics/gamedev/thechase500-cricket-chase-game.md) (`game-ref`): fun cricket browser games

<!-- GENERATED:END -->
