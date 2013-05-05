/* This file (geoid.js) is compiled from geoid.co. Please view the
original commented source there. */
(function(){
  "use strict";
  var canvas, ref$, width, height, k, ref1$, v, x0$, arr, rotation, e, currentRot, fov, distance, symmetric, x1$, minVal, ref2$, x2$, maxVal, reclamp, ctx, buffers, latBands, lonBands, noiseTex, noiseTransport, orthogonalLic, advection, blend, setupBuffers, numTriangles, p, mod, frame, initial, playing, x3$, x4$, draw, oceanField, landTextures, texturesToLoad, totalTextures, maybeDraw, pad, i, landMask, nightTexture, pointUnder, x5$, out$ = typeof exports != 'undefined' && exports || this;
  canvas = document.getElementById('canvas');
  ref$ = document.documentElement, canvas.width = ref$.clientWidth, canvas.height = ref$.clientHeight;
  width = canvas.width, height = canvas.height;
  window.addEventListener('resize', debounce(250, function(){
    var ref$;
    ref$ = document.documentElement, canvas.width = ref$.clientWidth, canvas.height = ref$.clientHeight;
    width = canvas.width, height = canvas.height;
  }));
  try {
    window.gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  } catch (e$) {}
  if (typeof gl == 'undefined' || gl === null) {
    alert("Sorry, it looks like your browser doesn't support WebGL, or webGL is disabled!");
    throw new Error("no webgl ;_;");
  }
  window.gl = WebGLDebugUtils.makeDebugContext(gl);
  for (k in ref1$ = gl) {
    v = ref1$[k];
    if (/^[A-Z_]+$/.test(k)) {
      window[k] = v;
    }
  }
  x0$ = gl;
  x0$.viewport(0, 0, width, height);
  x0$.clearColor(0, 0, 0, 1);
  x0$.clear(COLOR_BUFFER_BIT | DEPTH_BUFFER_BIT);
  arr = function(it){
    return Array.prototype.slice.call(it);
  };
  rotation = (function(){
    try {
      return new Float32Array(get('rotation'));
    } catch (e$) {
      e = e$;
      return mat4.identity();
    }
  }());
  currentRot = (function(){
    try {
      return new Float32Array(get('current-rot'));
    } catch (e$) {
      e = e$;
      return mat4.identity();
    }
  }());
  fov = parseInt(get('fov') || 15, 10);
  distance = get('distance') || 1 / Math.tan(radians(fov) / 2);
  function resetStage(){
    rotation = mat4.identity();
    currentRot = mat4.identity();
    fov = 15;
    distance = 1 / Math.tan(radians(fov) / 2);
    $('m').value = 10;
    $('n').value = 3;
    $('blend-ratio').value = 0.95;
    $('forwards').value = 10;
    $('backwards').value = 10;
    $('advection-h').value = 0.5;
    $('advection-steps').value = 10;
    minVal.value = 0.3;
    maxVal.value = 0.7;
  }
  window.addEventListener('unload', function(){
    set('rotation', arr(rotation));
    set('current-rot', arr(currentRot));
    set('distance', distance);
    set('fov', fov);
    set('m', parseFloat($('m').value) || 10);
    set('n', parseFloat($('n').value) || 10);
    set('blend-ratio', parseFloat($('blend-ratio').value) || 0.85);
    set('lic-h', $('lic-h').value);
    set('forwards', $('forwards').value);
    set('backwards', $('backwards').value);
    set('advection-h', $('advection-h').value);
    set('advection-steps', $('advection-steps').value);
    set('min-val', minVal.value);
    set('max-val', maxVal.value);
  });
  $('m').value = get('m') || 10;
  $('n').value = get('n') || 3;
  $('blend-ratio').value = get('blend-ratio') || 0.95;
  $('forwards').value = get('forwards') || 10;
  $('backwards').value = get('backwards') || 10;
  $('advection-h').value = get('advection-h') || 0.5;
  $('advection-steps').value = get('advection-steps') || 10;
  $('reset').addEventListener('click', resetStage);
  $('zoom-in').addEventListener('click', function(){
    fov = clamp(fov - 1, 1, 100);
  });
  $('zoom-out').addEventListener('click', function(){
    fov = clamp(fov + 1, 1, 100);
  });
  symmetric = $('symmetric');
  x1$ = minVal = $('min-value');
  x1$.value = parseFloat((ref2$ = get('min-val')) != null ? ref2$ : 0.3);
  x2$ = maxVal = $('max-value');
  x2$.value = parseFloat(get('max-val')) || 0.7;
  reclamp = function(){
    minVal.value = Math.min(0.5, parseFloat(minVal.value));
    maxVal.value = Math.max(0.5, parseFloat(maxVal.value));
  };
  if (symmetric.checked) {
    reclamp();
  }
  symmetric.addEventListener('change', function(){
    if (this.checked) {
      reclamp();
    }
  });
  minVal.addEventListener('input', function(){
    if (symmetric.checked) {
      maxVal.value = 1 - parseFloat(this.value);
    }
  });
  maxVal.addEventListener('input', function(){
    if (symmetric.checked) {
      minVal.value = 1 - parseFloat(this.value);
    }
  });
  addWheelListener(canvas, function(it){
    fov = clamp(fov + it.deltaY / Math.abs(it.deltaY), 1, 100);
  });
  ctx = document.createElement('canvas').getContext('2d');
  function genNoise(width, height){
    var x3$, x4$, i, to$;
    x3$ = ctx.createImageData(width, height);
    x4$ = x3$.data;
    for (i = 0, to$ = width * height * 4; i < to$; i += 4) {
      x4$[i] = x4$[i + 1] = x4$[i + 2] = Math.random() >= 0.5 ? 255 : 0;
      x4$[i + 3] = 255;
    }
    return x3$;
  }
  out$.buffers = buffers = {};
  latBands = 30;
  lonBands = 30;
  noiseTex = gl.createTexture();
  function imageProcessingSet(){
    return {
      framebuffer: gl.createFramebuffer(),
      texture: gl.createTexture(),
      renderbuffer: gl.createRenderbuffer()
    };
  }
  function setupFramebuffer(arg$){
    var framebuffer, renderbuffer, texture, tw, th, x3$;
    framebuffer = arg$.framebuffer, renderbuffer = arg$.renderbuffer, texture = arg$.texture;
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    tw = 2048;
    th = 1024;
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, tw, th, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    x3$ = renderbuffer;
    gl.bindRenderbuffer(gl.RENDERBUFFER, x3$);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, tw, th);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderbuffer);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  noiseTransport = imageProcessingSet();
  orthogonalLic = imageProcessingSet();
  advection = imageProcessingSet();
  blend = imageProcessingSet();
  setupBuffers = function(){
    var noise, modelCoords, texCoords, lat, to$, theta, sT, cT, lon, to1$, phi, sP, cP, idx, to2$, to3$, fst, snd, x3$;
    noise = genNoise(2048, 1024);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.bindTexture(gl.TEXTURE_2D, noiseTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, noise);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
    setupFramebuffer(noiseTransport);
    setupFramebuffer(orthogonalLic);
    setupFramebuffer(advection);
    setupFramebuffer(blend);
    modelCoords = [];
    texCoords = [];
    for (lat = 0, to$ = latBands; lat <= to$; ++lat) {
      theta = lat * Math.PI / latBands;
      sT = Math.sin(theta);
      cT = Math.cos(theta);
      for (lon = 0, to1$ = lonBands; lon <= to1$; ++lon) {
        phi = lon * 2 * Math.PI / lonBands;
        sP = Math.sin(phi);
        cP = Math.cos(phi);
        modelCoords.push(cP * sT, cT, sP * sT);
        texCoords.push(1 - lon / lonBands, 1 - lat / latBands);
      }
    }
    idx = [];
    for (lat = 0, to2$ = latBands; lat < to2$; ++lat) {
      for (lon = 0, to3$ = lonBands; lon < to3$; ++lon) {
        fst = lat * (lonBands + 1) + lon;
        snd = fst + lonBands + 1;
        idx.push(fst, fst + 1, snd, snd, fst + 1, snd + 1);
      }
    }
    buffers.modelCoord = createBuffer(gl, new Float32Array(modelCoords));
    buffers.texCoord = createBuffer(gl, new Float32Array(texCoords));
    buffers.idx = (x3$ = gl.createBuffer(), gl.bindBuffer(ELEMENT_ARRAY_BUFFER, x3$), gl.bufferData(ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), STATIC_DRAW), x3$);
    buffers.basicQuad = createBuffer(gl, new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]));
    buffers.basicQuadTex = createBuffer(gl, new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]));
    buffers.basicQuadIndices = createBuffer(gl, new Uint16Array([0, 1, 2, 0, 2, 3]), ELEMENT_ARRAY_BUFFER);
  };
  numTriangles = latBands * lonBands * 6;
  out$.p = p = {
    globe: load('globe', gl),
    noiseTransport: load('noiseTransport', gl),
    orthogonalLic: load('orthogonalLic', gl, parseInt($('backwards').value, 10) || 10, parseInt($('forwards').value, 10) || 10),
    advection: load('advection', gl, 10),
    blend: load('blend', gl)
  };
  $('backwards').addEventListener('change', function(){
    p.orthogonalLic = load('orthogonalLic', gl, parseInt(this.value, 10), parseInt($('forwards').value, 10));
  });
  $('forwards').addEventListener('change', function(){
    p.orthogonalLic = load('orthogonalLic', gl, parseInt($('backwards').value, 10), parseInt(this.value, 10));
  });
  $('advection-steps').addEventListener('change', function(){
    p.advection = load('advection', gl, parseInt(this.value, 10));
  });
  function loadTexture(program, texture, name, number){
    var x3$;
    gl.activeTexture(gl["TEXTURE" + number]);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    x3$ = gl.getUniformLocation(program, name);
    gl.uniform1i(x3$, number);
  }
  function loadPlainQuadProgram(program, framebuffer){
    var x3$;
    gl.useProgram(program);
    x3$ = gl;
    x3$.viewport(0, 0, 2048, 1024);
    x3$.disable(DEPTH_TEST);
    x3$.disable(CULL_FACE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.clear(COLOR_BUFFER_BIT | DEPTH_BUFFER_BIT);
  }
  mod = function(num, base){
    return (num % base + base) % base;
  };
  function loadOceanCurrentCommon(program){
    var slicesAvailable, time, cur, last, next, timeVal, x3$;
    slicesAvailable = oceanField.length;
    time = parseFloat($('time').value);
    cur = Math.floor(time / 2);
    last = mod(cur - 1, slicesAvailable);
    next = mod(cur + 1, slicesAvailable);
    loadTexture(program, oceanField[cur], 'curOcean', 0);
    loadTexture(program, oceanField[last], 'prevOcean', 1);
    loadTexture(program, oceanField[next], 'nextOcean', 2);
    timeVal = (time / 2 - cur) * 2;
    x3$ = gl.getUniformLocation(program, 'time');
    gl.uniform1f(x3$, timeVal);
  }
  function loadIsWater(program){
    loadTexture(program, landMask, 'landMask', 3);
  }
  function drawPlainQuad(program){
    bindBuffer(gl, program, 'vertexCoord', buffers.basicQuad, 2);
    bindBuffer(gl, program, 'texCoord', buffers.basicQuadTex, 2);
    gl.bindBuffer(ELEMENT_ARRAY_BUFFER, buffers.basicQuadIndices);
    gl.drawElements(TRIANGLES, 6, UNSIGNED_SHORT, 0);
  }
  initial = true;
  playing = true;
  x3$ = $('play');
  x3$.disabled = true;
  x3$.addEventListener('click', function(){
    playing = true;
    this.disabled = true;
    $('pause').disabled = false;
  });
  x4$ = $('pause');
  x4$.disabled = false;
  x4$.addEventListener('click', function(){
    playing = false;
    this.disabled = true;
    $('play').disabled = false;
  });
  out$.draw = draw = function(){
    var slicesAvailable, t, speed, newT, x5$, x6$, x7$, x8$, x9$, rot, modelView, useDay, monthNo, nextNo, x10$, x11$, x12$, x13$, x14$, x15$, x16$;
    slicesAvailable = oceanField.length * 2;
    t = parseFloat($('time').value);
    if (playing) {
      speed = parseFloat($('speed').value);
      newT = mod(t + speed, slicesAvailable);
      $('time').value = newT;
      t = newT;
      updateTimestamp();
    }
    loadPlainQuadProgram(p.noiseTransport, noiseTransport.framebuffer);
    loadIsWater(p.noiseTransport);
    uniform(gl, p.noiseTransport, 'randomOffset', '2f', Math.random(), Math.random());
    loadTexture(p.noiseTransport, noiseTex, 'noise', 4);
    drawPlainQuad(p.noiseTransport);
    loadPlainQuadProgram(p.orthogonalLic, orthogonalLic.framebuffer);
    loadOceanCurrentCommon(p.orthogonalLic);
    loadIsWater(p.orthogonalLic);
    loadTexture(p.orthogonalLic, noiseTransport.texture, 'transportedNoise', 4);
    x5$ = gl.getUniformLocation(p.orthogonalLic, 'useOrthogonal');
    gl.uniform1i(x5$, $('orthogonal').checked);
    x6$ = gl.getUniformLocation(p.orthogonalLic, 'h');
    gl.uniform1f(x6$, parseFloat($('lic-h').value));
    drawPlainQuad(p.orthogonalLic);
    loadPlainQuadProgram(p.advection, advection.framebuffer);
    loadOceanCurrentCommon(p.advection);
    loadIsWater(p.advection);
    loadTexture(p.advection, initial
      ? noiseTex
      : blend.texture, 'previousTexture', 4);
    x7$ = gl.getUniformLocation(p.advection, 'h');
    gl.uniform1f(x7$, parseFloat($('advection-h').value));
    uniform(gl, p.advection, 'randomOffset', '2f', Math.random(), Math.random());
    loadTexture(p.advection, noiseTex, 'noise', 5);
    drawPlainQuad(p.advection);
    loadPlainQuadProgram(p.blend, blend.framebuffer);
    loadTexture(p.blend, orthogonalLic.texture, 'orthogonalLIC', 4);
    loadTexture(p.blend, advection.texture, 'advected', 5);
    x8$ = gl.getUniformLocation(p.blend, 'ratio');
    gl.uniform1f(x8$, parseFloat($('blend-ratio').value));
    drawPlainQuad(p.blend);
    gl.useProgram(p.globe);
    x9$ = gl;
    x9$.viewport(0, 0, width, height);
    x9$.enable(DEPTH_TEST);
    x9$.enable(CULL_FACE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clear(COLOR_BUFFER_BIT | DEPTH_BUFFER_BIT);
    if (currentRot == null) {
      currentRot = mat4.identity();
    }
    rot = mat4.multiply(currentRot, rotation, mat4.create());
    uniform(gl, p.globe, 'NormalMatrix', 'Matrix3fv', mat4.toMat3(rot));
    uniform(gl, p.globe, 'ProjectionMatrix', 'Matrix4fv', mat4.perspective(fov, width / height, 0.1, 100.0));
    modelView = mat4.identity();
    mat4.translate(modelView, [0, 0, -(distance + 1)]);
    mat4.multiply(modelView, rot);
    uniform(gl, p.globe, 'ModelViewMatrix', 'Matrix4fv', modelView);
    loadOceanCurrentCommon(p.globe);
    loadIsWater(p.globe);
    loadTexture(p.globe, blend.texture, 'texture', 4);
    useDay = $('day').checked;
    monthNo = mod(Math.floor(t), 12);
    nextNo = mod(monthNo + 1, 12);
    loadTexture(p.globe, useDay ? landTextures[monthNo] : nightTexture, 'curEarthTexture', 5);
    if (useDay) {
      loadTexture(p.globe, landTextures[nextNo], 'nextEarthTexture', 6);
    } else {
      x10$ = gl.getUniformLocation(p.globe, 'nextEarthTexture');
      gl.uniform1i(x10$, 5);
    }
    x11$ = gl.getUniformLocation(p.globe, 'landBlend');
    gl.uniform1f(x11$, t - Math.floor(t));
    x12$ = gl.getUniformLocation(p.globe, 'mask');
    gl.uniform1i(x12$, $('enable-mask').checked);
    x13$ = gl.getUniformLocation(p.globe, 'm');
    gl.uniform1f(x13$, parseFloat($('m').value) || 10);
    x14$ = gl.getUniformLocation(p.globe, 'n');
    gl.uniform1f(x14$, parseFloat($('n').value) || 3);
    x15$ = gl.getUniformLocation(p.globe, 'minVal');
    gl.uniform1f(x15$, parseFloat($('min-value').value || 0));
    x16$ = gl.getUniformLocation(p.globe, 'maxVal');
    gl.uniform1f(x16$, parseFloat($('max-value').value || 1));
    bindBuffer(gl, p.globe, 'modelCoord', buffers.modelCoord, 3);
    bindBuffer(gl, p.globe, 'texCoord', buffers.texCoord, 2);
    gl.bindBuffer(ELEMENT_ARRAY_BUFFER, buffers.idx);
    gl.drawElements(TRIANGLES, numTriangles, UNSIGNED_SHORT, 0);
    initial = false;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(draw);
  };
  window.requestAnimationFrame = window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame;
  window.cancelAnimationFrame = window.mozCancelAnimationFrame || window.webkitCancelAnimationFrame;
  function setTexture(texture, data){
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
    gl.generateMipmap(gl.TEXTURE_2D);
    return texture;
  }
  function loadImage(src, cb){
    var x5$;
    x5$ = new Image;
    x5$.onload = cb;
    x5$.src = src;
  }
  oceanField = [];
  landTextures = [];
  texturesToLoad = totalTextures = 2 + 1 + 12 + 1;
  maybeDraw = function(){
    $('load-progress').value = 1 - texturesToLoad / totalTextures;
    if (texturesToLoad === 0) {
      $('loading').hidden = true;
      $('load-progress').value = 0;
      $('time').setAttribute('max', oceanField.length * 2 - 0.01);
      $('time').value = 0;
      draw();
    }
  };
  pad = function(it){
    if (it >= 10) {
      return it;
    } else {
      return "0" + it;
    }
  };
  function splitPacked(img, idx){
    var c, ref$, ctx, start, n, i$, ref1$, len$, y, j$, ref2$, len1$, x;
    c = (ref$ = document.createElement('canvas'), ref$.width = img.width, ref$.height = img.height, ref$);
    ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    start = idx * 8;
    n = 0;
    for (i$ = 0, len$ = (ref1$ = [0, 512, 1024, 1536]).length; i$ < len$; ++i$) {
      y = ref1$[i$];
      for (j$ = 0, len1$ = (ref2$ = [0, 1024]).length; j$ < len1$; ++j$) {
        x = ref2$[j$];
        oceanField[start + n] = setTexture(gl.createTexture(), ctx.getImageData(x, y, 1024, 512));
        ++n;
      }
    }
    --texturesToLoad;
    return maybeDraw();
  }
  for (i = 0; i < 2; ++i) {
    (fn$.call(this, i));
  }
  $('load-more').addEventListener('click', function(){
    var i;
    totalTextures = 13;
    texturesToLoad = 13;
    $('loading').hidden = false;
    $('load-progress').value = 0;
    for (i = 2; i < 15; ++i) {
      (fn$.call(this, i));
    }
    function fn$(i){
      loadImage("packed-" + pad(i) + ".png", function(){
        splitPacked(this, i);
      });
    }
  });
  $('time').addEventListener('input', updateTimestamp);
  function updateTimestamp(){
    var months, years, yMonths, x5$, date;
    months = parseFloat($('time').value);
    years = Math.floor(months / 12);
    yMonths = Math.floor(months - years * 12);
    x5$ = date = new Date;
    x5$.setFullYear(1991 + years, yMonths, 1);
    return $('timestamp').textContent = date.getFullYear() + "-" + pad(date.getMonth() + 1);
  }
  landMask = gl.createTexture();
  loadImage('land-mask.png', function(){
    setTexture(landMask, this);
    --texturesToLoad;
    maybeDraw();
  });
  for (i = 1; i <= 12; ++i) {
    (fn1$.call(this, i));
  }
  nightTexture = gl.createTexture();
  loadImage('black-marble.jpg', function(){
    setTexture(nightTexture, this);
    --texturesToLoad;
    maybeDraw();
  });
  setupBuffers();
  pointUnder = function(x, y){
    var ref$, left, top, det;
    ref$ = canvas.getBoundingClientRect(), left = ref$.left, top = ref$.top;
    x = (x - left) * 2 / (width - 1) - 1;
    y = -((y - top) * 2 / (height - 1) - 1);
    det = 1 - x * x - y * y;
    if (det >= 0) {
      return [x, y, Math.sqrt(det)];
    } else {
      return [x / Math.sqrt(x * x + y * y), y / Math.sqrt(x * x + y * y), 0];
    }
  };
  x5$ = canvas;
  x5$.addEventListener('mousedown', function(arg$){
    var i0, j0, p, rotate, stop;
    i0 = arg$.clientX, j0 = arg$.clientY;
    x5$.style.cursor = 'move';
    p = pointUnder(i0, j0);
    rotate = function(arg$){
      var i, j, q, cp, cq, angle, axis;
      i = arg$.clientX, j = arg$.clientY;
      q = pointUnder(i, j);
      cp = vec3.direction([0, 0, 0], p);
      cq = vec3.direction([0, 0, 0], q);
      angle = Math.acos(vec3.dot(cp, cq) / (vec3.length(cp) * vec3.length(cq)));
      axis = vec3.cross(cp, cq);
      currentRot = mat4.rotate(mat4.identity(), angle, axis);
    };
    x5$.addEventListener('mousemove', rotate);
    stop = (function(ran){
      return function(){
        if (!ran) {
          ran = true;
          mat4.multiply(currentRot, rotation, rotation);
          currentRot = mat4.identity();
        }
        x5$.style.cursor = 'pointer';
        x5$.removeEventListener('mousemove', rotate);
        x5$.removeEventListener('mouseup', stop);
        x5$.removeEventListener('mouseleave', stop);
      };
    }.call(this, false));
    x5$.addEventListener('mouseup', stop);
    x5$.addEventListener('mouseleave', stop);
  });
  function fn$(i){
    loadImage("packed-" + pad(i) + ".png", function(){
      splitPacked(this, i);
    });
  }
  function fn1$(i){
    loadImage("blue-marble-" + pad(i) + ".jpg", function(){
      landTextures[i - 1] = setTexture(gl.createTexture(), this);
      --texturesToLoad;
      maybeDraw();
    });
  }
}).call(this);
