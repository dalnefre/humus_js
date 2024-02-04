/*
 * humus_test.js -- humus.js unit tests
 *
 * author: Dale Schumacher <dale.schumacher@gmail.com>
 */

 import core from "./core.js";
 import Actor from "./actor.js";
 import Humus from "./humus.js";
 import gen_meta from "./gen_meta.js";
 import Test from "./test.js";

function testSuite(callback) {
	var log = core.trace;  // log to trace channel
	var trace = core.trace;
	var debug = core.debug;
	var Dictionary = core.Dictionary;
	var Config = Actor.Config;
	var sink_beh = Actor.sink_beh;
	var Msg = Dictionary;  // local alias
	var HUM = Humus;  // shorter alias
	var UNDEF = HUM.UNDEF;
	var NIL = HUM.NIL;
	var Pr = HUM.Pr;
	var suite = Test.Suite();
	var asyncTest = function (name, test_fn) {
		suite.asyncTest(name, function () {
			log('... '+name+' ...');
			test_fn();
		});
	};
	var asyncWait = suite.asyncWait;
	var asyncDone = suite.asyncDone;
	var test = function (name, test_fn) {
		suite.test(name, function () {
			log('--- '+name+' ---');
			test_fn();
		});
	};
	var fail = suite.fail;
	var assertEqual = suite.assertEqual;

	var assert_fail_beh = function (msg) {
		fail('assert_fail_beh');
	};
	var assert_end_beh = function (end) {
		return function (msg) {
			assertEqual(end, msg, 'assert_end_beh');
			this.become(assert_fail_beh);
		};
	};
	var assert_equal_beh = function (expect, next) {
		return function (actual) {
			assertEqual(expect, actual);
			this.become(next);
		};
	};

	test('pair basics', function () {
		var p = Pr(0, 1);
		
		assertEqual(false, Pr.created(0), 'Pr.created(0)');
		assertEqual(false, Pr.created(undefined), 'Pr.created(undefined)');
		assertEqual(false, Pr.created(null), 'Pr.created(null)');
		assertEqual(true, Pr.created(p), 'Pr.created(p)');
		assertEqual('<0,1>', p.toString(), '<0,1>.toString()');
		assertEqual(0, p.hd, '<0,1>.hd');
		assertEqual(1, p.tl, '<0,1>.tl');
		assertEqual(p, Pr(0, 1), 'p.equals(Pr(0, 1))');
		assertEqual(Pr(0, Pr(Pr(1, 2), 3)), Pr(0, Pr(Pr(1, 2), 3)), 'deep equals');
	});
	test('mock Actor', function () {
		var self = this;
		var cfg = Config();
		var GEN = gen_meta(cfg);  // select generator
		var Actor = GEN.Actor;
		var mock;
		
		mock = Actor(
			assert_equal_beh(
				true, 
				assert_end_beh(self)
			), 
			'mock'
		);
		cfg.send(true, mock);
		assertEqual(1, cfg.pending(), 'pending before');
		assertEqual(true, cfg.dispatch());
		assertEqual(false, cfg.dispatch());
		assertEqual(0, cfg.pending(), 'pending after');
		// verify mock
		cfg.send(self, mock);
		assertEqual(true, cfg.dispatch(), 'end mock');
		assertEqual(false, cfg.dispatch(), 'end config');		
	});
	test('const expr', function () {
		var self = this;
		var cfg = Config();
		var GEN = gen_meta(cfg);  // select generator
		var empty_env_beh = GEN.empty_env_beh;
		var const_expr_beh = GEN.const_expr_beh;
		var empty_env = cfg.create(empty_env_beh, 'empty_env');
		var mock = cfg.create(
			assert_equal_beh(
				'k', 
				assert_end_beh(self)
			),
			'mock'
		);
		var const_expr = cfg.create(const_expr_beh('k'), 'const:k');

		// test behavior
		cfg.send(
			Pr(mock, Pr('eval', empty_env)),
			const_expr
		);
		assertEqual(1, cfg.pending(), 'pending before');
		assertEqual(2, cfg.dispatchLoop(1000));
		assertEqual(0, cfg.pending(), 'pending after');
		// verify mock
		cfg.send(self, mock);
		assertEqual(true, cfg.dispatch(), 'end mock');
		assertEqual(false, cfg.dispatch(), 'end config');
	});
	test('ident expr', function () {
		var self = this;
		var cfg = Config();
		var GEN = gen_meta(cfg);  // select generator
		var empty_env_beh = GEN.empty_env_beh;
		var env_beh = GEN.env_beh;
		var ident_expr_beh = GEN.ident_expr_beh;
		var empty_env = cfg.create(empty_env_beh, 'empty_env');
		var env = cfg.create(env_beh('x', 'var', empty_env), 'env:x');
		var mock = cfg.create(
			assert_equal_beh(
				'var', 
				assert_end_beh(self)
			),
			'mock'
		);
		var ident_expr = cfg.create(ident_expr_beh('x'), 'ident:x');

		// test behavior
		cfg.send(
			Pr(mock, Pr('eval', env)),
			ident_expr
		);
		assertEqual(1, cfg.pending(), 'pending before');
		assertEqual(3, cfg.dispatchLoop(1001));
		assertEqual(0, cfg.pending(), 'pending after');
		// verify mock
		cfg.send(self, mock);
		assertEqual(true, cfg.dispatch(), 'end mock');
		assertEqual(false, cfg.dispatch(), 'end config');
	});
/*
# (\i.i)(42) => 42
SEND (println, #eval, undef_env) TO
	NEW app_expr_beh(
		NEW abs_expr_beh(
			NEW ident_ptrn_beh(#i),
			NEW ident_expr_beh(#i)
		),
		NEW const_expr_beh(42)
	)
*/
	test('identity function', function () {
		var self = this;
		var cfg = Config();
		var GEN = gen_meta(cfg);  // select generator
		var Actor = GEN.Actor;
		var empty_env_beh = GEN.empty_env_beh;
		var abs_expr_beh = GEN.abs_expr_beh;
		var app_expr_beh = GEN.app_expr_beh;
		var const_expr_beh = GEN.const_expr_beh;
		var ident_expr_beh = GEN.ident_expr_beh;
		var ident_ptrn_beh = GEN.ident_ptrn_beh;
		var empty_env = Actor(empty_env_beh, 'empty_env');
		var mock = Actor(
			assert_equal_beh(
				42, 
				assert_end_beh(self)
			),
			'mock'
		);
		var expr = Actor(
			app_expr_beh(
				Actor(
					abs_expr_beh(
						Actor(ident_ptrn_beh('i'), 'ptrn:i'),
						Actor(ident_expr_beh('i'), 'ident:i')
					),
					'abs:i'
				),
				Actor(const_expr_beh(42), 'const:42')
			),
			'app:42'
		);

		// test behavior
		cfg.send(
			Pr(mock, Pr('eval', empty_env)),
			expr
		);
		assertEqual(1, cfg.pending(), 'pending before');
		assertEqual(17, cfg.dispatchLoop(1002));
		assertEqual(0, cfg.pending(), 'pending after');
		// verify mock
		cfg.send(self, mock);
		assertEqual(true, cfg.dispatch(), 'end mock');
		assertEqual(false, cfg.dispatch(), 'end config');
	});
/*
# ((\x.\y.x)(#t))(#f) => #t
SEND (println, #eval, undef_env) TO
	NEW app_expr_beh(
		NEW app_expr_beh(
			NEW abs_expr_beh(
				NEW ident_ptrn_beh(#x),
				NEW abs_expr_beh(
					NEW ident_ptrn_beh(#y),
					NEW ident_expr_beh(#x)
				)
			),
			NEW const_expr_beh(#t)
		),
		NEW const_expr_beh(#f)
	)
*/
	test('true conditional function', function () {
		var self = this;
		var cfg = Config();
		var GEN = gen_meta(cfg);  // select generator
		var Actor = GEN.Actor;
		var empty_env_beh = GEN.empty_env_beh;
		var const_expr_beh = GEN.const_expr_beh;
		var ident_expr_beh = GEN.ident_expr_beh;
		var abs_expr_beh = GEN.abs_expr_beh;
		var app_expr_beh = GEN.app_expr_beh;
		var ident_ptrn_beh = GEN.ident_ptrn_beh;
		var empty_env = Actor(empty_env_beh, 'empty_env');
		var mock = Actor(
			assert_equal_beh(
				true, 
				assert_end_beh(self)
			),
			'mock'
		);
		var expr = Actor(
			app_expr_beh(
				Actor(
					app_expr_beh(
						Actor(
							abs_expr_beh(
								Actor(ident_ptrn_beh('x'), 'ptrn:x'),
								Actor(
									abs_expr_beh(
										Actor(ident_ptrn_beh('y'), 'ptrn:y'),
										Actor(ident_expr_beh('x'), 'ident:x')
									),
									'abs:y'
								)
							),
							'abs:x'
						),
						Actor(const_expr_beh(true), 'const:true')
					),
					'app:true'
				),
				Actor(const_expr_beh(false), 'const:false')
			),
			'app:false'
		);

		// test behavior
		cfg.send(
			Pr(mock, Pr('eval', empty_env)),
			expr
		);
		assertEqual(1, cfg.pending(), 'pending before');
		assertEqual(32, cfg.dispatchLoop(1003));
		assertEqual(0, cfg.pending(), 'pending after');
		// verify mock
		cfg.send(self, mock);
		assertEqual(true, cfg.dispatch(), 'end mock');
		assertEqual(false, cfg.dispatch(), 'end config');
	});
/*
# LET zero? = \x.(
#	CASE x OF
#	0 : TRUE
#	_ : FALSE
#	END
# )
CREATE global_env WITH env_beh(
	#zero?, 
	NEW closure_beh(
		#x, 
		NEW case_expr_beh(
			NEW ident_expr_beh(#x),
			NEW case_choice_beh(
				NEW const_ptrn_beh(0),
				NEW const_expr_beh(TRUE),
				NEW case_choice_beh(
					NEW ident_ptrn_beh(#_),
					NEW const_expr_beh(FALSE),
					case_end
				)
			)
		), 
		undef_env
	),
	undef_env)
*/
	test('zero? = \\x.CASE x OF ... END', function () {
		var self = this;
		var cfg = Config();
		var GEN = gen_meta(cfg);  // select generator
		var Actor = GEN.Actor;
		var empty_env_beh = GEN.empty_env_beh;
		var env_beh = GEN.env_beh;
		var const_expr_beh = GEN.const_expr_beh;
		var ident_expr_beh = GEN.ident_expr_beh;
		var abs_expr_beh = GEN.abs_expr_beh;
		var closure_beh = GEN.closure_beh;
		var app_expr_beh = GEN.app_expr_beh;
		var case_expr_beh = GEN.case_expr_beh;
		var case_choice_beh = GEN.case_choice_beh;
		var case_end_beh = GEN.case_end_beh;
		var const_ptrn_beh = GEN.const_ptrn_beh;
		var ident_ptrn_beh = GEN.ident_ptrn_beh;
		var empty_env = Actor(empty_env_beh, 'empty_env');
		var zero_fn = Actor(
			closure_beh(
				Actor(ident_ptrn_beh('x'), 'ptrn:x'),
				Actor(
					case_expr_beh(
						Actor(ident_expr_beh('x'), 'ident:x'),
						Actor(
							case_choice_beh(
								Actor(const_ptrn_beh(0), 'ptrn:0'),
								Actor(const_expr_beh(true), 'const:true'),
								Actor(
									case_choice_beh(
										Actor(ident_ptrn_beh('_'), 'ptrn:_'),
										Actor(const_expr_beh(false), 'const:false'),
										Actor(case_end_beh, 'END')
									),
									'OF _'
								)
							),
							'OF 0'
						)
					),
					'CASE'
				),
				empty_env
			),
			'fn:x'
		);
		var global_env = Actor(env_beh('zero?', zero_fn, empty_env), 'env:zero?');
/*
# zero?(0) => TRUE
SEND (NEW assert_eq_beh(TRUE), #eval, global_env) TO
	NEW app_expr_beh(
		NEW ident_expr_beh(#zero?),
		NEW const_expr_beh(0)
	)
*/
		var t_mock = Actor(
			assert_equal_beh(
				true, 
				assert_end_beh(self)
			),
			'assert_eq:true'
		);
		var t_expr = Actor(
			app_expr_beh(
				Actor(ident_expr_beh('zero?'), 'ident:zero?'),
				Actor(const_expr_beh(0), 'const:0')
			),
			'app:0'
		);
		// test behavior
		cfg.send(
			Pr(t_mock, Pr('eval', global_env)),
			t_expr
		);
		assertEqual(1, cfg.pending(), 'pending before');
		assertEqual(24, cfg.dispatchLoop(1004));
		assertEqual(0, cfg.pending(), 'pending after');
		// verify mock
		cfg.send(self, t_mock);
		assertEqual(true, cfg.dispatch(), 'end t_mock');
		assertEqual(false, cfg.dispatch(), 'end config');

/*
# zero?(1) => FALSE
SEND (NEW assert_eq_beh(FALSE), #eval, global_env) TO
	NEW app_expr_beh(
		NEW ident_expr_beh(#zero?),
		NEW const_expr_beh(1)
	)
*/
		var f_mock = Actor(
			assert_equal_beh(
				false, 
				assert_end_beh(self)
			),
			'assert_eq:false'
		);
		var f_expr = Actor(
			app_expr_beh(
				Actor(ident_expr_beh('zero?'), 'ident:zero?'),
				Actor(const_expr_beh(1), 'const:1')
			),
			'app:1'
		);

		// test behavior
		cfg.send(
			Pr(f_mock, Pr('eval', global_env)),
			f_expr
		);
		assertEqual(1, cfg.pending(), 'pending before');
		assertEqual(28, cfg.dispatchLoop(1005));
		assertEqual(0, cfg.pending(), 'pending after');
		// verify mock
		cfg.send(self, f_mock);
		assertEqual(true, cfg.dispatch(), 'end f_mock');
		assertEqual(false, cfg.dispatch(), 'end config');
	});
/*
# LET eq? = \x.\y.(
#	CASE y OF
#	$x : TRUE
#	_ : FALSE
#	END
# )
CREATE eq? WITH closure_beh(
	NEW ident_ptrn_beh(#x),
	NEW abs_expr_beh(
		NEW ident_ptrn_beh(#y),
		NEW case_expr_beh(
			NEW ident_expr_beh(#y),
			NEW case_choice_beh(
				NEW value_ptrn_beh(
					NEW ident_expr_beh(#x)
				),
				NEW const_expr_beh(TRUE)
			),
			NEW case_choice_beh(
				any_ptrn,
				NEW const_expr_beh(FALSE),
				case_end
			)
		)
	),
	undef_env
)
*/
	test('eq? = \\x.\\y.CASE y OF ... END', function () {
		var self = this;
		var cfg = Config();
		var GEN = gen_meta(cfg);  // select generator
		var Actor = GEN.Actor;
		var empty_env_beh = GEN.empty_env_beh;
		var env_beh = GEN.env_beh;
		var const_expr_beh = GEN.const_expr_beh;
		var ident_expr_beh = GEN.ident_expr_beh;
		var abs_expr_beh = GEN.abs_expr_beh;
		var closure_beh = GEN.closure_beh;
		var app_expr_beh = GEN.app_expr_beh;
		var case_expr_beh = GEN.case_expr_beh;
		var case_choice_beh = GEN.case_choice_beh;
		var case_end_beh = GEN.case_end_beh;
		var value_ptrn_beh = GEN.value_ptrn_beh;
		var ident_ptrn_beh = GEN.ident_ptrn_beh;
		var any_ptrn_beh = GEN.any_ptrn_beh;
		var empty_env = Actor(empty_env_beh, 'empty_env');
		var eq_fn = Actor(
			closure_beh(
				Actor(ident_ptrn_beh('x'), 'ptrn:x'),
				Actor(
					abs_expr_beh(
						Actor(ident_ptrn_beh('y'), 'ptrn:y'),
						Actor(
							case_expr_beh(
								Actor(ident_expr_beh('y'), 'ident:y'),
								Actor(
									case_choice_beh(
										Actor(
											value_ptrn_beh(
												Actor(ident_expr_beh('x'), 'ident:x')
											),
											'value:x'
										),
										Actor(const_expr_beh(true), 'const:true'),
										Actor(
											case_choice_beh(
												Actor(any_ptrn_beh, 'ptrn:_'),
												Actor(const_expr_beh(false), 'const:false'),
												Actor(case_end_beh, 'END')
											),
											'OF _'
										)
									),
									'OF $x'
								)
							),
							'CASE'
						)
					),
					'fn:y'
				),
				empty_env
			),
			'fn:x'
		);
		var global_env = Actor(env_beh('eq?', eq_fn, empty_env), 'env:eq?');
/*
# (eq?(0))(1) => FALSE
SEND (NEW assert_eq_beh(FALSE), #eval, global_env) TO
	NEW app_expr_beh(
		NEW app_expr_beh(
			NEW ident_expr_beh(#eq?),
			NEW const_expr_beh(0)
		),
		NEW const_expr_beh(1)
	)
*/
		var f_mock = Actor(
			assert_equal_beh(
				false, 
				assert_end_beh(self)
			),
			'assert_eq:false'
		);
		var f_expr = Actor(
			app_expr_beh(
				Actor(
					app_expr_beh(
						Actor(ident_expr_beh('eq?'), 'ident:eq?'),
						Actor(const_expr_beh(0), 'const:0')
					),
					'app:0'
				),
				Actor(const_expr_beh(1), 'const:1')
			),
			'app:1'
		);

		// test behavior
		cfg.send(
			Pr(f_mock, Pr('eval', global_env)),
			f_expr
		);
		assertEqual(1, cfg.pending(), 'pending before');
		assertEqual(48, cfg.dispatchLoop(1006));
		assertEqual(0, cfg.pending(), 'pending after');
		// verify mock
		cfg.send(self, f_mock);
		assertEqual(true, cfg.dispatch(), 'end f_mock');
		assertEqual(false, cfg.dispatch(), 'end config');
	});
/*
# LET z = 0 IN (1, z)
CREATE expr WITH pair_expr_beh(
	NEW const_expr_beh(1),
	NEW ident_expr_beh(#z)
)
*/
	test('LET z = 0 IN (1, z)', function () {
		var self = this;
		var cfg = Config();
		var GEN = gen_meta(cfg);  // select generator
		var Actor = GEN.Actor;
		var empty_env_beh = GEN.empty_env_beh;
		var env_beh = GEN.env_beh;
		var const_expr_beh = GEN.const_expr_beh;
		var ident_expr_beh = GEN.ident_expr_beh;
		var pair_expr_beh = GEN.pair_expr_beh;
		var env = Actor(empty_env_beh, 'empty_env');
		var mock = Actor(
			assert_equal_beh(
				Pr(1, 0), 
				assert_end_beh(self)
			),
			'mock'
		);
		var expr = Actor(
			pair_expr_beh(
				Actor(const_expr_beh(1), 'const:1'),
				Actor(ident_expr_beh('z'), 'ident:z')
			),
			'pair'
		);

		env = Actor(env_beh('z', 0, env), 'env:z');
		// test behavior
		cfg.send(
			Pr(mock, Pr('eval', env)),
			expr
		);
		assertEqual(1, cfg.pending(), 'pending before');
		assertEqual(10, cfg.dispatchLoop(1007));
		assertEqual(0, cfg.pending(), 'pending after');
		// verify mock
		cfg.send(self, mock);
		assertEqual(true, cfg.dispatch(), 'end mock');
		assertEqual(false, cfg.dispatch(), 'end config');
	});
/*
# LET pr = \(a, b).\c.(c(a, b))
CREATE pr WITH abs_expr_beh(
	NEW pair_ptrn_beh(
		NEW ident_ptrn_beh(#a),
		NEW ident_ptrn_beh(#b)
	),
	NEW abs_expr_beh(
		NEW ident_ptrn_beh(#c), 
		NEW app_expr_beh(
			NEW ident_expr_beh(#c),
			NEW pair_expr_beh(
				NEW ident_expr_beh(#a),
				NEW ident_expr_beh(#b)
			)
		)
	)
)
*/
	test('pr = \\(a, b).\\c.(c(a, b))', function () {
		var self = this;
		var cfg = Config();
		var GEN = gen_meta(cfg);  // select generator
		var Actor = GEN.Actor;
		var empty_env_beh = GEN.empty_env_beh;
		var env_beh = GEN.env_beh;
		var const_expr_beh = GEN.const_expr_beh;
		var ident_expr_beh = GEN.ident_expr_beh;
		var abs_expr_beh = GEN.abs_expr_beh;
		var closure_beh = GEN.closure_beh;
		var app_expr_beh = GEN.app_expr_beh;
		var pair_expr_beh = GEN.pair_expr_beh;
		var ident_ptrn_beh = GEN.ident_ptrn_beh;
		var pair_ptrn_beh = GEN.pair_ptrn_beh;
		var env = Actor(empty_env_beh, 'empty_env');
		var pr_fn = Actor(
			closure_beh(
				Actor(
					pair_ptrn_beh(
						Actor(ident_ptrn_beh('a'), 'ptrn:a'),
						Actor(ident_ptrn_beh('b'), 'ptrn:b')
					), 
					'ptrn:(a,b)'
				),
				Actor(abs_expr_beh(
						Actor(ident_ptrn_beh('c'), 'ptrn:c'),
						Actor(
							app_expr_beh(
								Actor(ident_expr_beh('c'), 'ident:c'),
								Actor(
									pair_expr_beh(
										Actor(ident_expr_beh('a'), 'ident:a'),
										Actor(ident_expr_beh('b'), 'ident:b')
									),
									'pair:a,b'
								)
							),
							'app:c(a,b)'
						)
					),
					'fn:c'
				),
				env
			),
			'pr(a,b)'
		);
/*
# LET hd = \c.c(\(a, b).a)
CREATE hd WITH abs_expr_beh(
	NEW ident_ptrn_beh(#c),
	NEW app_expr_beh(
		NEW ident_expr_beh(#c),
		NEW abs_expr_beh(
			NEW pair_ptrn_beh(
				NEW ident_ptrn_beh(#a),
				NEW ident_ptrn_beh(#b)
			),
			NEW ident_expr_beh(#a)
		)
	)
)
*/
		var hd_fn = Actor(
			closure_beh(
				Actor(ident_ptrn_beh('c'), 'ptrn:c'),
				Actor(
					app_expr_beh(
						Actor(ident_expr_beh('c'), 'ident:c'),
						Actor(
							abs_expr_beh(
								Actor(
									pair_ptrn_beh(
										Actor(ident_ptrn_beh('a'), 'ptrn:a'),
										Actor(ident_ptrn_beh('b'), 'ptrn:b')
									),
									'ptrn:(a,b)'
								),
								Actor(ident_expr_beh('a'), 'ident:a')
							),
							'abs:(a,b)'
						)
					),
					'app:\\(a,b).a'
				),
				env
			),
			'hd(c)'
		);
/*
# LET tl = \c.c(\(a, b).b)
CREATE tl WITH abs_expr_beh(
	NEW ident_ptrn_beh(#c),
	NEW app_expr_beh(
		NEW ident_expr_beh(#c),
		NEW abs_expr_beh(
			NEW pair_ptrn_beh(
				NEW ident_ptrn_beh(#a),
				NEW ident_ptrn_beh(#b)
			),
			NEW ident_expr_beh(#b)
		)
	)
)
*/
		var tl_fn = Actor(
			closure_beh(
				Actor(ident_ptrn_beh('c'), 'ptrn:c'),
				Actor(
					app_expr_beh(
						Actor(ident_expr_beh('c'), 'ident:c'),
						Actor(
							abs_expr_beh(
								Actor(
									pair_ptrn_beh(
										Actor(ident_ptrn_beh('a'), 'ptrn:a'),
										Actor(ident_ptrn_beh('b'), 'ptrn:b')
									),
									'ptrn:(a,b)'
								),
								Actor(ident_expr_beh('b'), 'ident:b')
							),
							'abs:(a,b)'
						)
					),
					'app:\\(a,b).a'
				),
				env
			),
			'tl(c)'
		);

		env = Actor(env_beh('pr', pr_fn, env), 'env:pr');
		env = Actor(env_beh('hd', hd_fn, env), 'env:hd');
		env = Actor(env_beh('tl', tl_fn, env), 'env:tl');
/*
# hd(pr(0, 1)) => 0
SEND (NEW assert_eq_beh(0), #eval, env) TO
	NEW app_expr_beh(
		NEW ident_expr_beh(#hd),
		NEW app_expr_beh(
			NEW ident_expr_beh(#pr),
			NEW pair_expr_beh(
				NEW const_expr_beh(0),
				NEW const_expr_beh(1)
			)
		)
	)
*/
		var hd_mock = Actor(
			assert_equal_beh(
				0, 
				assert_end_beh(self)
			),
			'assert_eq:0'
		);
		var hd_expr = Actor(
			app_expr_beh(
				Actor(ident_expr_beh('hd'), 'ident:hd'),
				Actor(
					app_expr_beh(
						Actor(ident_expr_beh('pr'), 'ident:pr'),
						Actor(
							pair_expr_beh(
								Actor(const_expr_beh(0), 'const:0'),
								Actor(const_expr_beh(1), 'const:1')
							),
							'pair:0,1'
						)
					),
					'app:pr'
				)
			),
			'app:hd'
		);

		// test behavior
		cfg.send(
			Pr(hd_mock, Pr('eval', env)),
			hd_expr
		);
		assertEqual(1, cfg.pending(), 'pending before');
		assertEqual(97, cfg.dispatchLoop(1008));
		assertEqual(0, cfg.pending(), 'pending after');
		// verify mock
		cfg.send(self, hd_mock);
		assertEqual(true, cfg.dispatch(), 'end hd_mock');
		assertEqual(false, cfg.dispatch(), 'end config');

/*
# tl(pr(0, 1)) => 1
SEND (NEW assert_eq_beh(1), #eval, env) TO
	NEW app_expr_beh(
		NEW ident_expr_beh(#tl),
		NEW app_expr_beh(
			NEW ident_expr_beh(#pr),
			NEW pair_expr_beh(
				NEW const_expr_beh(0),
				NEW const_expr_beh(1)
			)
		)
	)
*/
		var tl_mock = Actor(
			assert_equal_beh(
				1, 
				assert_end_beh(self)
			),
			'assert_eq:1'
		);
		var tl_expr = Actor(
			app_expr_beh(
				Actor(ident_expr_beh('tl'), 'ident:tl'),
				Actor(
					app_expr_beh(
						Actor(ident_expr_beh('pr'), 'ident:pr'),
						Actor(
							pair_expr_beh(
								Actor(const_expr_beh(0), 'const:0'),
								Actor(const_expr_beh(1), 'const:1')
							),
							'pair:0,1'
						)
					),
					'app:pr'
				)
			),
			'app:tl'
		);

		// test behavior
		cfg.send(
			Pr(tl_mock, Pr('eval', env)),
			tl_expr
		);
		assertEqual(1, cfg.pending(), 'pending before');
		assertEqual(95, cfg.dispatchLoop(1009));
		assertEqual(0, cfg.pending(), 'pending after');
		// verify mock
		cfg.send(self, tl_mock);
		assertEqual(true, cfg.dispatch(), 'end tl_mock');
		assertEqual(false, cfg.dispatch(), 'end config');
	});
/*
LET x = 1 IN 
	LET (0, $x, y) = (0, 1, 2, 3) IN 
		(x, y)
*/
	test('LET x = 1 IN LET (0, $x, y) = (0, 1, 2, 3) IN (x, y)', function () {
		var self = this;
		var cfg = Config();
		var GEN = gen_meta(cfg);  // select generator
		var Actor = GEN.Actor;
		var empty_env_beh = GEN.empty_env_beh;
		var env_beh = GEN.env_beh;
		var dynamic_env_beh = GEN.dynamic_env_beh;
		var ident_expr_beh = GEN.ident_expr_beh;
		var pair_expr_beh = GEN.pair_expr_beh;
		var eqtn_beh = GEN.eqtn_beh;
		var const_ptrn_beh = GEN.const_ptrn_beh;
		var value_ptrn_beh = GEN.value_ptrn_beh;
		var ident_ptrn_beh = GEN.ident_ptrn_beh;
		var pair_ptrn_beh = GEN.pair_ptrn_beh;
		var env = Actor(empty_env_beh, 'empty_env');
		var eqtn = Actor(
			eqtn_beh(
				Actor(
					pair_ptrn_beh(
						Actor(const_ptrn_beh(0), 'ptrn:0'),
						Actor(
							pair_ptrn_beh(
								Actor(
									value_ptrn_beh(
										Actor(ident_expr_beh('x'), 'ident:x')
									),
									'value:x'
								),
								Actor(ident_ptrn_beh('y'), 'ptrn:y')
							),
							'ptrn:($x,y)'
						)
					),
					'ptrn:(0,...)'
				),
				Actor(
					pair_ptrn_beh(
						Actor(const_ptrn_beh(0), 'ptrn:0'),
						Actor(
							pair_ptrn_beh(
								Actor(const_ptrn_beh(1), 'ptrn:1'),
								Actor(
									pair_ptrn_beh(
										Actor(const_ptrn_beh(2), 'ptrn:2'),
										Actor(const_ptrn_beh(3), 'ptrn:3')
									),
									'ptrn:(2,3)'
								)
							),
							'ptrn:(1,...)'
						)
					),
					'ptrn:(0,...)'
				)
			),
			'eqtn'
		);
		var cust = Actor(
			function (env_) {
				if (env_ === UNDEF) {
					fail('#unify failed.');
				}
				this.send(
					Pr(mock, Pr('eval', env_)),
					this.create(
						pair_expr_beh(
							this.create(ident_expr_beh('x'), 'ident:x'),
							this.create(ident_expr_beh('y'), 'ident:y')
						),
						'(x,y)'
					)
				);
			},
			'cust'
		);
		var mock = Actor(assert_equal_beh(Pr(1, Pr(2, 3)), assert_end_beh(self)), 'mock');

		env = Actor(env_beh('x', 1, env), 'x:1');
		env = Actor(dynamic_env_beh(env), 'dyn_env');

		// test behavior
		cfg.send(
			Pr(cust, Pr('unify', env)),
			eqtn
		);
		assertEqual(1, cfg.pending(), 'pending before');
		assertEqual(45, cfg.dispatchLoop(1010));
		assertEqual(0, cfg.pending(), 'pending after');
		// verify mocks
		cfg.send(self, mock);
		assertEqual(true, cfg.dispatch(), 'end mock');
		assertEqual(false, cfg.dispatch(), 'end config');
	});
/*
LET even? = \n.(
	CASE n OF
	0 : TRUE
	_ : odd?(dec(n))
	END
)
LET odd? = \n.(
	CASE n OF
	0 : FALSE
	_ : even?(dec(n))
	END
)
# even?(3) => FALSE
# odd?(3) => TRUE
*/
	test('Odd/Even Example', function () {
		var self = this;
		var cfg = Config();
		var GEN = gen_meta(cfg);  // select generator
		var Actor = GEN.Actor;
		var empty_env_beh = GEN.empty_env_beh;
		var env_beh = GEN.env_beh;
		var dynamic_env_beh = GEN.dynamic_env_beh;
		var const_expr_beh = GEN.const_expr_beh;
		var ident_expr_beh = GEN.ident_expr_beh;
		var abs_expr_beh = GEN.abs_expr_beh;
		var closure_beh = GEN.closure_beh;
		var app_expr_beh = GEN.app_expr_beh;
		var pair_expr_beh = GEN.pair_expr_beh;
		var case_expr_beh = GEN.case_expr_beh;
		var case_choice_beh = GEN.case_choice_beh;
		var case_end_beh = GEN.case_end_beh;
		var eqtn_beh = GEN.eqtn_beh;
		var const_ptrn_beh = GEN.const_ptrn_beh;
		var value_ptrn_beh = GEN.value_ptrn_beh;
		var ident_ptrn_beh = GEN.ident_ptrn_beh;
		var any_ptrn_beh = GEN.any_ptrn_beh;
		var pair_ptrn_beh = GEN.pair_ptrn_beh;
		var env = Actor(empty_env_beh, 'empty_env');
		var even_eqtn;
		var odd_eqtn;
		var cust;
		var mock;

		env = Actor(
			env_beh(
				'dec', 
				Actor(
					function (msg) {
						if (Pr.created(msg)) {
							var cust = msg.hd;
							var req = msg.tl;
							
							if (Pr.created(req) 
							 && (req.hd === 'apply')) {
								var arg = req.tl;
								var n = +arg;
								
								if (n > 0) {
									this.send((n - 1), cust);
								} else {
									this.send(UNDEF, cust);
								}
							}
						}
					},
					'{n-1}'
				),
				env
			),
			'env:dec'
		);
		env = Actor(dynamic_env_beh(env), 'dyn_env');
		
		even_eqtn = Actor(
			eqtn_beh(
				Actor(ident_ptrn_beh('even?'), 'ptrn:even?'),
				Actor(
					const_ptrn_beh(
						Actor(
							closure_beh(
								Actor(ident_ptrn_beh('n'), 'ident:n'),
								Actor(
									case_expr_beh(
										Actor(ident_expr_beh('n'), 'ident:n'),
										Actor(
											case_choice_beh(
												Actor(
													const_ptrn_beh(0),
													'ptrn:0'
												),
												Actor(const_expr_beh(true), 'const:true'),
												Actor(
													case_choice_beh(
														Actor(any_ptrn_beh, 'ptrn:_'),
														Actor(
															app_expr_beh(
																Actor(ident_expr_beh('odd?'), 'ident:odd?'),
																Actor(
																	app_expr_beh(
																		Actor(ident_expr_beh('dec'), 'ident:dec'),
																		Actor(ident_expr_beh('n'), 'ident:n')
																	),
																	'dec(n)'
																)
															), 
															'odd?(...)'
														),
														Actor(case_end_beh, 'END')
													),
													'OF _'
												)
											),
											'OF 0'
										)
									),
									'CASE'
								),
								env
							),
							'even?(n)'
						)
					),
					'ptrn:\\n.(...)'
				)
			),
			'even_eqtn'
		);
		odd_eqtn = Actor(
			eqtn_beh(
				Actor(ident_ptrn_beh('odd?'), 'ptrn:odd?'),
				Actor(
					const_ptrn_beh(
						Actor(
							closure_beh(
								Actor(ident_ptrn_beh('n'), 'ident:n'),
								Actor(
									case_expr_beh(
										Actor(ident_expr_beh('n'), 'ident:n'),
										Actor(
											case_choice_beh(
												Actor(
													const_ptrn_beh(0),
													'ptrn:0'
												),
												Actor(const_expr_beh(false), 'const:false'),
												Actor(
													case_choice_beh(
														Actor(any_ptrn_beh, 'ptrn:_'),
														Actor(
															app_expr_beh(
																Actor(ident_expr_beh('even?'), 'ident:even?'),
																Actor(
																	app_expr_beh(
																		Actor(ident_expr_beh('dec'), 'ident:dec'),
																		Actor(ident_expr_beh('n'), 'ident:n')
																	),
																	'dec(n)'
																)
															), 
															'even?(...)'
														),
														Actor(case_end_beh, 'END')
													),
													'OF _'
												)
											),
											'OF 0'
										)
									),
									'CASE'
								),
								env
							),
							'odd?(n)'
						)
					),
					'ptrn:\\n.(...)'
				)
			),
			'odd_eqtn'
		);
		
		cust = Actor(
			function (env_) {
				var cust_ = this.create(
					function (env_) {
						if (env_ === UNDEF) {
							fail('#unify failed (odd?).');
						}
						this.send(
							Pr(mock, Pr('eval', env_)),
							this.create(
								pair_expr_beh(
									this.create(
										app_expr_beh(
											this.create(ident_expr_beh('even?'), 'ident:even?'),
											this.create(const_expr_beh(3), 'const:3')
										), 
										'even?(3)'
									),
									this.create(
										app_expr_beh(
											this.create(ident_expr_beh('odd?'), 'ident:odd?'),
											this.create(const_expr_beh(3), 'const:3')
										), 
										'odd?(3)'
									)
								),
								'(even?(3),odd?(3))'
							)
						);
					},
					'cust_'
				);

				if (env_ === UNDEF) {
					fail('#unify failed (even?).');
				}
				this.send(
					Pr(cust_, Pr('unify', env_)),
					odd_eqtn
				);
			},
			'cust'
		);
		mock = Actor(
			assert_equal_beh(
				Pr(false, true), 
				assert_end_beh(self)
			), 
			'mock'
		);

		// test behavior
		cfg.send(
			Pr(cust, Pr('unify', env)),
			even_eqtn
		);
		assertEqual(1, cfg.pending(), 'pending before');
		assertEqual(359, cfg.dispatchLoop(1011));
		assertEqual(0, cfg.pending(), 'pending after');
		// verify mocks
		cfg.send(self, mock);
		assertEqual(true, cfg.dispatch(), 'end mock');
		assertEqual(false, cfg.dispatch(), 'end config');
	});
/*
LET send_stmt_beh(m_expr, a_expr) = \(cust, #exec, env, sponsor).[
	CREATE call WITH call_pair_beh(m_expr, a_expr)
	SEND (k_send, #eval, env) TO call
	CREATE k_send WITH \(msg, to).[
		SEND (cust, #send, msg, to) TO sponsor
	]
]
CREATE assert_eq_42 WITH assert_eq_beh(42)
SEND 42 TO assert_eq_42
*/
	test('SEND statement', function () {
		var self = this;
		var cfg = Config();
		var GEN = gen_meta(cfg);  // select generator
		var Actor = GEN.Actor;
		var empty_env_beh = GEN.empty_env_beh;
		var env_beh = GEN.env_beh;
		var const_expr_beh = GEN.const_expr_beh;
		var ident_expr_beh = GEN.ident_expr_beh;
		var send_stmt_beh = GEN.send_stmt_beh;
		var env = Actor(empty_env_beh, 'empty_env');
		var a_mock = Actor(assert_equal_beh(42, sink_beh), 'a_mock');
		var send_stmt = Actor(
			send_stmt_beh(
				Actor(const_expr_beh(42), 'const:42'),
				Actor(ident_expr_beh('assert_eq_42'), 'ident:assert_eq_42')
			),
			'SEND 42 TO assert_eq_42'
		);

		env = Actor(env_beh('assert_eq_42', a_mock, env), 'env:assert_eq_42');

		var k_mock = Actor(assert_equal_beh('ok', assert_end_beh(self)), 'k_mock');
		var s_mock = Actor(assert_equal_beh(
			Pr(k_mock, Pr('send', Pr(42, a_mock))),
			assert_end_beh(self)
		), 's_mock');
		// test behavior
		cfg.send(
			Pr(k_mock, Pr('exec', Pr(env, s_mock))),
			send_stmt
		);
		assertEqual(1, cfg.pending(), 'pending before');
		assertEqual(11, cfg.dispatchLoop(1012));
		assertEqual(0, cfg.pending(), 'pending after');
		// verify mocks
//		cfg.send(self, k_mock);
//		assertEqual(true, cfg.dispatch(), 'end k_mock');
		cfg.send(self, s_mock);
		assertEqual(true, cfg.dispatch(), 'end s_mock');
		assertEqual(false, cfg.dispatch(), 'end config');
	});
	/*
	LET label_beh(cust, label) = \msg.[
		SEND (label, msg) TO cust
	]
	CREATE target WITH label_beh(println, #Hello)
	SEND #World TO target
	*/
	test('Label behavior', function () {
		var self = this;
		var cfg = Config();
		var GEN = gen_meta(cfg);  // select generator
		var Actor = GEN.Actor;
		var empty_env_beh = GEN.empty_env_beh;
		var env_beh = GEN.env_beh;
		var dynamic_env_beh = GEN.dynamic_env_beh;
		var const_expr_beh = GEN.const_expr_beh;
		var ident_expr_beh = GEN.ident_expr_beh;
		var abs_expr_beh = GEN.abs_expr_beh;
		var closure_beh = GEN.closure_beh;
		var app_expr_beh = GEN.app_expr_beh;
		var pair_expr_beh = GEN.pair_expr_beh;
		var ident_ptrn_beh = GEN.ident_ptrn_beh;
		var pair_ptrn_beh = GEN.pair_ptrn_beh;
		var block_expr_beh = GEN.block_expr_beh;
		var empty_stmt_beh = GEN.empty_stmt_beh;
		var stmt_pair_beh = GEN.stmt_pair_beh;
		var send_stmt_beh = GEN.send_stmt_beh;
		var create_stmt_beh = GEN.create_stmt_beh;
		var config_beh = GEN.config_beh;
		var repl_sponsor_beh = GEN.repl_sponsor_beh;
		var env = Actor(empty_env_beh, 'empty_env');
		var label_beh_fn = Actor(
			closure_beh(
				Actor(
					pair_ptrn_beh(
						Actor(ident_ptrn_beh('cust'), 'ptrn:cust'),
						Actor(ident_ptrn_beh('label'), 'ptrn:cust')
					), 
					'ptrn:(cust,label)'
				),
				Actor(
					abs_expr_beh(
						Actor(ident_ptrn_beh('msg'), 'ptrn:msg'),
						Actor(
							block_expr_beh(
								NIL, 
								Actor(
									stmt_pair_beh(
										Actor(
											send_stmt_beh(
												Actor(
													pair_expr_beh(
														Actor(ident_expr_beh('label'), 'ident:label'),
														Actor(ident_expr_beh('msg'), 'ident:msg')
													), 
													'(,)'
												),
												Actor(ident_expr_beh('cust'), 'ident:cust')
											),
											'send:(label,msg)->cust'
										),
										Actor(empty_stmt_beh, '[]')
									),
									'[,]'
								)
							), 
							'block:[...]'
						)
					),
					'abs:(msg)'
				),
				env  // ...not exactly correct, but it will do...
			),
			'label_beh(cust,label)'
		);
		var create_stmt = Actor(
			create_stmt_beh(
				'target',
				Actor(
					app_expr_beh(
						Actor(ident_expr_beh('label_beh'), 'ident:label_beh'),
						Actor(
							pair_expr_beh(
								Actor(ident_expr_beh('println'), 'ident:println'),
								Actor(const_expr_beh('Hello'), 'const:Hello')
							),
							'(,)'
						)
					),
					'app:label_beh(#Hello)'
				)
			),
			'CREATE target WITH label_beh(println, #Hello)'
		);
		var send_stmt = Actor(
			send_stmt_beh(
				Actor(const_expr_beh('World'), 'const:World'),
				Actor(ident_expr_beh('target'), 'ident:target')
			),
			'SEND #World TO target'
		);
		var logger = Actor(
			function (msg) {
				debug(msg);
			},
			'logger'
		);
		var config = Actor(
			config_beh(logger),
			'config'
		);
		var sponsor = Actor(
			repl_sponsor_beh(config),
			'sponsor'
		);
		var k_create;
		
		env = Actor(env_beh('println', logger/*cfg.sink*/, env), 'env:println');
		env = Actor(env_beh('label_beh', label_beh_fn, env), 'env:label_beh');
		env = Actor(dynamic_env_beh(env), 'dyn_env');
		k_create = Actor(
			function (result) {
				if (result !== 'ok') {
					fail('expected: ok, got: '+result);
				}
				cfg.send(
					Pr(logger, Pr('exec', Pr(env, sponsor))),
					send_stmt
				);
			},
			'k_send'
		);
		// test behavior
		cfg.send(
			Pr(k_create, Pr('exec', Pr(env, sponsor))),
			create_stmt
		);
		assertEqual(1, cfg.pending(), 'pending before');
		assertEqual(118, cfg.dispatchLoop(1013));
		assertEqual(0, cfg.pending(), 'pending after');
		// verify mocks
/*
		cfg.send(self, s_mock);
		assertEqual(true, cfg.dispatch(), 'end s_mock');
		assertEqual(false, cfg.dispatch(), 'end config');
*/
	});
	return suite.getResult(callback);
};

function run_tests() {
	var log = core.log;  // log to info channel

	log('core(Humus) v' + Humus.version);
	testSuite(function (result) {
		log(result.formatted('Humus suite: '));
	});
};

export default Object.freeze({testSuite, run_tests});
