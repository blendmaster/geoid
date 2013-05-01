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
    fragment: "precision mediump float;\n\nuniform sampler2D field;\nuniform sampler2D noise;\n\nvarying vec2 tex;\n\nuniform vec2 randomOffset;\n\n// transform packed texture field\nvec2 fieldAt(vec2 coords) {\n  vec3 val = texture2D(field, coords).xyz;\n  return vec2(val.x - 0.5, val.y - 0.5);\n}\n\nbool isWater(vec2 coords) {\n  vec3 val = texture2D(field, coords).xyz;\n  return val.z != 0.0;\n}\n\nvec2 size = vec2(1024., 512.);\n\nvoid main() {\n  if (isWater(tex)) {\n    vec2 currentPosition = tex + randomOffset;\n    vec2 field = fieldAt(tex);\n\n    float h = 10.0;\n    vec2 advectedPosition = currentPosition + field * h / size;\n\n    gl_FragColor = vec4(texture2D(noise, advectedPosition));\n  } else {\n    gl_FragColor = vec4(0, 0., 0., 1.0);\n  }\n}"
  });
  programs.orthogonalLic = shaderProgram({
    vertex: plainQuadVertex,
    fragment: "precision mediump float;\n\nuniform sampler2D oceanCurrent;\nuniform sampler2D transportedNoise;\n\nvarying vec2 tex;\n\n// transform packed texture field\nvec2 orthogonalFieldAt(vec2 coords) {\n  vec3 val = texture2D(oceanCurrent, coords).xyz;\n  return vec2(-(val.y - 0.5), val.x - 0.5);\n}\n\nbool isWater(vec2 coords) {\n  vec3 val = texture2D(oceanCurrent, coords).xyz;\n  return val.z != 0.0;\n}\n\nvec2 size = vec2(1024., 512.);\n\nvoid main() {\n  if (isWater(tex)) {\n    float h = 1.0;\n\n    // LIC backwards and forwards\n    vec3 pixel = vec3(0.0, 0.0, 0.0);\n    vec2 pos = tex;\n\n    vec2 field = orthogonalFieldAt(pos);\n    for(int i = 0; i < 15; ++i) {\n      pixel = pixel + texture2D(transportedNoise, pos).rgb;\n      pos = pos - field * h / size;\n      field = orthogonalFieldAt(pos);\n    }\n    pos = tex;\n    field = orthogonalFieldAt(pos);\n    for(int i = 0; i < 15; ++i) {\n      pixel = pixel + texture2D(transportedNoise, pos).rgb;\n      pos = pos + field * h / size;\n      field = orthogonalFieldAt(pos);\n    }\n\n    // average\n    pixel = pixel / 30.0;\n\n    gl_FragColor = vec4(pixel, 1.0);\n  } else {\n    gl_FragColor = vec4(0, 0., 0., 1.0);\n  }\n}"
  });
  programs.advection = shaderProgram({
    vertex: plainQuadVertex,
    fragment: "precision mediump float;\n\nuniform sampler2D oceanCurrent;\nuniform sampler2D previousTexture;\n\nvarying vec2 tex;\n\n// transform packed texture field\nvec2 fieldAt(vec2 coords) {\n  vec3 val = texture2D(oceanCurrent, coords).xyz;\n  return vec2(val.x - 0.5, val.y - 0.5);\n}\n\nbool isWater(vec2 coords) {\n  vec3 val = texture2D(oceanCurrent, coords).xyz;\n  return val.z != 0.0;\n}\n\nvec2 size = vec2(1024., 512.);\n\nvoid main() {\n  if (isWater(tex)) {\n    vec2 currentPosition = tex;\n    vec2 field = fieldAt(tex);\n\n    float h = 1.0;\n    vec2 advectedPosition = currentPosition + field * h / size;\n\n    gl_FragColor = vec4(texture2D(previousTexture, advectedPosition));\n  } else {\n    gl_FragColor = vec4(0, 0., 0., 1.0);\n  }\n}"
  });
  programs.blend = shaderProgram({
    vertex: plainQuadVertex,
    fragment: "precision mediump float;\n\nuniform sampler2D orthogonalLIC;\nuniform sampler2D advected;\n\nuniform sampler2D oceanCurrent;\n\nbool isWater(vec2 coords) {\n  vec3 val = texture2D(oceanCurrent, coords).xyz;\n  return val.z != 0.0;\n}\n\nvarying vec2 tex;\n\nvoid main() {\n  if (isWater(tex)) {\n    gl_FragColor = texture2D(orthogonalLIC, tex) * 0.05\n                 + texture2D(advected     , tex) * 0.95;\n\n  } else {\n    gl_FragColor = vec4(0, 0.5, 0., 1.0);\n  }\n}"
  });
}).call(this);
