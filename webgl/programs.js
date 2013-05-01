/* This file (programs.js) is compiled from programs.co. Please view the
original commented source there. */
(function(){
  "use strict";
  var programs, load, plainQuadVertex, out$ = typeof exports != 'undefined' && exports || this;
  programs = {};
  out$.load = load = function(it, gl){
    return programs[it](gl);
  };
  plainQuadVertex = "precision mediump float;\n\nattribute vec2 vertexCoord;\nattribute vec2 texCoord;\n\nvarying vec2 tex;\n\nvoid main() {\n  tex = texCoord;\n  gl_Position = vec4(vertexCoord.xy, 1., 1);\n}";
  programs.globe = shaderProgram({
    vertex: "precision mediump float;\n\nattribute vec3 modelCoord;\nattribute vec2 texCoord;\n\nvarying vec2 tex;\n\nuniform mat4 ModelViewMatrix;\nuniform mat4 ProjectionMatrix;\n\nvoid main() {\n  tex = texCoord;\n\n  vec4 WorldCoord = ModelViewMatrix * vec4(modelCoord,1.0);\n\n  gl_Position = ProjectionMatrix * WorldCoord;\n}",
    fragment: "precision mediump float;\n\nuniform sampler2D texture;\n\nvarying vec2 tex; // coords\n\nvoid main() {\n  gl_FragColor = texture2D(texture, tex);\n}"
  });
  programs.noiseTransport = shaderProgram({
    vertex: plainQuadVertex,
    fragment: "precision mediump float;\n\nuniform sampler2D field;\nuniform sampler2D noise;\n\nvarying vec2 tex;\n\n// transform packed texture field\nvec2 currentAt(vec2 coords) {\n  vec3 val = texture2D(field, coords).xyz;\n  return vec2(val.x - 0.5, val.y - 0.5);\n}\n\nbool isWater(vec2 coords) {\n  vec3 val = texture2D(field, coords).xyz;\n  return val.z != 0.0;\n}\n\nvoid main() {\n  if (isWater(tex)) {\n    //gl_FragColor = vec4(0, m, 0, 1.0);\n    gl_FragColor = vec4(texture2D(noise, tex));\n  } else {\n    gl_FragColor = vec4(0, 0., 0., 1.0);\n  }\n}"
  });
}).call(this);
