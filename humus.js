/*
 * humus.js -- Humus simulator/debugger
 *
 * author: Dale Schumacher <dale.schumacher@gmail.com>
 */

import core from "./core.js";
//import Actor from "./actor.js";

var version = '0.8.1 2024-02-03';
var equal = core.equal;
//	var log = core.log;
//	var debug = function (msg) {
//		core.debug(msg);
//		core.trace('--?-- '+msg);
//	};
var trace = core.trace;
var Dictionary = core.Dictionary;
//	var Set = core.Set;
//	var Queue = core.Queue;
var println = function (msg) {
	core.println(core.id('output'), msg);
};

var UNDEF = {
	toString: function () {
		return '<UNDEF>';
	}
};
var NIL = {
	toString: function () {
		return '<NIL>';
	}
};
var Obj = (function () {
	var factory;
	var constructor = function Obj(data) {
		Dictionary.class.call(this, data);
	}
	.subclass(Dictionary.class)
	.method('error', function (msg) {
		throw Error(msg + ' ' + this);
	});

	factory = function (data) {
		var self = new constructor(data);

		self.constructor = constructor;
		return self;
	};
	factory.class = constructor;
	return factory;
})();
var Pr = (function () {
	var factory;
	var constructor = function Pair(h, t) {
		this.hd = h;
		this.tl = t;
	}
	.method('equals', function (that) {
		if (factory.created(that)) {
			return equal(this.hd, that.hd) && equal(this.tl, that.tl);
		}
		return false;
	})
	.override('toString', function () {
		return '<' + this.hd + ',' + this.tl + '>';
	});

	factory = function (h, t) {
		var self = new constructor(h, t);

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
var pp = function (value) {
	var s = '';
	var h, t;

	if (Pr.created(value)) {
		h = value.hd;
		t = value.tl;
		if (Pr.created(h)) {
			s += '(';
			s += pp(h);
			s += ')';
		} else {
			s += pp(h);
		}
		s += ', ';
		s += pp(t);
	} else if (value === UNDEF) {
		s += '?';
	} else if (value === NIL) {
		s += 'NIL';
	} else if (value === true) {
		s += 'TRUE';
	} else if (value === false) {
		s += 'FALSE';
	} else if (typeof value === 'string') {
		s += '#';
		s += value;
	} else {
		s += value;
	}
	return s;
};

export default Object.freeze(Dictionary({
	println,
	UNDEF,
	NIL,
	Obj,
	Pr,
	pp,
	version
}));
