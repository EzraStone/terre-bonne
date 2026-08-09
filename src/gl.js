// Terre Bonne — renderer.
//
// Pillar 1: the limitation is the monster. Everything in here exists to make the
// image refuse to settle: 320x240 internal, affine texture mapping with no
// perspective correction, screen-space vertex snapping, 15-bit colour with an
// ordered Bayer dither, and a fog plane that eats the world at 12-20 metres.
// There is no anti-aliasing, no mipmapping, no dynamic shadow. Any change that
// increases clarity is the wrong change.

export const RES = { lo: [320, 240], hi: [640, 480] };

/* ------------------------------------------------------------------ mat4 */
export const M4 = {
  ident() { return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]); },

  perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0,
    ]);
  },

  // Camera basis from yaw/pitch, inverted into a view matrix.
  view(px, py, pz, yaw, pitch, roll = 0) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cr = Math.cos(roll), sr = Math.sin(roll);

    // forward = -Z of the camera
    let fx = -sy * cp, fy = sp, fz = -cy * cp;
    let rx = cy, ry = 0, rz = -sy;
    // up = right x forward
    let ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;

    if (roll !== 0) {
      const nrx = rx * cr + ux * sr, nry = ry * cr + uy * sr, nrz = rz * cr + uz * sr;
      ux = ux * cr - rx * sr; uy = uy * cr - ry * sr; uz = uz * cr - rz * sr;
      rx = nrx; ry = nry; rz = nrz;
    }

    const zx = -fx, zy = -fy, zz = -fz;
    return new Float32Array([
      rx, ux, zx, 0,
      ry, uy, zy, 0,
      rz, uz, zz, 0,
      -(rx * px + ry * py + rz * pz),
      -(ux * px + uy * py + uz * pz),
      -(zx * px + zy * py + zz * pz),
      1,
    ]);
  },

  mul(a, b) { // a * b
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] +
                       a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      }
    }
    return o;
  },
};

/* --------------------------------------------------------------- shaders */
// Affine UVs: GPUs interpolate varyings perspective-correctly, so we pre-multiply
// by w and divide it back out in the fragment stage. What survives is plain
// screen-space linear interpolation — the PlayStation's warping texture crawl.
const VERT = `#version 300 es
precision highp float;

layout(location=0) in vec3 aPos;
layout(location=1) in vec2 aUV;
layout(location=2) in vec3 aCol;
layout(location=3) in vec3 aNrm;

uniform mat4 uProj, uView, uModel;
uniform vec2 uRes;
uniform float uSnap;      // 0 = smooth, 1 = full PS1 lattice
uniform float uUVScroll;

out vec3 vUV;             // xy = uv*w, z = w
out vec3 vCol;
out vec3 vNrm;
out vec3 vViewPos;

void main(){
  vec4 world = uModel * vec4(aPos, 1.0);
  vec4 view  = uView * world;
  vec4 clip  = uProj * view;

  // screen-space position snapping — vertices can only land on the lattice
  if (uSnap > 0.0 && clip.w > 0.0) {
    vec2 grid = uRes * 0.5;
    vec2 ndc  = clip.xy / clip.w;
    vec2 snapped = floor(ndc * grid + 0.5) / grid;
    clip.xy = mix(ndc, snapped, uSnap) * clip.w;
  }

  vec2 uv = aUV + vec2(0.0, uUVScroll);
  vUV = vec3(uv * clip.w, clip.w);
  vCol = aCol;
  vNrm = mat3(uModel) * aNrm;
  vViewPos = view.xyz;
  gl_Position = clip;
}`;

