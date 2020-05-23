#ifdef UV_TEX
uniform sampler2D uv;
#endif
 
uniform sampler2D Ix1;
uniform sampler2D Iy1;
uniform sampler2D I1, I2;
 
void main() {
   const float hw = float(windowSize / 2);
   float G0, G1, G2;
   float y = gl_TexCoord[0].y * texHeight;
   float x = gl_TexCoord[0].x * texWidth;
   vec2 invdim = 1.0 / vec2(texWidth, texHeight);
 
#ifdef UV_TEX
   vec2 uv = 2.0*texture2D(uv, (gl_TexCoord[0].st + vec2(0.5*PREV_W, 0.5*PREV_H))).xy;
#else
   vec2 uv = vec2(0.0, 0.0);
#endif
   G0 = 0.0045; G1 = 0.0; G2 = 0.0045; //prevent div by zero
   for(int j=0; j<nIterations; j++) { //for num iterations
       float xleft_w = y-hw+uv.y, ytop_w = x-hw+uv.x;
       float v0 = 0.0; float v1 = 0.0; //image mismatch vector
       float xleft = x-hw; float ytop = y-hw;
       for(int k=1; k<=windowSize; k++) {
           float x1 = xleft+float(k)+0.5;
           float x2 = ytop_w+float(k)+0.5;
           for(int l=1; l<=windowSize;l++) {
                float y1 = ytop+float(l)+0.5;
                float y2 = xleft_w+float(l)+0.5;
                //if we just have this in 1 rgba texture we could reduce this to one tex lookup?
                float A_t1 = texture2D(Ix1, vec2(x1,y1)*invdim);
                float A_t2 = texture2D(Iy1, vec2(x1,y1)*invdim);
                float dI   = texture2D(I1, vec2(x1,y1)*invdim) -
                             texture2D(I2, vec2(x2,y2)*invdim);
                if(j==0) { //compute G
                    G0 += A_t1*A_t1; //Ix^2
                    G1 += A_t1*A_t2; //Ixy
                    G2 += A_t2*A_t2; //Iy^2
                }
 
                v0 += A_t1 * dI; v1 += A_t2 * dI; //image mismatch vector
           }
           float det_inv = 1.0 / (G0 * G2 - G1 * G1);
           float G00 = G0;
           G0 = G2 * det_inv;  G1 *= -det_inv; G2 = G00 * det_inv; //G^-1
       }
       //v^k=v^k-1+(G^-1b_k)
       uv.x += v0*G0+v1*G1;
       uv.y += v0*G1+v1*G2;
   }
#ifdef EIGEN
   float e00 = (G0+G2) * 0.5f + sqrt(((G0+G2)*(G0+G2))*0.25f+G1*G1-G0*G2);
   float e01 = (G0+G2) * 0.5f - sqrt(((G0+G2)*(G0+G2))*0.25f+G1*G1-G0*G2);
   float e10 = (G0+G2) * 0.5f + sqrt(4*G1*G1+(G0-G2)*(G0-G2))*0.5f;
   float e11 = (G0+G2) * 0.5f - sqrt(4*G1*G1+(G0-G2)*(G0-G2))*0.5f;
   gl_FragColor = vec4(uv.x, uv.y,min(min(min(e00, e01), e10), e11), 0.0);
#else
   gl_FragColor = vec4(uv.x, uv.y, 0.0,0.0);
#endif
}
