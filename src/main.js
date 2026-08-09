// Terre Bonne — boot.

import { Game } from './game.js';

const canvas = document.getElementById('screen');

try {
  window.game = new Game(canvas);
} catch (err) {
  console.error(err);
  const panel = document.getElementById('title');
  panel.innerHTML =
    `<p class="slug">Terre Bonne</p>
     <h2>This browser cannot render the swamp.</h2>
     <p class="body quiet">The game needs WebGL2. ${String(err.message || err)}</p>`;
}
