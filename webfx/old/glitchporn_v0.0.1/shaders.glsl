var UV_NORM = "100.0";

computeVS = `
precision mediump float;
attribute vec2 a_pos;
varying vec2 v_uv;
varying vec2 v_uvi;
void main() {
    v_uv = a_pos*0.5+0.5;
    v_uvi = a_pos*vec2(0.5, -0.5)+0.5;
    gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

computeFS = `






precision mediump float;
varying vec2 v_uv;
varying vec2 v_uvi;
uniform sampler2D u_I1;
uniform sampler2D u_I2;
uniform sampler2D u_D1;
uniform sampler2D u_UV;
uniform vec2 u_res;
uniform bool u_isFirst;
uniform float u_pyrScale;
uniform float u_level;

#define WINDOW 5
#define ITERS 50

#define UV_NORM `+UV_NORM+`
vec2 pack(float x){
  float fix = 255.0/256.0;
  vec2 y = vec2(fract(x*fix*1.0), fract(x*fix*255.0));
  return y;
}
float unpack(vec2 x) {
  float fix = 256.0/255.0;
  return x.x*fix/1.0+x.y*fix/255.0;
}
vec4 packuv(vec2 uv) {
    return vec4(pack(uv.x/UV_NORM+0.5),pack(uv.y/UV_NORM+0.5));
}
vec2 unpackuv(vec4 uv) {
    return vec2((unpack(uv.xy)-0.5)*UV_NORM, (unpack(uv.zw)-0.5)*UV_NORM);
}

void main() {
    vec2 pix = 1.0 / u_res;
    float hw = float(WINDOW/2);
    vec2 uv;
    if (!u_isFirst) {
        uv = unpackuv(texture2D(u_UV, v_uv))/pow(u_pyrScale, u_level);
    }
    float x = v_uv.x * u_res.x;
    float y = v_uv.y * u_res.y;
    float G0, G1, G2;
    G0 = 0.0045; G1 = 0.0; G2 = 0.0045;


    for (int k = 0; k < ITERS; k++) {
        float xleft = x-hw;
        float ytop = y-hw;
        float xleft_w = x-hw+uv.x;
        float ytop_w = y-hw+uv.y;
        float v0 = 0.0; float v1 = 0.0;
        for (int i = 0; i < WINDOW; i++) {
            float x1 = xleft+float(i);
            float x2 = xleft_w+float(i);
            for (int j = 0; j < WINDOW; j++) {
                    float y1 = ytop+float(j);
                    float y2 = ytop_w+float(j);

                    float A_t1 = texture2D(u_D1, vec2(x1,y1)*pix).x-0.5;
                    float A_t2 = texture2D(u_D1, vec2(x1,y1)*pix).y-0.5;
                    float dI   = texture2D(u_I1, vec2(x1,y1)*pix).x -
                                texture2D(u_I2, vec2(x2,y2)*pix).x;

                    if (k==0) {
                        G0 += A_t1*A_t1; //Ix^2
                        G1 += A_t1*A_t2; //Ixy
                        G2 += A_t2*A_t2; //Iy^2
                    }

                    v0 += A_t1 * dI;
                    v1 += A_t2 * dI;
            }
        }

        float det_inv = 1.0 / (G0 * G2 - G1 * G1);
        float G00 = G0;
        G0 = G2 * det_inv;  G1 *= -det_inv; G2 = G00 * det_inv;

        uv.x += v0*G0+v1*G1;
        uv.y += v0*G1+v1*G2;
    }

    gl_FragColor = packuv(uv*pow(u_pyrScale, u_level));
    // gl_FragColor = packuv(vec2(0.0,0.0));
}






