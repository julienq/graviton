"use strict";

// Simple format function for messages and templates. Use %0, %1... as slots
// for parameters; %(n) can also be used to avoid possible ambiguities (e.g.
// "x * 10 = %(0)0".) %% is also replaced by %. Null and undefined are
// replaced by an empty string.
String.prototype.fmt = function () {
  var args = arguments;
  return this.replace(/%(\d+|%|\((\d+)\))/g, function (_, p, pp) {
    var p_ = parseInt(pp || p, 10);
    return p == "%" ? "%" : args[p_] == null ? "" : args[p_];
  });
};

if (typeof Function.prototype.bind != "function") {
  Function.prototype.bind = function (x) {
    var f = this;
    var args = slice.call(arguments, 1);
    return function () {
      return f.apply(x, args.concat(slice.call(arguments)));
    };
  };
}

(function (flexo) {
  "use strict";

  flexo.VERSION = "0.2.3";

  var foreach = Array.prototype.forEach;
  var map = Array.prototype.map;
  var push = Array.prototype.push;
  var reduce = Array.prototype.reduce;
  var slice = Array.prototype.slice;
  var splice = Array.prototype.splice;

  var browserp = typeof window == "object";
  var global_ = browserp ? window : global;

  // Define π as a global
  global_.π = Math.PI;

  // requestAnimationFrame
  if (browserp && !window.requestAnimationFrame) {
    window.requestAnimationFrame = (window.webkitRequestAnimationFrame ||
      window.mozRequestAnimationFrame || window.msRequestAnimationFrame ||
      function (f) {
        return window.setTimeout(function () {
          f(Date.now());
        }, 15);
      }).bind(window);
    window.cancelAnimationFrame = (window.webkitCancelAnimationFrame ||
      window.mozCancelAnimationFrame || window.msCancelAnimationFrame ||
      window.clearTimeout).bind(window);
  }


  // Objects

  // Test whether x is an instance of y (i.e. y is the prototype of x, or the
  // prototype of its prototype, or...)
  flexo.instance_of = function (x, y) {
    var proto = typeof x == "object" && Object.getPrototypeOf(x);
    return !!proto && (proto == y || flexo.instance_of(proto, y));
  };

  // Define a property named `name` on object `obj` and make it read-only (i.e.
  // it only has a get.)
  flexo.make_readonly = function (obj, name, get) {
    Object.defineProperty(obj, name, {
      enumerable: true,
      get: flexo.funcify(get)
    });
  };

  // Define a property named `name` on object `obj` with the custom setter `set`
  // The setter gets two parameters (<value>, <cancel>) and returns the new
  // value to be set. An initial value may be provided, which does not trigger
  // the setter. `cancel` may be called with a truthy value to cancel the
  // setter.
  flexo.make_property = function (obj, name, set, value) {
    Object.defineProperty(obj, name, { enumerable: true,
      get: function () { return value; },
      set: function (v) {
        try {
          value = set.call(this, v, flexo.fail);
        } catch (e) {
          if (e !== "fail") {
            throw e;
          }
        }
      }
    });
  };

  // Safe call to toString(); when obj is null or undefined, return an empty
  // string.
  flexo.safe_string = function (obj) {
    if (obj == null) {
      return "";
    }
    return obj.toString.apply(obj, slice.call(arguments, 1));
  };


  // Strings

  // Chop the last character of a string iff it's a newline
  flexo.chomp = function (string) {
    return string.replace(/\n$/, "");
  };

  // Get a true or false value from a string; true if the string matches "true"
  // in case-insensitive, whitespace-tolerating way
  flexo.is_true = function (string) {
    return flexo.safe_trim(string).toLowerCase() === "true";
  };

  // Pad a string to the given length with the given padding (defaults to 0)
  // if it is shorter. The padding is added at the beginning of the string.
  flexo.pad = function (string, length, padding) {
    if (typeof padding !== "string") {
      padding = "0";
    }
    if (typeof string !== "string") {
      string = string.toString();
    }
    var l = length + 1 - string.length;
    return l > 0 ? (Array(l).join(padding)) + string : string;
  };

  // Quote a string, escaping quotes and newlines properly. Uses " by default,
  // but can be changed to '
  flexo.quote = function (string, q) {
    q = q || '"';
    return "%0%1%0".fmt(q, string.replace(new RegExp(q, "g"), "\\" + q)
        .replace(/\n/g, "\\n"));
  };

  // Trim a string, or return the empty string if the argument was not a string
  // (for instance, null or undefined.)
  flexo.safe_trim = function (maybe_string) {
    return typeof maybe_string == "string" ? maybe_string.trim() : "";
  };

  // Parse a number, using parseFloat first but defaulting to parseInt for
  // hexadecimal values (no octal parsing is done.)
  flexo.to_number = function (string) {
    var f = parseFloat(string);
    return f == 0 ? parseInt(string) : f;
  };

  // Convert a number to roman numerals (integer part only; n must be positive
  // or zero.) Now that's an important function to have in any framework.
  flexo.to_roman = function (n) {
    var unit = function (n, i, v, x) {
      var r = "";
      if (n % 5 === 4) {
        r += i;
        ++n;
      }
      if (n === 10) {
        r += x;
      } else {
        if (n >= 5) {
          r += v;
        }
        for (var j = 0; j < n % 5; ++j) {
          r += i;
        }
      }
      return r;
    }
    if (typeof n === "number" && n >= 0) {
      n = Math.floor(n);
      if (n === 0) {
        return "nulla";
      }
      var r = "";
      for (var i = 0; i < Math.floor(n / 1000); ++i) r += "m";
      return r +
        unit(Math.floor(n / 100) % 10, "c", "d", "m") +
        unit(Math.floor(n / 10) % 10, "x", "l", "c") +
        unit(n % 10, "i", "v", "x");
    }
  };

  // Convert a string with dash to camel case: remove dashes and capitalize the
  // following letter (e.g., convert foo-bar to fooBar)
  flexo.undash = function (s) {
    return s.replace(/-+(.?)/g, function (_, p) {
      return p.toUpperCase();
    });
  };


  // Numbers

  // Return the value constrained between min and max. A NaN value is converted
  // to 0 before being clamped. min and max are assumed to be numbers such that
  // min <= max.
  flexo.clamp = function (value, min, max) {
    return Math.max(Math.min(isNaN(value) ? 0 : value, max), min);
  };

  // Linear interpolation
  flexo.lerp = function (from, to, ratio) {
    return from + (to - from) * ratio;
  };

  // Remap a value from a given range to another range (from Processing)
  flexo.remap = function (value, istart, istop, ostart, ostop) {
    return ostart + (ostop - ostart) * ((value - istart) / (istop - istart));
  };

  // Return a random integer in the [min, max] range, assuming min <= max.
  // The min parameter may be omitted and defaults to zero.
  flexo.random_int = function (min, max) {
    if (max === undefined) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max + 1 - min));
  };


  // Arrays

  // Return a new array without the given item
  flexo.array_without = function (array, item) {
    var a = array.slice();
    flexo.remove_from_array(a, item);
    return a;
  };

  flexo.extract_from_array = function (array, p, that) {
    var extracted = [];
    var original = slice.call(array);
    for (var i = array.length - 1; i >= 0; --i) {
      if (p.call(that, array[i], i, original)) {
        extracted.unshift(array[i]);
        splice.call(array, i, 1);
      }
    }
    return extracted;
  };

  // Drop elements of an array while the predicate is true
  flexo.drop_while = function (a, p, that) {
    for (var i = 0, n = a.length; i < n && p.call(that, a[i], i, a); ++i);
    return slice.call(a, i);
  };

  // Find the first item x in a such that p(x) is true
  flexo.find_first = function (a, p, that) {
    if (!Array.isArray(a)) {
      return;
    }
    for (var i = 0, n = a.length; i < n && !p.call(that, a[i], i, a); ++i);
    return a[i];
  };

  // Foreach in reverse
  flexo.hcaErof = function (a, f, that) {
    for (var i = a.length - 1; i >= 0; --i) {
      f.call(that, a[i], i, a);
    }
  };

  // Interspers the separator `sep` in the array a
  flexo.intersperse = function (a, sep) {
    var n = a.length;
    if (n == 0) {
      return [];
    }
    var j = new Array(2 * n - 1);
    j[2 * (--n)] = a[n];
    for (var i = 0; i < n; ++i) {
      j[2 * i] = a[i];
      j[2 * i + 1] = sep;
    }
    return j;
  };

  // Partition `a` according to predicate `p` and return and array of two arrays
  // (first one is the array of elements for which p is true.)
  flexo.partition = function (a, p, that) {
    var ins = [];
    var outs = [];
    for (var i = 0, n = a.length; i < n; ++i) {
      (p.call(that, a[i], i, a) ? ins : outs).push(a[i]);
    }
    return [ins, outs];
  };

  // Return a random element from an array
  flexo.random_element = function (a) {
    return a[flexo.random_int(a.length - 1)];
  };

  // Remove the first element from the array that matches the predicate p
  flexo.remove_first_from_array = function (a, p, that) {
    if (!Array.isArray(a)) {
      return;
    }
    for (var i = 0, n = a.length; i < n && !p.call(that, a[i], i, a); ++i);
    if (i < n) {
      return a.splice(i, 1)[0];
    }
  };

  // Remove an item from an array
  flexo.remove_from_array = function (array, item) {
    if (array && item != null) {
      var index = array.indexOf(item);
      if (index >= 0) {
        return array.splice(index, 1)[0];
      }
    }
  };

  // Replace the first instance of old_item in array with new_item, and return
  // old_item on success
  flexo.replace_in_array = function (array, old_item, new_item) {
    if (array && old_item != null) {
      var index = array.indexOf(old_item);
      if (index >= 0) {
        array[index] = new_item;
        return old_item;
      }
    }
  };

  // Shuffle the array into a new array (the original array is not changed and
  // the new, shuffled array is returned.)
  flexo.shuffle_array = function (array) {
    var shuffled = slice.call(array);
    for (var i = shuffled.length - 1; i > 0; --i) {
      var j = flexo.random_int(i);
      var x = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = x;
    }
    return shuffled;
  };

  // Create a new urn to pick from. The argument is the array of items in the
  // urn; items can be added or removed later.
  flexo.Urn = function (items) {
    flexo.make_property(this, "items", function (items_) {
      this._remaining = [];
      delete this._last_pick;
      return items_;
    });
    flexo.make_readonly(this, "remaining", function () {
      return this._remaining.length;
    });
    this.items = Array.isArray(items) && items || [];
  };

  flexo.Urn.prototype = {

    // Pick an item from the urn, refilling it as necessary.
    pick: function () {
      var last;
      if (this._remaining.length == 0) {
        this._remaining = slice.call(this.items);
        if (this._remaining.length > 1 && this.hasOwnProperty("_last_pick")) {
          last = flexo.remove_from_array(this._remaining, this._last_pick);
        }
      }
      if (this._remaining.length > 0) {
        this._last_pick = this._remaining
          .splice(flexo.random_int(this._remaining.length - 1), 1)[0];
        if (last !== undefined) {
          this._remaining.push(last);
        }
        return this._last_pick;
      }
    },

    // Pick n elements from the urn and return as a list. Try to minimize
    // repetition as much as possible
    picks: function (n) {
      if (n > this._remaining.length && n <= this.items.length) {
        this._remaining = [];
      }
      var picks = [];
      for (var i = 0; i < n; ++i) {
        picks.push(this.pick());
      }
      return picks;
    },

    // Add an item to the urn
    add: function (item) {
      this.items.push(item);
      this._remaining.push(item);
      return this;
    },

    // Remove an item from the urn
    remove: function (item) {
      var removed = flexo.remove_from_array(this.items, item);
      if (removed) {
        flexo.remove_from_array(this._remaining, item);
      }
      return removed;
    }

  };

  // Return all the values of an object (presumably used as a dictionary)
  flexo.values = function (object) {
    return Object.keys(object).map(function (key) {
      return object[key];
    });
  };


  // URIs: parsing and resolving relative URIs (e.g. to load resources)

  // Split an URI into an object with the five parts scheme, authority, path,
  // query, and fragment (without the extra punctuation; i.e. query does not
  // have a leading "?") Fields not in the URI are undefined. Return nothing if
  // the input URI does not match.
  flexo.split_uri = function (uri) {
    var m = flexo.safe_string(uri).match(
      /^(?:([^:\/?#]+):)?(?:\/\/([^\/?#]*))?([^?#]*)(?:\?([^#]*))?(?:#(.*))?/
    );
    if (m) {
      return {
        scheme: m[1],
        authority: m[2],
        path: m[3],
        query: m[4],
        fragment: m[5]
      };
    }
  };

  // Rebuild an URI string from an object as split by flexo.split_uri
  flexo.unsplit_uri = function (r) {
    if (typeof r == "object") {
      return (r.scheme ? r.scheme + ":" : "") +
        (r.authority ? "//" + r.authority : "") +
        r.path +
        (r.query ? "?" + r.query : "") +
        (r.fragment ? "#" + r.fragment : "");
    }
  };

  // Utility function for absolute_uri
  function remove_dot_segments(input) {
    var output = "";
    while (input) {
      var m = input.match(/^\.\.?\//);
      if (m) {
        input = input.substr(m[0].length);
      } else {
        m = input.match(/^\/\.(?:\/|$)/);
        if (m) {
          input = "/" + input.substr(m[0].length);
        } else {
          m = input.match(/^\/\.\.(:?\/|$)/);
          if (m) {
            input = "/" + input.substr(m[0].length);
            output = output.replace(/\/?[^\/]*$/, "");
          } else if (input === "." || input === "..") {
            input = "";
          } else {
            m = input.match(/^\/?[^\/]*/);
            input = input.substr(m[0].length);
            output += m[0];
          }
        }
      }
    }
    return output;
  }

  // Return an absolute URI for the reference URI for a given base URI
  flexo.absolute_uri = function (base, ref) {
    var r = flexo.split_uri(ref);
    if (!r) {
      return;
    }
    if (r.scheme) {
      r.path = remove_dot_segments(r.path);
    } else {
      var b = flexo.split_uri(base);
      if (!b) {
        return;
      }
      r.scheme = b.scheme;
      if (r.authority) {
        r.path = remove_dot_segments(r.path);
      } else {
        r.authority = b.authority;
        if (!r.path) {
          r.path = b.path;
          if (!r.query) {
            r.query = b.query;
          }
        } else {
          if (r.path.substr(0, 1) === "/") {
            r.path = remove_dot_segments(r.path);
          } else {
            r.path = b.authority && !b.path ? "/" + r.path :
                remove_dot_segments(b.path.replace(/\/[^\/]*$/, "/") + r.path);
          }
        }
      }
    }
    return flexo.unsplit_uri(r);
  };

  // Return an absolute, normalized URI:
  //   * scheme and host are converted to lowercase
  //   * escape sequences are converted to uppercase
  //   * escaped letters, digits, hyphen, period and underscore are unescaped
  //   * remove port 80 from authority
  flexo.normalize_uri = function (base, ref) {
    var uri = flexo.split_uri(flexo.absolute_uri(base, ref)
      .replace(/%([0-9a-f][0-9a-f])/gi, function (m, n) {
        n = parseInt(n, 16);
        return (n >= 0x41 && n <= 0x5a) || (n >= 0x61 && n <= 0x7a) ||
          (n >= 0x30 && n <= 0x39) || n === 0x2d || n === 0x2e ||
          n === 0x5f || n === 0x7e ? String.fromCharCode(n) : m.toUpperCase();
      }));
    if (uri.scheme) {
      uri.scheme = uri.scheme.toLowerCase();
    }
    if (uri.authority) {
      uri.authority = uri.authority.replace(/:80$/, "").toLowerCase();
    }
    return flexo.unsplit_uri(uri);
  };

  // Make an XMLHttpRequest with optional params and return a promise
  // Set a mimeType parameter to override the MIME type of the request
  flexo.ez_xhr = function (uri, params) {
    var req = new XMLHttpRequest;
    if (typeof uri == "object") {
      params = uri;
      uri = params.uri;
    } else if (typeof params != "object") {
      params = {};
    }
    req.open(params.method || "GET", uri);
    if (params.hasOwnProperty("responseType")) {
      req.responseType = params.responseType;
    }
    if (params.hasOwnProperty("mimeType")) {
      req.overrideMimeType(params.mimeType);
    }
    if (params.hasOwnProperty("headers")) {
      for (var h in params.headers) {
        req.setRequestHeader(h, params.headers[h]);
      }
    }
    var promise = new flexo.Promise;
    req.onload = function () {
      if (req.response != null) {
        promise.fulfill(req.response);
      } else {
        promise.reject({ message: "missing response", request: req });
      }
    };
    req.onerror = function (error) {
      promise.reject({ message: "XHR error", request: req, error: error });
    };
    try {
      req.send(params.data || "");
    } catch (e) {
      promise.reject({ message: "XHR error", request: req, exception: e });
    }
    return promise;
  };

  // Get args from an URI
  flexo.get_args = function (defaults, argstr) {
    var args = defaults || {};
    var types = {};
    for (var a in args) {
      types[a] = typeof args[a];
    }
    if (!argstr) {
      argstr = typeof window === "object" &&
        typeof window.location === "object" &&
        typeof window.location.search === "string" ?
            window.location.search.substring(1) : "";
    }
    argstr.split("&").forEach(function (q) {
      if (!q) {
        return;
      }
      var sep = q.indexOf("=");
      var arg = q.substr(0, sep);
      var val = decodeURIComponent(q.substr(sep + 1));
      if (types.hasOwnProperty(arg)) {
        if (types[arg] === "number") {
          var n = flexo.to_number(val);
          args[arg] = isNaN(n) ? val : n;
        } else if (types[arg] === "boolean") {
          args[arg] = flexo.is_true(val);
        } else {
          args[arg] = val;
        }
      } else {
        args[arg] = val;
      }
    });
    return args;
  };


  // Custom events

  // Listeners for events indexed by type of event, then by target. Store
  // listeners with an additional "once" flag, so that they are removed
  // immediately when notified for the first time if the flag is set.
  // `events` looks like: {
  //   type: [ [target, [listener, once], [listener, once], ...],
  //           [target, [listener, once], ...],
  //           ... ],
  //   type: [ [target, ...], [target, ...] ],
  //   type: [ ... ],
  //   ...
  // }
  // TODO universal hashing for JS values so that target can be used as a key
  var events = {};

  // Call an event listener, which may be a function or an object with a
  // `handleEvent` function; if it’s neither, do nothing
  function call_listener(listener, e) {
    if (typeof listener.handleEvent == "function") {
      listener.handleEvent.call(listener, e);
    } else if (typeof listener == "function") {
      listener(e);
    }
  }

  // Listen to a custom event. Listener is a function or an object with a
  // `handleEvent` function which will then be invoked. The listener is
  // returned. An additional flag can be set if the listener is to be removed
  // after being called once (see listen_once below.)
  // If the same listener was already added for the same target and event type,
  // just update the once flag, which stays true if and only if it still set.
  // Set the target to null to listen to notifications of `type` from all
  // events.
  flexo.listen = function (target, type, listener) {
    return listen(target, type, listener, false);
  }

  // Listen to an event only once. The listener is returned.
  flexo.listen_once = function (target, type, listener) {
    return listen(target, type, listener, true);
  };

  function listen(target, type, listener, once) {
    if (!listener || typeof type != "string" || !type) {
      return;
    }
    if (target === undefined) {
      target = null;
    }
    if (!events.hasOwnProperty(type)) {
      events[type] = [[target, [listener, once]]];
    } else {
      var t = flexo.find_first(events[type], function (t) {
        return t[0] === target;
      });
      if (t) {
        var l = flexo.find_first(t, function (l) {
          return l[0] === l;
        });
        if (l) {
          l[1] = l[1] && once;
        } else {
          t.push([listener, once]);
        }
      } else {
        events[type].push([target, [listener, once]]);
      }
    }
    return listener;
  }

  // Can be called as notify(e), notify(source, type) or notify(source, type, e)
  flexo.notify = function (source, type, e) {
    if (typeof e == "object") {
      e.source = source;
      e.type = type;
    } else if (typeof type == "string") {
      e = { source: source, type: type };
    } else {
      e = source;
    }
    return flexo.asap(notify.bind(this, e));
  };

  function notify(e) {
    if (events.hasOwnProperty(e.type)) {
      notify_listeners(e, flexo.find_first(events[e.type], function (t) {
        return t[0] === e.source;
      }));
      if (e.source) {
        notify_listeners(e, flexo.find_first(events[e.type], function (t) {
          return t[0] === null;
        }));
      }
    }
  }

  function notify_listeners(e, t) {
    if (t) {
      t.slice(1).forEach(function (l) {
        if (l[1]) {
          flexo.remove_from_array(t, l);
          if (t.length == 1) {
            flexo.remove_from_array(events[e.type], t);
            if (events[e.type].length == 0) {
              delete events[e.type];
            }
          }
        }
        call_listener(l[0], e);
      });
    }
  }

  // Stop listening and return the removed listener. If the listener was not set
  // in the first place, do and return nothing.
  flexo.unlisten = function (target, type, listener) {
    if (events.hasOwnProperty(type)) {
      for (var i = 0, n = events[type].length;
          i < n && events[type][i][0] !== target; ++i);
      if (i < n) {
        for (var j = 1, m = events[type][i].length;
            j < m && events[type][i][j][0] !== listener; ++j);
        if (j < m) {
          events[type][i].splice(j, 1);
          if (events[type][i].length == 1) {
            events[type].splice(i, 1);
            if (events[type].length == 0) {
              delete events[type];
            }
          }
          return listener;
        }
      }
    }
  };


  // Functions and Asynchronicity

  // Hack using postMessage to provide a setImmediate replacement; inspired by
  // https://github.com/NobleJS/setImmediate
  flexo.asap = global_.setImmediate ? global_.setImmediate.bind(global_) :
    global_.postMessage ? (function () {
      var queue = [];
      var key = "asap{0}".fmt(Math.random());
      global_.addEventListener("message", function (e) {
        if (e.data === key) {
          var q = queue.slice();
          queue = [];
          for (var i = 0, n = q.length; i < n; ++i) {
            q[i]();
          }
        }
      }, false);
      return function (f) {
        queue.push(f);
        global_.postMessage(key, "*");
      };
    }()) : function (f) {
      setTimeout(f, 0);
    };

  // Return a function that discards its arguments. An optional parameter allows
  // to keep at most n arguments (defaults to 0 of course.)
  flexo.discard = function (f, n) {
    return function () {
      return f.apply(this, slice.call(arguments, 0, n || 0));
    };
  };

  // This function can be called to fail early. If called with no parameter or a
  // single parameter evaluating to a truthy value, throw a "fail" exception;
  // otherwise, return false.
  flexo.fail = function (p) {
    if (!arguments.length || p) {
      throw "fail";
    }
    return false;
  };

  // Turn a value into a 0-ary function returning that value
  flexo.funcify = function (x) {
    return typeof x == "function" ? x : function () { return x; };
  };

  // Identity function
  flexo.id = function (x) {
    return x;
  };

  // No-op function, returns nothing
  flexo.nop = function () {
  };

  // Trampoline calls, adapted from
  // http://github.com/spencertipping/js-in-ten-minutes

  // Use a trampoline to call a function; we expect a thunk to be returned
  // through the get_thunk() function below. Return nothing to step off the
  // trampoline (e.g. to wait for an event before continuing.)
  function apply_thunk(thunk) {
    var escape = thunk[1][thunk[1].length - 1];
    var self = thunk[0];
    while (thunk && thunk[0] !== escape) {
      thunk = thunk[0].apply(self, thunk[1]);
    }
    if (thunk) {
      return escape.apply(self, thunk[1]);
    }
  }

  Function.prototype.trampoline = function () {
    return apply_thunk([this, arguments]);
  };

  // Return a thunk suitable for the trampoline function above.
  Function.prototype.get_thunk = function() {
    return [this, arguments];
  };

  // Promises (see http://promisesaplus.com/)
  flexo.Promise = function () {
    this._queue = [];
    this._resolved = resolved_promise.bind(this);
  };

  flexo.Promise.prototype = {

    then: function (on_fulfilled, on_rejected) {
      var p = new flexo.Promise;
      this._queue.push([p, on_fulfilled, on_rejected]);
      if (this.hasOwnProperty("value") || this.hasOwnProperty("reason")) {
        flexo.asap(this._resolved);
      }
      return p;
    },

    timeout: function (dur_ms) {
      if (this._timeout) {
        clearTimeout(this._timeout);
        delete this._timeout;
      }
      if (typeof dur_ms == "number" && dur_ms > 0) {
        this._timeout = setTimeout(function () {
          this.reject("Timeout");
        }.bind(this), dur_ms);
      }
      return this;
    },

    fulfill: function (value) {
      return resolve_promise.call(this, "value", value);
    },

    reject: function (reason) {
      return resolve_promise.call(this, "reason", reason);
    },

    each: function (xs, f) {
      return reduce.call(xs, function (p, x) {
        return p.then(function (v) {
          return f(x, v);
        });
      }, this);
    }

  };

  function resolve_promise(resolution, value) {
    if (!this.hasOwnProperty("value") && !this.hasOwnProperty("reason")) {
      if (this._timeout) {
        clearTimeout(this._timeout);
        delete this._timeout;
      }
      this[resolution] = value;
      this._resolved();
    }
    return this;
  }

  function resolved_promise() {
    var resolution = this.hasOwnProperty("value") ? "value" : "reason";
    var on = this.hasOwnProperty("value") ? 1 : 2;
    for (var i = 0; i < this._queue.length; ++i) {
      var p = this._queue[i];
      if (typeof p[on] == "function") {
        try {
          var v = p[on](this[resolution]);
          if (v && typeof v.then == "function") {
            v.then(function (value) {
              p[0].fulfill(value);
            }, function (reason) {
              p[0].reject(reason);
            });
          } else {
            p[0].fulfill(v);
          }
        } catch (e) {
          p[0].reject(e);
        }
      } else {
        p[0][resolution == "value" ? "fulfill" : "reject"](this[resolution]);
      }
    }
    this._queue = [];
  }

  // Wrapper for then when a value may be either a promise-like object (with its
  // own .then() method) or an actual value which can be used straight away. The
  // first argument is returned. (Not the return value of f!)
  flexo.then = function (maybe_promise, f, delay) {
    if (maybe_promise && typeof maybe_promise.then == "function") {
      maybe_promise.then(f);
    } else if (delay) {
      flexo.asap(function () {
        f(maybe_promise);
      });
    } else {
      f(maybe_promise);
    }
    return maybe_promise;
  };

  flexo.while_p = function (p, f) {
    while (p()) {
      f();
    }
  };

  // Create a promise that loads an image. `attrs` is a dictionary of attribute
  // for the image and should contain a `src` property, or can simply be the
  // source attribute value itself. The promise has a pointer to the `img`
  // element.
  flexo.promise_img = function (attrs) {
    var promise = new flexo.Promise;
    var img = promise.img = new Image;
    if (typeof attrs == "object") {
      for (var attr in attrs) {
        img.setAttribute(attr, attrs[attr]);
      }
    } else {
      img.src = attrs;
    }
    if (img.complete) {
      promise.fulfill(img);
    } else {
      img.onload = promise.fulfill.bind(promise, img);
      img.onerror = promise.reject.bind(promise);
    }
    return promise;
  };

  // Create a promise that loads a script at `src` by adding it to `target`.
  flexo.promise_script = function (src, target) {
    var promise = new flexo.Promise;
    var script = target.ownerDocument.createElement("script");
    script.src = src;
    script.async = false;
    script.onload = promise.fulfill.bind(promise, script);
    script.onerror = promise.reject.bind(promise);
    target.appendChild(script);
    return promise;
  };

  // Apply function f (defaults to id) to all elements of array xs. Return a
  // promise that gets fulfilled with the last value (or the provided z value)
  // once all elements have finished.
  flexo.promise_each = function (xs, f, that, z) {
    var promise = new flexo.Promise;
    if (typeof f != "function") {
      f = flexo.id;
    }
    var pending = 0;
    var last;
    foreach.call(xs, function (x, i) {
      var y = last = f.call(that, x, i, xs);
      if (y && typeof y.then == "function") {
        ++pending;
        y.then(function (y_) {
          if (i == xs.length - 1) {
            last = y_;
          }
          if (--pending == 0) {
            promise.fulfill(arguments.length > 3 ? z : last);
          }
        }, promise.reject.bind(promise));
      }
    });
    if (pending == 0) {
      promise.fulfill(arguments.length > 3 ? z : last);
    }
    return promise;
  };

  flexo.promise_map = function (xs, f, that, tolerant) {
    if (arguments.length < 4 && typeof that == "boolean") {
      tolerant = that;
      that = undefined;
    }
    var promise = new flexo.Promise;
    var ys = new Array(xs.length);
    var pending = 1;
    var check_pending = function (decr) {
      if (--pending == 0) {
        promise.fulfill(ys);
      }
    }
    foreach.call(xs, function (x, i) {
      var y = f.call(that, x, i, xs);
      if (y && typeof y.then == "function") {
        ++pending;
        y.then(function (y_) {
          ys[i] = y_;
          check_pending();
        }, function (y_) {
          if (tolerant) {
            ys[i] = y_;
            check_pending();
          } else {
            promise.reject(reason);
          }
        });
      } else {
        ys[i] = y;
      }
    });
    check_pending();
    return promise;
  };

  flexo.promise_fold = function (xs, f, z) {
    var promise = new flexo.Promise;
    var g = function (z, i) {
      if (i == xs.length) {
        promise.fulfill(z);
      } else {
        var y = f(z, xs[i], i, xs);
        if (y && typeof y.then == "function") {
          y.then(function (y_) {
            g(y_, i + 1);
          });
        } else {
          g(y, i + 1);
        }
      }
    };
    g(z, 0);
    return promise;
  };

  // DOM

  // Make a (text) HTML tag; the first argument is the tag name. Following
  // arguments are the contents (as text; must be properly escaped.) If the last
  // argument is a boolean, it is treated as a flag to *not* close the element
  // when true (i.e. for elements that are incomplete or HTML elements that do
  // not need to be closed)
  // TODO handle encoding (at least of attribute values)
  flexo.html_tag = function (tag) {
    var out = "<" + tag;
    var contents = slice.call(arguments, 1);
    if (typeof contents[0] === "object" && !Array.isArray(contents[0])) {
      var attrs = contents.shift();
      for (var a in attrs) {
        if (attrs.hasOwnProperty(a)) {
          var v = attrs[a];
          // true and false/null/undefined act as special values: when true,
          // just output the attribute name (without any value); when false,
          // null or undefined, skip the attribute altogether
          if (v != null && v !== false) {
            out += (v === true ? " %0" : " %0=\"%1\"").fmt(a, v);
          }
        }
      }
    }
    out += ">";
    var keep_open = typeof contents[contents.length - 1] === "boolean" ?
        contents.pop() : false;
    out += contents.join("");
    if (!keep_open) {
      out += "</%0>".fmt(tag);
    }
    return out;
  };

  // Known XML namespaces and their prefixes for use with create_element below.
  // For convenience both "html" and "xhtml" are defined as prefixes for XHTML.
  flexo.ns = {
    html: "http://www.w3.org/1999/xhtml",
    m: "http://www.w3.org/1998/Math/MathML",
    svg: "http://www.w3.org/2000/svg",
    xhtml: "http://www.w3.org/1999/xhtml",
    xlink: "http://www.w3.org/1999/xlink",
    xml: "http://www.w3.org/1999/xml",
    xmlns: "http://www.w3.org/2000/xmlns/"
  };

  // Append a child node `ch` to `node`. If it is a string, create a text
  // node with the string as content; if it is an array, append all elements of
  // the array; if it is not a Node, then simply ignore it.
  flexo.append_child = function (node, ch) {
    if (typeof ch === "string") {
      node.appendChild(node.ownerDocument.createTextNode(ch));
    } else if (ch instanceof Array) {
      ch.forEach(function (ch_) {
        flexo.append_child(node, ch_);
      });
    } else if (ch instanceof window.Node) {
      node.appendChild(ch);
    }
  };

  // Simple way to create elements. The first argument is a string with the name
  // of the element (e.g., "rect"), and may also contain a namespace prefix as
  // defined in flexo.ns (e.g., "html:p"; the default is the namespace URI of
  // the document), class names, using "." as a separator similarly to CSS
  // (e.g., "html:p.important.description") and an id preceded by # (e.g.,
  // "html:p.important.description#rule; not that this id may not contain a .)
  // The second argument is optional and is an object defining attributes of the
  // element; its properties are names of attributes, and the values are the
  // values for the attribute. Note that a false, null or undefined value will
  // *not* set the attribute. Attributes may have namespace prefixes so that we
  // can use "xlink:href" for instance (e.g., flexo.create_element("svg:use",
  // { "xlink:href": "#foo" });) Beware of calling this function with `this` set
  // to the target document.
  flexo.create_element = function (name, attrs) {
    var contents;
    if (typeof attrs === "object" && !(attrs instanceof Node) &&
        !Array.isArray(attrs)) {
      contents = slice.call(arguments, 2);
    } else {
      contents = slice.call(arguments, 1);
      attrs = {};
    }
    var classes = name.trim().split(".").map(function (x) {
      var m = x.match(/#(.*)$/);
      if (m) {
        attrs.id = m[1];
        return x.substr(0, m.index);
      }
      return x;
    });
    name = classes.shift();
    if (classes.length > 0) {
      attrs["class"] =
        (typeof attrs["class"] === "string" ? attrs["class"] + " " : "")
        + classes.join(" ");
    }
    var m = name.match(/^(?:([^:]+):)?/);
    var ns = (m[1] && flexo.ns[m[1].toLowerCase()]) ||
      this.documentElement.namespaceURI;
    var elem = this.createElementNS(ns, m[1] ? name.substr(m[0].length) : name);
    for (var a in attrs) {
      if (attrs[a] != null && attrs[a] !== false) {
        var sp = a.split(":");
        ns = sp[1] && flexo.ns[sp[0].toLowerCase()];
        if (ns) {
          elem.setAttributeNS(ns, sp[1], attrs[a]);
        } else {
          elem.setAttribute(a, attrs[a]);
        }
      }
    }
    contents.forEach(function (ch) {
      flexo.append_child(elem, ch);
    });
    return elem;
  };

  flexo.tags = {
    html: ["a", "abbr", "address", "area", "article", "aside", "audio", "b",
      "base", "bdi", "bdo", "blockquote", "body", "br", "button", "canvas",
      "caption", "cite", "code", "col", "colgroup", "command", "datalist", "dd",
      "del", "details", "dfn", "dialog", "div", "dl", "dt", "em", "embed",
      "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3",
      "h4", "h5", "h6", "head", "header", "hgroup", "hr", "html", "i", "iframe",
      "img", "input", "ins", "kbd", "keygen", "label", "legend", "li", "link",
      "map", "mark", "menu", "meta", "meter", "nav", "noscript", "object", "ol",
      "optgroup", "option", "output", "p", "param", "pre", "progress", "q",
      "rp", "rt", "ruby", "s", "samp", "script", "section", "select", "small",
      "source", "span", "strong", "style", "sub", "summary", "sup", "table",
      "tbody", "td", "textarea", "tfoot", "th", "thead", "time", "title", "tr",
      "tref", "track", "u", "ul", "var", "video", "wbr"],
    svg: ["altGlyph", "altGlyphDef", "altGlyphItem", "animate", "animateColor",
      "animateMotion", "animateTransform", "circle", "clipPath",
      "color-profile", "cursor", "defs", "desc", "ellipse", "feBlend",
      "feColorMatrix", "feComponentTransfer", "feComposite", "feConvolveMatrix",
      "feDiffuseLighting", "feDisplacementMap", "feDistantLight", "feFlood",
      "feFuncA", "feFuncB", "feFuncG", "feFuncR", "feGaussianBlur", "feImage",
      "feMerge", "feMergeNode", "feMorphology", "feOffset", "fePointLight",
      "feSpecularLighting", "feSpotLight", "feTile", "feTurbulence", "filter",
      "font", "font-face", "font-face-format", "font-face-name",
      "font-face-src", "font-face-uri", "foreignObject", "g", "glyph",
      "glyphRef", "hkern", "image", "line", "linearGradient", "marker", "mask",
      "metadata", "missing-glyph", "mpath", "path", "pattern", "polygon",
      "polyline", "radialGradient", "rect", "set", "stop", "svg", "switch",
      "symbol", "text", "textPath", "tref", "tspan", "use", "view", "vkern"],
    m: ["abs", "and", "annotation", "annotation-xml", "apply", "approx",
      "arccos", "arccosh", "arccot", "arccoth", "arccsc", "arccsch", "arcsec",
      "arcsech", "arcsin", "arcsinh", "arctan", "arctanh", "arg", "bind",
      "bvar", "card", "cartesianproduct", "cbytes", "ceiling", "cerror", "ci",
      "cn", "codomain", "complexes", "compose", "condition", "conjugate", "cos",
      "cosh", "cot", "coth", "cs", "csc", "csch", "csymbol", "curl", "declare",
      "degree", "determinant", "diff", "divergence", "divide", "domain",
      "domainofapplication", "el", "emptyset", "eq", "equivalent", "eulergamma",
      "exists", "exp", "exponentiale", "factorial", "factorof", "false",
      "floor", "fn", "forall", "gcd", "geq", "grad", "gt", "ident", "imaginary",
      "imaginaryi", "implies", "in", "infinity", "int", "integers", "intersect",
      "interval", "inverse", "lambda", "laplacian", "lcm", "leq", "limit",
      "list", "ln", "log", "logbase", "lowlimi", "lt", "maction", "malign",
      "maligngroup", "malignmark", "malignscope", "math", "matrix", "matrixrow",
      "max", "mean", "median", "menclose", "merror", "mfenced", "mfrac",
      "mfraction", "mglyph", "mi", "minus", "mlabeledtr", "mlongdiv",
      "mmultiscripts", "mn", "mo", "mode", "moment", "momentabout", "mover",
      "mpadded", "mphantom", "mprescripts", "mroot", "mrow", "ms", "mscarries",
      "mscarry", "msgroup", "msline", "mspace", "msqrt", "msrow", "mstack",
      "mstyle", "msub", "msubsup", "msup", "mtable", "mtd", "mtext", "mtr",
      "munder", "munderover", "naturalnumbers", "neq", "none", "not",
      "notanumber", "note", "notin", "notprsubset", "notsubset", "or",
      "otherwise", "outerproduct", "partialdiff", "pi", "piece", "piecewise",
      "plus", "power", "primes", "product", "prsubset", "quotient", "rationals",
      "real", "reals", "reln", "rem", "root", "scalarproduct", "sdev", "sec",
      "sech", "selector", "semantics", "sep", "setdiff", "share", "sin",
      "subset", "sum", "tan", "tanh", "tendsto", "times", "transpose", "true",
      "union", "uplimit", "variance", "vector", "vectorproduct", "xor"]
  };

  if (browserp) {

    // Shorthand to create elements, e.g. flexo.$("svg#main.content")
    flexo.$ = function () {
      return flexo.create_element.apply(window.document, arguments);
    };

    // Shorthand to create a document fragment
    flexo.$$ = function () {
      var fragment = window.document.createDocumentFragment();
      foreach.call(arguments, function (ch) {
        flexo.append_child(fragment, ch);
      });
      return fragment;
    };

    // Make shorthands for known HTML, SVG and MathML elements, e.g. flexo.$p,
    // flexo.$fontFaceFormat (for svg:font-face-format), &c.
    for (var ns in flexo.tags) {
      flexo.tags[ns].forEach(function (tag) {
        flexo["$" + flexo.undash(tag)] = flexo.create_element
          .bind(window.document, "%0:%1".fmt(ns, tag));
      });
    }
  } else {
    for (var ns in flexo.tags) {
      flexo.tags[ns].forEach(function (tag) {
        flexo["$" + flexo.undash(tag)] = flexo.html_tag.bind(this, tag);
      });
    }
  }

  // Get clientX/clientY as an object { x: ..., y: ... } for events that may
  // be either a mouse event or a touch event, in which case the position of
  // the first touch is returned.
  flexo.event_client_pos = function (e) {
    return { x: e.targetTouches ? e.targetTouches[0].clientX : e.clientX,
      y: e.targetTouches ? e.targetTouches[0].clientY : e.clientY };
  };

  // Get the offset position of the mouse event e relative to the element `elem`
  // (defaults to e.target)
  flexo.event_offset_pos = function (e, elem) {
    var p = flexo.event_client_pos(e);
    var bbox = (elem || e.target).getBoundingClientRect();
    p.x -= bbox.left;
    p.y -= bbox.top;
    return p;
  };

  // Remove all children of an element
  flexo.remove_children = function (elem) {
    while (elem.firstChild) {
      elem.removeChild(elem.firstChild);
    }
  };

  // Root of a node: the furthest node up the tree.
  flexo.root = function (node) {
    return node && node.parentNode ? flexo.root(node.parentNode) : node;
  };

  // Safe removal of a node; do nothing if the node did not exist or had no
  // parent.
  flexo.safe_remove = function (node) {
    if (node && node.parentNode) {
      node.parentNode.removeChild(node);
    }
  };

  // Add or remove the class c on elem according to the value of predicate p
  // (add if true, remove if false)
  flexo.set_class_iff = function (elem, c, p) {
    if (p) {
      elem.classList.add(c);
    } else {
      elem.classList.remove(c);
    }
  };


  // Graphics

  // Color

  // Convert a color from hsv space (hue in radians, saturation and brightness
  // in the [0, 1] interval) to RGB, returned as an array of RGB values in the
  // [0, 256[ interval.
  flexo.hsv_to_rgb = function (h, s, v) {
    s = flexo.clamp(s, 0, 1);
    v = flexo.clamp(v, 0, 1);
    if (s === 0) {
      var v_ = Math.round(v * 255);
      return [v_, v_, v_];
    } else {
      h = (((h * 180 / π) + 360) % 360) / 60;
      var i = Math.floor(h);
      var f = h - i;
      var p = v * (1 - s);
      var q = v * (1 - (s * f));
      var t = v * (1 - (s * (1 - f)));
      return [Math.round([v, q, p, p, t, v][i] * 255),
        Math.round([t, v, v, q, p, p][i] * 255),
        Math.round([p, p, t, v, v, q][i] * 255)];
    }
  };

  // Convert a color from hsv space (hue in degrees, saturation and brightness
  // in the [0, 1] interval) to an RGB hex value
  flexo.hsv_to_hex = function (h, s, v) {
    return flexo.rgb_to_hex.apply(this, flexo.hsv_to_rgb(h, s, v));
  };

  // Convert an RGB color (3 values in the [0, 256[ interval) to a hex value
  flexo.rgb_to_hex = function () {
    return "#" + map.call(arguments,
      function (x) {
        return flexo.pad(flexo.clamp(Math.floor(x), 0, 255).toString(16), 2);
      }).join("");
  };

  // Convert a number to a color hex string. Use only the lower 24 bits.
  flexo.num_to_hex = function (n) {
    return "#" +  flexo.pad((n & 0xffffff).toString(16), 6);
  };


  // SVG

  // Get an SVG point for the event in the context of an SVG element (or the
  // closest svg element by default)
  flexo.event_svg_point = function(e, svg) {
    if (!svg) {
      svg = flexo.find_svg(e.target);
    }
    if (!svg) {
      return;
    }
    var p = svg.createSVGPoint();
    p.x = e.targetTouches ? e.targetTouches[0].clientX : e.clientX;
    p.y = e.targetTouches ? e.targetTouches[0].clientY : e.clientY;
    try {
      return p.matrixTransform(svg.getScreenCTM().inverse());
    } catch(e) {}
  };

  // Find the closest <svg> ancestor for a given element
  flexo.find_svg = function (elem) {
    if (!elem) {
      return;
    }
    if (elem.correspondingElement) {
      elem = elem.correspondingElement;
    }
    return elem.namespaceURI === flexo.ns.svg &&
      elem.localName === "svg" ? elem : flexo.find_svg(elem.parentNode);
  };

  flexo.deg2rad = function (degrees) {
    return degrees * π / 180;
  };

  // Make a list of points for a regular polygon with `sides` sides (should be
  // at least 3) inscribed in a circle of radius `r`. The first point is at
  // angle `phase`, which defaults to 0. The center of the circle may be set
  // with `x` and `y` (both default to 0.)
  flexo.poly_points = function (sides, r, phase, x, y) {
    phase = phase || 0;
    x = x || 0;
    y = y || 0;
    var points = [];
    for (var i = 0, ph = 2 * π / sides; i < sides; ++i) {
      points.push(x + r * Math.cos(phase + ph * i));
      points.push(y - r * Math.sin(phase + ph * i));
    }
    return points.join(" ");
  };

  // Create a regular polygon with the `sides` sides (should be at least 3),
  // inscribed in a circle of radius `r`, with an optional starting phase
  // (in degrees)
  flexo.$poly = function (attrs) {
    var sides = parseFloat(attrs.sides) || 0;
    var r = parseFloat(attrs.r) || 0;
    var phase = flexo.deg2rad(parseFloat(attrs.phase || 0));
    var x = parseFloat(attrs.x) || 0;
    var y = parseFloat(attrs.y) || 0;
    delete attrs.sides;
    delete attrs.r;
    delete attrs.phase;
    delete attrs.x;
    delete attrs.y;
    attrs.points = flexo.poly_points(sides, r, phase, x, y);
    return flexo.$polygon.apply(this, arguments);
  };

  // Create a star with `branches` branches inscribed in a circle of radius `r`,
  // with an optional starting phase (in degrees)
  flexo.$star = function (attrs) {
    var branches = parseFloat(attrs.branches) || 0;
    var r = parseFloat(attrs.r) || 0;
    var phase = parseFloat(attrs.phase || 0);
    var x = parseFloat(attrs.x) || 0;
    var y = parseFloat(attrs.y) || 0;
    delete attrs.branches;
    delete attrs.r;
    delete attrs.phase;
    delete attrs.x;
    delete attrs.y;
    var points = [];
    if (branches % 2 === 0) {
      var sides = branches / 2;
      return flexo.$g(attrs,
          flexo.$poly({ sides: sides, x: x, y: y, r: r, phase: phase }),
          flexo.$poly({ sides: sides, x: x, y: y, r: r,
            phase: phase + 360 / branches }));
    }
    phase = flexo.deg2rad(phase);
    for (var i = 0, ph = 4 * π / branches; i < branches; ++i) {
      points.push(x + r * Math.cos(phase + ph * i));
      points.push(y - r * Math.sin(phase + ph * i));
    }
    points.push(points[0]);
    points.push(points[1]);
    attrs.points = points.join(" ");
    return flexo.$polyline.apply(this, arguments);
  };

  // Triangle strips. The list of points should be at least 6 long (i.e. 3 pairs
  // of coordinates)
  flexo.$strip = function (attrs) {
    var points = (attrs.points || "").split(/\s*,\s*|\s+/);
    delete attrs.points;
    var g = flexo.$g.apply(this, arguments);
    for (var i = 0, n = points.length / 2 - 2; i < n; ++i) {
      g.appendChild(flexo.$polygon({ points:
        [points[2 * i], points[2 * i + 1],
         points[2 * i + 2], points[2 * i + 3],
         points[2 * i + 4], points[2 * i + 5],
         points[2 * i], points[2 * i + 1]
        ].join(" ")
      }));
    }
    return g;
  };

}(typeof exports === "object" ? exports : this.flexo = {}));
