var createMainCanvas = () => {
    var canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.margin = "0";
    canvas.style.background = "black";
    canvas.onResize = () => { };
    new ResizeObserver((e) => {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        canvas.onResize(canvas.clientWidth, canvas.clientHeight);
    }).observe(canvas);
    document.body.appendChild(canvas);
    return canvas;
}

var createVideoSource = (wfx, url) => {
    var videoElement = document.createElement("video");
    // videoElement.autoplay = true;
    videoElement.loaded = false;
    videoElement.muted = true;
    videoElement.loop = true;
    videoElement.src = url;
    videoElement.load();
    videoElement.play();
    var videoSource = wfx.Source(videoElement);
    videoElement.addEventListener('loadeddata', function () {
        videoSource.setReady(true);
        videoSource.setWidth(videoElement.videoWidth);
        videoSource.setHeight(videoElement.videoHeight);
    }, false);
    // document.body.appendChild(videoElement);
    return videoSource;
}


var createCameraSource = (wfx) => {
    let playing = false;
    var videoElement = document.createElement("video");
    var videoSource = wfx.Source(videoElement);
    // document.body.appendChild(videoElement);
    videoElement.autoPlay = true;
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: true })
        .then(function(stream) {
            videoElement.addEventListener('playing', () => {
                videoSource.setReady(true);
                videoSource.setWidth(videoElement.videoWidth);
                videoSource.setHeight(videoElement.videoHeight);
            });
            videoElement.srcObject = stream;
            videoElement.onloadedmetadata = () => {
                videoElement.play();
            };
        })
        .catch(function(error) {
          console.error(error); // eslint-disable-line
        });
    };
    return videoSource;
}



var mainCanvas = createMainCanvas();
var gl = mainCanvas.getContext("webgl");
var wfx = Webfx(mainCanvas);
var config = {
    window: 5,
    iters: 5,
    fact: 1 / 2,
    levels: 4,
    blur: 2,
    flowscale: 1 / 4
};

var sh_vheader = `
    precision mediump float;
`;
var sh_fheader = `
    precision mediump float;
`;
var sh_vbasic = sh_vheader +
    `
    precision mediump float;
    attribute vec2 a_pos;
    varying vec2 v_texCoord;
    void main() {
        v_texCoord = a_pos*0.5+0.5;
        gl_Position = vec4(a_pos, 0.0, 1.0);
    }
`;
var sh_pack = `
    vec2 pack(float x){
        x = clamp(x, 0.0, 1.0);
        float fix = 255.0/256.0;
        vec2 y = vec2(fract(x*fix*1.0), fract(x*fix*255.0));
        return y;
    }
    float unpack(vec2 x) {
        float fix = 256.0/255.0;
        return clamp(x.x*fix/1.0+x.y*fix/255.0, 0.0, 1.0);
    }
`;
var sh_pack2 = `
    vec4 pack2(vec2 uv) {
        return vec4(pack(uv.x),pack(uv.y));
    }
    vec2 unpack2(vec4 uv) {
        return vec2(unpack(uv.xy), unpack(uv.zw));
    }
`;