const FRAG = `#version 300 es
precision highp float;

in vec3 vUV;
in vec3 vCol;
in vec3 vNrm;
in vec3 vViewPos;

uniform sampler2D uTex;
uniform vec3 uFogCol;
uniform float uFogNear, uFogFar;   // draw distance lives here
uniform vec3 uLightCol;            // 2200K legend amber .. 5600K record blue-white
uniform float uLightRange, uLightInner, uLightOuter, uLightGain;
uniform vec3 uAmbient;
uniform float uAlphaCut;
uniform float uFlicker;
uniform float uUnlit;              // 1 = skip lighting (silhouettes, water sheen)

out vec4 frag;

const mat4 BAYER = mat4(
   0.0,  8.0,  2.0, 10.0,
  12.0,  4.0, 14.0,  6.0,
   3.0, 11.0,  1.0,  9.0,
  15.0,  7.0, 13.0,  5.0
);

float bayer(vec2 p){
  int x = int(mod(p.x, 4.0));
  int y = int(mod(p.y, 4.0));
  return BAYER[x][y] / 16.0 - 0.5;
}

void main(){
  vec2 uv = vUV.xy / vUV.z;                 // affine, deliberately
  vec4 tex = texture(uTex, uv);
  if (tex.a < uAlphaCut) discard;

  vec3 col = tex.rgb * vCol;

  if (uUnlit < 0.5) {
    // The flashlight is the only HUD. Its colour says what Ray currently believes.
    float dist = length(vViewPos);
    vec3  dir  = vViewPos / max(dist, 0.0001);
    float cone = smoothstep(uLightOuter, uLightInner, -dir.z);
    float fall = 1.0 - clamp(dist / uLightRange, 0.0, 1.0);
    fall = fall * (0.45 + 0.55 * fall);
    float lambert = clamp(dot(normalize(vNrm), -dir), 0.0, 1.0) * 0.55 + 0.45;
    vec3 lamp = uLightCol * cone * fall * lambert * uLightGain * uFlicker;
    col *= (uAmbient + lamp);
  }

  // fog: the culling distance is not a budget, it is the reason you cannot be sure
  float fogAmt = clamp((length(vViewPos) - uFogNear) / max(uFogFar - uFogNear, 0.001), 0.0, 1.0);
  col = mix(col, uFogCol, fogAmt);

  // 15-bit colour, ordered dither
  float d = bayer(gl_FragCoord.xy) / 32.0;
  col = floor((col + d) * 32.0 + 0.5) / 32.0;

  frag = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

// Fullscreen blit of the low-res target, integer-scaled and point-sampled.
const BLIT_V = `#version 300 es
precision highp float;
out vec2 vUV;
void main(){
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUV = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const BLIT_F = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
uniform float uVignette;
uniform float uFade;
out vec4 frag;
void main(){
  vec3 c = texture(uTex, vUV).rgb;
  vec2 d = vUV - 0.5;
  c *= 1.0 - uVignette * dot(d, d) * 1.6;
  frag = vec4(c * uFade, 1.0);
}`;

/* ------------------------------------------------------------------ util */
function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error('shader: ' + gl.getShaderInfoLog(s));
  }
  return s;
}

function link(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error('program: ' + gl.getProgramInfoLog(p));
  }
  return p;
}

function uniforms(gl, prog, names) {
  const u = {};
  for (const n of names) u[n] = gl.getUniformLocation(prog, n);
  return u;
}

/* --------------------------------------------------------------- Renderer */
export class Renderer {
  constructor(canvas) {
    const gl = canvas.getContext('webgl2', {
      alpha: false, antialias: false, depth: true, powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL2 is required.');
    this.gl = gl;
    this.canvas = canvas;

    this.prog = link(gl, VERT, FRAG);
    this.u = uniforms(gl, this.prog, [
      'uProj','uView','uModel','uRes','uSnap','uUVScroll','uTex',
      'uFogCol','uFogNear','uFogFar','uLightCol','uLightRange','uLightInner',
      'uLightOuter','uLightGain','uAmbient','uAlphaCut','uFlicker','uUnlit',
    ]);

    this.blit = link(gl, BLIT_V, BLIT_F);
    this.bu = uniforms(gl, this.blit, ['uTex','uVignette','uFade']);
    this.blitVAO = gl.createVertexArray();

    this.setInternalRes(RES.lo);

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
  }

  setInternalRes([w, h]) {
    const gl = this.gl;
    this.rw = w; this.rh = h;

    if (this.fbo) {
      gl.deleteFramebuffer(this.fbo);
      gl.deleteTexture(this.colorTex);
      gl.deleteRenderbuffer(this.depthRB);
    }

    this.colorTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.colorTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.depthRB = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.depthRB);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);

    this.fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.colorTex, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.depthRB);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // Upload a mesh (see geometry.js for the vertex layout) into a VAO.
  upload(mesh) {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.verts, gl.STATIC_DRAW);

    const stride = 11 * 4;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, stride, 20);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 3, gl.FLOAT, false, stride, 32);

    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.index, gl.STATIC_DRAW);

    gl.bindVertexArray(null);
    return { vao, count: mesh.index.length };
  }

  makeTexture(source) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    // point filtering, no mipmaps — the texture should crawl
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    return t;
  }

  beginFrame(cam) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, this.rw, this.rh);
    gl.clearColor(cam.fogCol[0], cam.fogCol[1], cam.fogCol[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(this.prog);
    const u = this.u;
    const proj = M4.perspective(cam.fov, this.rw / this.rh, 0.08, Math.max(cam.fogFar * 1.4, 30));
    gl.uniformMatrix4fv(u.uProj, false, proj);
    gl.uniformMatrix4fv(u.uView, false, cam.view);
    gl.uniform2f(u.uRes, this.rw, this.rh);
    gl.uniform1f(u.uSnap, cam.snap);
    gl.uniform1i(u.uTex, 0);
    gl.uniform3fv(u.uFogCol, cam.fogCol);
    gl.uniform1f(u.uFogNear, cam.fogNear);
    gl.uniform1f(u.uFogFar, cam.fogFar);
    gl.uniform3fv(u.uLightCol, cam.lightCol);
    gl.uniform1f(u.uLightRange, cam.lightRange);
    gl.uniform1f(u.uLightInner, cam.lightInner);
    gl.uniform1f(u.uLightOuter, cam.lightOuter);
    gl.uniform1f(u.uLightGain, cam.lightGain);
    gl.uniform3fv(u.uAmbient, cam.ambient);
    gl.uniform1f(u.uFlicker, cam.flicker);
    gl.uniform1f(u.uUVScroll, 0);
    gl.uniform1f(u.uAlphaCut, 0.5);
    gl.uniform1f(u.uUnlit, 0);
    gl.uniformMatrix4fv(u.uModel, false, M4.ident());
  }

  draw(handle, tex, opts = {}) {
    const gl = this.gl;
    const u = this.u;
    gl.uniformMatrix4fv(u.uModel, false, opts.model || M4.ident());
    gl.uniform1f(u.uAlphaCut, opts.alphaCut ?? 0.5);
    gl.uniform1f(u.uUVScroll, opts.scroll || 0);
    gl.uniform1f(u.uUnlit, opts.unlit ? 1 : 0);
    if (opts.doubleSided) gl.disable(gl.CULL_FACE);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.bindVertexArray(handle.vao);
    gl.drawElements(gl.TRIANGLES, handle.count, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);
    if (opts.doubleSided) gl.enable(gl.CULL_FACE);
  }

  // Present: integer upscale, letterboxed, nothing smoothed.
  endFrame(vignette = 0.55, fade = 1) {
    const gl = this.gl;
    const dpr = 1; // the frame is 240p; a hi-dpi backbuffer would only soften it
    const cw = Math.floor(this.canvas.clientWidth * dpr);
    const ch = Math.floor(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw; this.canvas.height = ch;
    }

    const scale = Math.max(1, Math.min(Math.floor(cw / this.rw), Math.floor(ch / this.rh)));
    const vw = this.rw * scale, vh = this.rh * scale;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, cw, ch);
    gl.disable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.viewport(Math.floor((cw - vw) / 2), Math.floor((ch - vh) / 2), vw, vh);

    gl.useProgram(this.blit);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.colorTex);
    gl.uniform1i(this.bu.uTex, 0);
    gl.uniform1f(this.bu.uVignette, vignette);
    gl.uniform1f(this.bu.uFade, fade);
    gl.bindVertexArray(this.blitVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.enable(gl.DEPTH_TEST);
  }
}
