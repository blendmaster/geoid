/* This file (utils.js) is compiled from utils.co. Please view the
original commented source there. */
(function(){
  "use strict";
  var log, degrees, radians, $, readPpm, shaderProgram, defer, reading, uniform, bindBuffer, out$ = typeof exports != 'undefined' && exports || this, slice$ = [].slice;
  mat4.translation = function(translation){
    return mat4.translate(mat4.identity(), translation);
  };
  out$.log = log = function(it){
    console.log(it);
    return it;
  };
  out$.degrees = degrees = function(it){
    return it * 180 / Math.PI;
  };
  out$.radians = radians = function(it){
    return it * Math.PI / 180;
  };
  out$.$ = $ = function(it){
    return document.getElementById(it);
  };
  out$.readPpm = readPpm = function(gl, it){
    var ref$, width, height, pixels, e, data, i, to$, tex;
    try {
      ref$ = it.match(/P6\n(\d+) (\d+)\n255\n([\s\S]+)/), width = ref$[1], height = ref$[2], pixels = ref$[3];
    } catch (e$) {
      e = e$;
      throw Error("not a valid binary ppm!");
    }
    width = parseInt(width, 10);
    height = parseInt(height, 10);
    data = new Uint8Array(width * height * 3);
    for (i = 0, to$ = pixels.length; i < to$; ++i) {
      data[i] = pixels.charCodeAt(i);
    }
    tex = gl.createTexture();
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, width, height, 0, gl.RGB, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    return tex;
  };
  out$.shaderProgram = shaderProgram = function(arg$){
    var vertex, fragment, uniforms, ref$;
    vertex = arg$.vertex, fragment = arg$.fragment, uniforms = (ref$ = arg$.uniforms) != null
      ? ref$
      : {};
    return function(gl){
      var x0$, vertexShader, x1$, fragmentShader, x2$, program, name, ref$, ref1$, type, value, results$ = [];
      x0$ = vertexShader = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(x0$, vertex);
      gl.compileShader(x0$);
      if (!gl.getShaderParameter(x0$, COMPILE_STATUS)) {
        throw new Error("couldn't compile vertex shader!\n" + gl.getShaderInfoLog(x0$));
      }
      x1$ = fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(x1$, fragment);
      gl.compileShader(x1$);
      if (!gl.getShaderParameter(x1$, COMPILE_STATUS)) {
        throw new Error("couldn't compile fragment shader!\n" + gl.getShaderInfoLog(x1$));
      }
      x2$ = program = gl.createProgram();
      gl.attachShader(x2$, vertexShader);
      gl.attachShader(x2$, fragmentShader);
      gl.linkProgram(x2$);
      if (!gl.getProgramParameter(x2$, LINK_STATUS)) {
        throw new Error("couldn't intialize shader program!");
      }
      gl.program = program;
      gl.useProgram(program);
      for (name in ref$ = uniforms) {
        ref1$ = ref$[name], type = ref1$[0], value = slice$.call(ref1$, 1);
        results$.push(gl["uniform" + type].apply(gl, [gl.getUniformLocation(program, name)].concat(value)));
      }
      return results$;
    };
  };
  out$.defer = defer = function(t, fn){
    return setTimeout(fn, t);
  };
  out$.reading = reading = function(id, readerFn, fn){
    var onchange, x0$;
    onchange = function(){
      var that, x0$;
      if (that = this.files[0]) {
        x0$ = new FileReader;
        x0$.onload = function(){
          fn(this.result);
        };
        x0$["read" + readerFn](that);
      }
    };
    x0$ = $(id);
    x0$.addEventListener('change', onchange);
    onchange.call(x0$);
    return x0$;
  };
  out$.uniform = uniform = function(gl, name, type, value){
    return gl["uniform" + type](gl.getUniformLocation(gl.program, name), false, value);
  };
  out$.bindBuffer = bindBuffer = function(gl, name, value, elementLength, type){
    var x0$, buf, x1$;
    type == null && (type = ARRAY_BUFFER);
    x0$ = buf = gl.createBuffer();
    gl.bindBuffer(type, x0$);
    gl.bufferData(type, value, STATIC_DRAW);
    x1$ = gl.getAttribLocation(gl.program, name);
    gl.enableVertexAttribArray(x1$);
    gl.vertexAttribPointer(x1$, elementLength, gl.FLOAT, false, 0, 0);
    return buf;
  };
}).call(this);
