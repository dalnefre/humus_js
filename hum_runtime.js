/*
 * hum_runtime.js -- Humus Runtime Environment
 *
 * author: Dale Schumacher <dale.schumacher@gmail.com>
 */

import core from "./core.js";
import Actor from "./actor.js";
import Humus from "./humus.js";
import hum_xlat from "./hum_xlat.js";

var version = '0.8.1 2024-02-03';
var warn = core.debug;
var equal = core.equal;
var HUM = Humus;
var Pr = HUM.Pr;
var UNDEF = HUM.UNDEF;
var NIL = HUM.NIL;
var sink_beh = Actor.sink_beh;
var random_range = function (lo, hi) {
	var r;

	hi = hi || lo;
	if (lo > hi) { var tmp = lo; lo = hi; hi = tmp; }
	return (lo + Math.floor(Math.random() * (hi + 1 - lo)));
};
var base_digit = function (base, digit) {
	if ((base < 2) || (base > 36)) {
		return undefined;
	}
	if ((digit >= 48) && (digit <= 57)) {  // [0-9]
		digit = digit - 48;
	} else if ((digit >= 65) && (digit <= 90)) {  // [A-Z]
		digit = (digit - 65) + 10;
	} else if ((digit >= 97) && (digit <= 122)) {  // [a-z]
		digit = (digit - 97) + 10;
	}
	if (digit < base) {
		return digit;
	}
	return undefined;
};

