(function ($) {
  "use strict";

  $.DISTANCE_THRESHOLD = 1;
  $.SPARK_RADIUS = 36
  $.TRAIL_TTL = 900;
  $.TRAIL_FREEZE = 250;
  $.COLORS = ["silver", "white", "maroon", "red", "purple", "fuchsia", "green",
    "lime", "navy", "blue", "teal", "aqua"];
  $.SHAPES = [
    function () { return flexo.$circle({ r: 4 }); },
    function () { return flexo.$star(5, 2, 5, Math.random()); },
    function () { return flexo.$poly(3, 4, Math.random()); },
    function () { return flexo.$poly(4, 4, Math.random()); },
    function () { return flexo.$poly(5, 4, Math.random()); },
    function () { return flexo.$poly(6, 4, Math.random()); },
  ];

  // A sprite, encapsulating an SVG element
  $.Sprite = function (level, elem) {
    flexo.make_readonly(this, "level", level);
    flexo.make_readonly(this, "elem", elem);
    flexo.make_property(this, "h", function (h) {
      h = (h + 360) % 360;
      this.th = h / 180 * Math.PI;
      return h;
    });
    init_number_property(this, "x", 0);             // x position
    init_number_property(this, "y", 0);             // y position
    init_number_property(this, "r", 0);             // rotation
    init_number_property(this, "s", 1);             // scale
    init_number_property(this, "h", 0);             // heading (radians)
    init_number_property(this, "a", 0);             // acceleration
    init_number_property(this, "v", 0);             // velocity
    init_number_property(this, "vmin", -Infinity);  // minimum velocity
    init_number_property(this, "vmax", Infinity);   // maximum velocity
    init_number_property(this, "vh", 0);            // heading velocity
    init_number_property(this, "vr", 0);            // rotation velocity
  };

  // Update the element of the sprite for the current frame and check it against
  // the spark and trail
  $.Sprite.prototype.update = function (dt) {
    this.v = flexo.clamp(this.v + this.a * dt, this.vmin, this.vmax);
    this.h += this.vh * dt;
    this.r += this.vr * dt;
    this.x += this.v * Math.cos(this.th) * dt;
    this.y += this.v * Math.sin(this.th) * dt;
    if (this.x < this.radius || this.x > this.level.width - this.radius) {
      this.h = 180 - this.h;
    } else if (this.y < this.radius ||
        this.y > this.level.height - this.radius) {
      this.h = -this.h;
    }
    this.x = flexo.clamp(this.x, this.radius, this.level.width - this.radius);
    this.y = flexo.clamp(this.y, this.radius, this.level.height - this.radius);
    if (this.elem) {
      this.elem.setAttribute("transform",
          "translate(%0, %1) rotate(%2) scale(%3)"
          .fmt(this.x, this.y, this.r, this.s));
      if (this.radius > 1) {
        if (distance_squared(this, this.level.spark.__p) <
            this.level.spark.__radius) {
          delete this.level.spark.__alive;
        }
        if (cut_trail(this, this.level.trail)) {
          this.level.trail.__points = [];
        }
      }
    }
  };


  // The current game
  $.Level = function (n) {
    this.svg = document.querySelector("svg");
    var vb = this.svg.viewBox.baseVal;
    this.width = vb.width;
    this.height = vb.height;
    this.trail = document.getElementById("trail");
    this.enemies = document.getElementById("enemies");
    this.spark = document.getElementById("spark");
    this.spokes = this.spark.querySelectorAll("line");
    this.mask = this.spark.querySelector("circle");
    this.sprites = [];
    this.t0 = Date.now();
    this.trail.__points = [];
    this.spark.__radius = $.SPARK_RADIUS;
    this.spark.__alive = true;
    move_spark(this.spark, { x: this.width / 2, y: this.height / 2 }, true);
    this.mask.addEventListener("mousedown", this, false);
    this.mask.addEventListener("touchstart", this, false);
    for (var i = 0; i < n; ++i) {
      var color = flexo.random_element($.COLORS);
      var enemy = new $.Sprite(this, flexo.random_element($.SHAPES)());
      enemy.elem.setAttribute("fill", color);
      enemy.radius = 4;
      enemy.x = flexo.random_int(0, this.width);
      enemy.y = flexo.random_int(0, this.height);
      enemy.h = flexo.random_int(0, 360);
      enemy.v = 60;
      enemy.vr = flexo.random_int(60, 200);
      this.enemies.appendChild(enemy.elem);
      this.sprites.push(enemy);
      /*for (var j = 0; j < 4; ++j) {
        var en = new $.Sprite(flexo.$circle({ fill: color, r: 1 }));
        en.radius = 1;
        en.x = enemy.x;
        en.y = enemy.y;
        en.h = flexo.random_int(0, 360);
        en.v = 50;
        this.enemies.appendChild(en.elem);
        this.sprites.push(en);
      }*/
    }
  };

  $.Level.prototype.capture_enemies = function () {
    for (var i = this.sprites.length - 1; i >= 0; --i) {
      var elem = this.sprites[i].elem;
      var rect = elem.getBoundingClientRect();
      var e = document.elementFromPoint(rect.left + rect.width / 2,
          rect.top + rect.height / 2);
      if (e == this.trail) {
        flexo.safe_remove(elem);
        flexo.remove_from_array(this.sprites, this.sprites[i]);
      }
    }
  };

  // Check that the loop was closed. If it was, trim the trail and check for
  // enemies inside the trail
  $.Level.prototype.check_closed_loop = function () {
    var p = intersect_polyline(this.trail.__points);
    if (p) {
      this.trail.setAttribute("fill", "yellow");
      this.trail.__frozen = Date.now();
      this.trail.__points = this.trail.__points.slice(p.i);
      this.trail.__points[this.trail.__points.length - 1] = p;
      this.trail.setAttribute("points", this.trail.__points.map(function (p) {
        return p.x + " " + p.y;
      }).join(" "));
      this.capture_enemies();
    }
  };

  // Clamp the point from the event e within the screen and return the clamped
  // point (an object {x : ..., y: ... })
  $.Level.prototype.clamp_svg_point = function (e, offset) {
    var p = flexo.event_svg_point(e, this.svg);
    p.x = flexo.clamp(p.x - offset.x, 0, this.width);
    p.y = flexo.clamp(p.y - offset.y, 0, this.height);
    return p;
  };

  $.Level.prototype.handleEvent = function (e) {
    if (!this.spark.__alive) {
      return;
    }
    if (e.type == "mousedown" || e == "touchstart") {
      e.preventDefault();
      document.body.classList.add("dragging");
      var p = flexo.event_svg_point(e, this.svg);
      this.offset = { x: p.x - this.spark.__p.x, y: p.y - this.spark.__p.y };
      trail.__points = [];
      if (e.type == "mousedown") {
        document.addEventListener("mousemove", this, false);
        document.addEventListener("mouseup", this, false);
      } else {
        document.addEventListener("touchmove", this, false);
        document.addEventListener("touchend", this, false);
      }
    } else if (e.type == "mousemove" || e.type == "touchmove") {
      var p = this.clamp_svg_point(e, this.offset);
      move_spark(this.spark, p);
      this.grow_trail(p);
    } else {
      delete this.offset;
      this.trail.__points = [];
      document.body.classList.remove("dragging");
      if (e.type == "mouseup") {
        document.removeEventListener("mousemove", this, false);
        document.removeEventListener("mouseup", this, false);
      } else {
        document.removeEventListener("touchmove", this, false);
        document.removeEventListener("touchend", this, false);
      }
    }
  };

  // Add a point to the trail. If it's too close to the previous point, remove it
  // (we avoid spurious self-intersections this way)
  $.Level.prototype.grow_trail = function (p) {
    if (trail.__frozen) {
      return;
    }
    var n = trail.__points.length;
    if (n > 0) {
      var q = trail.__points[n - 1];
      var d = distance_squared(p, q);
      /*if (n > 1) {
        var r = trail.__points[n - 2];
        var u = { x: p.x - q.x, y: p.y - q.y };
        var v = { x: r.x - q.x, y: r.y - q.y };
        var lu = Math.sqrt(distance_squared(p, q));
        var lv = Math.sqrt(distance_squared(q, r));
        if (lu > 0 && lv > 0) {
          var cos = Math.abs(((u.x * v.x) + (u.y * v.y)) / (lu * lv));
        }
      }*/
      if (d < $.DISTANCE_THRESHOLD) {
        trail.__points.pop();
      }
    }
    p.added = Date.now();
    trail.__points.push(p);
    this.check_closed_loop();
  };

  $.Level.prototype.start = function () {
    requestAnimationFrame(this.update_bound = this.update.bind(this));
    return this;
  };

  // Update the world on each animation frame
  $.Level.prototype.update = function () {
    update_spokes(this.spokes);
    update_trail(this.trail);
    var t = Date.now();
    var dt = (t - this.t0) / 1000;
    this.t0 = t;
    for (var i = 0, n = this.sprites.length; i < n; ++i) {
      this.sprites[i].update(dt);
    }
    if (this.spark.__alive) {
      requestAnimationFrame(this.update_bound);
    }
  };


  // Cross product of two vectors u and v
  function cross_product(u, v) {
    return (u.x * v.y) - (u.y * v.x);
  }

  function cut_trail(sprite, trail) {
    var dist = Infinity;
    for (var i = 0, n = trail.__points.length; i < n - 1; ++i) {
      var p = trail.__points[i];
      var q = trail.__points[i + 1];
      var d = distance_to_segment_squared(sprite, p, q);
      if (d < dist) {
        dist = d;
      }
    }
    return dist < (sprite.radius * sprite.radius);
  }

  // Squared distance between two points
  function distance_squared(u, v) {
    var dx = u.x - v.x;
    var dy = u.y - v.y;
    return (dx * dx) + (dy * dy);
  }

  function distance_to_segment_squared(p, v, w) {
    var l2 = distance_squared(v, w);
    if (l2 == 0) {
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

  function init_number_property(obj, prop, n) {
    if (typeof obj[prop] != "number") {
      obj[prop] = n;
    }
  }

  // Intersect segment p, p_ with segment q, q_. Return the coordinates of the
  // intersection point if it exists, otherwise undefined
  // cf. http://stackoverflow.com/questions/563198/
  function intersect(p, p_, q, q_) {
    var r = { x: p_.x - p.x, y: p_.y - p.y };
    var s = { x: q_.x - q.x, y: q_.y - q.y };
    var rs = cross_product(r, s);
    if (rs != 0) {
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

  // Check whether the first segment in a polyline intersect any of the
  // following segments
  // TODO skip if the last segment is not long enough (starting to zag)
  function intersect_polyline(points) {
    for (var n = points.length, i = 0; i < n - 3; ++i) {
      var p = intersect(points[n - 1], points[n - 2], points[i], points[i + 1]);
      if (p) {
        p.i = i + 1;
        return p;
      }
    }
    return p;
  }

  // Move the spark to the given point.
  function move_spark(spark, p) {
    spark.__p = p;
    spark.setAttribute("transform", "translate(%0, %1) rotate(%2)"
        .fmt(p.x, p.y, flexo.random_int(-15, 15)));
  }

  // Update the spokes of the spark to make them flicker
  function update_spokes(spokes) {
    var colors = ["red", "yellow", "orange"];
    for (var i = 0, n = spokes.length; i < n; ++i) {
      spokes[i].setAttribute("x1", 2 + Math.random() * 2);
      spokes[i].setAttribute("x2", 4 + Math.random() * 4);
      spokes[i].setAttribute("stroke", flexo.random_element(colors));
      spokes[i].setAttribute("stroke-opacity",
          flexo.clamp(Math.random() * 1.5, 0, 1));
    }
  }

  // Update the trail by removing all points that are over TRAIL_TTL ms old
  function update_trail(trail) {
    var now = Date.now();
    if (trail.__frozen) {
      if (now - trail.__frozen > $.TRAIL_FREEZE) {
        trail.__points = [];
        trail.setAttribute("fill", "none");
        delete trail.__frozen;
      } else {
        return;
      }
    }
    var n = trail.__points.length;
    trail.__points = trail.__points.filter(function (p, i) {
      return now - p.added < $.TRAIL_TTL;
    });
    trail.setAttribute("points", trail.__points.map(function (p) {
      return p.x + " " + p.y;
    }).join(" "));
  };

  document.addEventListener("touchstart", function (e) {
    e.preventDefault();
  }, false);

  $.LEVEL = new $.Level(6).start();

}(window.zilch = {}));
