// "use strict";

// Squared distance between two points
function distance_squared(u, v) {
  var dx = u.x - v.x;
  var dy = u.y - v.y;
  return (dx * dx) + (dy * dy);
}

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

var DISTANCE_THRESHOLD = 1;

// Check whether the first segment in a polyline intersect any of the following
// segments
// TODO skip if the last segment is not long enough (starting to zag)
function intersect_polyline(points) {
  for (var n = points.length, i = 0, p; i < n - 3; ++i) {
    p = intersect(points[n - 1], points[n - 2], points[i], points[i + 1]);
    if (p) {
      p.i = i + 1;
      return p;
    }
  }
  return p;
}

var SVG = document.querySelector("svg");
var WIDTH = SVG.viewBox.baseVal.width;
var HEIGHT = SVG.viewBox.baseVal.height;

// Get an SVG point for the event in the context of an SVG element (or the
// closest svg element by default)
function svg_point(e) {
  var p = SVG.createSVGPoint();
  p.x = e.pointerList[0].clientX;
  p.y = e.pointerList[0].clientY;
  try {
    return p.matrixTransform(SVG.getScreenCTM().inverse());
  } catch(e) {}
};

// Clamp the point from the event e within the screen and return the clamped
// point (an object {x : ..., y: ... })
function clamp_svg_point(e, offset) {
  var p = svg_point(e);
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

// Add a point to the trail. If it's too close to the previous point, remove it
// (we avoid spurious self-intersections this way)
function trail(p) {
  if (TRAIL.__frozen) {
    return;
  }
  var n = TRAIL.__points.length;
  if (n > 0) {
    var q = TRAIL.__points[n - 1];
    var d = distance_squared(p, q);
    /*if (n > 1) {
      var r = TRAIL.__points[n - 2];
      var u = { x: p.x - q.x, y: p.y - q.y };
      var v = { x: r.x - q.x, y: r.y - q.y };
      var lu = Math.sqrt(distance_squared(p, q));
      var lv = Math.sqrt(distance_squared(q, r));
      if (lu > 0 && lv > 0) {
        var cos = Math.abs(((u.x * v.x) + (u.y * v.y)) / (lu * lv));
      }
    }*/
    if (d < DISTANCE_THRESHOLD) {
      TRAIL.__points.pop();
    }
  }
  p.added = Date.now();
  TRAIL.__points.push(p);
  check_closed_loop();
}

var ENEMIES = document.getElementById("enemies");

function capture_enemies() {
  for (var i = SPRITES.length - 1; i >= 0; --i) {
    var elem = SPRITES[i].elem;
    var rect = elem.getBoundingClientRect(elem);
    var e = document.elementFromPoint(rect.left + rect.width / 2,
        rect.top + rect.height / 2);
    if (e === TRAIL) {
      flexo.safe_remove(elem);
      flexo.remove_from_array(SPRITES, SPRITES[i]);
    }
  }
}

// Check that the loop was closed. If it was, trim the trail and check for
// enemies inside the trail
function check_closed_loop() {
  var p = intersect_polyline(TRAIL.__points);
  if (p) {
    TRAIL.setAttribute("fill", "yellow");
    TRAIL.__frozen = Date.now();
    TRAIL.__points = TRAIL.__points.slice(p.i);
    TRAIL.__points[TRAIL.__points.length - 1] = p;
    TRAIL.setAttribute("points", TRAIL.__points.map(function (p) {
      return p.x + " " + p.y;
    }).join(" "));
    capture_enemies();
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

var SPRITES = [];
var T0 = Date.now();

// Update the world on each animation frame
function update() {
  update_spokes();
  update_trail();
  var t = Date.now();
  var dt = (t - T0) / 1000;
  T0 = t;
  for (var i = 0, n = SPRITES.length; i < n; ++i) {
    SPRITES[i].update(dt);
  }
  if (SPARK.__alive) {
    flexo.request_animation_frame(update);
  }
}

// Move the spark to the given point.
function move_spark(p) {
  SPARK.__p = p;
  SPARK.setAttribute("transform", "translate({0}, {1}) rotate({2})"
      .fmt(p.x, p.y, flexo.random_int(-15, 15)));
}


// Sprites

function init_number_property(obj, prop, n) {
  if (typeof obj[prop] !== "number") {
    obj[prop] = n;
  }
}

function distance_to_segment_squared(p, v, w) {
  var l2 = distance_squared(v, w);
  if (l2 === 0) {
    return distance_squared(p, v);
  }
  var t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  if (t < 0) {
    return distance_squared(p, v);
  }
  if (t > 1) {
    return distance_squared(p, w);
  }
  return distance_squared(p,
      { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) });
}

function cut_trail(sprite) {
  var dist = Infinity;
  for (var i = 0, n = TRAIL.__points.length; i < n - 1; ++i) {
    var p = TRAIL.__points[i];
    var q = TRAIL.__points[i + 1];
    var d = distance_to_segment_squared(sprite, p, q);
    if (d < dist) {
      dist = d;
    }
  }
  return dist < (sprite.radius * sprite.radius);
}

var SPRITE = {

  init: function (elem) {
    Object.defineProperty(this, "elem", { enumerable: true,
      get: function () { return elem; }
    });
    var h;
    Object.defineProperty(this, "h", { enumerable: true,
      get: function () { return h; },
      set: function (h_) {
        h = (h_ + 360) % 360;
        this.th = h / 180 * Math.PI;
      }
    });
    init_number_property(this, "x", 0);
    init_number_property(this, "y", 0);
    init_number_property(this, "r", 0);
    init_number_property(this, "s", 1);
    init_number_property(this, "h", 0);
    init_number_property(this, "a", 0);
    init_number_property(this, "v", 0);
    init_number_property(this, "vmin", -Infinity);
    init_number_property(this, "vmax", Infinity);
    init_number_property(this, "vh", 0);
    init_number_property(this, "vr", 0);
    return this;
  },

  update: function (dt) {
    this.v = flexo.clamp(this.v + this.a * dt, this.vmin, this.vmax);
    this.h += this.vh * dt;
    this.r += this.vr * dt;
    this.x += this.v * Math.cos(this.th) * dt;
    this.y += this.v * Math.sin(this.th) * dt;
    if (this.x < this.radius || this.x > WIDTH - this.radius) {
      this.h = 180 - this.h;
    } else if (this.y < this.radius || this.y > HEIGHT - this.radius) {
      this.h = -this.h;
    }
    this.x = flexo.clamp(this.x, this.radius, WIDTH - this.radius);
    this.y = flexo.clamp(this.y, this.radius, HEIGHT - this.radius);
    if (this.elem) {
      this.elem.setAttribute("transform",
          "translate({0}, {1}) rotate({2}) scale({3})"
          .fmt(this.x, this.y, this.r, this.s));
      if (this.radius > 1) {
        if (distance_squared(this, SPARK.__p) < SPARK.__radius) {
          delete SPARK.__alive;
        }
        if (cut_trail(this)) {
          TRAIL.__points = [];
        }
      }
    }
  },

};

var HANDLER = {

  handleEvent: function (e) {
    if (!SPARK.__alive) {
      return;
    }
    if (e.type === vs.POINTER_START) {
      document.body.classList.add("dragging");
      var p = svg_point(e);
      this.offset = { x: p.x - SPARK.__p.x, y: p.y - SPARK.__p.y };
      TRAIL.__points = [];
    } else if (this.offset) {
      if (e.type === vs.POINTER_MOVE) {
        var p = clamp_svg_point(e, this.offset);
        move_spark(p);
        trail(p);
      } else {
        delete this.offset;
        TRAIL.__points = [];
        document.body.classList.remove("dragging");
      }
    }
  },

};


// Initialize the game

var COLORS = ["silver", "white", "maroon", "red", "purple", "fuchsia", "green",
    "lime", "navy", "blue", "teal", "aqua"];

var SHAPES = [
  function () { return flexo.$circle({ r: 4 }); },
  function () { return flexo.svg_star(5, 2, 5, Math.random()); },
  function () { return flexo.svg_polygon(3, 4, Math.random()); },
  function () { return flexo.svg_polygon(4, 4, Math.random()); },
  function () { return flexo.svg_polygon(5, 4, Math.random()); },
  function () { return flexo.svg_polygon(6, 4, Math.random()); },
];

for (var i = 0; i < 6; ++i) {
  var color = flexo.random_element(COLORS);
  var enemy = Object.create(SPRITE).init(flexo.random_element(SHAPES)());
  enemy.elem.setAttribute("fill", color);
  enemy.radius = 4;
  enemy.x = flexo.random_int(0, WIDTH);
  enemy.y = flexo.random_int(0, HEIGHT);
  enemy.h = flexo.random_int(0, 360);
  enemy.v = 60;
  ENEMIES.appendChild(enemy.elem);
  SPRITES.push(enemy);
  for (var j = 0; j < 4; ++j) {
    var en = Object.create(SPRITE).init(flexo.$circle({ fill: color, r: 1 }));
    en.radius = 1;
    en.x = enemy.x;
    en.y = enemy.y;
    en.h = flexo.random_int(0, 360);
    en.v = 50;
    ENEMIES.appendChild(en.elem);
    SPRITES.push(en);
  }
}

TRAIL.__points = [];
SPARK.__radius = 36;
SPARK.__alive = true;
move_spark({ x: WIDTH / 2, y: HEIGHT / 2 }, true);

document.addEventListener("touchstart", function (e) {
  e.preventDefault();
}, false);
vs.addPointerListener(MASK, vs.POINTER_START, HANDLER, false);
vs.addPointerListener(document, vs.POINTER_MOVE, HANDLER, false);
vs.addPointerListener(document, vs.POINTER_END, HANDLER, false);

flexo.request_animation_frame(update);
