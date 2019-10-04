var vs = `
attribute vec2 a_pos;
varying vec2 v_pos;
void main() {
  v_pos = a_pos;
  gl_Position = vec4(a_pos,0.0,1.0);
}`;



var fs = `
precision mediump float;

varying vec2 v_pos;

uniform float u_time; // Время, в любом формате
uniform int u_mode; // Режим: 0 - компьютер (мышка), 1 - телефон (гироскоп)
uniform mat3 u_gyro; // Матрица ориентации телефона
uniform vec2 u_mouse; // Положение мышки, можно сглаженное, нормализованное
uniform vec2 u_res; // разрешение канваса
uniform sampler2D u_tex0; // Текстуры
uniform sampler2D u_tex1;
uniform sampler2D u_tex2;

const float PI = 3.1415926535897932384626433832795;

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
  return texture2D(u_tex0, vec2(phi,th)+u_mouse*100.0).rgb;
}

vec2 ptouv(vec2 p) {
  vec2 uv = p/2.0 + 0.5;
  uv.y = 1.0 - uv.y;
  return uv;
}


void main() {
  vec2 uv = ptouv(v_pos);
  vec3 color;
  vec3 r;
  for (int x = 0; x < 2; x++) {
    for (int y = 0; y < 2; y++) {
      r = texture2D(u_tex1, uv+vec2(float(x),float(y))/vec2(1920.0*2.0, 1080.0*2.0)).rgb;
      r = r * 2.0 - 1.0;
      color += project(r);
    }
  }

  color /= 2.0*2.0;

  gl_FragColor = vec4(color,1.0);
}`;
