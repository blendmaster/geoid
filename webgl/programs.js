/* This file (programs.js) is compiled from programs.co. Please view the
original commented source there. */
(function(){
  "use strict";
  var programs, load, plainQuadVertex, out$ = typeof exports != 'undefined' && exports || this, slice$ = [].slice;
  programs = {};
  out$.load = load = function(it){
    var args;
    args = slice$.call(arguments, 1);
    return programs[it].apply(null, args);
  };
  plainQuadVertex = "precision mediump float;\n\nattribute vec2 vertexCoord;\nattribute vec2 texCoord;\n\nvarying vec2 tex;\n\nvoid main() {\n  tex = texCoord;\n  gl_Position = vec4(vertexCoord.xy, 1., 1);\n}";
  programs.globe = shaderProgram({
    vertex: "precision mediump float;\n\nattribute vec3 modelCoord;\nattribute vec2 texCoord;\n\nvarying vec2 tex;\n\nuniform mat4 ModelViewMatrix;\nuniform mat4 ProjectionMatrix;\n\nvoid main() {\n  tex = texCoord;\n\n  vec4 WorldCoord = ModelViewMatrix * vec4(modelCoord,1.0);\n\n  gl_Position = ProjectionMatrix * WorldCoord;\n}",
    fragment: "precision mediump float;\n\nuniform sampler2D texture;\n\nvarying vec2 tex; // coords\n\nuniform sampler2D oceanCurrent;\nuniform sampler2D earthTexture;\n\nbool isWater(vec2 coords) {\n  vec3 val = texture2D(oceanCurrent, coords).xyz;\n  return val.z != 0.0;\n}\n\n// transform packed texture field\nvec2 fieldAt(vec2 coords) {\n  vec3 val = texture2D(oceanCurrent, coords).xyz;\n  return vec2(val.x - 0.5, val.y - 0.5);\n}\n\n// tweak variables for masking\nuniform float m;\nuniform float n;\n\nuniform bool mask;\n\nvoid main() {\n  if (isWater(tex)) {\n    vec4 pixel = texture2D(texture, tex);\n\n    float magnitude = length(fieldAt(tex));\n\n    // not in paper, but in 2002 e/l texture advection:\n    // masking by magnitude\n    vec4 alpha = vec4(1., 1., 1., 1.);\n    if (mask) {\n      float ratio = min(magnitude / 0.5, 1.);\n      alpha = (1. - pow(1. - ratio, m)) * (1. - pow(1. - pixel, vec4(n)));\n    }\n\n    gl_FragColor = pixel * alpha;\n  } else {\n    gl_FragColor = texture2D(earthTexture, tex);\n  }\n}",
    uniforms: {
      mask: ['1i', true],
      m: ['1f', 10],
      n: ['1f', 3]
    }
  });
  programs.noiseTransport = shaderProgram({
    vertex: plainQuadVertex,
    fragment: "precision mediump float;\n\nuniform sampler2D field;\nuniform sampler2D noise;\n\nvarying vec2 tex;\n\nuniform vec2 randomOffset;\n\n// transform packed texture field\nvec2 fieldAt(vec2 coords) {\n  vec3 val = texture2D(field, coords).xyz;\n  return vec2(val.x - 0.5, val.y - 0.5);\n}\n\nbool isWater(vec2 coords) {\n  vec3 val = texture2D(field, coords).xyz;\n  return val.z != 0.0;\n}\n\n//vec2 size = vec2(1024., 512.);\n\nvoid main() {\n  if (isWater(tex)) {\n    vec2 currentPosition = tex + randomOffset;\n\n    // so, the paper says to advect the noise along the field, but since\n    // it's random anyway, I don't get why they bother...\n    /*\n    vec2 pos = currentPosition;\n    float h = 0.125;\n    vec2 field = fieldAt(pos);\n    for(int i = 0; i < 35; ++i) {\n      pos = pos - field * h / size;\n      field = fieldAt(pos);\n    }\n    */\n\n    //gl_FragColor = texture2D(noise, pos);\n    gl_FragColor = texture2D(noise, currentPosition);\n  } else {\n    gl_FragColor = texture2D(noise, tex);\n  }\n}"
  });
  programs.orthogonalLic = shaderProgram({
    vertex: plainQuadVertex,
    fragment: function(stepsForwards, stepsBackwards){
      return "precision mediump float;\n\nuniform sampler2D oceanCurrent;\nuniform sampler2D transportedNoise;\n\nvarying vec2 tex;\n\nuniform bool useOrthogonal;\n\n// transform packed texture field\nvec2 orthogonalFieldAt(vec2 coords) {\n  vec3 val = texture2D(oceanCurrent, coords).xyz;\n  if (useOrthogonal) {\n    return vec2(-(val.y - 0.5), val.x - 0.5);\n  } else {\n    return vec2((val.x - 0.5), val.y - 0.5);\n  }\n}\n\nbool isWater(vec2 coords) {\n  vec3 val = texture2D(oceanCurrent, coords).xyz;\n  return val.z != 0.0;\n}\n\nuniform vec2 size;\nuniform float h;\n\n// loops have to be unrolled so use global state and recompile instead\n// TODO better way to do this\nconst int stepsBackwards = " + stepsBackwards + ";\nconst int stepsForwards = " + stepsForwards + ";\n\nvoid main() {\n  if (isWater(tex)) {\n    // LIC backwards and forwards\n    vec3 pixel = vec3(0.0, 0.0, 0.0);\n    vec2 pos = tex;\n\n    vec2 field = orthogonalFieldAt(pos);\n    for(int i = 0; i < stepsBackwards; ++i) {\n      pixel = pixel + texture2D(transportedNoise, pos).rgb;\n      pos = pos - field * h / size;\n      field = orthogonalFieldAt(pos);\n    }\n    pos = tex;\n    field = orthogonalFieldAt(pos);\n    for(int i = 0; i < stepsForwards; ++i) {\n      pixel = pixel + texture2D(transportedNoise, pos).rgb;\n      pos = pos + field * h / size;\n      field = orthogonalFieldAt(pos);\n    }\n\n    // average\n    pixel = pixel / " + (stepsForwards + stepsBackwards) + ".0;\n\n    gl_FragColor = vec4(pixel, 1.0);\n  } else {\n    gl_FragColor = texture2D(transportedNoise, tex);\n  }\n}";
    },
    uniforms: {
      size: ['2f', 1024, 512],
      h: ['1f', 0.75],
      useOrthogonal: ['1i', true]
    }
  });
  programs.advection = shaderProgram({
    vertex: plainQuadVertex,
    fragment: "precision mediump float;\n\nuniform sampler2D oceanCurrent;\nuniform sampler2D previousTexture;\n\nvarying vec2 tex;\n\n// transform packed texture field\nvec2 fieldAt(vec2 coords) {\n  vec3 val = texture2D(oceanCurrent, coords).xyz;\n  return vec2(val.x - 0.5, val.y - 0.5);\n}\n\nbool isWater(vec2 coords) {\n  vec3 val = texture2D(oceanCurrent, coords).xyz;\n  return val.z != 0.0;\n}\n\nvec2 size = vec2(1024., 512.);\n\nvoid main() {\n  if (isWater(tex)) {\n    vec2 currentPosition = tex;\n\n    float h = 0.125;\n\n    vec2 pos = tex;\n    vec2 field = fieldAt(pos);\n    for(int i = 0; i < 35; ++i) {\n      pos = pos - field * h / size;\n      field = fieldAt(pos);\n    }\n\n    gl_FragColor = vec4(texture2D(previousTexture, pos));\n  } else {\n    gl_FragColor = texture2D(previousTexture, tex);\n  }\n}"
  });
  programs.blend = shaderProgram({
    vertex: plainQuadVertex,
    fragment: "precision mediump float;\n\nuniform sampler2D orthogonalLIC;\nuniform sampler2D advected;\n\nuniform sampler2D oceanCurrent;\n\nbool isWater(vec2 coords) {\n  vec3 val = texture2D(oceanCurrent, coords).xyz;\n  return val.z != 0.0;\n}\n\n// transform packed texture field\nvec2 fieldAt(vec2 coords) {\n  vec3 val = texture2D(oceanCurrent, coords).xyz;\n  return vec2(val.x - 0.5, val.y - 0.5);\n}\n\nvarying vec2 tex;\n\nvoid main() {\n  vec4 pixel   = texture2D(orthogonalLIC, tex) * 0.05\n               + texture2D(advected     , tex) * 0.95;\n\n  gl_FragColor = pixel;\n}"
  });
}).call(this);
