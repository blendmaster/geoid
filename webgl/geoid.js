/* This file (geoid.js) is compiled from geoid.co. Please view the
original commented source there. */
(function(){
  "use strict";
  var canvas, ref$, width, height, k, ref1$, v, x0$, arr, rotation, e, currentRot, fov, distance, symmetric, x1$, minVal, x2$, maxVal, reclamp, ctx, buffers, latBands, lonBands, noiseTex, noiseTransport, orthogonalLic, advection, blend, setupBuffers, numTriangles, p, frame, draw, texture, x3$, earthTexture, x4$, pointUnder, x5$, out$ = typeof exports != 'undefined' && exports || this;
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
  x1$.value = parseFloat(get('min-val'));
  x2$ = maxVal = $('max-value');
  x2$.value = parseFloat(get('max-val'));
  reclamp = function(){
    console.log(minVal.value);
    console.log(maxVal.value);
    minVal.value = Math.min(0.5, parseFloat(minVal.value));
    maxVal.value = Math.max(0.5, parseFloat(maxVal.value));
    console.log(minVal.value);
    console.log(maxVal.value);
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
  addWheelListener(document.body, function(it){
    fov = clamp(fov + it.deltaY / Math.abs(it.deltaY), 1, 100);
  });
  ctx = document.createElement('canvas').getContext('2d');
  function genNoise(width, height){
    var x3$, x4$, i, to$;
    x3$ = ctx.createImageData(width, height);
    x4$ = x3$.data;
    for (i = 0, to$ = width * height * 4; i < to$; i += 4) {
      x4$[i] = x4$[i + 1] = Math.random() >= 0.5 ? 255 : 0;
      x4$[i + 2] = x4$[i + 3] = 255;
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
  p = {
    globe: load('globe', gl),
    noiseTransport: load('noiseTransport', gl),
    orthogonalLic: load('orthogonalLic', gl, 20, 20),
    advection: load('advection', gl, 10),
    blend: load('blend', gl)
  };
  $('backwards').addEventListener('change', function(){
    p.orthogonalLic = load('orthogonalLic', gl, parseInt(this.value, 10), parseInt($('forwards').value, 10));
  });
  $('backwards').addEventListener('change', function(){
    p.orthogonalLic = load('orthogonalLic', gl, parseInt($('backwards').value, 10), parseInt(this.value, 10));
  });
  $('advection-steps').addEventListener('change', function(){
    p.advection = load('advection', gl, parseInt(this.value, 10));
  });
  out$.draw = draw = function(){
    var x3$, x4$, x5$, x6$, x7$, x8$, x9$, x10$, x11$, x12$, x13$, x14$, x15$, x16$, x17$, x18$, x19$, x20$, rot, modelView, x21$, x22$, x23$, x24$, x25$, x26$, x27$, x28$;
    gl.useProgram(p.noiseTransport);
    x3$ = gl;
    x3$.viewport(0, 0, 2048, 1024);
    x3$.disable(DEPTH_TEST);
    x3$.disable(CULL_FACE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, noiseTransport.framebuffer);
    gl.clear(COLOR_BUFFER_BIT | DEPTH_BUFFER_BIT);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    x4$ = gl.getUniformLocation(p.noiseTransport, 'texture');
    gl.uniform1i(x4$, 0);
    uniform(gl, p.noiseTransport, 'randomOffset', '2f', Math.random(), Math.random());
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, noiseTex);
    x5$ = gl.getUniformLocation(p.noiseTransport, 'noise');
    gl.uniform1i(x5$, 1);
    bindBuffer(gl, p.noiseTransport, 'vertexCoord', buffers.basicQuad, 2);
    bindBuffer(gl, p.noiseTransport, 'texCoord', buffers.basicQuadTex, 2);
    gl.bindBuffer(ELEMENT_ARRAY_BUFFER, buffers.basicQuadIndices);
    gl.drawElements(TRIANGLES, 6, UNSIGNED_SHORT, 0);
    gl.useProgram(p.orthogonalLic);
    x6$ = gl;
    x6$.viewport(0, 0, 2048, 1024);
    x6$.disable(DEPTH_TEST);
    x6$.disable(CULL_FACE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, orthogonalLic.framebuffer);
    gl.clear(COLOR_BUFFER_BIT | DEPTH_BUFFER_BIT);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    x7$ = gl.getUniformLocation(p.orthogonalLic, 'oceanCurrent');
    gl.uniform1i(x7$, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, noiseTransport.texture);
    x8$ = gl.getUniformLocation(p.orthogonalLic, 'transportedNoise');
    gl.uniform1i(x8$, 1);
    x9$ = gl.getUniformLocation(p.orthogonalLic, 'useOrthogonal');
    gl.uniform1i(x9$, $('orthogonal').checked);
    x10$ = gl.getUniformLocation(p.orthogonalLic, 'h');
    gl.uniform1f(x10$, parseFloat($('lic-h').value));
    bindBuffer(gl, p.orthogonalLic, 'vertexCoord', buffers.basicQuad, 2);
    bindBuffer(gl, p.orthogonalLic, 'texCoord', buffers.basicQuadTex, 2);
    gl.bindBuffer(ELEMENT_ARRAY_BUFFER, buffers.basicQuadIndices);
    gl.drawElements(TRIANGLES, 6, UNSIGNED_SHORT, 0);
    gl.useProgram(p.advection);
    x11$ = gl;
    x11$.viewport(0, 0, 2048, 1024);
    x11$.disable(DEPTH_TEST);
    x11$.disable(CULL_FACE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, advection.framebuffer);
    gl.clear(COLOR_BUFFER_BIT | DEPTH_BUFFER_BIT);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    x12$ = gl.getUniformLocation(p.advection, 'oceanCurrent');
    gl.uniform1i(x12$, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, blend.texture);
    x13$ = gl.getUniformLocation(p.advection, 'previousTexture');
    gl.uniform1i(x13$, 1);
    x14$ = gl.getUniformLocation(p.advection, 'h');
    gl.uniform1f(x14$, parseFloat($('advection-h').value));
    bindBuffer(gl, p.advection, 'vertexCoord', buffers.basicQuad, 2);
    bindBuffer(gl, p.advection, 'texCoord', buffers.basicQuadTex, 2);
    gl.bindBuffer(ELEMENT_ARRAY_BUFFER, buffers.basicQuadIndices);
    gl.drawElements(TRIANGLES, 6, UNSIGNED_SHORT, 0);
    gl.useProgram(p.blend);
    x15$ = gl;
    x15$.viewport(0, 0, 2048, 1024);
    x15$.disable(DEPTH_TEST);
    x15$.disable(CULL_FACE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, blend.framebuffer);
    gl.clear(COLOR_BUFFER_BIT | DEPTH_BUFFER_BIT);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, orthogonalLic.texture);
    x16$ = gl.getUniformLocation(p.blend, 'orthogonalLIC');
    gl.uniform1i(x16$, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, advection.texture);
    x17$ = gl.getUniformLocation(p.blend, 'advected');
    gl.uniform1i(x17$, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    x18$ = gl.getUniformLocation(p.blend, 'oceanCurrent');
    gl.uniform1i(x18$, 2);
    x19$ = gl.getUniformLocation(p.blend, 'ratio');
    gl.uniform1f(x19$, parseFloat($('blend-ratio').value));
    bindBuffer(gl, p.orthogonalLic, 'vertexCoord', buffers.basicQuad, 2);
    bindBuffer(gl, p.orthogonalLic, 'texCoord', buffers.basicQuadTex, 2);
    gl.bindBuffer(ELEMENT_ARRAY_BUFFER, buffers.basicQuadIndices);
    gl.drawElements(TRIANGLES, 6, UNSIGNED_SHORT, 0);
    gl.useProgram(p.globe);
    x20$ = gl;
    x20$.viewport(0, 0, width, height);
    x20$.enable(DEPTH_TEST);
    x20$.enable(CULL_FACE);
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
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, blend.texture);
    x21$ = gl.getUniformLocation(p.globe, 'texture');
    gl.uniform1i(x21$, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    x22$ = gl.getUniformLocation(p.globe, 'oceanCurrent');
    gl.uniform1i(x22$, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, earthTexture);
    x23$ = gl.getUniformLocation(p.globe, 'earthTexture');
    gl.uniform1i(x23$, 2);
    x24$ = gl.getUniformLocation(p.globe, 'mask');
    gl.uniform1i(x24$, $('enable-mask').checked);
    x25$ = gl.getUniformLocation(p.globe, 'm');
    gl.uniform1f(x25$, parseFloat($('m').value) || 10);
    x26$ = gl.getUniformLocation(p.globe, 'n');
    gl.uniform1f(x26$, parseFloat($('n').value) || 3);
    x27$ = gl.getUniformLocation(p.globe, 'minVal');
    gl.uniform1f(x27$, parseFloat($('min-value').value || 0));
    x28$ = gl.getUniformLocation(p.globe, 'maxVal');
    gl.uniform1f(x28$, parseFloat($('max-value').value || 1));
    bindBuffer(gl, p.globe, 'modelCoord', buffers.modelCoord, 3);
    bindBuffer(gl, p.globe, 'texCoord', buffers.texCoord, 2);
    gl.bindBuffer(ELEMENT_ARRAY_BUFFER, buffers.idx);
    gl.drawElements(TRIANGLES, numTriangles, UNSIGNED_SHORT, 0);
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(draw);
  };
  window.requestAnimationFrame = window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame;
  window.cancelAnimationFrame = window.mozCancelAnimationFrame || window.webkitCancelAnimationFrame;
  texture = gl.createTexture();
  x3$ = new Image;
  x3$.onload = function(){
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
    gl.generateMipmap(gl.TEXTURE_2D);
    draw();
  };
  x3$.src = 'ocean-current.png';
  earthTexture = gl.createTexture();
  x4$ = new Image;
  x4$.onload = function(){
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.bindTexture(gl.TEXTURE_2D, earthTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
    gl.generateMipmap(gl.TEXTURE_2D);
    draw();
  };
  x4$.src = 'blue-marble.jpg';
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
}).call(this);
