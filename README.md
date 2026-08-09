# TERRE BONNE

A low-poly folk horror walk. Bellamy Bridge, Jackson County, Florida. 2:00 a.m.

A grieving man walks a half-mile nature trail looking for a ghost story, and
finds the history the ghost story was invented to cover.

Built from `docs/design-doc.html` — a playable implementation of the design
document, not an adaptation of it. Runs in the browser, no build step, no
dependencies.

## Run it

Any static server will do; ES modules will not load from `file://`.

```
npx http-server -p 8099 .     # or: python3 -m http.server 8099
```

Then open <http://127.0.0.1:8099/>.

Needs WebGL2 and a mouse (pointer lock). Click the frame to capture the cursor.

## Controls

| | |
|---|---|
| `W A S D` | walk |
| mouse | look |
| `E` | read the thing in front of you · get in the truck · (hold) read the names |
| hold `F` | pray |
| hold `X` | stay (at the bridge, loop three) |
| `R` | recorder |
| `Esc` | put down what you are reading / release the cursor |

## The mechanic

Ray's flashlight **is the HUD**. There is no meter, no number, no belief bar.
Its colour temperature says what he currently believes, and the world renders
accordingly.

| | Legend · 2200K | Record · 5600K |
|---|---|---|
| light | warm amber | cold blue-white |
| draw distance | 20 m | 12 m (8 m on loop three) |
| the figure | a woman at the treeline, always at the edge of sight | no bride — sounds instead of sights |
| the trail | loops forever; no new geometry opens | the only state where the trail admits it is longer than the sign says |

Belief moves through artifacts. Nearly every one is a pair — the interpretive
plaque the county wrote, and the document somebody tucked behind it. Read the
plaque, the light warms. Read the obituary, the survey, the ledger, the light
goes cold. You can read both. You cannot hold both: the most recent reading
wins, and what came before only softens how hard the light swings.

**Prayer costs a memory.** Hold `F`. In Legend state it does nothing mechanical
— the breathing steadies, the camera sway calms, and that is all it is. In
Record state it works: it quiets the thing in the fog and opens the way forward,
and each true prayer replaces a softened memory of Junie with the accurate one.
The first costs him the way he remembers her laugh. The fourth costs him the
last thing he actually said to her, which was not kind.

**The laugh** fires every time Ray accepts an easy explanation. Occurrence one
is seventy percent barred owl and genuinely ambiguous. By the third it is
unmistakably a young woman, and it is close. Play the recorder in the final act
and the laugh is on the 2:00 file — the one made in the gravel lot before
anything had happened. It was always on it.

## Four ways off the trail

| | |
|---|---|
| **Barred Owl** | Walk out having accepted the story the town tells. Dawn, birdsong, a pleasant walk to the truck — and then the credits play the tape. |
| **The Register** | All three ledger leaves, cold light, and at the bridge you read the names aloud. She goes quiet. Not banished — answered. |
| **Always and Forever** | Refuse to leave on loop three. The camera lets go of Ray and pulls back to the trailhead. |
| **0.00** | At the gate, after the second laugh, get in the truck and drive home. Ninety seconds. Nobody is hurt, and it is deliberately the easiest one to miss. |

## What is in here

```
index.html          shell + DOM text layer
src/gl.js           240p framebuffer, affine UVs, vertex snapping, Bayer dither, fog
src/textures.js     every texture, generated at runtime, 64–128px, palette-locked
src/geometry.js     mesh builder; world-space batching, baked vertex lighting
src/world.js        the trail, the swamp, the grove, the field, the 1914 truss
src/content.js      all of the writing
src/game.js         belief, prayer, loops, endings
src/audio.js        procedural swamp bed, the owl, the laugh, shape-note, the recorder
src/ui.js           subtitles, reader, recorder, endings
docs/design-doc.html  the source document
```

### Render spec, as built

- 320 × 240 internal, integer upscale, point-sampled; 640 × 480 unlock on the title screen
- Affine texture mapping — UVs premultiplied by `w` and divided back out in the
  fragment stage, so interpolation stays screen-space linear and the textures warp
- Screen-space vertex position snapping
- 15-bit colour, ordered Bayer 4×4 dither
- Baked vertex lighting; the flashlight is the only runtime light; no dynamic shadows
- 64–128 px textures, point filtering, no mipmaps
- One figure in the whole game

**Hard rule, enforced in code:** Elizabeth is never rendered inside the fog
plane. She is placed at 95% of the current draw distance every frame, so running
at her resolves the fog to empty trail. She is not a model the player is allowed
to look at, and there is no sequence where that changes.

### Audio

Everything is synthesised in WebAudio at runtime: the cicada and cricket-frog
bed, the river, footfalls on plank and on mud, the barred owl's "who cooks for
you", the laugh (owl layered under a young woman, mix shifting 70/30 → 10/90
across three occurrences), three moments of unaccompanied shape-note singing,
and the band-passed diegetic recorder. Loop three removes the wildlife bed
entirely, because removing sound is the scare.

A full build field-records the Chipola at night and drops those files in behind
the same triggers. The structure is here; the microphone is not.

## Handle with care

Terre Bonne held enslaved people. The rule this project keeps: **the enslaved
are never the monster, never a jump scare, and never a ghost that menaces the
player.** The horror is the erasure — a town that built a beautiful sad story
about one girl and set it on top of everyone else. The ledger names are
fictional composites, labelled as such in-game, not individuals lifted from
archives without descendant consent. Anyone taking this further should consult
Jackson County historical resources before rewriting that act.

Elizabeth, Samuel, Ann and Edward Bellamy existed, and Samuel's death is
documented, not invented. What the record supports is depicted; past that line
it is fiction.

**Content warnings:** bereavement and grief, suicide (historical, offscreen),
infant death, slavery and its erasure, isolation, darkness, sudden loud audio at
two marked points.
