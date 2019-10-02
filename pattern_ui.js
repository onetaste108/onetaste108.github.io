function init_input(canvas) {
  INPUT = {
    mouseX: 0,
    mouseY: 0,
    pmouseX: 0,
    pmouseY: 0,
    dmouseX: 0,
    dmouseY: 0,
    zoom: 0,

    w: false,
    s: false,
    a: false,
    d: false
  }

  var mouseDown = function(e) {
    INPUT.drag = true;
    INPUT.pmouseX = e.clientX;
    INPUT.pmouseY = e.clientY;
    INPUT.mouseX = e.clientX;
    INPUT.mouseY = e.clientY;
    INPUT.mouseX = e.clientX;
    INPUT.mouseY = e.clientY;
    INPUT.dmouseX = 0;
    INPUT.dmouseY = 0;
    e.preventDefault();
    return false;
  };

  var mouseUp = function(e) {
    INPUT.drag = false;
    INPUT.dmouseX = 0;
    INPUT.dmouseY = 0;
  };

  var mouseMove = function(e) {
    // if (!INPUT.drag) return false;
    INPUT.mouseX = e.clientX;
    INPUT.mouseY = e.clientY;
  };

  update_input = function() {
    INPUT.dmouseX = INPUT.mouseX - INPUT.pmouseX;
    INPUT.dmouseY = INPUT.mouseY - INPUT.pmouseY;
    INPUT.pmouseX = INPUT.mouseX;
    INPUT.pmouseY = INPUT.mouseY;
  }

  var key_down = (e) => {
    if (e.code == "KeyW") INPUT.w = true;
    if (e.code == "KeyA") INPUT.a = true;
    if (e.code == "KeyS") INPUT.s = true;
    if (e.code == "KeyD") INPUT.d = true;
  }

  var key_up = (e) => {
    if (e.code == "KeyW") INPUT.w = false;
    if (e.code == "KeyA") INPUT.a = false;
    if (e.code == "KeyS") INPUT.s = false;
    if (e.code == "KeyD") INPUT.d = false;
  }

  document.addEventListener("keydown", key_down, false);
  document.addEventListener("keyup", key_up, false);

  window.addEventListener("mousedown", mouseDown, false);
  window.addEventListener("mouseup", mouseUp, false);
  window.addEventListener("mouseout", mouseUp, false);
  window.addEventListener("mousemove", mouseMove, false);
  window.addEventListener("wheel", event => INPUT.zoom+=(event.deltaY/Math.abs(event.deltaY)));

  return [INPUT, update_input];
}
