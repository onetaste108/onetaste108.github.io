var Webfx = (canvas) => {

    var gl = canvas.getContext("webgl");
    var screenResizeBinding = [];
    new ResizeObserver(() => {
        screenResizeBinding.forEach((val) => { val(); });
    }).observe(canvas);



    var bindScreenSize = (fbo, ratio) => {
        if (!ratio) ratio = 1;
        screenResizeBinding.push(() => {
            fbo.resize(Math.floor(canvas.width * ratio), Math.floor(canvas.height * ratio));
        });
    };


    var screen = {
        tex: () => console.error("Scren tex not implemented"),
        width: () => gl.canvas.width,
        height: () => gl.canvas.height,
        size: () => [gl.canvas.width, gl.canvas.height],
        fbo: () => null,
        swap: () => { }
    }

    var empty = {
        tex: () => null,
        width: () => null,
        height: () => null,
        size: () => null,
        fbo: () => null,
        swap: () => { }
    }



    var Source = (e) => {
        var _element = e;
        var _ready = false;
        var _width, _height;
        var element = () => _element;
        var ready = () => _ready;
        var width = () => _width;
        var height = () => _height;
        var setReady = (val) => _ready = val;
        var setWidth = (val) => _width = val;
        var setHeight = (val) => _height = val;
        return {
            element: element,
            ready: ready,
            width: width,
            height: height,
            setReady: setReady,
            setWidth: setWidth,
            setHeight: setHeight
        };
    };



    var Tex = () => {
        var _texture = twgl.createTexture(gl, { width: 1, height: 1, minMag: gl.LINEAR });
        var _width = 1;
        var _height = 1;
        var _source = null;
        var _update = () => {
            twgl.setTextureFromElement(gl, _texture, _source.element());
            _width = _source.width();
            _height = _source.height();
        }
        var tex = () => _texture;
        var width = () => _width;
        var height = () => _height;
        var size = () => [_width, _height];
        var setSource = (source) => {
            _source = source;
        }
        var update = () => {
            if (_source && _source.ready()) _update();
        }
        return {
            tex: tex,
            width: width,
            height: height,
            size: size,
            setSource: setSource,
            update: update
        };
    };


    var FBO = (w, h) => {
        var self = {};
        if (w == "screen") {
            bindScreenSize(self, h ? h : 0 );
            w = 1; h=1;
        }
        var _frameBufferInfo = twgl.createFramebufferInfo(gl, null, w, h);
        self.tex = () => _frameBufferInfo.attachments[0];
        self.width = () => _frameBufferInfo.width;
        self.height = () => _frameBufferInfo.height;
        self.size = () => [_frameBufferInfo.width, _frameBufferInfo.height];
        self.resize = (w, h) => {
            twgl.resizeFramebufferInfo(gl, _frameBufferInfo, null, w, h);
        };
        self.fbo = () => _frameBufferInfo;
        self.swap = () => { };
        return self;
    };


    var DFBO = (w, h) => {
        var _fbo1 = FBO(w, h);
        var _fbo2 = FBO(w, h);
        var resize = (w, h) => { _fbo1.resize(w, h); _fbo2.resize(w, h); }
        var width = _fbo1.width;
        var height = _fbo1.height;
        var size = _fbo1.size;
        var swap = () => {
            var temp = _fbo1;
            _fbo1 = _fbo2;
            _fbo2 = temp;
        };
        var tex = () => _fbo2.tex();
        var fbo = () => _fbo1.fbo();
        return {
            resize: resize,
            width: width,
            height: height,
            size: size,
            tex: tex,
            fbo: fbo,
            swap: swap
        };
    };


    var Program = (vs, fs, defaults) => {
        if (!defaults) defaults = {};
        var prog = twgl.createProgramInfo(gl, [vs, fs]);
        var arrays = {
            a_pos: [-1, -1, 0, 1, -1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1, 1, 0],
        };
        var buffer = twgl.createBufferInfoFromArrays(gl, arrays);
        twgl.setBuffersAndAttributes(gl, prog, buffer);
        var render = (target, textures, uniforms) => {
            if (!uniforms) uniforms = {};
            gl.useProgram(prog.program);
            uniforms["u_res"] = target.size();
            for (var i = 0; i < textures.length; i++) {
                uniforms["u_tex" + i.toString()] = textures[i].tex();
                uniforms["u_tex" + i.toString() + "res"] = textures[i].size();
            }
            twgl.setUniforms(prog, defaults);
            twgl.setUniforms(prog, uniforms);
            twgl.bindFramebufferInfo(gl, target.fbo());
            twgl.drawBufferInfo(gl, buffer);
            target.swap();
        };
        return { render: render };
    };

    return {
        screen: screen,
        empty: empty,
        bindScreenSize: bindScreenSize,

        Source: Source,
        Tex: Tex,
        FBO: FBO,
        DFBO: DFBO,
        Program: Program
    }
}