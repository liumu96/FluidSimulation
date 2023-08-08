function initFramebuffers() {
  let simRes = getResolution(config.SIM_RESOLUTION);
  let dyeRes = getResolution(config.DYE_RESOLUTION);

  const texType = ext.halfFloatTexType;
  const rgba = ext.formatRGBA;
  const rg = ext.formatRG;
  const r = ext.formatR;
  const filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;

  gl.disable(gl.BLEND);

  if (dye == null)
    dye = createDoubleFBO(
      dyeRes.width,
      dyeRes.height,
      rgba.internalFormat,
      rgba.format,
      texType,
      filtering
    );
  else
    dye = resizeDoubleFBO(
      dye,
      dyeRes.width,
      dyeRes.height,
      rgba.internalFormat,
      rgba.format,
      texType,
      filtering
    );

  if (velocity == null)
    velocity = createDoubleFBO(
      simRes.width,
      simRes.height,
      rg.internalFormat,
      rg.format,
      texType,
      filtering
    );
  else
    velocity = resizeDoubleFBO(
      velocity,
      simRes.width,
      simRes.height,
      rg.internalFormat,
      rg.format,
      texType,
      filtering
    );

  divergence = createFBO(
    simRes.width,
    simRes.height,
    r.internalFormat,
    r.format,
    texType,
    gl.NEAREST
  );
  curl = createFBO(
    simRes.width,
    simRes.height,
    r.internalFormat,
    r.format,
    texType,
    gl.NEAREST
  );
  pressure = createDoubleFBO(
    simRes.width,
    simRes.height,
    r.internalFormat,
    r.format,
    texType,
    gl.NEAREST
  );

  initBloomFramebuffers();
  initSunraysFramebuffers();
}

function initBloomFramebuffers() {
  let res = getResolution(config.BLOOM_RESOLUTION);

  const texType = ext.halfFloatTexType;
  const rgba = ext.formatRGBA;
  const filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;

  bloom = createFBO(
    res.width,
    res.height,
    rgba.internalFormat,
    rgba.format,
    texType,
    filtering
  );

  bloomFramebuffers.length = 0;
  for (let i = 0; i < config.BLOOM_ITERATIONS; i++) {
    let width = res.width >> (i + 1);
    let height = res.height >> (i + 1);

    if (width < 2 || height < 2) break;

    let fbo = createFBO(
      width,
      height,
      rgba.internalFormat,
      rgba.format,
      texType,
      filtering
    );
    bloomFramebuffers.push(fbo);
  }
}

function initSunraysFramebuffers() {
  let res = getResolution(config.SUNRAYS_RESOLUTION);

  const texType = ext.halfFloatTexType;
  const r = ext.formatR;
  const filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;

  sunrays = createFBO(
    res.width,
    res.height,
    r.internalFormat,
    r.format,
    texType,
    filtering
  );
  sunraysTemp = createFBO(
    res.width,
    res.height,
    r.internalFormat,
    r.format,
    texType,
    filtering
  );
}

function createDoubleFBO(w, h, internalFormat, format, type, param) {
  let fbo1 = createFBO(w, h, internalFormat, format, type, param);
  let fbo2 = createFBO(w, h, internalFormat, format, type, param);

  return {
    width: w,
    height: h,
    texelSizeX: fbo1.texelSizeX,
    texelSizeY: fbo1.texelSizeY,
    get read() {
      return fbo1;
    },
    set read(value) {
      fbo1 = value;
    },
    get write() {
      return fbo2;
    },
    set write(value) {
      fbo2 = value;
    },
    swap() {
      let temp = fbo1;
      fbo1 = fbo2;
      fbo2 = temp;
    },
  };
}

function createFBO(w, h, internalFormat, format, type, param) {
  gl.activeTexture(gl.TEXTURE0);
  let texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);

  let fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texture,
    0
  );
  gl.viewport(0, 0, w, h);
  gl.clear(gl.COLOR_BUFFER_BIT);

  let texelSizeX = 1.0 / w;
  let texelSizeY = 1.0 / h;

  return {
    texture,
    fbo,
    width: w,
    height: h,
    texelSizeX,
    texelSizeY,
    attach(id) {
      gl.activeTexture(gl.TEXTURE0 + id);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      return id;
    },
  };
}

