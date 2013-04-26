/* This file (geoid.js) is compiled from geoid.co. Please view the
original commented source there. */
(function(){
  "use strict";
  var canvas, width, height, k, ref$, v, x0$, rotation, currentRot, fov, distance, buffers, latBands, lonBands, setupBuffers, numTriangles, draw, texture, x1$, pointUnder, x2$, out$ = typeof exports != 'undefined' && exports || this;
  canvas = document.getElementById('canvas');
  width = canvas.width, height = canvas.height;
  try {
    window.gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  } catch (e$) {}
  if (typeof gl == 'undefined' || gl === null) {
    alert("Sorry, it looks like your browser doesn't support WebGL, or webGL is disabled!");
    throw new Error("no webgl ;_;");
  }
  window.gl = WebGLDebugUtils.makeDebugContext(gl);
  for (k in ref$ = gl) {
    v = ref$[k];
    if (/^[A-Z_]+$/.test(k)) {
      window[k] = v;
    }
  }
  x0$ = gl;
  x0$.viewport(0, 0, width, height);
  x0$.enable(DEPTH_TEST);
  x0$.enable(CULL_FACE);
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
  out$.buffers = buffers = {};
  load('globe', gl);
  latBands = 30;
  lonBands = 30;
  setupBuffers = function(){
    var modelCoords, texCoords, lat, to$, theta, sT, cT, lon, to1$, phi, sP, cP, idx, to2$, to3$, fst, snd, x1$;
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
    console.log('idx size', idx.length, 'model size', modelCoords.length, 'tex size', texCoords.length);
    out$.modelCoords = modelCoords;
    out$.texCoords = texCoords;
    out$.idx = idx;
    buffers.modelCoord = bindBuffer(gl, 'modelCoord', new Float32Array(modelCoords), 3);
    buffers.texCoord = bindBuffer(gl, 'texCoord', new Float32Array(texCoords), 2);
    buffers.idx = (x1$ = gl.createBuffer(), gl.bindBuffer(ELEMENT_ARRAY_BUFFER, x1$), gl.bufferData(ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), STATIC_DRAW), x1$);
  };
  numTriangles = latBands * lonBands * 6;
  out$.draw = draw = function(){
    var rot, modelView, x1$;
    gl.clear(COLOR_BUFFER_BIT | DEPTH_BUFFER_BIT);
    if (currentRot == null) {
      currentRot = mat4.identity();
    }
    rot = mat4.multiply(currentRot, rotation, mat4.create());
    uniform(gl, 'NormalMatrix', 'Matrix3fv', mat4.toMat3(rot));
    uniform(gl, 'ProjectionMatrix', 'Matrix4fv', mat4.perspective(fov, width / height, 0.1, 100.0));
    console.log(mat4.perspective(fov, width / height, 0.1, 100.0));
    modelView = mat4.identity();
    mat4.translate(modelView, [0, 0, -(distance + 1)]);
    mat4.multiply(modelView, rot);
    uniform(gl, 'ModelViewMatrix', 'Matrix4fv', modelView);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    x1$ = gl.getUniformLocation(gl.program, 'texture');
    gl.uniform1i(x1$, 0);
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