var blitProg = wfx.Program(
    `
    #define STRECH 0
    #define FILL 1
    #define FIT 2
    precision mediump float;
    attribute vec2 a_pos;
    varying vec2 v_texCoord;
    uniform int u_mode;
    uniform bool u_flip;
    uniform vec2 u_res;
    uniform vec2 u_tex0res;
    void main() {
        vec2 pos = a_pos;
        if (u_flip) pos = pos * vec2(1.0, -1.0);
        if (u_mode == STRECH) {
            v_texCoord = pos * 0.5 + 0.5;
        } else if (u_mode == FILL) {
            float ratio = (u_res.x / u_res.y) / (u_tex0res.x / u_tex0res.y);
            if (ratio < 1.0) {
                v_texCoord = vec2(pos.x*ratio, pos.y) * 0.5 + 0.5;
            } else {
                v_texCoord = vec2(pos.x, pos.y/ratio) * 0.5 + 0.5;
            }
        } else if (u_mode == FIT) {
            float ratio = (u_res.x / u_res.y) / (u_tex0res.x / u_tex0res.y);
            if (ratio < 1.0) {
                v_texCoord = vec2(pos.x, pos.y/ratio) * 0.5 + 0.5;
            } else {
                v_texCoord = vec2(pos.x*ratio, pos.y) * 0.5 + 0.5;
            }
        }
        gl_Position = vec4(a_pos, 0.0, 1.0);
    }
    `,
    `
    precision mediump float;
    varying vec2 v_texCoord;
    uniform sampler2D u_tex0;
    void main() {
        gl_FragColor = texture2D(u_tex0, v_texCoord);
    }
    `,
    { u_mode: 0, u_flip: false }
);
var blit = (fbo, tex, mode, flip) => {
    if (!mode) mode = 0;
    if (!flip) flip = false;
    blitProg.render(fbo, [tex], { u_mode: mode, u_flip: flip });
};

var blurProg = wfx.Program(
    sh_vbasic,
    sh_fheader +
    sh_pack + `
    varying vec2 v_texCoord;
    uniform vec2 u_dir;
    uniform vec2 u_res;
    uniform sampler2D u_tex0;
    vec4 blur5(sampler2D image, vec2 uv, vec2 resolution, vec2 direction) {
        vec4 color = vec4(0.0);
        vec2 off1 = vec2(1.3333333333333333) * direction;
        color += texture2D(image, uv) * 0.29411764705882354;
        color += texture2D(image, uv + (off1 / resolution)) * 0.35294117647058826;
        color += texture2D(image, uv - (off1 / resolution)) * 0.35294117647058826;
        return color; 
      }
      void main() {
          gl_FragColor = blur5(u_tex0, v_texCoord, u_res, u_dir);
      }
    `
);
var blurFilter = (dfbo, n) => {
    for (var i = 0; i < n; i++) {
        blurProg.render(dfbo, [dfbo], { u_dir: [0, 1] });
        blurProg.render(dfbo, [dfbo], { u_dir: [1, 0] });
    }
};

var blurPackProg = wfx.Program(
    sh_vbasic,
    sh_fheader +
    sh_pack +
    `
    varying vec2 v_texCoord;
    uniform vec2 u_dir;
    uniform vec2 u_res;
    uniform sampler2D u_tex0;
    vec2 blur5(sampler2D image, vec2 uv, vec2 resolution, vec2 direction) {
        float color = 0.0;
        vec2 off1 = vec2(1.3333333333333333) * direction;
        color += unpack(texture2D(image, uv).xy) * 0.29411764705882354;
        color += unpack(texture2D(image, uv + (off1 / resolution)).xy) * 0.35294117647058826;
        color += unpack(texture2D(image, uv - (off1 / resolution)).xy) * 0.35294117647058826;
        return pack(color); 
      }
      void main() {
          gl_FragColor = vec4(blur5(u_tex0, v_texCoord, u_res, u_dir), 0.0, 1.0);
      }
    `
);
var blurPackFilter = (dfbo, n) => {
    for (var i = 0; i < n; i++) {
        blurPackProg.render(dfbo, [dfbo], { u_dir: [0, 1] });
        blurPackProg.render(dfbo, [dfbo], { u_dir: [1, 0] });
    }
};


var unpackProg = wfx.Program(
    sh_vbasic,
    sh_fheader +
    sh_pack +
    sh_pack2 +
    `
    varying vec2 v_texCoord;
    uniform sampler2D u_tex0;
    void main() {
        vec4 tex =  texture2D(u_tex0, v_texCoord);
        gl_FragColor = vec4(vec3(unpack(tex.rg)), 1.0);
    }
    `
); var unpack = (tex) => { unpackProg.render(tex, [tex]); return tex; };

