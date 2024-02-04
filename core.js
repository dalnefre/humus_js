/*
 * core.js -- JavaScript core extensions
 *
 * author: Dale Schumacher <dale.schumacher@gmail.com>
 * website: dalnefre.com
 */

var version = '0.8.1 2024-02-03';
var id = function (el) {  // shorthand element lookup
	if (typeof el === 'string') {
		el = document.getElementById(el);
	}
	return el;
};
var println = function (el, msg) {
	if (el) {
		el.appendChild(document.createTextNode(msg + "\n"));
	}
};
var log = function (msg) {
	println(id('log'), msg);
};
var debug = function (msg) {
	println(id('debug'), msg);
};
var trace = function (msg) {
	println(id('trace'), msg);
};
var equal = function (x, y) {
	if (x === y) {
		return true;  // trivial (fast) case
	}
	if ((typeof x === 'object') && (x !== null)
	 && (typeof y === 'object') && (y !== null)) {
		if (typeof x.equals === 'function') {
			return x.equals(y);
		}
	}
	return false;
};
var create = function (o) {  // Crockford object creation pattern
	var _ = function () {};

	_.prototype = o;
	return new _();
};
var later = function (msec, method) {  // per Crockford
	var self = this;
	var args = Array.prototype.slice.apply(arguments, [2]);

	if (typeof method === 'string') {
		method = self[method];
	}
	setTimeout(function () {
		method.apply(self, args);
	}, msec);
	return self;
};
var hasProperties = function (o) {
	return o && ((typeof o === 'object') || (typeof o === 'function'));
};
var noOverwrite = function (dst, src, key) {
	return !dst.hasOwnProperty(key);
};
var noOverride = function (dst, src, key) {
	return !(key in dst);
};
var ownProperties = function (dst, src, key) {
	return src.hasOwnProperty(key);
};
var copyAll = function () {
	return true;
};
// copy properties to <dst> from <src> if <pred> holds
var extend = function (dst, src, pred) {
	var key;

	if (!hasProperties(dst)) {
		throw Error('Object.extend requires a target object');
	}
	if (hasProperties(src)) {
		pred = pred || copyAll;
		for (key in src) {
			if (pred(dst, src, key)) {
				dst[key] = src[key];
			}
		}
	}
	return dst;
};
// add <value> as field <name> on a constructor function without redefinition
var field = function (name, value) {
	if (name in this.prototype) {
		throw Error("Can't redefine " + name + " on " + this);
	}
	this.prototype[name] = value;
	return this;
};
// add <fn> as method <name> on a constructor function without redefinition
var method = function (name, fn) {
	if (typeof fn !== 'function') {
		throw Error("Function required in method('" + name + "', " + fn + ")");
	}
	return this.field(name, fn);
};

extend(extend, {
	noOverwrite: noOverwrite,
	noOverride: noOverride,
	ownProperties: ownProperties,
	copyAll: copyAll
});

extend(Object, {
	create: create,
	later: later,
	hasProperties: hasProperties,
	extend: extend
}, noOverride);

field.apply(Function, ['field', field]);
method.apply(Function, ['method', method]);

Function
.method('override', function (name, fn) {
	if (typeof fn !== 'function') {
		throw Error("Function required in override('" + name + "', " + fn + ")");
	}
	if (!(name in this.prototype)) {
		throw Error(name + " not defined on " + this);
	}
	this.prototype[name] = fn;
	return this;
})
.method('subclass', function (superclass) {
	extend(this.prototype, superclass.prototype, noOverwrite);
	this.superclass = superclass;
	return this;
});

var Dictionary = (function () {
	var factory;
	var forDefaultFn = function (item, acc) {
		acc.push(item);
		return acc;
	};
	var constructor = function Dictionary(data) {
		Object.extend(this, data, Object.extend.ownProperties);
	}
	.method('forEach', function (fn, acc) {
		var p;

		fn = fn || forDefaultFn;
		if (acc === undefined) {
			acc = [];
		}
		for (p in this) {
			if (this.hasOwnProperty(p)) {
				acc = fn(p, acc);
			}
		}
		return acc;
	})
	.method('forEachData', function (fn, acc) {
		var self = this;

		fn = fn || forDefaultFn;
		return this.forEach(function (key, acc) {
			if (typeof self[key] !== 'function') {
				acc = fn(key, acc);
			}
			return acc;
		}, acc);
	})
	.method('equals', function (other) {
		var self = this;

		if (typeof other !== 'object') {
			return false;
		} else {
			return this.forEachData(function (key, acc) {
				return acc && equal(self[key], other[key]);
			}, true);
		}
	})
	.override('toString', function () {
		var self = this;

		var a = this.forEachData(function (key, acc) {
			acc.push(key + ':' + self[key]);
			return acc;
		}, []);
		return '{' + a.join(', ') + '}';
	});

	factory = function (data) {
		var self = new constructor(data);

		self.constructor = constructor;
		return self;
	};
	factory.class = constructor;
	return factory;
})();

var AbstractMembersArray = (function () {
	return function MembersArray(data) {
		this.members = data || [];
	}
	.method('forEach', function (fn, acc) {
		var i;

		fn = fn || function (item, acc) {
			acc.push(item);
			return acc;
		};
		if (acc === undefined) {
			acc = [];
		}
		for (i = 0; i < this.members.length; i += 1) {
			acc = fn(this.members[i], acc);
		}
		return acc;
	});
})();

