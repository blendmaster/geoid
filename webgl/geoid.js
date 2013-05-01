/* This file (geoid.js) is compiled from geoid.co. Please view the
original commented source there. */
(function(){
  "use strict";
  var canvas, ref$, width, height, k, ref1$, v, x0$, rotation, currentRot, fov, distance, ctx, buffers, latBands, lonBands, noiseTex, noiseTransportFramebuffer, noiseTransportTexture, noiseTransportRenderbuffer, setupBuffers, numTriangles, p, draw, texture, x1$, pointUnder, x2$, out$ = typeof exports != 'undefined' && exports || this;
  canvas = document.getElementById('canvas');
  ref$ = document.documentElement, canvas.width = ref$.clientWidth, canvas.height = ref$.clientHeight;
  width = canvas.width, height = canvas.height;
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
  function resetStage(){
    rotation = mat4.identity();
    currentRot = mat4.identity();
    fov = 15;
    distance = 1 / Math.tan(radians(fov) / 2);
  }
  resetStage();
  $('zoom-in').addEventListener('click', function(){
    --fov;
    draw();
  });
  $('zoom-out').addEventListener('click', function(){
    ++fov;
    draw();
  });
  ctx = document.createElement('canvas').getContext('2d');
  function genNoise(width, height){
    var x1$, x2$, i, to$;
    x1$ = ctx.createImageData(width, height);
    x2$ = x1$.data;
    for (i = 0, to$ = width * height * 4; i < to$; i += 4) {
      x2$[i] = x2$[i + 1] = x2$[i + 2] = Math.random() >= 0.5 ? 255 : 0;
      x2$[i + 3] = 255;
    }
    return x1$;
  }
  out$.buffers = buffers = {};
  latBands = 30;
  lonBands = 30;
  noiseTex = gl.createTexture();
  noiseTransportFramebuffer = gl.createFramebuffer();
  noiseTransportTexture = gl.createTexture();
  noiseTransportRenderbuffer = gl.createRenderbuffer();
  setupBuffers = function(){
    var noise, tw, th, x1$, modelCoords, texCoords, lat, to$, theta, sT, cT, lon, to1$, phi, sP, cP, idx, to2$, to3$, fst, snd, x2$;
    noise = genNoise(1024, 512);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.bindTexture(gl.TEXTURE_2D, noiseTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, noise);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.bindTexture(gl.TEXTURE_2D, noiseTransportTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    tw = 1024;
    th = 512;
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, tw, th, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, noiseTransportFramebuffer);
    x1$ = noiseTransportRenderbuffer;
    gl.bindRenderbuffer(gl.RENDERBUFFER, x1$);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, tw, th);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, noiseTransportTexture, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, noiseTransportRenderbuffer);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
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
    buffers.idx = (x2$ = gl.createBuffer(), gl.bindBuffer(ELEMENT_ARRAY_BUFFER, x2$), gl.bufferData(ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), STATIC_DRAW), x2$);
    buffers.basicQuad = createBuffer(gl, new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]));
    buffers.basicQuadTex = createBuffer(gl, new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]));
    buffers.basicQuadIndices = createBuffer(gl, new Uint16Array([0, 1, 2, 0, 2, 3]), ELEMENT_ARRAY_BUFFER);
  };
  numTriangles = latBands * lonBands * 6;
  p = {
    globe: load('globe', gl),
    noiseTransport: load('noiseTransport', gl)
  };
  out$.draw = draw = function(){
    var x1$, x2$, x3$, x4$, rot, modelView, x5$;
    gl.useProgram(p.noiseTransport);
    x1$ = gl;
    x1$.viewport(0, 0, 1024, 512);
    x1$.disable(DEPTH_TEST);
    x1$.disable(CULL_FACE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, noiseTransportFramebuffer);
    gl.clear(COLOR_BUFFER_BIT | DEPTH_BUFFER_BIT);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    x2$ = gl.getUniformLocation(p.noiseTransport, 'texture');
    gl.uniform1i(x2$, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, noiseTex);
    x3$ = gl.getUniformLocation(p.noiseTransport, 'noise');
    gl.uniform1i(x3$, 1);
    bindBuffer(gl, p.noiseTransport, 'vertexCoord', buffers.basicQuad, 2);
    bindBuffer(gl, p.noiseTransport, 'texCoord', buffers.basicQuadTex, 2);
    gl.bindBuffer(ELEMENT_ARRAY_BUFFER, buffers.basicQuadIndices);
    gl.drawElements(TRIANGLES, 6, UNSIGNED_SHORT, 0);
    gl.useProgram(p.globe);
    x4$ = gl;
    x4$.viewport(0, 0, width, height);
    x4$.enable(DEPTH_TEST);
    x4$.enable(CULL_FACE);
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
    gl.bindTexture(gl.TEXTURE_2D, noiseTransportTexture);
    x5$ = gl.getUniformLocation(p.globe, 'texture');
    gl.uniform1i(x5$, 0);
    bindBuffer(gl, p.globe, 'modelCoord', buffers.modelCoord, 3);
    bindBuffer(gl, p.globe, 'texCoord', buffers.texCoord, 2);
    gl.bindBuffer(ELEMENT_ARRAY_BUFFER, buffers.idx);
    gl.drawElements(TRIANGLES, numTriangles, UNSIGNED_SHORT, 0);
  };
  texture = gl.createTexture();
  x1$ = new Image;
  x1$.onload = function(){
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
    gl.generateMipmap(gl.TEXTURE_2D);
    draw();
  };
  x1$.src = 'ocean-current.png';
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
  x2$ = canvas;
  x2$.addEventListener('mousedown', function(arg$){
    var i0, j0, p, rotate, stop;
    i0 = arg$.clientX, j0 = arg$.clientY;
    x2$.style.cursor = 'move';
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
      draw();
    };
    x2$.addEventListener('mousemove', rotate);
    stop = (function(ran){
      return function(){
        if (!ran) {
          ran = true;
          mat4.multiply(currentRot, rotation, rotation);
          currentRot = mat4.identity();
        }
        x2$.style.cursor = 'pointer';
        x2$.removeEventListener('mousemove', rotate);
        x2$.removeEventListener('mouseup', stop);
        x2$.removeEventListener('mouseleave', stop);
      };
    }.call(this, false));
    x2$.addEventListener('mouseup', stop);
    x2$.addEventListener('mouseleave', stop);
  });
}).call(this);
