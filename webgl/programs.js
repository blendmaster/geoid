/* This file (programs.js) is compiled from programs.co. Please view the
original commented source there. */
(function(){
  "use strict";
  var programs, load, out$ = typeof exports != 'undefined' && exports || this;
  programs = {};
  out$.load = load = function(it, gl){
    return programs[it](gl);
  };
  programs.globe = shaderProgram({
    vertex: "precision mediump float;\n\nattribute vec3 modelCoord;\nattribute vec2 texCoord;\n\nvarying vec2 tex;\n\nuniform mat4 ModelViewMatrix;\nuniform mat4 ProjectionMatrix;\n\nvoid main() {\n  tex = texCoord;\n\n  vec4 WorldCoord = ModelViewMatrix * vec4(modelCoord,1.0);\n\n  gl_Position = ProjectionMatrix * WorldCoord;\n}",
    fragment: "precision mediump float;\n\nuniform sampler2D texture;\n\nvarying vec2 tex; // coords\n\nvoid main() {\n  vec3 val = texture2D(texture, tex).xyz;\n  vec2 current = vec2(val.x - 0.5, val.y - 0.5);\n  float m = length(current);\n\n  bool water = val.z != 0.0;\n  if (water) {\n    gl_FragColor = vec4(0, m, 0, 1.0);\n  } else{\n    gl_FragColor = vec4(0, 0, 0, 1.0);\n  }\n}"
  });
}).call(this);
