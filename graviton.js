// "use strict";

var svg = document.querySelector("svg");
var spark = document.getElementById("spark");
var trail = document.getElementById("trail");
trail.__points = [];
var spokes = spark.querySelectorAll("line");

var colors = ["red", "yellow", "orange"];

function move_spark(p) {
  spark.setAttribute("transform", "translate({0}, {1}) rotate({2})"
      .fmt(p.x, p.y, flexo.random_int(-15, 15)));
}

function sparkle() {
  for (var i = 0, n = spokes.length; i < n; ++i) {
    spokes[i].setAttribute("x1", 2 + Math.random() * 2);
    spokes[i].setAttribute("x2", 4 + Math.random() * 4);
    spokes[i].setAttribute("stroke", flexo.random_element(colors));
    spokes[i].setAttribute("stroke-opacity",
        flexo.clamp(Math.random() * 1.5, 0, 1));
  }
}

function update_trail() {
  var now = Date.now();
  var n = trail.__points.length;
  trail.__points = trail.__points.filter(function (p, i) {
    return now - p.added < 1000 && n - i < 32;
  });
  trail.setAttribute("points", trail.__points.map(function (p) {
    return p.x + " " + p.y;
  }).join(" "));
}

function reset_trail(p) {
  trail.__points = [];
  if (p) {
    move_trail(p);
  }
}

function move_trail(p) {
  p.added = Date.now();
  trail.__points.push(p);
}

function update() {
  sparkle();
  update_trail();
  flexo.request_animation_frame(update);
}

function clamp_svg_point(e) {
  var p = flexo.event_svg_point(e, svg);
  p.x = flexo.clamp(p.x, 0, 480);
  p.y = flexo.clamp(p.y, 0, 320);
  return p;
}

var handler = {

  handleEvent: function (e) {
    if (e.type === "mousedown" || e.type === "touchstart") {
      this.down(e);
    } else if (e.type === "mousemove" || e.type === "touchmove") {
      this.move(e);
    } else if (e.type === "mouseup" || e.type === "touchend") {
      this.up(e);
    }
  },

  down: function (e) {
    this.dragging = true;
    document.body.classList.add("dragging");
    var p = clamp_svg_point(e);
    move_spark(p);
    reset_trail(p);
  },

  move: function (e) {
    if (this.dragging) {
      var p = clamp_svg_point(e);
      move_spark(p);
      move_trail(p);
    }
  },

  up: function (e) {
    reset_trail();
    delete this.dragging;
    document.body.classList.remove("dragging");
  },

};

svg.addEventListener("mousedown", handler, false);
document.addEventListener("mousemove", handler, false);
document.addEventListener("mouseup", handler, false);
svg.addEventListener("touchstart", handler, false);
svg.addEventListener("touchmove", handler, false);
svg.addEventListener("touchend", handler, false);

flexo.request_animation_frame(update);
