/*
 * humus.js -- Humus simulator/debugger
 *
 * author: Dale Schumacher <dale.schumacher@gmail.com>
 * requires: core.js, actor.js
 */

if (typeof DALNEFRE === 'undefined') {
	throw Error('Namespace "DALNEFRE" required!');
}
if (typeof DALNEFRE.Actor === 'undefined') {
	throw Error('Namespace "DALNEFRE.Actor" required!');
}
if (typeof DALNEFRE.Humus !== 'undefined') {
	throw Error('Namespace "DALNEFRE.Humus" already defined!');
}

DALNEFRE.Humus = (function (self) {
	var version = '0.7.0 2011-01-21';
	var DAL = DALNEFRE;
	var equal = DAL.equal;
//	var log = DAL.log;
//	var debug = function (msg) {
//		DAL.debug(msg);
//		DAL.trace('--?-- '+msg);
//	};
	var trace = DAL.trace;
	var Dictionary = DAL.Dictionary;
//	var Set = DAL.Set;
//	var Queue = DAL.Queue;
	var println = function (msg) {
		DAL.println(DAL.id('output'), msg);
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

	self = Dictionary({
		println: println,
		UNDEF: UNDEF,
		NIL: NIL,
		Obj: Obj,
		Pr: Pr,
		pp: pp,
		version: version
	});
	return self;
})();