function resizeDoubleFBO(target, w, h, internalFormat, format, type, param) {
  if (target.width == w && target.height == h) return target;
  target.read = resizeFBO(
    target.read,
    w,
    h,
    internalFormat,
    format,
    type,
    param
  );
  target.write = createFBO(w, h, internalFormat, format, type, param);
  target.width = w;
  target.height = h;
  target.texelSizeX = 1.0 / w;
  target.texelSizeY = 1.0 / h;
  return target;
}

function resizeFBO(target, w, h, internalFormat, format, type, param) {
  let newFBO = createFBO(w, h, internalFormat, format, type, param);
  copyProgram.bind();
  gl.uniform1i(copyProgram.uniforms.uTexture, target.attach(0));
  blit(newFBO);
  return newFBO;
}

function updateKeywords() {
  let displayKeywords = [];
  if (config.SHADING) displayKeywords.push("SHADING");
  if (config.BLOOM) displayKeywords.push("BLOOM");
  if (config.SUNRAYS) displayKeywords.push("SUNRAYS");
  displayMaterial.setKeywords(displayKeywords);
}

function multipleSplats(amount) {
  for (let i = 0; i < amount; i++) {
    const color = generateColor();
    color.r *= 10.0;
    color.g *= 10.0;
    color.b *= 10.0;
    const x = Math.random();
    const y = Math.random();
    const dx = 1000 * (Math.random() - 0.5);
    const dy = 1000 * (Math.random() - 0.5);
    splat(x, y, dx, dy, color);
  }
}

function generateColor() {
  let c = HSVtoRGB(Math.random(), 1.0, 1.0);
  c.r *= 0.15;
  c.g *= 0.15;
  c.b *= 0.15;
  return c;
}

function HSVtoRGB(h, s, v) {
  let r, g, b, i, f, p, q, t;
  i = Math.floor(h * 6);
  f = h * 6 - i;
  p = v * (1 - s);
  q = v * (1 - f * s);
  t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0:
      (r = v), (g = t), (b = p);
      break;
    case 1:
      (r = q), (g = v), (b = p);
      break;
    case 2:
      (r = p), (g = v), (b = t);
      break;
    case 3:
      (r = p), (g = q), (b = v);
      break;
    case 4:
      (r = t), (g = p), (b = v);
      break;
    case 5:
      (r = v), (g = p), (b = q);
      break;
  }

  return {
    r,
    g,
    b,
  };
}

function splat(x, y, dx, dy, color) {
  splatProgram.bind();
  gl.uniform1i(splatProgram.uniforms.uTarget, velocity.read.attach(0));
  gl.uniform1f(splatProgram.uniforms.aspectRatio, canvas.width / canvas.height);
  gl.uniform2f(splatProgram.uniforms.point, x, y);
  gl.uniform3f(splatProgram.uniforms.color, dx, dy, 0.0);
  gl.uniform1f(
    splatProgram.uniforms.radius,
    correctRadius(config.SPLAT_RADIUS / 100.0)
  );
  blit(velocity.write);
  velocity.swap();

  gl.uniform1i(splatProgram.uniforms.uTarget, dye.read.attach(0));
  gl.uniform3f(splatProgram.uniforms.color, color.r, color.g, color.b);
  blit(dye.write);
  dye.swap();
}

function correctRadius(radius) {
  let aspectRatio = canvas.width / canvas.height;
  if (aspectRatio > 1) radius *= aspectRatio;
  return radius;
}

/****** update ******/

function calcDeltaTime() {
  let now = Date.now();
  let dt = (now - lastUpdateTime) / 1000;
  dt = Math.min(dt, 0.016666);
  lastUpdateTime = now;
  return dt;
}

function updateColors(dt) {
  if (!config.COLORFUL) return;

  colorUpdateTimer += dt * config.COLOR_UPDATE_SPEED;
  if (colorUpdateTimer >= 1) {
    colorUpdateTimer = wrap(colorUpdateTimer, 0, 1);
    pointers.forEach((p) => {
      p.color = generateColor();
    });
  }
}

function wrap(value, min, max) {
  let range = max - min;
  if (range == 0) return min;
  return ((value - min) % range) + min;
}

