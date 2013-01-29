// "use strict";

var SVG = document.querySelector("svg");
var WIDTH = SVG.viewBox.baseVal.width;
var HEIGHT = SVG.viewBox.baseVal.height;

// Clamp the point from the event e within the screen and return the clamped
// point (an object {x : ..., y: ... })
function clamp_svg_point(e, offset) {
  var p = flexo.event_svg_point(e, SVG);
  p.x = flexo.clamp(p.x - offset.x, 0, WIDTH);
  p.y = flexo.clamp(p.y - offset.y, 0, HEIGHT);
  return p;
}

var TRAIL = document.getElementById("trail");
var TRAIL_TTL = 1200;

// Update the trail by removing all points that are over TRAIL_TTL ms old
function update_trail() {
  var now = Date.now();
  var n = TRAIL.__points.length;
  TRAIL.__points = TRAIL.__points.filter(function (p, i) {
    return now - p.added < TRAIL_TTL;
  });
  TRAIL.setAttribute("points", TRAIL.__points.map(function (p) {
    return p.x + " " + p.y;
  }).join(" "));
}

// Add a point to the trail
function trail(p) {
  p.added = Date.now();
  TRAIL.__points.push(p);
}

var SPARK = document.getElementById("spark");
var SPOKES = SPARK.querySelectorAll("line");
var MASK = SPARK.querySelector("circle");

// Update the spokes of the spark to make them flicker
function update_spokes() {
  var colors = ["red", "yellow", "orange"];
  for (var i = 0, n = SPOKES.length; i < n; ++i) {
    SPOKES[i].setAttribute("x1", 2 + Math.random() * 2);
    SPOKES[i].setAttribute("x2", 4 + Math.random() * 4);
    SPOKES[i].setAttribute("stroke", flexo.random_element(colors));
    SPOKES[i].setAttribute("stroke-opacity",
        flexo.clamp(Math.random() * 1.5, 0, 1));
  }
}

// Update the world on each animation frame
function update() {
  update_spokes();
  update_trail();
  flexo.request_animation_frame(update);
}

// Move the spark to the given point.
function move_spark(p, clear_trail) {
  SPARK.__p = p;
  SPARK.setAttribute("transform", "translate({0}, {1}) rotate({2})"
      .fmt(p.x, p.y, flexo.random_int(-15, 15)));
}

var HANDLER = {

  handleEvent: function (e) {
    if (e.type === "mousedown" || e.type === "touchstart") {
      this.down(e);
    } else if (e.type === "mousemove" || e.type === "touchmove") {
      this.move(e);
    } else if (e.type === "mouseup" || e.type === "touchend") {
      this.up(e);
    }
  },

  // Start dragging. Record the offset from where the event was in the mask so
  // that the spark does not jump when it starts moving
  down: function (e) {
    document.body.classList.add("dragging");
    var p = flexo.event_svg_point(e);
    this.offset = { x: p.x - SPARK.__p.x, y: p.y - SPARK.__p.y };
    TRAIL.__points = [];
  },

  // If offset is set, then we're dragging the spark so keep moving it
  move: function (e) {
    if (this.offset) {
      var p = clamp_svg_point(e, this.offset);
      move_spark(p);
      trail(p);
    }
  },

  // Stop dragging
  up: function (e) {
    delete this.offset;
    TRAIL.__points = [];
    document.body.classList.remove("dragging");
  }

};


// Initialize the game

move_spark({ x: WIDTH / 2, y: HEIGHT / 2 }, true);
TRAIL.__points = [];

MASK.addEventListener("mousedown", HANDLER, false);
document.addEventListener("mousemove", HANDLER, false);
document.addEventListener("mouseup", HANDLER, false);
MASK.addEventListener("touchstart", HANDLER, false);
MASK.addEventListener("touchmove", HANDLER, false);
MASK.addEventListener("touchend", HANDLER, false);

flexo.request_animation_frame(update);
