/************** Global Variables **************/

let pointers = [];
let splatStack = [];

pointers.push(new PointerPrototype());

let dye;
let velocity;
let divergence;
let curl;
let pressure;
let bloom;
let bloomFramebuffers = [];
let sunrays;
let sunraysTemp;

const blit = (() => {
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]),
    gl.STATIC_DRAW
  );
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint16Array([0, 1, 2, 0, 2, 3]),
    gl.STATIC_DRAW
  );
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(0);

  return (target, clear = false) => {
    if (target == null) {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    } else {
      gl.viewport(0, 0, target.width, target.height);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    }
    if (clear) {
      gl.clearColor(0.0, 0.0, 0.0, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    // CHECK_FRAMEBUFFER_STATUS();
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  };
})();

/************** Material **************/
const displayMaterial = new Material(baseVertexShader, displayShaderSource);

/************** Programs **************/
const blurProgram = new Program(blurVertexShader, blurShader);
const copyProgram = new Program(baseVertexShader, copyShader);
const clearProgram = new Program(baseVertexShader, clearShader);
const colorProgram = new Program(baseVertexShader, colorShader);
const checkerboardProgram = new Program(baseVertexShader, checkerboardShader);
const bloomPrefilterProgram = new Program(
  baseVertexShader,
  bloomPrefilterShader
);
const bloomBlurProgram = new Program(baseVertexShader, bloomBlurShader);
const bloomFinalProgram = new Program(baseVertexShader, bloomFinalShader);
const sunraysMaskProgram = new Program(baseVertexShader, sunraysMaskShader);
const sunraysProgram = new Program(baseVertexShader, sunraysShader);
const splatProgram = new Program(baseVertexShader, splatShader);
const advectionProgram = new Program(baseVertexShader, advectionShader);
const divergenceProgram = new Program(baseVertexShader, divergenceShader);
const curlProgram = new Program(baseVertexShader, curlShader);
const vorticityProgram = new Program(baseVertexShader, vorticityShader);
const pressureProgram = new Program(baseVertexShader, pressureShader);
const gradienSubtractProgram = new Program(
  baseVertexShader,
  gradientSubtractShader
);
/************** Texture **************/
let ditheringTexture = createTextureAsync("LDR_LLL1_0.png");

/*************************************************/

updateKeywords();
initFramebuffers();
multipleSplats(parseInt(Math.random() * 20) + 5);

let lastUpdateTime = Date.now();
let colorUpdateTimer = 0.0;
update();

function update() {
  const dt = calcDeltaTime();
  if (resizeCanvas()) initFramebuffers();
  updateColors(dt);
  applyInputs();
  if (!config.PAUSED) step(dt);
  render(null);
  requestAnimationFrame(update);
}

/************** Render **************/
function render(target) {
  if (config.BLOOM) applyBloom(dye.read, bloom);
  if (config.SUNRAYS) {
    applySunrays(dye.read, dye.write, sunrays);
    blur(sunrays, sunraysTemp, 1);
  }

  if (target == null || !config.TRANSPARENT) {
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.BLEND);
  } else {
    gl.disable(gl.BLEND);
  }

  if (!config.TRANSPARENT) drawColor(target, normalizeColor(config.BACK_COLOR));
  if (target == null && config.TRANSPARENT) drawCheckerboard(target);
  drawDisplay(target);
}

/************** Canvas Event **************/
canvas.addEventListener("mousedown", (e) => {
  let posX = scaleByPixelRatio(e.offsetX);
  let posY = scaleByPixelRatio(e.offsetY);
  let pointer = pointers.find((p) => p.id == -1);
  if (pointer == null) pointer = new pointerPrototype();
  updatePointerDownData(pointer, -1, posX, posY);
});

canvas.addEventListener("mousemove", (e) => {
  let pointer = pointers[0];
  if (!pointer.down) return;
  let posX = scaleByPixelRatio(e.offsetX);
  let posY = scaleByPixelRatio(e.offsetY);
  updatePointerMoveData(pointer, posX, posY);
});

window.addEventListener("mouseup", () => {
  updatePointerUpData(pointers[0]);
});

canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  const touches = e.targetTouches;
  while (touches.length >= pointers.length)
    pointers.push(new pointerPrototype());
  for (let i = 0; i < touches.length; i++) {
    let posX = scaleByPixelRatio(touches[i].pageX);
    let posY = scaleByPixelRatio(touches[i].pageY);
    updatePointerDownData(pointers[i + 1], touches[i].identifier, posX, posY);
  }
});

canvas.addEventListener(
  "touchmove",
  (e) => {
    e.preventDefault();
    const touches = e.targetTouches;
    for (let i = 0; i < touches.length; i++) {
      let pointer = pointers[i + 1];
      if (!pointer.down) continue;
      let posX = scaleByPixelRatio(touches[i].pageX);
      let posY = scaleByPixelRatio(touches[i].pageY);
      updatePointerMoveData(pointer, posX, posY);
    }
  },
  false
);

window.addEventListener("touchend", (e) => {
  const touches = e.changedTouches;
  for (let i = 0; i < touches.length; i++) {
    let pointer = pointers.find((p) => p.id == touches[i].identifier);
    if (pointer == null) continue;
    updatePointerUpData(pointer);
  }
});

window.addEventListener("keydown", (e) => {
  if (e.code === "KeyP") config.PAUSED = !config.PAUSED;
  if (e.key === " ") splatStack.push(parseInt(Math.random() * 20) + 5);
});
