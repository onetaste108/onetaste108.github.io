console.log("Flow");
video = document.getElementById("video");
displayCanvas = document.getElementById("canvas");

displayCtx = canvas.getContext("2d");

var frameGrabber = (videoElement) => {
    var canvasWidth = 256;
    var canvasHeight = 256;
    var canvas = document.createElement("canvas");
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    var ctx = canvas.getContext("2d");
    var grab = () => {
        ctx.drawImage(videoElement, 0, 0, canvasWidth, canvasHeight);
        return canvas;
    }
    return grab;
}


var initComputeShader = () => {
    var width = 256;
    var height = 256;
    // var canvas = document.createElement("canvas");
    var canvas = document.getElementById("computeCanvas");
    canvas.width = width;
    canvas.height = height;
    var gl = canvas.getContext("webgl");
    var programInfo = twgl.createProgramInfo(gl, [computeVS, computeFS]);
    var derivProgramInfo = twgl.createProgramInfo(gl, [computeVS, derivFS]);
    var plainProg = twgl.createProgramInfo(gl, [computeVS, plainFS]);
    var plainUVProg = twgl.createProgramInfo(gl, [computeVS, plainUVFS]);
    var blurProg = twgl.createProgramInfo(gl, [computeVS, blur5FS]);
    var warpProg = twgl.createProgramInfo(gl, [computeVS, warpFS]);
    var medianProg = twgl.createProgramInfo(gl, [computeVS, medianFS]);
    const arrays = {
        a_pos: [-1, -1, 0, 1, -1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1, 1, 0],
    };
    const bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays);


    gl.useProgram(programInfo.program);
    twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);

    var warpFbo1 = twgl.createFramebufferInfo(gl, null, width*4, height*4);
    var warpFbo2 = twgl.createFramebufferInfo(gl, null, width*4, height*4);
    
    var warp = (uv, scale) => {
        gl.useProgram(warpProg.program);
        twgl.setUniforms(warpProg, {
            u_tex: warpFbo1.attachments[0],
            u_UV: uv,
            u_scale: scale,
            u_res: [warpFbo1.width, warpFbo1.height],
        })
        twgl.bindFramebufferInfo(gl, warpFbo2);
        twgl.drawBufferInfo(gl, bufferInfo);
        var tmp = warpFbo1;
        warpFbo1 = warpFbo2;
        warpFbo2 = tmp;
    }
    var warpSet = (tex) => {
        gl.useProgram(plainProg.program);
        twgl.setUniforms(plainProg, {
            u_tex: tex,
            u_flip: false
        })
        twgl.bindFramebufferInfo(gl, warpFbo2);
        twgl.drawBufferInfo(gl, bufferInfo);
        var tmp = warpFbo1;
        warpFbo1 = warpFbo2;
        warpFbo2 = tmp;
    }

    var medianFbo1 = twgl.createFramebufferInfo(gl, null, width, height);
    var medianFbo2 = twgl.createFramebufferInfo(gl, null, width, height);

    var median = () => {
        gl.useProgram(medianProg.program);
        twgl.setUniforms(medianProg, {
            u_tex: medianFbo1.attachments[0],
            u_res: [medianFbo1.width, medianFbo1.height],
        })
        twgl.bindFramebufferInfo(gl, medianFbo2);
        twgl.drawBufferInfo(gl, bufferInfo);
        var tmp = medianFbo1;
        medianFbo1 = medianFbo2;
        medianFbo2 = tmp;
    };

    var blit = (tex, target) => {
        gl.useProgram(plainProg.program);
        twgl.setUniforms(plainProg, {
            u_tex: tex,
            u_flip: false
        })
        twgl.bindFramebufferInfo(gl, target);
        twgl.drawBufferInfo(gl, bufferInfo);
    };
    

    var previousFrame = twgl.createTexture(gl, null, {minMag: gl.LINEAR});
    var currentFrame = twgl.createTexture(gl, null, {minMag: gl.LINEAR});

    var grab = frameGrabber(video);

    var buildPyramid = (width, height, levels, scale) => {
        var frames = [];
        var derivs = [];
        var uvs = [];
        var w = width;
        var h = height;
        for (var i = 0; i < levels; i++) {
            var frame1 = twgl.createFramebufferInfo(gl, null, w, h);
            var frame1_ = twgl.createFramebufferInfo(gl, null, w, h);
            var frame2 = twgl.createFramebufferInfo(gl, null, w, h);
            var frame2_ = twgl.createFramebufferInfo(gl, null, w, h);
            var deriv = twgl.createFramebufferInfo(gl, null, w, h);
            var uv = twgl.createFramebufferInfo(gl, null, w, h);
            frames.push([[frame1, frame1_], [frame2, frame2_]]);
            derivs.push(deriv);
            uvs.push(uv);
            w = Math.floor(w / scale);
            h = Math.floor(h / scale);
        }
        return {frames: frames, derivs: derivs, uvs: uvs, levels: levels, scale: scale}
    }

    var pyr = buildPyramid(256, 256, 2, 4);

    var blur = (fbo1, fbo2) => {
        gl.useProgram(blurProg.program);

        twgl.setUniforms(blurProg, {
            u_tex: fbo1.attachments[0],
            u_res: [fbo1.width, fbo1.height],
            u_dir: [1, 0]
        });
        twgl.bindFramebufferInfo(gl, fbo2);
        twgl.drawBufferInfo(gl, bufferInfo);

        twgl.setUniforms(blurProg, {
            u_tex: fbo2.attachments[0],
            u_res: [fbo1.width, fbo1.height],
            u_dir: [0, 1]
        });
        twgl.bindFramebufferInfo(gl, fbo1);
        twgl.drawBufferInfo(gl, bufferInfo);
    }

    var propagateFrames = () => {
        for (var j = 0; j < 2; j++) {
            for (var i = 0; i < pyr.levels; i++) {
                gl.useProgram(plainProg.program);
                if (i==0) {
                    if (j == 0) {
                        twgl.setUniforms(plainProg, {u_tex: previousFrame, u_flip: false});
                    } else {
                        twgl.setUniforms(plainProg, {u_tex: currentFrame, u_flip: false});
                    }
                } else {
                    twgl.setUniforms(plainProg, {
                        u_tex: pyr.frames[i-1][j][0].attachments[0],
                        u_flip: false
                    });
                }
                twgl.bindFramebufferInfo(gl, pyr.frames[i][j][0]);
                twgl.drawBufferInfo(gl, bufferInfo);
                for (var k = 0; k < 10; k++) {
                    blur(pyr.frames[i][j][0], pyr.frames[i][j][1]);
                }
            }
        }
    }

    var propagateDerivs = () => {
        gl.useProgram(derivProgramInfo.program);
        for (var i = 0; i < pyr.levels; i++) {
            twgl.setUniforms(derivProgramInfo, {
                u_tex: pyr.frames[i][0][0].attachments[0],
                u_res: [pyr.frames[i][0][0].width, pyr.frames[i][0][0].height]
            })
            twgl.bindFramebufferInfo(gl, pyr.derivs[i]);
            twgl.drawBufferInfo(gl, bufferInfo);
        }
    }

    var propagateUVs = () => {
        gl.useProgram(programInfo.program);
        for (var i = pyr.levels-1; i >= 0; i--) {
            var isFirst = i==pyr.levels-1;
            if (!isFirst) {
                twgl.setUniforms(programInfo, {u_UV: pyr.uvs[i+1].attachments[0]});
            } else {
                twgl.setUniforms(programInfo, {u_UV: null});
            }
            twgl.setUniforms(programInfo, {
                u_I1: pyr.frames[i][0][0].attachments[0],
                u_I2: pyr.frames[i][1][0].attachments[0],
                u_D1: pyr.derivs[i].attachments[0],
                u_res: [pyr.frames[i][0][0].width, pyr.frames[i][0][0].height],
                u_isFirst: isFirst,
                u_level: i,
                u_pyrScale: pyr.scale
            })
            twgl.bindFramebufferInfo(gl, pyr.uvs[i]);
            twgl.drawBufferInfo(gl, bufferInfo);
        }
    }


    var updateFrames = () => {
        var tmp = previousFrame;
        previousFrame = currentFrame;
        currentFrame = tmp;
        twgl.setTextureFromElement(gl, currentFrame, grab());
    }

    updateFrames();
    canvas.addEventListener("click", ()=>{ warpSet(currentFrame); console.log("Reset")});
    video.addEventListener("play", ()=>{ warpSet(currentFrame); console.log("Reset")});
    warpSet(currentFrame);

    var show = (tex) => {
        gl.useProgram(plainProg.program);
        twgl.setUniforms(plainProg, {
            u_tex: tex,
            u_flip: true
        })
        twgl.bindFramebufferInfo(gl);
        twgl.drawBufferInfo(gl, bufferInfo);
    }

    var showuv = (tex) => {
        gl.useProgram(plainUVProg.program);
        twgl.setUniforms(plainUVProg, {
            u_tex: tex,
            u_flip: true
        })
        twgl.bindFramebufferInfo(gl);
        twgl.drawBufferInfo(gl, bufferInfo);
    }
    
    var render = () => {
        updateFrames();
        
        propagateFrames();
        propagateDerivs();
        propagateUVs();

        // blit(currentFrame, medianFbo1);
        blit(pyr.uvs[0].attachments[0], medianFbo1);
        for (var i = 0; i < 0; i++) {
            median();
        }
        
        
        warp(medianFbo1.attachments[0], 4);
        
        show(pyr.frames[0][0][0].attachments[0]);
        show(pyr.derivs[0].attachments[0]);
        // showuv(pyr.uvs[0].attachments[0]);
        showuv(medianFbo1.attachments[0]);
        // show(medianFbo1.attachments[0]);
        displayCtx.drawImage(canvas, 0, 0, displayCanvas.width, displayCanvas.height);
        show(warpFbo1.attachments[0])



        requestAnimationFrame(render);
    }
    render();
}





initComputeShader();