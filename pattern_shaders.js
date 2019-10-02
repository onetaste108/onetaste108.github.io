var vs = `
attribute vec2 a_pos;
varying vec2 v_pos;
void main() {
  v_pos = a_pos;
  gl_Position = vec4(a_pos,0.0,1.0);
}`;



var fs = `
precision mediump float;

const float PI = 3.1415926535897932384626433832795;
varying vec2 v_pos;
uniform float u_time;
uniform mat4 u_cam;
uniform vec2 u_offset;
uniform vec2 u_res;
uniform sampler2D u_tex;
uniform sampler2D u_tex_depth;
uniform sampler2D u_tex_norm;


vec4 quat_from_axis_angle(vec3 axis, float angle)
{
  vec4 qr;
  float half_angle = (angle * 0.5) * 3.14159 / 180.0;
  qr.x = axis.x * sin(half_angle);
  qr.y = axis.y * sin(half_angle);
  qr.z = axis.z * sin(half_angle);
  qr.w = cos(half_angle);
  return qr;
}

vec3 rot(vec3 p, vec3 a)
{
  vec3 axis = normalize(a);
  float angle = length(a);
  vec4 q = quat_from_axis_angle(axis, angle);
  vec3 v = p.xyz;
  v = v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
  return p-v;
}

vec3 project(vec3 p) {
  vec3 np = normalize(p);
  float phi = atan(np.x/np.z) / PI + 0.5;
  if (np.z < 0.0) phi = 1.0 - phi;
  float th = -asin(np.y) / PI + 0.5;
  return texture2D(u_tex, vec2(phi,th)+u_offset*100.0).rgb;
}

vec2 ptouv(vec2 p) {
  vec2 uv = p/2.0 + 0.5;
  uv.y = 1.0 - uv.y;
  return uv;
}

vec3 smooth3(sampler2D tex, vec2 p, vec2 uv, float a) {
  vec3 neigbours;
  neigbours += texture2D(tex, uv+vec2(p.x, 0)).rgb;
  neigbours += texture2D(tex, uv+vec2(p.x, p.y)).rgb;
  neigbours += texture2D(tex, uv+vec2(0, p.y)).rgb;
  neigbours += texture2D(tex, uv+vec2(-p.x, p.y)).rgb;
  neigbours += texture2D(tex, uv+vec2(-p.x, 0)).rgb;
  neigbours += texture2D(tex, uv+vec2(-p.x, -p.y)).rgb;
  neigbours += texture2D(tex, uv+vec2(0, -p.y)).rgb;
  neigbours += texture2D(tex, uv+vec2(p.x, -p.y)).rgb;
  vec3 center = texture2D(tex, uv).rgb;
  return mix(center, neigbours, a);
}

void main() {
  vec2 uv = ptouv(v_pos);
  vec3 color;
  vec3 r;
  for (int x = 0; x < 4; x++) {
    for (int y = 0; y < 4; y++) {
      r = texture2D(u_tex_norm, uv+vec2(float(x),float(y))/vec2(1920.0*4.0, 1080.0*4.0)).rgb;
      r = r * 2.0 - 1.0;
      color += project(r);
    }
  }

  color /= 4.0*4.0;

  gl_FragColor = vec4(color,1.0);
}`;