var Set = (function () {
	var factory;
	var constructor = function Set() {
		AbstractMembersArray.call(this);
	}
	.subclass(AbstractMembersArray)
	.method('cardinality', function () {
		return this.members.length;
	})
	.method('add', function (item) {
		if (!this.contains(item)) {
			this.members.push(item);
		}
		return this;
	})
	.method('contains', function (match) {
		return this.forEach(function (item, acc) {
			return acc || equal(item, match);
		}, false);
	})
	.method('remove', function (item) {
		var i;

		for (i = 0; i < this.members.length; i += 1) {
			if (equal(item, this.members[i])) {
				this.members.splice(i, 1);  // delete this member
				break;
			}
		}
		return this;
	})
	.override('toString', function () {
		return '{' + this.members.join(',') + '}';
	});

	factory = function () {
		var self = new constructor();

		self.constructor = constructor;
		return self;
	};
	factory.class = constructor;
	return factory;
})();

var Queue = (function () {
	var factory;
	var constructor = function Queue() {
		AbstractMembersArray.call(this);
	}
	.subclass(AbstractMembersArray)
	.method('size', function () {
		return this.members.length;
	})
	.method('put', function (item) {
		this.members.push(item);
		return this;
	})
	.method('take', function () {
		return this.members.shift();
	})
	.override('toString', function () {
		return '[' + this.members.join(',') + ']';
	});

	factory = function () {
		var self = new constructor();

		self.constructor = constructor;
		return self;
	};
	factory.class = constructor;
	return factory;
})();

var Sequence = (function () {
	var factory;
	var constructor = function Sequence(data) {
		AbstractMembersArray.call(this, data);
	}
	.subclass(AbstractMembersArray)
	.method('length', function () {
		return this.members.length;
	})
	.method('item', function (index) {
		if (index < this.members.length) {
			return this.members[index];
		}
	})
	.method('indexOf', function (pred) {
		var i;

		pred = pred || function (item) {
			return false;
		};
		for (i = 0; i < this.members.length; i += 1) {
			if (pred(this.members[i])) {
				return i;
			}
		}
		return -1;  // not found
	})
	.method('add', function (item) {
		this.members.push(item);
		return this;
	})
	.method('insert', function (index, item) {
		this.members.splice(index, 0, item);
		return this;
	})
	.method('remove', function (match) {
		var i = this.indexOf(function (item) {
			return equal(match, item);
		});

		if (i >= 0) {
			this.members.splice(i, 1);  // delete this member
		}
		return this;
	})
	.method('clone', function () {
		var i, target;

		target = factory();
		for (i = 0; i < this.members.length; i += 1) {
			target.add(this.members[i]);
		}
		return target;
	})
	.method('shuffle', function () {
		var r, data, N;

		data = this.members;
		N = data.length;
		this.members = [];
		while (N > 0) {
//				debug('shuffle: <'+this.members.join(',')+'> '+N+' <'+data.join(',')+'> ');
			r = Math.floor(Math.random() * N);
			this.members.push(data[r]);
			data.splice(r, 1);  // delete this entry
			N -= 1;  // shrink data range
		}
		return this;
	})
	.override('toString', function () {
		return '<' + this.members.join(',') + '>';
	});

	factory = function (data) {
		var self = new constructor(data);

		self.constructor = constructor;
		return self;
	};
	factory.class = constructor;
	factory.created = function (instance) {
		return ((typeof instance === 'object')
			&&  (instance !== null)
			&&  (instance.constructor === constructor));
	};
	return factory;
})();

var HtmlBuilder = (function () {  // HTML element factory
	var factory;
	var constructor = function HtmlBuilder(node, parent) {
		Dictionary.class.call(this);
		if (typeof node === 'object') {
			this.node = node;
			if ((typeof parent === 'object')
			 && (parent.constructor === constructor)) {
				this.parent = parent;
			}
		}
	}
	.subclass(Dictionary.class)
	.method('child', function (child) {
		if (this.node) {
			this.node.appendChild(child);
		}
		return new constructor(child, this);
	})
	.method('setAttrs', function (attrs) {
		if (this.node/* instanceof Element*/) {
			var p;

			for (p in attrs) {
				if (attrs.hasOwnProperty(p)) {
					if (typeof attrs[p] !== 'function') {
						this.node.setAttribute(p, attrs[p]);
					}
				}
			}
		}
		return this;
	})
	.method('text', function (value) {
		return this.child(document.createTextNode(value));
	})
	.method('element', function (name, attrs) {
		var child = this.child(document.createElement(name));
		return child.setAttrs(attrs);
	})
	.method('div', function (attrs) {
		return this.element('div', attrs);
	})
	.method('span', function (attrs) {
		return this.element('span', attrs);
	})
	.method('empty', function () {
		if (this.node/* instanceof HTMLElement*/) {
			this.node.innerHTML = '';
		}
		return this;
	});

	factory = function (data) {
		var self = new constructor(data);

		self.constructor = constructor;
		return self;
	};
	factory.class = constructor;
	return factory;
})();

export default Object.freeze({
	id,
	println,
	log,
	debug,
	trace,
	equal,
	Dictionary,
	AbstractMembersArray,
	Set,
	Queue,
	Sequence,
	HtmlBuilder,
	version
});
