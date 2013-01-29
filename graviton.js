// "use strict";

// Cross product of two vectors u and v
function cross_product(u, v) {
  return (u.x * v.y) - (u.y * v.x);
}

// Intersect segment p, p_ with segment q, q_. Return the coordinates of the
// intersection point if it exists, otherwise undefined
// cf. http://stackoverflow.com/questions/563198/
function intersect(p, p_, q, q_) {
  var r = { x: p_.x - p.x, y: p_.y - p.y };
  var s = { x: q_.x - q.x, y: q_.y - q.y };
  var rs = cross_product(r, s);
  if (rs !== 0) {
    var qp = { x: q.x - p.x, y: q.y - p.y };
    var t = cross_product(qp, s) / rs;
    if (t >= 0 && t <= 1) {
      var u = cross_product(qp, r) / rs;
      if (u >= 0 && u <= 1) {
        return { x: p.x + (t * r.x), y: p.y + (t * r.y) };
      }
    }
  }
}

// Check whether the first segment in a polyline intersect any of the following
// segments
// TODO simplify the line to make segments bigger?
// TODO remove extra segments before closing the polyline
function intersect_polyline(points) {
  for (var n = points.length, i = 0, p; i < n - 3; ++i) {
    p = intersect(points[n - 1], points[n - 2], points[i], points[i + 1]);
    if (p) {
      /*SVG.appendChild(flexo.$line({ x1: points[n - 1].x, y1: points[n - 1].y,
        x2: points[n - 2].x, y2: points[n - 2].y, stroke: "blue" }));
      SVG.appendChild(flexo.$line({ x1: points[i].x, y1: points[i].y,
        x2: points[i + 1].x, y2: points[i + 1].y, stroke: "green" }));*/
      p.i = i;
      return p;
    }
  }
  return p;
}

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
var TRAIL_TTL = 900;
var TRAIL_FREEZE = 250;

// Update the trail by removing all points that are over TRAIL_TTL ms old
function update_trail() {
  var now = Date.now();
  if (TRAIL.__frozen) {
    if (now - TRAIL.__frozen > TRAIL_FREEZE) {
      TRAIL.__points = [];
      TRAIL.setAttribute("fill", "none");
      delete TRAIL.__frozen;
    } else {
      return;
    }
  }
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
  if (TRAIL.__frozen) {
    return;
  }
  p.added = Date.now();
  TRAIL.__points.push(p);
  var p = intersect_polyline(TRAIL.__points);
  if (p) {
    TRAIL.setAttribute("fill", "yellow");
    TRAIL.__frozen = Date.now();
    var enemy = document.getElementById("enemy");
    if (enemy) {
      var rect = enemy.getBoundingClientRect(enemy);
      var e = document.elementFromPoint(rect.left + rect.width / 2,
          rect.top + rect.height / 2);
      if (e === TRAIL) {
        flexo.safe_remove(enemy);
      }
    }
  }
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
function move_spark(p) {
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

  /*
  down: function (e) {
    var p = flexo.event_svg_point(e);
    move_spark(p);
    trail(p);
  },
  */

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

TRAIL.__points = [];
move_spark({ x: WIDTH / 2, y: HEIGHT / 2 }, true);

SVG.addEventListener("mousedown", HANDLER, false);
document.addEventListener("mousemove", HANDLER, false);
document.addEventListener("mouseup", HANDLER, false);
MASK.addEventListener("touchstart", HANDLER, false);
MASK.addEventListener("touchmove", HANDLER, false);
MASK.addEventListener("touchend", HANDLER, false);

flexo.request_animation_frame(update);