function applyInputs() {
  if (splatStack.length > 0) multipleSplats(splatStack.pop());

  pointers.forEach((p) => {
    if (p.moved) {
      p.moved = false;
      splatPointer(p);
    }
  });
}

function step(dt) {
  gl.disable(gl.BLEND);

  curlProgram.bind();
  gl.uniform2f(
    curlProgram.uniforms.texelSize,
    velocity.texelSizeX,
    velocity.texelSizeY
  );
  gl.uniform1i(curlProgram.uniforms.uVelocity, velocity.read.attach(0));
  blit(curl);

  vorticityProgram.bind();
  gl.uniform2f(
    vorticityProgram.uniforms.texelSize,
    velocity.texelSizeX,
    velocity.texelSizeY
  );
  gl.uniform1i(vorticityProgram.uniforms.uVelocity, velocity.read.attach(0));
  gl.uniform1i(vorticityProgram.uniforms.uCurl, curl.attach(1));
  gl.uniform1f(vorticityProgram.uniforms.curl, config.CURL);
  gl.uniform1f(vorticityProgram.uniforms.dt, dt);
  blit(velocity.write);
  velocity.swap();

  divergenceProgram.bind();
  gl.uniform2f(
    divergenceProgram.uniforms.texelSize,
    velocity.texelSizeX,
    velocity.texelSizeY
  );
  gl.uniform1i(divergenceProgram.uniforms.uVelocity, velocity.read.attach(0));
  blit(divergence);

  clearProgram.bind();
  gl.uniform1i(clearProgram.uniforms.uTexture, pressure.read.attach(0));
  gl.uniform1f(clearProgram.uniforms.value, config.PRESSURE);
  blit(pressure.write);
  pressure.swap();

  pressureProgram.bind();
  gl.uniform2f(
    pressureProgram.uniforms.texelSize,
    velocity.texelSizeX,
    velocity.texelSizeY
  );
  gl.uniform1i(pressureProgram.uniforms.uDivergence, divergence.attach(0));
  for (let i = 0; i < config.PRESSURE_ITERATIONS; i++) {
    gl.uniform1i(pressureProgram.uniforms.uPressure, pressure.read.attach(1));
    blit(pressure.write);
    pressure.swap();
  }

  gradienSubtractProgram.bind();
  gl.uniform2f(
    gradienSubtractProgram.uniforms.texelSize,
    velocity.texelSizeX,
    velocity.texelSizeY
  );
  gl.uniform1i(
    gradienSubtractProgram.uniforms.uPressure,
    pressure.read.attach(0)
  );
  gl.uniform1i(
    gradienSubtractProgram.uniforms.uVelocity,
    velocity.read.attach(1)
  );
  blit(velocity.write);
  velocity.swap();

  advectionProgram.bind();
  gl.uniform2f(
    advectionProgram.uniforms.texelSize,
    velocity.texelSizeX,
    velocity.texelSizeY
  );
  if (!ext.supportLinearFiltering)
    gl.uniform2f(
      advectionProgram.uniforms.dyeTexelSize,
      velocity.texelSizeX,
      velocity.texelSizeY
    );
  let velocityId = velocity.read.attach(0);
  gl.uniform1i(advectionProgram.uniforms.uVelocity, velocityId);
  gl.uniform1i(advectionProgram.uniforms.uSource, velocityId);
  gl.uniform1f(advectionProgram.uniforms.dt, dt);
  gl.uniform1f(
    advectionProgram.uniforms.dissipation,
    config.VELOCITY_DISSIPATION
  );
  blit(velocity.write);
  velocity.swap();

  if (!ext.supportLinearFiltering)
    gl.uniform2f(
      advectionProgram.uniforms.dyeTexelSize,
      dye.texelSizeX,
      dye.texelSizeY
    );
  gl.uniform1i(advectionProgram.uniforms.uVelocity, velocity.read.attach(0));
  gl.uniform1i(advectionProgram.uniforms.uSource, dye.read.attach(1));
  gl.uniform1f(
    advectionProgram.uniforms.dissipation,
    config.DENSITY_DISSIPATION
  );
  blit(dye.write);
  dye.swap();
}