var unpack2Prog = wfx.Program(
    sh_vbasic,
    sh_fheader +
    sh_pack +
    sh_pack2 +
    `
    varying vec2 v_texCoord;
    uniform sampler2D u_tex0;
    void main() {
        vec4 tex =  texture2D(u_tex0, v_texCoord);
        gl_FragColor = vec4(unpack2(tex), 0.5, 1.0);
    }
    `
); var unpack2 = (tex) => { unpack2Prog.render(tex, [tex]); return tex; };

var bwProg = wfx.Program(
    sh_vbasic,
    sh_fheader +
    sh_pack +
    `
    varying vec2 v_texCoord;
    uniform sampler2D u_tex0;
    void main() {
        vec4 tex =  texture2D(u_tex0, v_texCoord);
        float c = (tex.x+tex.y+tex.z)/3.0;
        gl_FragColor = vec4(pack(c), 0.0, 1.0);
    }
    `
);

var derivProg = wfx.Program(
    sh_vbasic,
    sh_fheader +
    `
    varying vec2 v_texCoord;
    uniform sampler2D u_tex0;
    uniform vec2 u_res;
    void main() {
        vec2 pix = 1.0 / u_res;
        float dx =  texture2D(u_tex0, v_texCoord + vec2(pix.x, 0.0)).r - 
                    texture2D(u_tex0, v_texCoord - vec2(pix.x, 0.0)).r;
        float dy =  texture2D(u_tex0, v_texCoord + vec2(0.0, pix.y)).r - 
                    texture2D(u_tex0, v_texCoord - vec2(0.0, pix.y)).r;
        gl_FragColor = vec4(dx*0.5+0.5, dy*0.5+0.5, 0.0, 1.0);
    }
    `
);

var derivPackProg = wfx.Program(
    sh_vbasic,
    sh_fheader +
    sh_pack +
    sh_pack2 +
    `
    varying vec2 v_texCoord;
    uniform sampler2D u_tex0;
    uniform vec2 u_res;
    void main() {
        vec2 pix = 1.0 / u_res;
        float dx =  unpack(texture2D(u_tex0, v_texCoord + vec2(pix.x, 0.0)).rg) - 
                    unpack(texture2D(u_tex0, v_texCoord - vec2(pix.x, 0.0)).rg);
        float dy =  unpack(texture2D(u_tex0, v_texCoord + vec2(0.0, pix.y)).rg) - 
                    unpack(texture2D(u_tex0, v_texCoord - vec2(0.0, pix.y)).rg);
        gl_FragColor = pack2(vec2(dx*0.5+0.5, dy*0.5+0.5));
    }
    `
);

var flowProg = wfx.Program(
    sh_vbasic,
    sh_fheader +
    sh_pack +
    sh_pack2 +
    `const int WINDOW = int(` + String(config.window) + `);` +
    `const int ITERS = int(` + String(config.iters) + `);` +
    `
    varying vec2 v_texCoord;
    uniform vec2 u_res;

    uniform sampler2D u_tex0;
    uniform sampler2D u_tex1;
    uniform sampler2D u_tex2;
    uniform sampler2D u_tex3;
    uniform bool u_first;
    
    #define u_I1 u_tex0
    #define u_I2 u_tex1
    #define u_D1 u_tex2
    #define u_flowTex u_tex3
    
    const int W2 = WINDOW / 2;

    void main() {
        vec2 pix = 1.0 / u_res;
        float hw = float(W2);
        vec2 uv;
        if (!u_first) uv = (unpack2(texture2D(u_flowTex, v_texCoord))-0.5)*u_res;
        vec2 pos = v_texCoord * u_res;
        float GXX, GXY, GYY;
        GXX = 0.0045; GXY = 0.0; GYY = 0.0045;
        for (int k = 0; k < ITERS; k++) {
            vec2 pos1b = pos - hw;
            vec2 pos2b = pos1b + uv;
            vec2 v;
            for (int i = -W2; i < W2+1; i++) {
                vec2 pos1 = pos1b;
                vec2 pos2 = pos2b;
                pos1.x += float(i);
                pos2.x += float(i);
                for (int j = -W2; j < W2+1; j++) {
                    pos1.y += float(j);
                    pos2.y += float(j);
                    vec2 d = (unpack2(texture2D(u_D1, pos1/u_res))*2.0-1.0);
                    float dI   = unpack(texture2D(u_I2, pos2/u_res).xy) -
                                    unpack(texture2D(u_I1, pos1/u_res).xy);
                    if (k==0) {
                        GXX += d.x*d.x;
                        GXY += d.x*d.y;
                        GYY += d.y*d.y;
                    }
                    v -= d * dI;
                }
            }
            float det_inv = 1.0 / (GXX * GYY - GXY * GXY);
            float GXX0 = GXX;
            GXX = GYY * det_inv;  GXY *= -det_inv; GYY = GXX0 * det_inv;
            uv.x += (v.x*GXX+v.y*GXY);
            uv.y += (v.x*GXY+v.y*GYY);
        }
        gl_FragColor = pack2(uv/u_res+0.5);
        // gl_FragColor = pack2(uv+0.5);
    }
    `
);

