function run_pattern(canvasId) {
  // GLOBALS

  var IS_BLUR = false;
  var IS_UI = false;

  var IS_VIDEO;
  var SOURCE;
  var IMAGE_SOURCE;
  var VIDEO_SOURCE;
  var INPUT;

  // LOAD FILES

  function check_image(fname) {
    var ext = fname.split('.').pop();
    switch (ext.toLowerCase()) {
      case "jpg":
      case "jpeg":
      case "png":
      return true;
    }
    return false;
  }

  function check_video(fname) {
    var ext = fname.split('.').pop();
    switch (ext.toLowerCase()) {
      case "mov":
      case "mp4":
      case "avi":
      return true;
    }
    return false;
  }

  function load_image(gl, tex, url) {
    IMAGE_SOURCE.src = url;
    IMAGE_SOURCE.onload = () => {
      VIDEO_SOURCE.pause();
      VIDEO_SOURCE.removeAttribute('src');
      VIDEO_SOURCE.load();
      IS_VIDEO = false;
      twgl.setTextureFromElement(gl, tex, IMAGE_SOURCE);
      SOURCE = IMAGE_SOURCE;
    };
  }

  function load_video(url) {
    VIDEO_SOURCE.src = url;
    VIDEO_SOURCE.play();
  }

  function load_texture(gl, tex, url) {
    if (check_image(url)) load_image(gl, tex, url);
    if (check_video(url)) load_video(url);
  }

  function source_size() {
    if (IS_VIDEO) return [VIDEO_SOURCE.videoWidth, VIDEO_SOURCE.videoHeight];
    return [IMAGE_SOURCE.width, IMAGE_SOURCE.height];
  }

  function init_loader() {
    IMAGE_SOURCE = new Image();
    VIDEO_SOURCE = document.createElement("video");
    VIDEO_SOURCE.playsInline = true;
    VIDEO_SOURCE.addEventListener("playing", ()=>{
      IS_VIDEO = true;
      SOURCE = VIDEO_SOURCE;
    }, true);
  }

  // Setup GL

  function setup_gl(canvas) {
    var gl = canvas.getContext("webgl");
    var arrays = {
      a_pos: {
        numComponents: 2,
        data: [-1,-1,  -1, 1,   1,-1,  -1, 1,  1,-1,   1, 1]
      },
      a_texCoord: {
        numComponents: 2,
        data: [0,0, 0,1, 1,0, 0,1, 1,0, 1,1]
      }
    }
    var programInfo = twgl.createProgramInfo(gl, [vs, fs]);
    var bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays);
    twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);
    var blurProgramInfo = undefined;
    var blurBufferInfo = undefined;
    if (IS_BLUR) {
      blurProgramInfo = twgl.createProgramInfo(gl, [vs, fs_blur]);
      blurBufferInfo = twgl.createBufferInfoFromArrays(gl, arrays);
      twgl.setBuffersAndAttributes(gl, blurProgramInfo, blurBufferInfo);
    }
    return [gl, programInfo, bufferInfo, blurProgramInfo, blurBufferInfo];
  }

  function create_textures(gl, filter_s, main_s) {
    var tex_main = twgl.createTexture(gl, {width: main_s.w, height: main_s.h});
    var tex_depth = twgl.createTexture(gl, {width: main_s.w, height: main_s.h});
    var tex_norm = twgl.createTexture(gl, {width: main_s.w, height: main_s.h});
    var tex_filter = undefined;
    var fbo_filter = undefined;
    if (IS_BLUR) {
      tex_filter = [];
      fbo_filter = [];
      for (var i = 0; i < 2; i++) {
        tex_filter.push( twgl.createTexture(gl, {width: filter_s.w, height: filter_s.h}) );
        fbo_filter.push( twgl.createFramebufferInfo(gl, [{attachment: tex_filter[i]}],  filter_s.w,  filter_s.h) );
      }
    }
    return [tex_main, tex_depth, tex_norm, tex_filter, fbo_filter];
  }

  function blur(n, gl, tex_main, tex_filter, fbo_filter, blurBufferInfo, blurProgramInfo, size_main, size_fbo) {
    if (i == 0) return tex_main;
    var fbo_index = 0;
    gl.useProgram(blurProgramInfo.program);
    var u = {
      u_tex: tex_main,
      u_texres: size_main,
      u_res: size_fbo,
      u_mode: fbo_index
    }
    for (var i = 0; i < n; i++) {
      var fbo_index_next = (fbo_index+1)%2;
      twgl.bindFramebufferInfo(gl, fbo_filter[fbo_index_next]);
      twgl.setUniforms(blurProgramInfo, u);
      twgl.drawBufferInfo(gl, blurBufferInfo);
      u.u_texres = size_fbo;
      u.u_tex = tex_filter[fbo_index_next];
      u.u_mode = i%2;
      fbo_index = fbo_index_next;
    }
    twgl.bindFramebufferInfo(gl);
    return u.u_tex;
  }

  // RUN

  var canvas = document.getElementById(canvasId);
  var [gl, programInfo, bufferInfo, blurProgramInfo, blurBufferInfo] = setup_gl(canvas);
  var [tex_main, tex_depth, tex_norm, tex_filter, fbo_filter] = create_textures(gl, {w:1024,h:1024}, {w:1024,h:1024});

  init_loader();
  // init_drop(gl, tex_main, canvas);
  load_texture(gl, tex_main, "img/1.jpg");
  DEPTH_SOURCE = new Image();
  DEPTH_SOURCE.src = "img/01db.png";
  DEPTH_SOURCE.onload = () => {
    twgl.setTextureFromElement(gl, tex_depth, DEPTH_SOURCE);
  };

  NORM_SOURCE = new Image();
  NORM_SOURCE.src = "img/05n.png";
  NORM_SOURCE.onload = () => {
    twgl.setTextureFromElement(gl, tex_norm, NORM_SOURCE);
  };

  var [INPUT, update_input] = init_input(canvas);
  // var sl_blur = add_slider("Blur", 0, 10, 0);
  // var sl_distort = add_slider("Distort", 0, 1, 0);
  // var sl_bump = add_slider("Bump", 0, 1, 0);
  // var sl_step_scale = add_slider("Step Scale", 0, 1, 1);
  // var sl_grad_scale = add_slider("Gradient Scale", 0, 0.01, 0.1);


  const m4 = twgl.m4;
  var camera = m4.identity();

  var uniforms = {};
  uniforms.u_eye = [0.0,0.0,0.0];
  var time = 0;

  px = INPUT.mouseX;
  py = INPUT.mouseY;
  vx = 0;
  vy = 0;

  canvas.width = canvas.clientWidth
  canvas.height = canvas.clientHeight
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);




  var gn = new GyroNorm();

  ga = 0;
  gb = 0;
  gg = 0;

  gn.init().then(function(){
    gn.start(function(data){
      // Process:
      ga = data.do.alpha	//( deviceorientation event alpha value )
      gb = data.do.beta		//( deviceorientation event beta value )
      gg = data.do.gamma	//( deviceorientation event gamma value )
      // data.do.absolute	( deviceorientation event absolute value )

      // data.dm.x		( devicemotion event acceleration x value )
      // data.dm.y		( devicemotion event acceleration y value )
      // data.dm.z		( devicemotion event acceleration z value )

      // data.dm.gx		( devicemotion event accelerationIncludingGravity x value )
      // data.dm.gy		( devicemotion event accelerationIncludingGravity y value )
      // data.dm.gz		( devicemotion event accelerationIncludingGravity z value )

      // data.dm.alpha	( devicemotion event rotationRate alpha value )
      // data.dm.beta		( devicemotion event rotationRate beta value )
      // data.dm.gamma	( devicemotion event rotationRate gamma value )
    });
  }).catch(function(e){
    alert("ERROR");
  });

  function render() {
    update_input();
    mstep = 0.005;
    dx = INPUT.dmouseX;
    dy = INPUT.dmouseY;

    // npx = INPUT.mouseX;
    // npy = INPUT.mouseY;
    npx = INPUT.gb;
    npy = INPUT.gg;
    vx = (npx-px)*0.1;
    vy = (npy-py)*0.1;
    px += vx;
    py += vy;

    rot_len = Math.sqrt(vx*vx+vy*vy)
    if (rot_len > 0){
      m4.axisRotate(camera, [-vy/rot_len,vx/rot_len,0], mstep*rot_len, camera);
    }
    // m4.axisRotate(camera, [1,0,0], gx*mstep, camera);


    time += 1/60;
    if (IS_VIDEO) twgl.setTextureFromElement(gl, tex_main, VIDEO_SOURCE);

    // BLUR
    var blur_tex = tex_main;
    if (IS_BLUR) {
      blur_tex = blur(sl_blur.value, gl, tex_main, tex_filter, fbo_filter, blurBufferInfo, blurProgramInfo, source_size(), [1024,1024]);
    }
    // twgl.drawBufferInfo(gl, blurBufferInfo);


    // DRAW
    uniforms.u_time = time;
    uniforms.u_cam = camera;
    // if (INPUT.drag) uniforms.u_eye[0] += INPUT.dmouseX*0.005;
    // if (INPUT.drag) uniforms.u_eye[1] += INPUT.dmouseY*0.005;
    // uniforms.u_eye[2] = INPUT.zoom;
    //
    uniforms.u_tex = tex_main;
    uniforms.u_tex_depth = tex_depth;
    uniforms.u_tex_norm = tex_norm;
    uniforms.u_offset = [INPUT.mouseX/canvas.width, INPUT.mouseY/canvas.height];
    uniforms.u_offset = [px/canvas.width, py/canvas.height];
    // console.log([INPUT.mouseX, INPUT.mouseY]);
    // uniforms.u_blur_tex = blur_tex;
    // uniforms.u_blur_tex = blur_tex;
    // uniforms.u_distort = sl_distort.value;
    // uniforms.u_distort = sl_distort.value;
    // uniforms.u_bump = sl_bump.value;
    uniforms.u_res = [canvas.width, canvas.height];
    // uniforms.u_STEP_SCALE = sl_step_scale.value;
    // uniforms.u_bgrad = sl_grad_scale.value;
    //
    // uniforms.u_scale = 1;
    // uniforms.u_fov = 1;
    // uniforms.u_lpos = 5;
    // uniforms.u_rad_in = 1;
    // uniforms.u_rad_mid = 3;
    // uniforms.u_rad_out = 4;
    // uniforms.u_phong = 0;
    // uniforms.u_MIN_DIST = 0;
    // uniforms.u_MAX_DIST = 100;
    // uniforms.u_noise_speed = 0.5;
    // uniforms.u_lookrot = 0;


    gl.useProgram(programInfo.program);
    twgl.setUniforms(programInfo, uniforms);
    twgl.drawBufferInfo(gl, bufferInfo);
  }

  function animate() {
    requestAnimationFrame(animate);
    render();
  }
  animate();
}