function applyBloom(source, destination) {
  if (bloomFramebuffers.length < 2) return;

  let last = destination;

  gl.disable(gl.BLEND);
  bloomPrefilterProgram.bind();
  let knee = config.BLOOM_THRESHOLD * config.BLOOM_SOFT_KNEE + 0.0001;
  let curve0 = config.BLOOM_THRESHOLD - knee;
  let curve1 = knee * 2;
  let curve2 = 0.25 / knee;
  gl.uniform3f(bloomPrefilterProgram.uniforms.curve, curve0, curve1, curve2);
  gl.uniform1f(
    bloomPrefilterProgram.uniforms.threshold,
    config.BLOOM_THRESHOLD
  );
  gl.uniform1i(bloomPrefilterProgram.uniforms.uTexture, source.attach(0));
  blit(last);

  bloomBlurProgram.bind();
  for (let i = 0; i < bloomFramebuffers.length; i++) {
    let dest = bloomFramebuffers[i];
    gl.uniform2f(
      bloomBlurProgram.uniforms.texelSize,
      last.texelSizeX,
      last.texelSizeY
    );
    gl.uniform1i(bloomBlurProgram.uniforms.uTexture, last.attach(0));
    blit(dest);
    last = dest;
  }

  gl.blendFunc(gl.ONE, gl.ONE);
  gl.enable(gl.BLEND);

  for (let i = bloomFramebuffers.length - 2; i >= 0; i--) {
    let baseTex = bloomFramebuffers[i];
    gl.uniform2f(
      bloomBlurProgram.uniforms.texelSize,
      last.texelSizeX,
      last.texelSizeY
    );
    gl.uniform1i(bloomBlurProgram.uniforms.uTexture, last.attach(0));
    gl.viewport(0, 0, baseTex.width, baseTex.height);
    blit(baseTex);
    last = baseTex;
  }

  gl.disable(gl.BLEND);
  bloomFinalProgram.bind();
  gl.uniform2f(
    bloomFinalProgram.uniforms.texelSize,
    last.texelSizeX,
    last.texelSizeY
  );
  gl.uniform1i(bloomFinalProgram.uniforms.uTexture, last.attach(0));
  gl.uniform1f(bloomFinalProgram.uniforms.intensity, config.BLOOM_INTENSITY);
  blit(destination);
}

function applySunrays(source, mask, destination) {
  gl.disable(gl.BLEND);
  sunraysMaskProgram.bind();
  gl.uniform1i(sunraysMaskProgram.uniforms.uTexture, source.attach(0));
  blit(mask);

  sunraysProgram.bind();
  gl.uniform1f(sunraysProgram.uniforms.weight, config.SUNRAYS_WEIGHT);
  gl.uniform1i(sunraysProgram.uniforms.uTexture, mask.attach(0));
  blit(destination);
}

function blur(target, temp, iterations) {
  blurProgram.bind();
  for (let i = 0; i < iterations; i++) {
    gl.uniform2f(blurProgram.uniforms.texelSize, target.texelSizeX, 0.0);
    gl.uniform1i(blurProgram.uniforms.uTexture, target.attach(0));
    blit(temp);

    gl.uniform2f(blurProgram.uniforms.texelSize, 0.0, target.texelSizeY);
    gl.uniform1i(blurProgram.uniforms.uTexture, temp.attach(0));
    blit(target);
  }
}

function drawColor(target, color) {
  colorProgram.bind();
  gl.uniform4f(colorProgram.uniforms.color, color.r, color.g, color.b, 1);
  blit(target);
}

function normalizeColor(input) {
  let output = {
    r: input.r / 255,
    g: input.g / 255,
    b: input.b / 255,
  };
  return output;
}

function drawDisplay(target) {
  let width = target == null ? gl.drawingBufferWidth : target.width;
  let height = target == null ? gl.drawingBufferHeight : target.height;

  displayMaterial.bind();
  if (config.SHADING)
    gl.uniform2f(displayMaterial.uniforms.texelSize, 1.0 / width, 1.0 / height);
  gl.uniform1i(displayMaterial.uniforms.uTexture, dye.read.attach(0));
  if (config.BLOOM) {
    gl.uniform1i(displayMaterial.uniforms.uBloom, bloom.attach(1));
    gl.uniform1i(
      displayMaterial.uniforms.uDithering,
      ditheringTexture.attach(2)
    );
    let scale = getTextureScale(ditheringTexture, width, height);
    gl.uniform2f(displayMaterial.uniforms.ditherScale, scale.x, scale.y);
  }
  if (config.SUNRAYS)
    gl.uniform1i(displayMaterial.uniforms.uSunrays, sunrays.attach(3));
  blit(target);
}