var displayFlow = wfx.Program(
    sh_vbasic,
    sh_vheader +
    sh_pack +
    sh_pack2 +
    `
    vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }
    float sdSegment(vec2 p, vec2 a, vec2 b )
    {
        vec2 pa = p-a, ba = b-a;
        float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
        return length( pa - ba*h );
    }
    uniform sampler2D u_tex0;
    uniform sampler2D u_tex1;
    varying vec2 v_texCoord;
    uniform vec2 u_res;
    uniform float u_scale;
    #define PI 3.14159265359
    void main() {
        vec4 vid = texture2D(u_tex1, v_texCoord);
        // float grid = 100.0;
        // float col;
        // vec2 pt;
        // float dist;
        // vec2 flow;
        // for (int i = -3; i < 4; i++) {
        //     for (int j = -3; j < 4; j++) {
        //         pt = (floor(v_texCoord*grid)+0.5+vec2(float(i), float(j)))/grid;
        //         flow = ((unpack2(texture2D(u_tex0, pt)))-0.5)*vec2(0.5);
        //         float dist = sdSegment(v_texCoord, pt, pt+flow);
        //         col += smoothstep(0.0012, 0.001, dist) * length(flow)*10.0;
        //     }
        // }
        vec2 flow = ((unpack2(texture2D(u_tex0, v_texCoord)))-0.5)*vec2(1.0,1.0);
        vec2 nflow = normalize(flow);
        float hue = atan(nflow.y, nflow.x)/PI/2.0;
        gl_FragColor = vec4(hsv2rgb(vec3(hue, 1.0, length(flow)*u_scale)), 1.0)*10.0; 
        // gl_FragColor = vec4(vec3(length(flow)), 1.0); 
        // gl_FragColor = mix(
        //     vid,
        //     vec4(hsv2rgb(vec3(hue, 1.0, 1.0)), 1.0),
        //     col); 
        // gl_FragColor = vec4(vec3(col), 1.0); 
        // gl_FragColor = vec4(unpack2(texture2D(u_tex0, pt))*u_scale, 0.0, 1.0); 

    }
    `
)