var factory;
var constructor = function Runtime(generator) {  // e.g.: gen_meta
	var cfg = Actor.Config();
	var GEN = generator(cfg);
	var XLAT = hum_xlat(GEN);
	var env;
	var println_beh = function (id) {
		id = id || 'output';
		return function (msg) {
			core.println(core.id(id), HUM.pp(msg));
		};
	};
	var timer_beh = function (config) {
		return function (msg) {
			if (Pr.created(msg)
			 && Pr.created(msg.tl)) {
				var delay = msg.hd;
				var message = msg.tl.hd;
				var actor = msg.tl.tl;
				var target;

				if ((typeof delay === 'number')
				 && (typeof actor === 'object')
				 && (actor.isActor)) {
					target = this.create(
						GEN.downcall_beh(config, actor),
						'_' + actor.id
					);
					this.sendAfter(delay, message, target);
				} else {
					warn('timer: invalid args: ' + args);
				}
			}
		};
	};
	var random_beh = function (config) {
		return function (msg) {
			if (Pr.created(msg)) {
				var cust = msg.hd;
				var range = msg.tl;

				cust = this.create(
					GEN.downcall_beh(config, cust),
					'_' + cust.id
				);
				this.send(Math.floor(Math.random() * range), cust);
			}
		};
	};
	var not_fn = function (arg) {
		if (arg === true) {
			return false;
		}
		if (arg === false) {
			return true;
		}
		warn('not('+arg+') -> ?');
		return UNDEF;
	};
	var or_fn = function (arg) {
		if (Pr.created(arg)) {
			var a = arg.hd;
			var b = arg.tl;

			if ((a === true) || (b === true)) {
				return true;
			}
			if ((a === false) && (b === false)) {
				return false;
			}
		}
		warn('or('+arg+') -> ?');
		return UNDEF;
	};
	var and_fn = function (arg) {
		if (Pr.created(arg)) {
			var a = arg.hd;
			var b = arg.tl;

			if ((a === false) || (b === false)) {
				return false;
			}
			if ((a === true) && (b === true)) {
				return true;
			}
		}
		warn('and('+arg+') -> ?');
		return UNDEF;
	};
	var neg_fn = function (arg) {
		if (typeof arg === 'number') {
			return -arg;
		}
		warn('neg('+arg+') -> ?');
		return UNDEF;
	};
	var add_fn = function (arg) {
		if (Pr.created(arg)) {
			var n = arg.hd;
			var m = arg.tl;

			if ((typeof n === 'number')
			 && (typeof m === 'number')) {
				return (n + m);
			}
		}
		warn('add('+arg+') -> ?');
		return UNDEF;
	};
	var sub_fn = function (arg) {
		if (Pr.created(arg)) {
			var n = arg.hd;
			var m = arg.tl;

			if ((typeof n === 'number')
			 && (typeof m === 'number')) {
				return (n - m);
			}
		}
		warn('sub('+arg+') -> ?');
		return UNDEF;
	};
	var mul_fn = function (arg) {
		if (Pr.created(arg)) {
			var n = arg.hd;
			var m = arg.tl;

			if ((typeof n === 'number')
			 && (typeof m === 'number')) {
				return (n * m);
			}
		}
		warn('mul('+arg+') -> ?');
		return UNDEF;
	};
	var div_fn = function (arg) {
		if (Pr.created(arg)) {
			var n = arg.hd;
			var m = arg.tl;

			if ((typeof n === 'number')
			 && (typeof m === 'number')
			 && (m !== 0)) {
				return Math.floor(n / m);
			}
		}
		warn('div('+arg+') -> ?');
		return UNDEF;
	};
	var eq_fn = function (arg) {
		if (Pr.created(arg)) {
			return equal(arg.hd, arg.tl);
		}
		return UNDEF;
	};
	var compare_fn = function (arg) {
		if (Pr.created(arg)) {
			var n = arg.hd;
			var m = arg.tl;

			if (n === m) {
				return 0;
			}
			if ((typeof n === 'number')
			 && (typeof m === 'number')) {
			 	if (n < m) {
			 		return -1;
			 	}
			 	if (n > m) {
			 		return 1;
			 	}
				return 0;
			}
		}
		warn('compare('+arg+') -> ?');
		return UNDEF;
	};
	var less_fn = function (arg) {
		var cmp = compare_fn(arg);

		if (cmp === UNDEF) {
			return UNDEF;
		}
		return (cmp < 0);
	};
	var less_equal_fn = function (arg) {
		var cmp = compare_fn(arg);

		if (cmp === UNDEF) {
			return UNDEF;
		}
		return (cmp <= 0);
	};
	var greater_equal_fn = function (arg) {
		var cmp = compare_fn(arg);

		if (cmp === UNDEF) {
			return UNDEF;
		}
		return (cmp >= 0);
	};
	var greater_fn = function (arg) {
		var cmp = compare_fn(arg);

		if (cmp === UNDEF) {
			return UNDEF;
		}
		return (cmp > 0);
	};
	var tuple_to_number_fn = function (arg) {
		var n = 0;
		var b, d, m;

		try {
			if (!Pr.created(arg)) {
				throw Error('Bad Number Format');
			}
			b = arg.hd;
			d = arg.tl;
			if (typeof b !== 'number') {
				throw Error('Bad Number Format');
			}
			while (d !== NIL) {
				if (Pr.created(d)
				 && (typeof d.hd === 'number')) {
					m = base_digit(b, d.hd);
					if (m === undefined) {
						throw Error('Bad Number Format');
					}
					n = (n * b) + m;
					d = d.tl;
				} else if (typeof d === 'number') {
					d = Pr(d, NIL);
				} else {
					throw Error('Bad Number Format');
				}
			}
		} catch (e) {
			warn('tuple_to_number('+arg+') -> ?');
			return UNDEF;
		}
		return n;
	};
	var tuple_to_symbol_fn = function (arg) {
		var s = '';
		var c;

		try {
			while (arg !== NIL) {
				if (Pr.created(arg)
				 && (typeof arg.hd === 'number')) {
					s += String.fromCharCode(arg.hd);
					arg = arg.tl;
				} else if (typeof arg === 'number') {
					arg = Pr(arg, NIL);
				} else {
					throw Error('Bad Symbol Format');
				}
			}
		} catch (e) {
			warn('tuple_to_symbol('+arg+') -> ?');
			return UNDEF;
		}
		return s;
	};
	var in_range_set_fn = function (arg) {
		if (Pr.created(arg)
		&&  (typeof arg.tl === 'number')) {
			var range_set = arg.hd;
			var token = arg.tl;

			while (Pr.created(range_set)) {
				var h = range_set.hd;
				var t = range_set.tl;

				range_set = t;
				if (Pr.created(h)) {
					t = h.tl;
					h = h.hd;

					if ((typeof h === 'number')
					&&  (typeof t === 'number')
					&&  (h <= token)
					&&  (token <= t)) {
						return true;
					}
				} else if (h === token) {
					return true;
				}
			}
			if (range_set === NIL) {
				return false;
			}
		}
		warn('in_range_set('+arg+') -> ?');
		return UNDEF;
	};
	/*
	LET map_empty = \_.?
	*/
	var f_map_empty = GEN.Actor(
		function (msg) {
			if (Pr.created(msg)) {
				var cust = msg.hd;
				var req = msg.tl;

				if (Pr.created(req)
				 && (req.hd === 'apply')) {
				 	this.send(UNDEF, cust);
				}
			}
		},
		'map_empty_fn'
	);
	/*
	LET map_bind(map, key, value) = \lookup.(
		CASE lookup OF
		$key : value
		_ : map(lookup)
		END
	)
	*/
	var map_bind_fn = function (arg) {
		if (Pr.created(arg)
		 && Pr.created(arg.tl)) {
			var map = arg.hd;
			var key = arg.tl.hd;
			var value = arg.tl.tl;

			if (map === f_map_empty) {
				map = GEN.Actor(function (msg) {
					if (Pr.created(msg)) {
						var cust = msg.hd;
						var req = msg.tl;

						if (Pr.created(req)
						 && (req.hd === 'apply')) {
							var key_ = req.tl;

							this.send(map._lookup(key_), cust);
						}
					}
				}, 'map(key)->value');
				map._lookup = function (key_) {
					if (equal(key, key_)) {
						return value;
					} else {
						return UNDEF;
					}
				};
				map._bind = function (key, value) {
					var lookup_ = map._lookup;

/*						core.log(map+' bind '+key+' -> '+value); */
					map._lookup = function (key_) {
						if (equal(key, key_)) {
							return value;
						} else {
							return lookup_(key_);
						}
					}
				};
			} else {
				map._bind(key, value);
			}
			return map;
		}
	};
	var execute = function (id) {
		var el, stmt;
		var repl_beh = function (status) {
			if (status === 'ok') {
				try {
					stmt = XLAT.compile();
					if (stmt) {
						this.send(
							Pr(this.self, Pr('exec', Pr(env, a_sponsor))),
							stmt
						);
					}
				} catch (e) {
					alert('compile: '+e+'\n'+e.subject);
				}
			} else {
				alert('status = '+status);
			}
		};

		id = id || 'script';
		el = core.id(id);
		if (el) {
			try {
				XLAT.parse(el.value);
				cfg.send('ok', cfg.create(repl_beh, 'REPL'));
			} catch (e) {
				alert('parse: '+e);
			}
		}
	};
//		var a_logger = GEN.Actor(sink_beh, 'logger');
	var a_logger = GEN.Actor(println_beh('debug'), 'logger');
	var a_config = GEN.Actor(GEN.config_beh(a_logger), 'config');
	var a_timer = GEN.Actor(timer_beh(a_config), 'timer');
	var d_timer = GEN.Actor(GEN.upcall_beh(a_timer), '^timer');
	var d_random = GEN.Actor(GEN.upcall_beh(
		GEN.Actor(random_beh(a_config), 'random')
	), '^random');
	var a_println = GEN.Actor(println_beh('output'), 'println');
	var d_println = GEN.Actor(GEN.upcall_beh(a_println), '^println');
	var a_sponsor = GEN.Actor(GEN.repl_sponsor_beh(a_config, a_println), 'sponsor');
	var env = GEN.Actor(GEN.empty_env_beh, 'empty_env');
/*		core.log('initializing environment'); */
	env = GEN.Actor(GEN.repl_env_beh({
		'versions':
			Pr( 'Xlat v'+XLAT.version,
				Pr( 'GEN v'+GEN.version,
					Pr( 'Runtime v'+version,
						'Humus v'+HUM.version
					)
				)
			),
		'sink':
			GEN.Actor(GEN.upcall_beh(cfg.sink), '^sink'),
		'random': d_random,
		'timer': d_timer,
		'println': d_println,
		'map_empty': f_map_empty,
		'map_bind':
			GEN.Actor(GEN.native_fn_beh(map_bind_fn), 'map_bind_fn'),
		'tuple_to_symbol':
			GEN.Actor(GEN.native_fn_beh(tuple_to_symbol_fn), 'tuple_to_symbol_fn'),
		'tuple_to_number':
			GEN.Actor(GEN.native_fn_beh(tuple_to_number_fn), 'tuple_to_number_fn'),
		'in_range_set':
			GEN.Actor(GEN.native_fn_beh(in_range_set_fn), 'in_range_set_fn'),
		'less':
			GEN.Actor(GEN.native_fn_beh(less_fn), 'less_fn'),
		'less_equal':
			GEN.Actor(GEN.native_fn_beh(less_equal_fn), 'less_equal_fn'),
		'greater_equal':
			GEN.Actor(GEN.native_fn_beh(greater_equal_fn), 'greater_equal_fn'),
		'greater':
			GEN.Actor(GEN.native_fn_beh(greater_fn), 'greater_fn'),
		'not':
			GEN.Actor(GEN.native_fn_beh(not_fn), 'not_fn'),
		'or':
			GEN.Actor(GEN.native_fn_beh(or_fn), 'or_fn'),
		'and':
			GEN.Actor(GEN.native_fn_beh(and_fn), 'and_fn'),
		'neg':
			GEN.Actor(GEN.native_fn_beh(neg_fn), 'neg_fn'),
		'div':
			GEN.Actor(GEN.native_fn_beh(div_fn), 'div_fn'),
		'sub':
			GEN.Actor(GEN.native_fn_beh(sub_fn), 'sub_fn'),
		'mul':
			GEN.Actor(GEN.native_fn_beh(mul_fn), 'mul_fn'),
		'add':
			GEN.Actor(GEN.native_fn_beh(add_fn), 'add_fn'),
		'eq':
			GEN.Actor(GEN.native_fn_beh(eq_fn), 'eq_fn'),
		'compare':
			GEN.Actor(GEN.native_fn_beh(compare_fn), 'compare_fn')
	}, env), 'repl_env');

	cfg.send('v'+HUM.version+'\n', a_println);
	cfg.run();

	this.config = cfg;
	this.execute = execute;
	this.timer_svc = d_timer;  // <-- EXPOSE GLOBAL TIMER SERVICE
}
.field('version', version)
.override('toString', function () {
	return '<Runtime v' + this.version + '>';
});

factory = function (generator) {
	var self = new constructor(generator);

	self.constructor = constructor;
	return self;
};
factory.class = constructor;
factory.created = function (instance) {
	return ((typeof instance === 'object')
		&&  (instance !== null)
		&&  (instance.constructor === constructor));
};

export default Object.freeze(factory);
