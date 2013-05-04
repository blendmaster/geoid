/* This file (programs.js) is compiled from programs.co. Please view the
original commented source there. */
(function(){
  "use strict";
  var programs, load, plainQuadVertex, oceanCurrentComon, isWater, out$ = typeof exports != 'undefined' && exports || this, slice$ = [].slice;
  programs = {};
  out$.load = load = function(it){
    var args;
    args = slice$.call(arguments, 1);
    return programs[it].apply(null, args);
  };
  plainQuadVertex = "precision mediump float;\n\nattribute vec2 vertexCoord;\nattribute vec2 texCoord;\n\nvarying vec2 tex;\n\nvoid main() {\n  tex = texCoord;\n  gl_Position = vec4(vertexCoord.xy, 1., 1);\n}";
  oceanCurrentComon = "// we need all three to be able to interpolate between months.\n// well, we technically don't need 3, but having the previous set\n// makes it easier to look backwards in time.\nuniform sampler2D prevOcean;\nuniform sampler2D curOcean;\nuniform sampler2D nextOccean;\n\n// unpack current timestamped field from packed texture\n// see the `octave` folder for details\n//\n// coords is in homogenous [0,1] coords, and will be wrapped.\n// time is in months relative to the start of curOcean.\n//\n// Vector fields are essentially trilinearly interpolated,\n// in 2D for the current timestamp automatically by openGL,\n// and through time by this function. Due to the log-space packing of\n// the fields, openGL's interpolation isn't actually linear, but it's close\n// enough.\nvec2 fieldAt(vec2 coords, float time) {\n  // wrap coords to [0, 1]\n  coords = coords - floor(coords);\n\n  float monthOffset = fract(time);\n  int thisMonth = floor(time);\n  int nextMonth = thisMonth + 1;\n\n  vec2 startVal;\n  vec2 endVal;\n  if (thisMonth == -1) {\n    startVal = unpckVals(coords, 15., prevOcean);\n    endVal   = unpckVals(coords, 0, curOcean);\n  } else if(thisMonth == 15) {\n    startVal = unpckVals(coords, 15, curOcean);\n    endVal   = unpckVals(coords, 0, nextOccean);\n  } else {\n    startVal = unpckVals(coords, thisMonth, curOcean);\n    endVal   = unpckVals(coords, nextMonth, curOcean);\n  }\n\n  retun mix(startVal, endVal, monthOffset);\n}\n\n// the vector field value from a specific month in a set\n// unpacks the log-space numbers from RGBA channels.\n// layout:\n//\n// 0,1   2,3\n// 4,5   6,7\n// 8,9   10,11\n// 12,13 14,15\nvec2 firstField(vec2 coords, int month, sampler2D fieldSet) {\n  vec2 start = vec2(\n    // left side or right side, i.e. 0 or 0.5\n    mod(floor(month / 2.), 2.) / 2.,\n    // which layer, 0, 0.25, 0.5, 0.75\n    floor(month / 4.) / 4.);\n\n  float actualCoords = start + coords / vec2(2., 4.);\n\n  if (mod(month, 2) == 0) {\n    return unlog(texture2D(fieldSet, actualCoords).rg);\n  } else {\n    return unlog(texture2D(fieldSet, actualCoords).ba);\n  }\n}\n\n// log space unpacking.\n// Negative numbers were packed backards into [0, 127].\n// Positive numbers were packed normally into [128, 255];\n//\n// The backwards packing ws done so openGL's billinear interp around 0.5 wouldn't\n// cause large negative numbers to suddenly change into tiny positive numbers if\n// the two real values were e.g. 0.49 and 0.51.\nvec2 unlog(vec2 val) {\n  return vec2(unlogComponent(val.x), unlogComponent(val.y));\n}\n\nfloat unlogComponent(float val) {\n  if (val < 0.5) {\n    // regularly in space [0, 0.5] so transform to [0, 1], then\n    // flip into log space [-10, 0];\n    return exp(val * 2 * -10.);\n  } else {\n    // regularly in space [0.5, 1.0] so transform to [0, 0.5], then\n    // to [0, 10], then subtract to log space [-10, 0];\n    return exp((val - 0.5) * 10. - 10.);\n  }\n}";
  isWater = "// a simple boolean lookup to deal with edge effects around continents.\nuniform texture2D water;\n\nbool isWater(vec2 coords) {\n  // no fancy unpacking or wrapping, thankfully\n  return texture2D(water, coords) == 1;\n}";
  programs.globe = shaderProgram({
    vertex: "precision mediump float;\n\nattribute vec3 modelCoord;\nattribute vec2 texCoord;\n\nvarying vec2 tex;\n\nuniform mat4 ModelViewMatrix;\nuniform mat4 ProjectionMatrix;\n\nvoid main() {\n  tex = texCoord;\n\n  vec4 WorldCoord = ModelViewMatrix * vec4(modelCoord,1.0);\n\n  gl_Position = ProjectionMatrix * WorldCoord;\n}",
    fragment: "precision mediump float;\n\nuniform sampler2D texture;\n\nvarying vec2 tex; // coords\n\nuniform sampler2D oceanCurrent;\nuniform sampler2D earthTexture;\n\nbool isWater(vec2 coords) {\n  vec3 val = texture2D(oceanCurrent, coords).xyz;\n  return val.z == 1.0;\n}\n\n// transform packed texture field\nvec2 fieldAt(vec2 coords) {\n  vec3 val = texture2D(oceanCurrent, coords).xyz;\n  return vec2(val.x - 0.5, val.y - 0.5);\n}\n\n// tweak variables for masking\nuniform float m;\nuniform float n;\n\nuniform bool mask;\n\n// tweak contrast stretch\nuniform float minVal;\nuniform float maxVal;\n\nvoid main() {\n  if (isWater(tex)) {\n    vec4 pixel = texture2D(texture, tex);\n\n    // stretch contrast\n    float range = maxVal - minVal;\n    vec3 normalized = pixel.rgb - vec3(minVal, minVal, minVal);\n    pixel.rgb = clamp(normalized / range, vec3(0.,0.,0.), vec3(1.,1.,1.));\n\n    float magnitude = length(fieldAt(tex));\n\n    // not in paper, but in 2002 e/l texture advection:\n    // masking by magnitude\n    vec4 alpha = vec4(1., 1., 1., 1.);\n    if (mask) {\n      float ratio = min(magnitude / 0.5, 1.);\n      alpha = (1. - pow(1. - ratio, m)) * (1. - pow(1. - pixel, vec4(n)));\n    }\n\n    gl_FragColor = pixel * alpha;\n    gl_FragColor.b = gl_FragColor.b / 0.9 + 0.1;\n  } else {\n    gl_FragColor = texture2D(earthTexture, tex);\n  }\n}",
    uniforms: {
      mask: ['1i', true],
      m: ['1f', 10],
      n: ['1f', 3],
      minVal: ['1f', 0.4],
      maxVal: ['1f', 0.6]
    }
  });
  programs.noiseTransport = shaderProgram({
    vertex: plainQuadVertex,
    fragment: "precision mediump float;\n\nuniform sampler2D field;\nuniform sampler2D noise;\n\nvarying vec2 tex;\n\nuniform vec2 randomOffset;\n\n// transform packed texture field\nvec2 fieldAt(vec2 coords) {\n  vec3 val = texture2D(field, coords).xyz;\n  return vec2(val.x - 0.5, val.y - 0.5);\n}\n\nbool isWater(vec2 coords) {\n  vec3 val = texture2D(field, coords).xyz;\n  return val.z == 1.0;\n}\n\n//vec2 size = vec2(1024., 512.);\n\nvoid main() {\n  if (isWater(tex)) {\n    vec2 currentPosition = tex + randomOffset;\n\n    // so, the paper says to advect the noise along the field, but since\n    // it's random anyway, I don't get why they bother...\n    /*\n    vec2 pos = currentPosition;\n    float h = 0.125;\n    vec2 field = fieldAt(pos);\n    for(int i = 0; i < 35; ++i) {\n      pos = pos - field * h / size;\n      field = fieldAt(pos);\n    }\n    */\n\n    //gl_FragColor = texture2D(noise, pos);\n    gl_FragColor = texture2D(noise, currentPosition);\n  } else {\n    gl_FragColor = texture2D(noise, tex);\n  }\n}"
  });
  programs.orthogonalLic = shaderProgram({
    vertex: plainQuadVertex,
    fragment: function(stepsForwards, stepsBackwards){
      return "precision mediump float;\n\nuniform sampler2D oceanCurrent;\nuniform sampler2D transportedNoise;\n\nvarying vec2 tex;\n\nuniform bool useOrthogonal;\n\n// transform packed texture field\nvec2 orthogonalFieldAt(vec2 coords) {\n  vec3 val = texture2D(oceanCurrent, coords).xyz;\n  if (useOrthogonal) {\n    return vec2(-(val.y - 0.5), val.x - 0.5);\n  } else {\n    return vec2((val.x - 0.5), val.y - 0.5);\n  }\n}\n\nbool isWater(vec2 coords) {\n  vec3 val = texture2D(oceanCurrent, coords).xyz;\n  return val.z == 1.0;\n}\n\nuniform vec2 size;\nuniform float h;\n\n// loops have to be unrolled so use global state and recompile instead\n// TODO better way to do this\nconst int stepsBackwards = " + stepsBackwards + ";\nconst int stepsForwards = " + stepsForwards + ";\n\nvoid main() {\n  if (isWater(tex)) {\n    // LIC backwards and forwards\n    vec3 pixel = vec3(0.0, 0.0, 0.0);\n    vec2 pos = tex;\n\n    vec2 field = orthogonalFieldAt(pos);\n    for(int i = 0; i < stepsBackwards; ++i) {\n      pixel = pixel + texture2D(transportedNoise, pos).rgb;\n      pos = pos - field * h / size;\n      field = orthogonalFieldAt(pos);\n    }\n    pos = tex;\n    field = orthogonalFieldAt(pos);\n    for(int i = 0; i < stepsForwards; ++i) {\n      pixel = pixel + texture2D(transportedNoise, pos).rgb;\n      pos = pos + field * h / size;\n      field = orthogonalFieldAt(pos);\n    }\n\n    // average\n    pixel = pixel / " + (stepsForwards + stepsBackwards) + ".0;\n\n    gl_FragColor = vec4(pixel, 1.0);\n  } else {\n    gl_FragColor = texture2D(transportedNoise, tex);\n  }\n}";
    },
    uniforms: {
      size: ['2f', 1024, 512],
      h: ['1f', 0.75],
      useOrthogonal: ['1i', true]
    }
  });
  programs.advection = shaderProgram({
    vertex: plainQuadVertex,
    fragment: function(steps){
      return "precision mediump float;\n\nuniform sampler2D oceanCurrent;\nuniform sampler2D previousTexture;\n\n// when out of bounds, pull new noise\nuniform sampler2D noise;\n\nuniform vec2 randomOffset;\n\nvarying vec2 tex;\n\n// transform packed texture field\nvec2 fieldAt(vec2 coords) {\n  vec3 val = texture2D(oceanCurrent, coords).xyz;\n  return vec2(val.x - 0.5, val.y - 0.5);\n}\n\nbool isWater(vec2 coords) {\n  vec3 val = texture2D(oceanCurrent, coords).xyz;\n  return val.z == 1.0;\n}\n\nvec2 size = vec2(1024., 512.);\n\nuniform float h;\n\nvoid main() {\n  if (isWater(tex)) {\n    vec2 currentPosition = tex;\n\n    vec2 pos = tex;\n    vec2 field = fieldAt(pos);\n    for(int i = 0; i < " + steps + "; ++i) {\n      pos = pos - field * h / size;\n      field = fieldAt(pos);\n    }\n    gl_FragColor = texture2D(previousTexture, pos);\n  } else {\n    // inject noise into the system at boundaries, otherwise there are\n    // streak artifacts since the noise isn't transported.\n    gl_FragColor = texture2D(previousTexture, tex + randomOffset);\n  }\n}";
    },
    uniforms: {
      h: ['1f', 0.125]
    }
  });
  programs.blend = shaderProgram({
    vertex: plainQuadVertex,
    fragment: "precision mediump float;\n\nuniform sampler2D orthogonalLIC;\nuniform sampler2D advected;\n\nuniform sampler2D oceanCurrent;\n\nbool isWater(vec2 coords) {\n  vec3 val = texture2D(oceanCurrent, coords).xyz;\n  return val.z != 0.0;\n}\n\n// transform packed texture field\nvec2 fieldAt(vec2 coords) {\n  vec3 val = texture2D(oceanCurrent, coords).xyz;\n  return vec2(val.x - 0.5, val.y - 0.5);\n}\n\nvarying vec2 tex;\n\nuniform float ratio;\n\nvoid main() {\n  vec4 pixel   = mix(texture2D(orthogonalLIC, tex)\n                    ,texture2D(advected     , tex)\n                    ,ratio);\n\n  gl_FragColor = pixel;\n}",
    uniforms: {
      ratio: ['1f', 0.85]
    }
  });
}).call(this);