var warpProg = wfx.Program(
    sh_vbasic,
    sh_vheader +
    sh_pack +
    sh_pack2 +
    `
    uniform sampler2D u_tex0;
    uniform sampler2D u_tex1;
    uniform sampler2D u_tex2;
    varying vec2 v_texCoord;
    uniform vec2 u_res;
    uniform float u_scale;
    void main() {
        float block = 8.0;
        vec2 pt = floor(v_texCoord * (u_res/block)) / (u_res/block);
        // vec2 pt = v_texCoord;
        vec2 flow = (unpack2(texture2D(u_tex1, pt))-0.5)*u_scale;
        flow = (floor(flow*u_res+0.5))/u_res;
        // flow *= 0.0;
        flow = v_texCoord-flow;

        vec2 pix = 1.0 / u_res;
        vec2 dx =  (unpack2(texture2D(u_tex1, pt + vec2(pix.x, 0.0)))-0.5) * 
                    (unpack2(texture2D(u_tex1, pt - vec2(pix.x, 0.0)))-0.5);
        vec2 dy =  (unpack2(texture2D(u_tex1, pt + vec2(0.0, pix.y)))-0.5) * 
                    (unpack2(texture2D(u_tex1, pt - vec2(0.0, pix.y)))-0.5);

        vec4 color = texture2D(u_tex0, clamp(flow, 0.0, 1.0));
        float d = dx.x * dy.y;
        if (d < 0.0) color = texture2D(u_tex2, v_texCoord);
        gl_FragColor = color;
    }
    `,
    {u_scale: 1}
);
var warp = (dfbo, tex, vid, scale) => {
    warpProg.render(dfbo, [dfbo, tex, vid], {u_scale: scale ? scale : 1});
}


var FlowPyramid = (f, l, b) => {
    var self = {};
    self.levels = [];
    for (var i = 0; i < l; i++) {
        self.levels.push({
            i1: wfx.DFBO("screen", config.flowscale * Math.pow(f, i)),
            i2: wfx.DFBO("screen", config.flowscale * Math.pow(f, i)),
            deriv: wfx.FBO("screen", config.flowscale * Math.pow(f, i)),
            flow: wfx.FBO("screen", config.flowscale * Math.pow(f, i)),
            first: i == (l - 1)
        });
    };
    self.flow = self.levels[0].flow;
    self.update = (new_frame) => {
        for (var i = 0; i < l; i++) {
            var tmp = self.levels[i].i1;
            self.levels[i].i1 = self.levels[i].i2;
            self.levels[i].i2 = tmp;
            if (i == 0) {
                blit(self.levels[i].i2, new_frame, 1);
            } else {
                blit(self.levels[i].i2, self.levels[i - 1].i2);
            }
            blurPackFilter(self.levels[i].i2, b);
            derivPackProg.render(self.levels[i].deriv, self.levels[i].i1);
        }
    };
    self.compute = () => {
        for (var i = l - 1; i >= 0; i--) {
            flowProg.render(
                self.levels[i].flow,
                [
                    self.levels[i].i1,
                    self.levels[i].i2,
                    self.levels[i].deriv,
                    self.levels[i].first ? wfx.empty : self.levels[i + 1].flow
                ],
                { u_first: self.levels[i].first }
            );
        }
    };
    return self;
}


// var videoSource = createVideoSource(wfx, "frank.mp4");
var videoSource = createCameraSource(wfx);
var video = videoSource.element();
var vid = wfx.Tex(); vid.setSource(videoSource);
var flowPre = wfx.DFBO("screen", config.screenscale);
var vid2 = wfx.FBO("screen", 1);
var flow = FlowPyramid(config.fact, config.levels, config.blur);
var flowPost = wfx.DFBO("screen", 1);
var warpFbo = wfx.DFBO("screen", 1);

var is_on = false;

mainCanvas.addEventListener("click", () => { is_on = !is_on });
// videoSource.element().addEventListener("play", () => { blit(warpFbo, vid, 1); console.log("Reset") });


var render = () => {

    vid.update();
    blit(flowPre, vid, 1);
    blit(vid2, vid, 1);
    bwProg.render(flowPre, [flowPre]);
    flow.update(flowPre);
    flow.compute();
    blit(flowPost, flow.levels[0].flow);
    blurFilter(flowPost, 2);
    if (!is_on) {
        blit(warpFbo, vid, 1);
    } else {
        warp(warpFbo, flowPost, vid2, 1);
    }
    blit(wfx.screen, warpFbo, null, true);

    setTimeout(render, 1000 / 30);
}
render();