/**********************************/

/****** commmon utils ******/

function getResolution(resolution) {
  let aspectRatio = gl.drawingBufferWidth / gl.drawingBufferHeight;
  if (aspectRatio < 1) aspectRatio = 1.0 / aspectRatio;

  let min = Math.round(resolution);
  let max = Math.round(resolution * aspectRatio);

  if (gl.drawingBufferWidth > gl.drawingBufferHeight)
    return { width: max, height: min };
  else return { width: min, height: max };
}

function hashCode(s) {
  if (s.length == 0) return 0;
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

function drawCheckerboard(target) {
  checkerboardProgram.bind();
  gl.uniform1f(
    checkerboardProgram.uniforms.aspectRatio,
    canvas.width / canvas.height
  );
  blit(target);
}

function CHECK_FRAMEBUFFER_STATUS() {
  let status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (status != gl.FRAMEBUFFER_COMPLETE)
    console.trace("Framebuffer error: " + status);
}

/**********************************/

/****** texture utils ******/

function createTextureAsync(url) {
  let texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGB,
    1,
    1,
    0,
    gl.RGB,
    gl.UNSIGNED_BYTE,
    new Uint8Array([255, 255, 255])
  );

  let obj = {
    texture,
    width: 1,
    height: 1,
    attach(id) {
      gl.activeTexture(gl.TEXTURE0 + id);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      return id;
    },
  };

  let image = new Image();
  image.onload = () => {
    obj.width = image.width;
    obj.height = image.height;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
  };
  image.src = url;

  return obj;
}

function getTextureScale(texture, width, height) {
  return {
    x: width / texture.width,
    y: height / texture.height,
  };
}

/**********************************/

/****** screen capture functions ******/

function captureScreenshot() {
  let res = getResolution(config.CAPTURE_RESOLUTION);
  let target = createFBO(
    res.width,
    res.height,
    ext.formatRGBA.internalFormat,
    ext.formatRGBA.format,
    ext.halfFloatTexType,
    gl.NEAREST
  );
  render(target);

  let texture = framebufferToTexture(target);
  texture = normalizeTexture(texture, target.width, target.height);

  let captureCanvas = textureToCanvas(texture, target.width, target.height);
  let datauri = captureCanvas.toDataURL();
  downloadURI("fluid.png", datauri);
  URL.revokeObjectURL(datauri);
}

function textureToCanvas(texture, width, height) {
  let captureCanvas = document.createElement("canvas");
  let ctx = captureCanvas.getContext("2d");
  captureCanvas.width = width;
  captureCanvas.height = height;

  let imageData = ctx.createImageData(width, height);
  imageData.data.set(texture);
  ctx.putImageData(imageData, 0, 0);

  return captureCanvas;
}

function framebufferToTexture(target) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
  let length = target.width * target.height * 4;
  let texture = new Float32Array(length);
  gl.readPixels(0, 0, target.width, target.height, gl.RGBA, gl.FLOAT, texture);
  return texture;
}

function normalizeTexture(texture, width, height) {
  let result = new Uint8Array(texture.length);
  let id = 0;
  for (let i = height - 1; i >= 0; i--) {
    for (let j = 0; j < width; j++) {
      let nid = i * width * 4 + j * 4;
      result[nid + 0] = clamp01(texture[id + 0]) * 255;
      result[nid + 1] = clamp01(texture[id + 1]) * 255;
      result[nid + 2] = clamp01(texture[id + 2]) * 255;
      result[nid + 3] = clamp01(texture[id + 3]) * 255;
      id += 4;
    }
  }
  return result;
}

function clamp01(input) {
  return Math.min(Math.max(input, 0), 1);
}

function downloadURI(filename, uri) {
  let link = document.createElement("a");
  link.download = filename;
  link.href = uri;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
