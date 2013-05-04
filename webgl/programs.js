/* This file (programs.js) is compiled from programs.co. Please view the
original commented source there. */
(function(){
  "use strict";
  var programs, load, plainQuadVertex, oceanCurrentCommon, out$ = typeof exports != 'undefined' && exports || this, slice$ = [].slice;
  programs = {};
  out$.load = load = function(it){
    var args;
    args = slice$.call(arguments, 1);
    return programs[it].apply(null, args);
  };
  plainQuadVertex = "precision mediump float;\n\nattribute vec2 vertexCoord;\nattribute vec2 texCoord;\n\nvarying vec2 tex;\n\nvoid main() {\n  tex = texCoord;\n  gl_Position = vec4(vertexCoord.xy, 1., 1);\n}";
  oceanCurrentCommon = "// a simple boolean lookup to deal with edge effects around continents.\nuniform sampler2D landMask;\n\nbool isWater(vec2 coords) {\n  // no fancy unpacking or wrapping, thankfully\n  return texture2D(landMask, coords).r > 0.;\n}\n\n// we need all three to be able to interpolate between months.\n// well, we technically don't need 3, but having the previous set\n// makes it easier to look backwards in time.\nuniform sampler2D prevOcean;\nuniform sampler2D curOcean;\nuniform sampler2D nextOccean;\n\n// vector values were normalized to [-1, 1] then transposed to [0, 1].\nvec2 unpack(vec2 val) {\n  return val - vec2(0.5, 0.5);\n}\n\n// the vector field value according to month\n// the first is RG, the second is BA\nvec2 unpackVal(vec2 coords, float month, sampler2D fieldSet) {\n  if (month == 0.) {\n    return unpack(texture2D(fieldSet, coords).rg);\n  } else {\n    return unpack(texture2D(fieldSet, coords).ba);\n  }\n}\n\n// unpack current timestamped field from 2-packed texture\n// see the `octave` folder for details.\n//\n// Vector fields are essentially trilinearly interpolated,\n// in 2D for the current timestamp automatically by openGL,\n// and through time by this function.\nvec2 fieldAt(vec2 coords, float time) {\n  if (isWater(coords)) {\n    float monthOffset = fract(time);\n    float thisMonth = floor(time);\n    float nextMonth = thisMonth + 1.;\n\n    vec2 startVal;\n    vec2 endVal;\n    if (thisMonth == -1.) {\n      startVal = unpackVal(coords, 1., prevOcean);\n      endVal   = unpackVal(coords, 0., curOcean);\n    } else {\n      if(thisMonth == 1.) {\n        startVal = unpackVal(coords, 1., curOcean);\n        endVal   = unpackVal(coords, 0., nextOccean);\n      } else {\n        startVal = unpackVal(coords, thisMonth, curOcean);\n        endVal   = unpackVal(coords, nextMonth, curOcean);\n      }\n    }\n\n    return mix(startVal, endVal, monthOffset);\n  } else {\n    return vec2(0., 0.);\n  }\n}";
  programs.globe = shaderProgram({
    vertex: "precision mediump float;\n\nattribute vec3 modelCoord;\nattribute vec2 texCoord;\n\nvarying vec2 tex;\n\nuniform mat4 ModelViewMatrix;\nuniform mat4 ProjectionMatrix;\n\nvoid main() {\n  tex = texCoord;\n\n  vec4 WorldCoord = ModelViewMatrix * vec4(modelCoord,1.0);\n\n  gl_Position = ProjectionMatrix * WorldCoord;\n}",
    fragment: "precision mediump float;\n\nuniform sampler2D texture;\n\nvarying vec2 tex;\n\nuniform sampler2D earthTexture;\n\n// tweak variables for masking\nuniform float m;\nuniform float n;\n\nuniform bool mask;\n\n// tweak contrast stretch\nuniform float minVal;\nuniform float maxVal;\n\n" + oceanCurrentCommon + "\n\nuniform float time;\n\nvoid main() {\n  if (texture2D(landMask, tex).r == 1.0) {\n    vec4 pixel = texture2D(texture, tex);\n\n    // stretch contrast\n    float range = maxVal - minVal;\n    vec3 normalized = pixel.rgb - vec3(minVal, minVal, minVal);\n    pixel.rgb = clamp(normalized / range, vec3(0.,0.,0.), vec3(1.,1.,1.));\n\n    float magnitude = length(fieldAt(tex, time));\n\n    // not in paper, but in 2002 e/l texture advection:\n    // masking by magnitude\n    vec4 alpha = vec4(1., 1., 1., 1.);\n    if (mask) {\n      float ratio = min(magnitude / 0.5, 1.);\n      alpha = (1. - pow(1. - ratio, m)) * (1. - pow(1. - pixel, vec4(n)));\n    }\n\n    vec4 masked = pixel * alpha;\n\n    // slight blue coloration for visual appeal\n    masked.b = masked.b / 0.9 + 0.1;\n    gl_FragColor = masked;\n  } else {\n    gl_FragColor = texture2D(earthTexture, tex);\n  }\n}",
    uniforms: {
      mask: ['1i', true],
      m: ['1f', 10],
      n: ['1f', 3],
      minVal: ['1f', 0.4],
      maxVal: ['1f', 0.6],
      time: ['1f', 0]
    }
  });
  programs.noiseTransport = shaderProgram({
    vertex: plainQuadVertex,
    fragment: "precision mediump float;\n\nuniform sampler2D noise;\n\nvarying vec2 tex;\n\nuniform vec2 randomOffset;\n\n" + oceanCurrentCommon + "\n\nvoid main() {\n  if (isWater(tex)) {\n    vec2 currentPosition = tex + randomOffset;\n\n    // so, the paper says to advect the noise along the field, but since\n    // it's random anyway, I don't get why they bother...\n    /*\n    vec2 pos = currentPosition;\n    float h = 0.125;\n    vec2 field = fieldAt(pos);\n    for(int i = 0; i < 35; ++i) {\n      pos = pos - field * h / size;\n      field = fieldAt(pos);\n    }\n    */\n\n    //gl_FragColor = texture2D(noise, pos);\n    gl_FragColor = texture2D(noise, currentPosition);\n  } else {\n    gl_FragColor = vec4(0.,0.,0.,1.);\n  }\n}"
  });
  programs.orthogonalLic = shaderProgram({
    vertex: plainQuadVertex,
    fragment: function(stepsForwards, stepsBackwards){
      return "precision mediump float;\n\nuniform sampler2D transportedNoise;\n\nvarying vec2 tex;\n\n" + oceanCurrentCommon + "\n\nuniform bool useOrthogonal;\n\nvec2 licFieldAt(vec2 coords, float time) {\n  vec2 val = fieldAt(coords, time);\n  if (useOrthogonal) {\n    return vec2(-val.y, val.x);\n  } else {\n    return val;\n  }\n}\n\nuniform float time;\n\nuniform vec2 size;\nuniform float h;\n\n// loops have to be unrolled so use global state and recompile instead\n// TODO better way to do this\nconst int stepsBackwards = " + stepsBackwards + ";\nconst int stepsForwards = " + stepsForwards + ";\n\nvoid main() {\n  if (isWater(tex)) {\n    // LIC backwards and forwards\n    vec3 pixel = vec3(0., 0., 0.);\n    vec2 pos = tex;\n\n    vec2 field = licFieldAt(pos, time);\n    for(int i = 0; i < stepsBackwards; ++i) {\n      pixel = pixel + texture2D(transportedNoise, pos).rgb;\n      pos = pos - field * h / size;\n      field = licFieldAt(pos, time);\n    }\n    pos = tex;\n    field = licFieldAt(pos, time);\n    for(int i = 0; i < stepsForwards; ++i) {\n      pixel = pixel + texture2D(transportedNoise, pos).rgb;\n      pos = pos + field * h / size;\n      field = licFieldAt(pos, time);\n    }\n\n    // average\n    pixel = pixel / " + (stepsForwards + stepsBackwards) + ".0;\n\n    gl_FragColor = vec4(pixel, 1.);\n  } else {\n    gl_FragColor = texture2D(transportedNoise, tex);\n  }\n}";
    },
    uniforms: {
      size: ['2f', 1024, 512],
      h: ['1f', 0.75],
      useOrthogonal: ['1i', true],
      time: ['1f', 0.0]
    }
  });
  programs.advection = shaderProgram({
    vertex: plainQuadVertex,
    fragment: function(steps){
      return "precision mediump float;\n\nuniform sampler2D previousTexture;\n\n" + oceanCurrentCommon + "\n\n// when out of bounds, pull new noise\nuniform sampler2D noise;\nuniform vec2 randomOffset;\n\nvarying vec2 tex;\n\nuniform float time;\n\nuniform vec2 size;\n\nuniform float h;\n\nvoid main() {\n  if (isWater(tex)) {\n    vec2 currentPosition = tex;\n\n    vec2 pos = tex;\n    vec2 field = fieldAt(pos, time);\n    for(int i = 0; i < " + steps + "; ++i) {\n      pos = pos - field * h / size;\n      field = fieldAt(pos, time);\n    }\n    gl_FragColor = texture2D(previousTexture, pos);\n  } else {\n    // inject noise into the system at boundaries, otherwise there are\n    // streak artifacts since the noise isn't transported.\n    gl_FragColor = texture2D(noise, tex + randomOffset);\n  }\n}";
    },
    uniforms: {
      size: ['2f', 1024, 512],
      h: ['1f', 0.125]
    }
  });
  programs.blend = shaderProgram({
    vertex: plainQuadVertex,
    fragment: "precision mediump float;\n\nuniform sampler2D orthogonalLIC;\nuniform sampler2D advected;\n\nvarying vec2 tex;\n\nuniform float ratio;\n\nvoid main() {\n  vec4 pixel   = mix(texture2D(orthogonalLIC, tex)\n                    ,texture2D(advected     , tex)\n                    ,ratio);\n\n  gl_FragColor = pixel;\n}",
    uniforms: {
      ratio: ['1f', 0.85]
    }
  });
}).call(this);