`;






derivFS = `
precision mediump float;
varying vec2 v_uv;
varying vec2 v_uvi;
uniform sampler2D u_tex;
uniform vec2 u_res;
void main() {
    vec2 pix = 1.0 / u_res;
    float dx = texture2D(u_tex, v_uv + vec2(pix.x, 0.0)).r - texture2D(u_tex, v_uv - vec2(pix.x, 0.0)).r;
    float dy = texture2D(u_tex, v_uv + vec2(0.0, pix.y)).r - texture2D(u_tex, v_uv - vec2(0.0, pix.y)).r;
    dx = dx + 0.5;
    dy = dy + 0.5;
    gl_FragColor = vec4(dx, dy, 0.0, 1.0);
}
`;



plainFS = `
precision mediump float;
varying vec2 v_uv;
varying vec2 v_uvi;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform bool u_flip;
void main() {
    vec2 uv;
    if (u_flip) {
        uv = v_uvi;
    } else {
        uv = v_uv;
    }
    gl_FragColor = texture2D(u_tex, uv);
}
`;

plainUVFS = `
precision mediump float;
varying vec2 v_uv;
varying vec2 v_uvi;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform bool u_flip;

#define UV_NORM `+UV_NORM+`
vec2 pack(float x){
  float fix = 255.0/256.0;
  vec2 y = vec2(fract(x*fix*1.0), fract(x*fix*255.0));
  return y;
}
float unpack(vec2 x) {
  float fix = 256.0/255.0;
  return x.x*fix/1.0+x.y*fix/255.0;
}
vec4 packuv(vec2 uv) {
    return vec4(pack(uv.x/UV_NORM+0.5),pack(uv.y/UV_NORM+0.5));
}
vec2 unpackuv(vec4 uv) {
    // return vec2((unpack(uv.xy)-0.5)*UV_NORM, (unpack(uv.zw)-0.5)*UV_NORM);
    return vec2(unpack(uv.xy), unpack(uv.zw));
}

void main() {
    vec2 uv;
    if (u_flip) {
        uv = v_uvi;
    } else {
        uv = v_uv;
    }
    gl_FragColor = vec4(unpackuv(texture2D(u_tex, uv)), 0.0, 1.0);
}
`;

blurFS = `
precision mediump float;
varying vec2 v_uv;
varying vec2 v_uvi;
uniform sampler2D u_tex;
uniform vec2 u_res;
#define k 7
void main() {
    vec4 col;
    vec2 pix = 1.0/u_res;
    for (int i=0;i<k;i++) {
        for (int j=0; j<k; j++) {
            col += texture2D(u_tex, v_uv-pix*float(k/2)+pix*vec2(float(i), float(j)));
        }
    }
    gl_FragColor = col / float(k*k);
}
`;

warpFS = `
precision mediump float;
varying vec2 v_uv;
varying vec2 v_uvi;
uniform sampler2D u_tex;
uniform sampler2D u_UV;
uniform float u_scale;
uniform vec2 u_res;

#define UV_NORM `+UV_NORM+`
vec2 pack(float x){
  float fix = 255.0/256.0;
  vec2 y = vec2(fract(x*fix*1.0), fract(x*fix*255.0));
  return y;
}
float unpack(vec2 x) {
  float fix = 256.0/255.0;
  return x.x*fix/1.0+x.y*fix/255.0;
}
vec4 packuv(vec2 uv) {
    return vec4(pack(uv.x/UV_NORM+0.5),pack(uv.y/UV_NORM+0.5));
}
vec2 unpackuv(vec4 uv) {
    return vec2((unpack(uv.xy)-0.5)*UV_NORM, (unpack(uv.zw)-0.5)*UV_NORM);
}

vec2 interp(vec2 uvin) {
    vec2 uv = uvin*u_res;
    vec2 uvi = floor(uv);
    vec2 uvf = uv-uvi;
    uv = uvi+smoothstep(0.0,1.0,smoothstep(0.0,1.0,smoothstep(0.0,1.0,uvf)));
    return uv/u_res;
}

void main() {
    vec2 uv = unpackuv(texture2D(u_UV, v_uv))*u_scale/u_res;
    // vec2 uv = unpackuv(texture2D(u_UV, floor(v_uv*50.0)/50.0))*u_scale/u_res;
    // uv = interp(uv);
    uv = (floor(uv*u_res+0.5))/u_res;
    uv = v_uv-uv;
    gl_FragColor = texture2D(u_tex, uv);
}
`;

blur5FS = `
precision mediump float;
varying vec2 v_uv;
varying vec2 v_uvi;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform vec2 u_dir;

vec4 blur5(sampler2D image, vec2 uv, vec2 resolution, vec2 direction) {
  vec4 color = vec4(0.0);
  vec2 off1 = vec2(1.3333333333333333) * direction;
  color += texture2D(image, uv) * 0.29411764705882354;
  color += texture2D(image, uv + (off1 / resolution)) * 0.35294117647058826;
  color += texture2D(image, uv - (off1 / resolution)) * 0.35294117647058826;
  return color; 
}

void main() {
    gl_FragColor = blur5(u_tex, v_uv, u_res, u_dir);
}
`;


medianFS = `
precision mediump float;
varying vec2 v_uv;
varying vec2 v_uvi;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform vec2 u_dir;

#define UV_NORM `+UV_NORM+`
vec2 pack(float x){
  float fix = 255.0/256.0;
  vec2 y = vec2(fract(x*fix*1.0), fract(x*fix*255.0));
  return y;
}
float unpack(vec2 x) {
  float fix = 256.0/255.0;
  return x.x*fix/1.0+x.y*fix/255.0;
}
vec4 packuv(vec2 uv) {
    return vec4(pack(uv.x),pack(uv.y));
}
vec2 unpackuv(vec4 uv) {
    return vec2(unpack(uv.xy), unpack(uv.zw));
}

// Change these 2 defines to change precision,
#define vec vec2
#define toVec(x) x.rg

//#define vec vec4
//#define toVec(x) x.rgba

#define s2(a, b)				temp = a; a = min(a, b); b = max(temp, b);
#define mn3(a, b, c)			s2(a, b); s2(a, c);
#define mx3(a, b, c)			s2(b, c); s2(a, c);

#define mnmx3(a, b, c)			mx3(a, b, c); s2(a, b);                                   // 3 exchanges
#define mnmx4(a, b, c, d)		s2(a, b); s2(c, d); s2(a, c); s2(b, d);                   // 4 exchanges
#define mnmx5(a, b, c, d, e)	s2(a, b); s2(c, d); mn3(a, c, e); mx3(b, d, e);           // 6 exchanges
#define mnmx6(a, b, c, d, e, f) s2(a, d); s2(b, e); s2(c, f); mn3(a, b, c); mx3(d, e, f); // 7 exchanges

void main() {

  vec v[9];

  // Add the pixels which make up our window to the pixel array.
  for(int dX = -1; dX <= 1; ++dX) {
    for(int dY = -1; dY <= 1; ++dY) {		
      vec2 offset = vec2(float(dX), float(dY));
		    
      // If a pixel in the window is located at (x+dX, y+dY), put it at index (dX + R)(2R + 1) + (dY + R) of the
      // pixel array. This will fill the pixel array, with the top left pixel of the window at pixel[0] and the
      // bottom right pixel of the window at pixel[N-1].
      v[(dX + 1) * 3 + (dY + 1)] = unpackuv(texture2D(u_tex, v_uv + offset/u_res));
    //   v[(dX + 1) * 3 + (dY + 1)] = texture2D(u_tex, v_uv + offset/u_res).rg;
    }
  }

  vec temp;

  // Starting with a subset of size 6, remove the min and max each time
  mnmx6(v[0], v[1], v[2], v[3], v[4], v[5]);
  mnmx5(v[1], v[2], v[3], v[4], v[6]);
  mnmx4(v[2], v[3], v[4], v[7]);
  mnmx3(v[3], v[4], v[8]);
  gl_FragColor = packuv(v[4]);
//   gl_FragColor = vec4(v[4], 0.0, 1.0);
//   gl_FragColor = vec4(1.0);
//   gl_FragColor = packuv(unpackuv(texture2D(u_tex, v_uv + offset/u_res)));
//   gl_FragColor = vec4(1.0,0.0,0.0,1.0);

}


`;