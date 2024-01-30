/*
 * gen_meta.js -- Humus meta-circular code generator
 *
 * author: Dale Schumacher <dale.schumacher@gmail.com>
 * requires: core.js, humus.js
 */

if (typeof DALNEFRE === 'undefined') {
	throw Error('Namespace "DALNEFRE" required!');
}
if (typeof DALNEFRE.Humus === 'undefined') {
	throw Error('Namespace "DALNEFRE.Humus" required!');
}
if (typeof DALNEFRE.Humus.Gen_Meta !== 'undefined') {
	throw Error('Module "DALNEFRE.Humus.Gen_Meta" already defined!');
}

DALNEFRE.Humus.Gen_Meta = (function () {
	var version = '0.8.0 2024-01-29';
	var DAL = DALNEFRE;
	var equal = DAL.equal;
	var log = DAL.log;
//	var debug = function (msg) {
//		DAL.debug(msg);
//		DAL.trace('--?-- '+msg);
//	};
	var trace = DAL.trace;
	var HUM = DAL.Humus;
	var UNDEF = HUM.UNDEF;
	var NIL = HUM.NIL;
	var Obj = HUM.Obj;
	var Pr = HUM.Pr;

	/*
	LET tag_beh(cust) = \msg.[ SEND (SELF, msg) TO cust ]
	*/
	var tag_beh = function (cust) {
		return function (msg) {
			this.send(Pr(this.self, msg), cust);
		};
	};
	/*
	LET join_beh(cust, k_first, k_rest) = \msg.[
		CASE msg OF
		($k_first, first) : [
			BECOME \($k_rest, rest).[
				SEND (first, rest) TO cust
			]
		]
		($k_rest, rest) : [
			BECOME \($k_first, first).[
				SEND (first, rest) TO cust
			]
		]
		END
	]
	*/
	var join_beh = function (cust, head, tail) {
		var h = undefined;
		var t = undefined;
	
		return function (msg) {
			if (Pr.created(msg)) {
				var tag = msg.hd;

				if ((h === undefined) && (tag === head)) {
					h = msg.tl;
				} else if ((t == undefined) && (tag === tail)) {
					t = msg.tl;
				}
				if ((h !== undefined) && (t !== undefined)) {
					this.send(Pr(h, t), cust)
				}
			}
		};
	};
	/*
	LET fork_beh(cust, head, tail) = \(h_req, t_req).[
		SEND (k_head, h_req) TO head
		SEND (k_tail, t_req) TO tail
		CREATE k_head WITH tag_beh(SELF)
		CREATE k_tail WITH tag_beh(SELF)
		BECOME join_beh(cust, k_head, k_tail)
	]
	*/
	var fork_beh = function (cust, head, tail) {
		return function (msg) {
			if (Pr.created(msg)) {
				var h_req = msg.hd;
				var t_req = msg.tl;
				var k_head = this.create(tag_beh(this.self));
				var k_tail = this.create(tag_beh(this.self));
				
				this.send(Pr(k_head, h_req), head);
				this.send(Pr(k_tail, t_req), tail);
				this.become(join_beh(cust, k_head, k_tail));
			}
		};
	};
	/*
	LET call_pair_beh(head, tail) = \(cust, req).[
		SEND (req, req) TO NEW fork_beh(cust, head, tail)
	]
	*/
	var call_pair_beh = function (head, tail) {
		return function (msg) {
			if (Pr.created(msg)) {
				var cust = msg.hd;
				var req = msg.tl;
				
				this.send(
					pair_of(req), 
					this.create(fork_beh(cust, head, tail))
				);
			}
		};
	};
	/*
	LET pair_of(value) = (value, value)
	*/
	var pair_of = function (value) {
		return Pr(value, value);
	};
	/*
	LET serializer_beh(svc) = \(cust, req).[
		CREATE ret WITH tag_beh(SELF)
		BECOME serializer_busy_beh(svc, cust, ret, NIL)
		SEND (ret, req) TO svc
	]
	LET serializer_busy_beh(svc, cust, ret, pending) = \msg.[
		CASE msg OF
		($ret, res) : [
			SEND res TO cust
			IF $pending = ((cust', req'), rest) [
				CREATE ret' WITH tag_beh(SELF)
				BECOME serializer_busy_beh(svc, cust', ret', rest)
				SEND (ret', req') TO svc
			] ELSE [
				BECOME serializer_beh(svc)
			]
		]
		(cust', req') : [
			LET pending' = $((cust', req'), pending)
			BECOME serializer_busy_beh(svc, cust, ret, pending')
		]
		END
	]
	*/
	var serializer_beh = function (svc) {
		return function (msg) {
			if (Pr.created(msg)) {
				var cust = msg.hd;
				var req = msg.tl;
				var ret = this.create(tag_beh(this.self));
				
				this.become(serializer_busy_beh(svc, cust, ret, NIL));
				this.send(Pr(ret, req), svc);
			}
		};
	};
	var serializer_busy_beh = function (svc, cust, ret, pending) {
		return function (msg) {
			if (Pr.created(msg)) {
				var h = msg.hd;
				var t = msg.tl;

				if (h === ret) {  // tagged response
					this.send(t, cust);
					if (Pr.created(pending)
					 && Pr.created(pending.hd)) {
						var cust_ = pending.hd.hd;
						var req_ = pending.hd.tl;
						var rest = pending.tl;
						var ret_ = this.create(tag_beh(this.self));
						
						this.become(serializer_busy_beh(svc, cust_, ret_, rest));
						this.send(Pr(ret_, req_), svc);
					} else {
						this.become(serializer_beh(svc));
					}
				} else {  // concurrent request
					var pending_ = Pr(msg, pending);

					this.become(serializer_busy_beh(svc, cust, ret, pending_));
				}
			}
		};
	};
	/*
	CREATE undefined WITH \(cust, _).[ SEND ? TO cust ]
	*/
	var undefined_beh = function (msg) {
		if (Pr.created(msg)) {
			var cust = msg.hd;
			
			trace('undefined_beh: req='+msg.tl);
			this.send(UNDEF, cust);
		}
	};
	/*
	LET empty_env_beh = \(cust, _).[ SEND ? TO cust ]
	*/
	var empty_env_beh = function (msg) {
		if (Pr.created(msg)) {
			var cust = msg.hd;
			var req = msg.tl;

			trace('undefined_beh: req=' + req);
			log('Undefined ' + req);			
			this.send(UNDEF, cust);
		}
	};
	/*
	LET env_beh(ident, value, next) = \(cust, req).[
		CASE req OF
		(#lookup, $ident) : [ SEND value TO cust ]
		_ : [ SEND (cust, req) TO next ]
		END
	]
	*/
	var env_beh = function (ident, value, next) {
		return function (msg) {
			if (Pr.created(msg)) {
				var cust = msg.hd;
				var req = msg.tl;
				
				if (Pr.created(req) 
				 && (req.hd === 'lookup')
				 && (req.tl === ident)) {
					this.send(value, cust);
				} else {
					this.send(msg, next);
				}
			}
		};
	};
	/*
	LET dynamic_env_beh(next) = \(cust, req).[
		CASE req OF
		(#bind, ident, value) : [
			CREATE next' WITH env_beh(ident, value, next)
			BECOME dynamic_env_beh(next')
			SEND SELF TO cust
		]
		_ : [ SEND (cust, req) TO next ]
		END
	]
	*/
	var dynamic_env_beh = function (next) {
		return function (msg) {
			if (Pr.created(msg)) {
				var cust = msg.hd;
				var req = msg.tl;
				
				if (Pr.created(req) 
				 && (req.hd === 'bind')
				 && Pr.created(req.tl)) {
					var ident = req.tl.hd;
					var value = req.tl.tl;
					var next_ = this.create(
						env_beh(ident, value, next),
						ident+':'+value
					);
					
					this.become(dynamic_env_beh(next_));
					this.send(this.self, cust);
				} else {
					this.send(msg, next);
				}
			}
		};
	};
	var repl_env_beh = function (dict, next) {  /*** WARNING! 'dict' is a MUTABLE value ***/
		return function (msg) {
			var cust, req, ident, value;

			if (Pr.created(msg)) {
				cust = msg.hd;
				req = msg.tl;
				if (Pr.created(req) 
				 && (req.hd === 'bind')
				 && Pr.created(req.tl)) {
					ident = req.tl.hd;
					value = req.tl.tl;
					dict[ident] = value;
					this.send(this.self, cust);
				} else if (Pr.created(req) 
				 && (req.hd === 'lookup')) {
				 	ident = req.tl;
				 	value = dict[ident];
				 	
				 	if (value === undefined) {
						this.send(msg, next);
				 	} else {
						this.send(value, cust);
					}
				} else {
					this.send(msg, next);
				}
			}
		}
	};
	/*
	LET block_env_beh(next, denv) = \(cust, req).[
		CASE req OF
		#self : [ SEND (cust, req) TO denv ]
		(#declare, ident) : [
			CREATE next' WITH unbound_env_beh(SELF, ident, NIL, next)
			BECOME block_env_beh(next', denv)
			SEND SELF TO cust
		]
		_ : [ SEND (cust, req) TO next ]
		END
	]
	*/
	var block_env_beh = function (next, denv) {
		return function (msg) {
			if (Pr.created(msg)) {
				var cust = msg.hd;
				var req = msg.tl;
				
				if (req === 'self') {
					this.send(msg, denv);
				} else if (Pr.created(req) 
				 && (req.hd === 'declare')) {
					var ident = req.tl;
					var next_ = this.create(
						unbound_env_beh(this.self, ident, NIL, next),
						ident+':_'
					);
					
					this.become(block_env_beh(next_, denv));
					this.send(this.self, cust);
				} else {
					this.send(msg, next);
				}
			}
		};
	};
	/*
	LET unbound_env_beh(scope, ident, waiting, next) = \(cust, req).[
		CASE req OF
		(#lookup, $ident) : [  # wait for binding
			BECOME unbound_env_beh(scope, ident, (cust, waiting), next)
		]
		(#bind, $ident, value) : [
			BECOME bound_env_beh(scope, ident, value, next)
			SEND waiting TO NEW \list.[  # deliver value to waiting
				IF $list = (first, rest) [
					SEND value TO first
					SEND rest TO SELF
				]
			]
			SEND scope TO cust
		]
		_ : [ SEND (cust, req) TO next ]
		END
	]
	*/
	var unbound_env_beh = function (scope, ident, waiting, next) {
		return function (msg) {
			if (Pr.created(msg)) {
				var cust = msg.hd;
				var req = msg.tl;
				
				if (Pr.created(req) 
				 && (req.hd === 'lookup')
				 && (req.tl === ident)) {
					this.become(
						unbound_env_beh(scope, ident, Pr(cust, waiting), next)
					);
				} else if (Pr.created(req) 
				 && (req.hd === 'bind')
				 && Pr.created(req.tl)
				 && (req.tl.hd === ident)) {
					var value = req.tl.tl;
					var dispatch = this.create(
						function (list) {
							if (Pr.created(list)) {
								this.send(value, list.hd);
								this.send(list.tl, this.self);
							}
						},
						'dispatch:'+value
					);
					
					this.become(
						bound_env_beh(scope, ident, value, next)
					);
					this.send(waiting, dispatch);
					this.send(scope, cust);
				} else {
					this.send(msg, next);
				}
			}
		};
	};
	/*
	LET bound_env_beh(scope, ident, value, next) = \(cust, req).[
		CASE req OF
		(#lookup, $ident) : [ SEND value TO cust ]
		(#bind, $ident, $value) : [ SEND scope TO cust ]
		(#bind, $ident, value') : [ SEND ? TO cust ]
		_ : [ SEND (cust, req) TO next ]
		END
	]
	*/
	var bound_env_beh = function (scope, ident, value, next) {
		return function (msg) {
			if (Pr.created(msg)) {
				var cust = msg.hd;
				var req = msg.tl;
				
				if (Pr.created(req) 
				 && (req.hd === 'lookup')
				 && (req.tl === ident)) {
					this.send(value, cust);
				} else if (Pr.created(req) 
				 && (req.hd === 'bind')
				 && Pr.created(req.tl)
				 && (req.tl.hd === ident)) {
					var value_ = req.tl.tl;
					
					this.send(
						((value === value_) ? scope : UNDEF), 
						cust
					);
				} else {
					this.send(msg, next);
				}
			}
		};
	};
	/*
	LET self_env_beh(self, next) = \(cust, req).[
		CASE req OF
		#self : [ SEND self TO cust ]
		_ : [ SEND (cust, req) TO next ]
		END
	]
	*/
	var self_env_beh = function (self, next) {
		return function (msg) {
			if (Pr.created(msg)) {
				var cust = msg.hd;
				var req = msg.tl;
				
				if (req === 'self') {
					this.send(self, cust);
				} else {
					this.send(msg, next);
				}
			}
		};
	};
	/*
	LET const_expr_beh(value) = \(cust, #eval, _).[
		SEND value TO cust
	]
	*/
	var const_expr_beh = function (value) {
		return function (msg) {
			if (Pr.created(msg)) {
				var cust = msg.hd;
				var req = msg.tl;
				
				if (Pr.created(req) 
				 && (req.hd === 'eval')) {
					this.send(value, cust);
				}
			}
		};
	};
	/*
	LET ident_expr_beh(ident) = \(cust, #eval, env).[
		SEND (cust, #lookup, ident) TO env
	]
	*/
	var ident_expr_beh = function (ident) {
		return function (msg) {
			if (Pr.created(msg)) {
				var cust = msg.hd;
				var req = msg.tl;
				
				if (Pr.created(req) 
				 && (req.hd === 'eval')) {
					var env = req.tl;

					this.send(Pr(cust, Pr('lookup', ident)), env);
				}
			}
		};
	};
	/*
	LET abs_expr_beh(ptrn, body_expr) = \(cust, #eval, env).[
		SEND NEW closure_beh(ptrn, body_expr, env) TO cust
	]
	*/
	var abs_expr_beh = function (ptrn, body_expr) {
		return function (msg) {
			if (Pr.created(msg)) {
				var cust = msg.hd;
				var req = msg.tl;
				
				if (Pr.created(req) 
				 && (req.hd === 'eval')) {
					var env = req.tl;

					this.send(
						this.create(
							closure_beh(ptrn, body_expr, env),
							'closure'
						),
						cust
					);
				}
			}
		};
	};
	/*
	LET closure_beh(ptrn, body, env) = \(cust, #apply, arg).[
		SEND (k_env, #match, arg, NEW dynamic_env_beh(env)) TO ptrn
		CREATE k_env WITH \env'.[
			CASE env' OF
			? : [ SEND ? TO cust ]
			_ : [ SEND (cust, #eval, env') TO body ]
			END
		]
	]
	*/
	var closure_beh = function (ptrn, body, env) {
		return function (msg) {
			if (Pr.created(msg)) {
				var cust = msg.hd;
				var req = msg.tl;
				
				if (Pr.created(req) 
				 && (req.hd === 'apply')) {
					var arg = req.tl;
					var k_env = this.create(
						function (env_) {
							if (env_ === UNDEF) {
								this.send(UNDEF, cust);
							} else {
								this.send(Pr(cust, Pr('eval', env_)), body);
							}
						}
					);

					this.send(
						Pr(k_env, Pr('match', Pr(arg, this.create(
							dynamic_env_beh(env),
							'dyn_env'
						)))),
						ptrn
					);
				}
			}
		};
	};
	/*
	LET app_expr_beh(abs_expr, arg_expr) = \(cust, #eval, env).[
		CREATE fork WITH fork_beh(k_app, abs_expr, arg_expr)
		SEND pair_of(#eval, env) TO fork
		CREATE k_app WITH \(abs, arg).[
			SEND (cust, #apply, arg) TO abs
		]
	]
	*/
	var app_expr_beh = function (abs_expr, arg_expr) {
		return function (msg) {
			if (Pr.created(msg)) {
				var cust = msg.hd;
				var req = msg.tl;
				
				if (Pr.created(req) 
				 && (req.hd === 'eval')) {
					var env = req.tl;
					var k_app = this.create(
						function (abs_arg) {
							if (Pr.created(abs_arg)) {
								var abs = abs_arg.hd;
								var arg = abs_arg.tl;
								
								if ((typeof abs !== 'object') || !abs.isActor) {
									/* avoid "send requires an actor" error */
									this.send(UNDEF, cust);
								} else {
									this.send(Pr(cust, Pr('apply', arg)), abs);
								}
							}
						}
					);
					var fork = this.create(
						fork_beh(k_app, abs_expr, arg_expr)
					);

					this.send(pair_of(req), fork);
				}
			}
		};
	};
	/*
	LET pair_expr_beh(head_expr, tail_expr) = \(cust, #eval, env).[
		CREATE fork WITH fork_beh(cust, head_expr, tail_expr)
		SEND pair_of(#eval, env) TO fork
	]
	*/
	var pair_expr_beh = function (head_expr, tail_expr) {
		return function (msg) {
			if (Pr.created(msg)) {
				var cust = msg.hd;
				var req = msg.tl;
				
				if (Pr.created(req) 
				 && (req.hd === 'eval')) {
					var env = req.tl;
					var fork = this.create(
						fork_beh(cust, head_expr, tail_expr)
					);

					this.send(pair_of(req), fork);
				}
			}
		};
	};
	/*
	LET case_expr_beh(value_expr, choices) = \(cust, #eval, env).[
		SEND (k_value, #eval, env) TO value_expr
		CREATE k_value WITH \value.[
			SEND (cust, #match, value, env) TO choices
		]
	]
	*/
	var case_expr_beh = function (value_expr, choices) {
		return function (msg) {
			if (Pr.created(msg)) {
				var cust = msg.hd;
				var req = msg.tl;
				
				if (Pr.created(req) 
				 && (req.hd === 'eval')) {
					var env = req.tl;
					var k_value = this.create(
						function (value) {
							this.send(
								Pr(cust, Pr('match', Pr(value, env))), 
								choices
							);
						}
					)

					this.send(Pr(k_value, req), value_expr);
				}
			}
		};
	};
	/*
	LET case_choice_beh(ptrn, expr, next) = \(cust, #match, value, env).[
		CREATE env' WITH dynamic_env_beh(env)
		SEND (k_match, #match, value, env') TO ptrn
		CREATE k_match WITH \env'.[
			CASE env' OF
			? : [ SEND (cust, #match, value, env) TO next ]
			_ : [ SEND (cust, #eval, env') TO expr ]
			END
		]
	]
	*/
	var case_choice_beh = function (ptrn, expr, next) {
		return function (msg) {
			if (Pr.created(msg)) {
				var cust = msg.hd;
				var req = msg.tl;
				
				if (Pr.created(req) 
				 && (req.hd === 'match')
				 && Pr.created(req.tl)) {
					var value = req.tl.hd;
					var env = req.tl.tl;
					var env_ = this.create(dynamic_env_beh(env), 'dyn_env');
					var k_match = this.create(
						function (env_) {
							if (env_ === UNDEF) {
								this.send(msg, next);
							} else {
								this.send(Pr(cust, Pr('eval', env_)), expr);
							}
						}
					);

					this.send(
						Pr(k_match, Pr('match', Pr(value, env_))), 
						ptrn
					);
				}
			}
		};
	};
	/*
	CREATE case_end WITH \(cust, #match, _).[ SEND ? TO cust ]
	*/
	var case_end_beh = function (msg) {
		if (Pr.created(msg)) {
			var cust = msg.hd;
			var req = msg.tl;
			
			if (Pr.created(req) 
			 && (req.hd === 'match')) {
				this.send(UNDEF, cust);  // mismatch
			}
		}
	};
	/*
	LET if_expr_beh(eqtn, expr, else) = \(cust, #eval, env).[
		CREATE env' WITH dynamic_env_beh(env)
		SEND (k_env, #unify, env') TO eqtn
		CREATE k_env WITH \env'.[
			CASE env' OF
			? : [ SEND (cust, #eval, env) TO else ]
			_ : [ SEND (cust, #eval, env') TO expr ]
			END
		]
	]
	*/
	var if_expr_beh = function (eqtn, expr, next) {
		return function (msg) {
			if (Pr.created(msg)) {
				var cust = msg.hd;
				var req = msg.tl;
				
				if (Pr.created(req) 
				 && (req.hd === 'eval')) {
					var env = req.tl;
					var env_ = this.create(dynamic_env_beh(env), 'dyn_env');				
					var k_env = this.create(
						function (env_) {
							if (env_ === UNDEF) {
								this.send(msg, next);
							} else {
								this.send(Pr(cust, Pr('eval', env_)), expr);
							}
						}
					);

					this.send(
						Pr(k_env, Pr('unify', env_)), 
						eqtn
					);
				}
			}
		};
	};
	/*
	LET let_expr_beh(eqtn, expr) = \(cust, #eval, env).[
		BECOME if_expr_beh(eqtn, expr, undefined)
		SEND (cust, #eval, env) TO SELF
	]
	*/
	var let_expr_beh = function (eqtn, expr) {
		return function (msg) {
			var undef = this.create(const_expr_beh(UNDEF), '?');

			this.become(if_expr_beh(eqtn, expr, undef));
			this.send(msg, this.self);
		};
	};
	/*
	LET block_expr_beh(vars, stmt) = \(cust, #eval, env).[
		SEND NEW block_beh(vars, stmt, env) TO cust
	]
	*/
	var block_expr_beh = function (vars, stmt) {
		return function (msg) {
			if (Pr.created(msg)) {
				var cust = msg.hd;
				var req = msg.tl;
				
				if (Pr.created(req) 
				 && (req.hd === 'eval')) {
					var env = req.tl;

					this.send(
						this.create(
							block_beh(vars, stmt, env),
							'block'
						),
						cust
					);
				}
			}
		};
	};
	/*
	CREATE now_expr WITH \(cust, #eval, env).[
		SEND <timestamp> TO cust
	]
	*/
	var now_expr_beh = function (msg) {  // FIXME: non-standard extension
		if (Pr.created(msg)) {
			var cust = msg.hd;
			var req = msg.tl;
			
			if (Pr.created(req) 
			 && (req.hd === 'eval')) {
				var env = req.tl;

				this.send(+(new Date()), cust);
			}
		}
	};
	/*
	CREATE self_expr WITH \(cust, #eval, env).[
		SEND (cust, #self) TO env
	]
	*/
	var self_expr_beh = function (msg) {
		if (Pr.created(msg)) {
			var cust = msg.hd;
			var req = msg.tl;
			
			if (Pr.created(req) 
			 && (req.hd === 'eval')) {
				var env = req.tl;

				this.send(Pr(cust, 'self'), env);
			}
		}
	};
	/*
	LET new_expr_beh(b_expr) = \(cust, #eval, env).[
		SEND (k_beh, #eval, env) TO b_expr
		CREATE k_beh WITH \beh_fn.[
			#
			# FIXME: INSTANCE NOT TRACKED, SHOULD ASK SPONSOR TO CREATE NEW ACTOR
			#
			BECOME serializer_beh(NEW self_beh(SELF, beh_fn, env))
			SEND SELF TO cust
		]
	]
	*/
	var new_expr_beh = function (b_expr) {
		return function (msg) {
			if (Pr.created(msg)) {
				var cust = msg.hd;
				var req = msg.tl;
				
				if (Pr.created(req) 
				 && (req.hd === 'eval')) {
					var env = req.tl;
					var k_beh = this.create(
						function (beh_fn) {
							this.become(serializer_beh(
								this.create(
									self_beh(this.self, beh_fn, env), 
									'actor'
								)
							));
							this.send(this.self, cust);
						},
						'new'
					)

					this.send(Pr(k_beh, req), b_expr);
				}
			}
		};
	};
	/*
	LET eqtn_beh(left_ptrn, right_ptrn) = \(cust, #unify, env).[
		SEND (cust, #eq, right_ptrn, env) TO left_ptrn
	]
	*/
	var eqtn_beh = function (left_ptrn, right_ptrn) {
		return function (msg) {
			if (Pr.created(msg)
			 && Pr.created(msg.tl)
			 && (msg.tl.hd === 'unify')) {
				var cust = msg.hd;
				var env = msg.tl.tl;
				
				this.send(
					Pr(cust, Pr('eq', Pr(right_ptrn, env))),
					left_ptrn
				);
			}
		};
	};
	/*
	LET const_ptrn_beh(value) = \(cust, req).[
		CASE req OF
		(#match, $value, env) : [ SEND env TO cust ]
		(#eq, right, env) : [ SEND (cust, #match, value, env) TO right ]
		(#bind, left, env) : [ SEND (cust, #match, value, env) TO left ]
		(#pair, pair, env) : [ SEND (cust, #match, value, env) TO pair ]
		(#value, _, env) : [ SEND value TO cust ]
		_ : [ SEND ? TO cust ]
		END
	]
	*/
	var const_ptrn_beh = function (value) {
		return function (msg) {
			if (Pr.created(msg)) {
				var cust = msg.hd;
				var req = msg.tl;
				
				if (Pr.created(req) 
				 && (req.hd === 'match')
				 && Pr.created(req.tl)
				 && equal(req.tl.hd, value)) {  // use DALNEFRE.equal() to match structued objects (like Pr)
					var env = req.tl.tl;

					this.send(env, cust);  // match
				} else if (Pr.created(req)
				 && (req.hd === 'eq')
				 && Pr.created(req.tl)) {
					var right = req.tl.hd;
					var env = req.tl.tl;

					this.send(
						Pr(cust, Pr('match', Pr(value, env))), 
						right
					);
				} else if (Pr.created(req)
				 && (req.hd === 'bind')
				 && Pr.created(req.tl)) {
					var left = req.tl.hd;
					var env = req.tl.tl;

					this.send(
						Pr(cust, Pr('match', Pr(value, env))), 
						left
					);
				} else if (Pr.created(req)
				 && (req.hd === 'pair')
				 && Pr.created(req.tl)) {
					var pair = req.tl.hd;
					var env = req.tl.tl;

					this.send(
						Pr(cust, Pr('match', Pr(value, env))), 
						pair
					);
				} else if (Pr.created(req)
				 && (req.hd === 'value')) {

					this.send(value, cust);  // value
				} else {
					this.send(UNDEF, cust);  // mismatch
				}
			}
		};
	};
	/*
	LET value_ptrn_beh(expr) = \(cust, cmd, arg, env).[
		SEND (k_val, #eval, env) TO expr
		CREATE k_val WITH \value.[
			SEND (cust, cmd, arg, env) TO NEW const_ptrn_beh(value)
		]
	]
	*/
	var value_ptrn_beh = function (expr) {
		return function (msg) {
			if (Pr.created(msg)) {
				var cust = msg.hd;
				var req = msg.tl;
				
				if (Pr.created(req) 
				 && Pr.created(req.tl)) {
					var cmd = req.hd;
					var arg = req.tl.hd;
					var env = req.tl.tl;
					var k_val = this.create(
						function (value) {
							this.send(
								msg,
								this.create(
									const_ptrn_beh(value),
									'is:'+value
								)
							);
						}
					);

					this.send(
						Pr(k_val, Pr('eval', env)), 
						expr
					);
				}
			}
		};
	};
	/*
	LET ident_ptrn_beh(ident) = \(cust, req).[
		CASE req OF
		(#match, value, env) : [ SEND (cust, #bind, ident, value) TO env ]
		(#eq, right, env) : [ SEND (cust, #bind, SELF, env) TO right ]
		(#pair, pair, env) : [ SEND (cust, #bind, SELF, env) TO pair ]
		_ : [ SEND ? TO cust ]
		END
	]
	*/
	var ident_ptrn_beh = function (ident) {
		return function (msg) {
			if (Pr.created(msg)) {
				var cust = msg.hd;
				var req = msg.tl;
				
				if (Pr.created(req) 
				 && (req.hd === 'match')
				 && Pr.created(req.tl)) {
					var value = req.tl.hd;
					var env = req.tl.tl;

					this.send(
						Pr(cust, Pr('bind', Pr(ident, value))), 
						env
					);
				} else if (Pr.created(req)
				 && (req.hd === 'eq')
				 && Pr.created(req.tl)) {
					var right = req.tl.hd;
					var env = req.tl.tl;

					this.send(
						Pr(cust, Pr('bind', Pr(this.self, env))), 
						right
					);
				} else if (Pr.created(req)
				 && (req.hd === 'pair')
				 && Pr.created(req.tl)) {
					var pair = req.tl.hd;
					var env = req.tl.tl;

					this.send(
						Pr(cust, Pr('bind', Pr(this.self, env))), 
						pair
					);
				} else {
					this.send(UNDEF, cust);  // mismatch
				}
			}
		};
	};
	/*
	CREATE any_ptrn WITH \(cust, req).[
		CASE req OF
		(#match, _, env) : [ SEND env TO cust ]
		(#eq, right, env) : [ SEND (cust, #bind, SELF, env) TO right ]
		(#pair, pair, env) : [ SEND (cust, #bind, SELF, env) TO pair ]
		_ : [ SEND ? TO cust ]
		END
	]
	*/
	var any_ptrn_beh = function (msg) {
		if (Pr.created(msg)) {
			var cust = msg.hd;
			var req = msg.tl;
			
			if (Pr.created(req) 
			 && (req.hd === 'match')
			 && Pr.created(req.tl)) {
//				var value = req.tl.hd;
				var env = req.tl.tl;

				this.send(env, cust);  // match
			} else if (Pr.created(req)
			 && (req.hd === 'eq')
			 && Pr.created(req.tl)) {
				var right = req.tl.hd;
				var env = req.tl.tl;

				this.send(
					Pr(cust, Pr('bind', Pr(this.self, env))), 
					right
				);
			} else if (Pr.created(req)
			 && (req.hd === 'pair')
			 && Pr.created(req.tl)) {
				var pair = req.tl.hd;
				var env = req.tl.tl;

				this.send(
					Pr(cust, Pr('bind', Pr(this.self, env))), 
					pair
				);
			} else {
				this.send(UNDEF, cust);  // mismatch
			}
		}
	};
	/*
	LET pair_ptrn_beh(head_ptrn, tail_ptrn) = \(cust, req).[
		CASE req OF
		(#match, (h, t), env) : [
			SEND (k_env, #match, h, env) TO head_ptrn
			CREATE k_env WITH pair_match_beh(cust, #match, t, tail_ptrn)
		]
		(#eq, right, env) : [ SEND (cust, #pair, SELF, env) TO right ]
		(#bind, left, env) : [
			CREATE fork WITH fork_beh(k_pair, head_ptrn, tail_ptrn)
			SEND pair_of(#value, NIL, env) TO fork
			CREATE k_pair WITH pair_bind_beh(cust, left, env)
		]
		(#pair, pair, env) : [ SEND (cust, #both, (head_ptrn, tail_ptrn), env) TO pair ]
		(#both, (h, t), env) : [
			SEND (k_env, #eq, h, env) TO head_ptrn
			CREATE k_env WITH pair_match_beh(cust, #eq, t, tail_ptrn)
		]
		(#value, _, env) : [
			CREATE fork WITH fork_beh(k_pair, head_ptrn, tail_ptrn)
			SEND pair_of(#value, NIL, env) TO fork
			CREATE k_pair WITH pair_value_beh(cust)
		]
		_ : [ SEND ? TO cust ]
		END
	]
	LET pair_match_beh(cust, cmd, tail, ptrn) = \env.[
		CASE env OF
		? : [ SEND ? TO cust ]
		_ : [ SEND (cust, cmd, tail, env) TO ptrn ]
		END
	]
	LET pair_bind_beh(cust, left, env) = \msg.[
		CASE msg OF
		(?, _) : [ SEND ? TO cust ]
		(_, ?) : [ SEND ? TO cust ]
		(h, t) : [ SEND (cust, #match, (h, t), env) TO left ]
		_ : [ SEND ? TO cust ]
		END
	]
	LET pair_value_beh(cust) = \msg.[
		CASE msg OF
		(?, _) : [ SEND ? TO cust ]
		(_, ?) : [ SEND ? TO cust ]
		(h, t) : [ SEND msg TO cust ]
		_ : [ SEND ? TO cust ]
		END
	]
	*/
	var pair_ptrn_beh = function (head_ptrn, tail_ptrn) {
		return function (msg) {
			if (Pr.created(msg)) {
				var cust = msg.hd;
				var req = msg.tl;
				
				if (Pr.created(req) 
				 && (req.hd === 'match')
				 && Pr.created(req.tl)
				 && Pr.created(req.tl.hd)) {
					var h = req.tl.hd.hd;
					var t = req.tl.hd.tl;
					var env = req.tl.tl;
					var k_env = this.create(pair_match_beh(cust, 'match', t, tail_ptrn));

					this.send(
						Pr(k_env, Pr('match', Pr(h, env))),
						head_ptrn
					);
				} else if (Pr.created(req)
				 && (req.hd === 'eq')
				 && Pr.created(req.tl)) {
					var right = req.tl.hd;
					var env = req.tl.tl;

					this.send(
						Pr(cust, Pr('pair', Pr(this.self, env))), 
						right
					);
				} else if (Pr.created(req)
				 && (req.hd === 'bind')
				 && Pr.created(req.tl)) {
					var left = req.tl.hd;
					var env = req.tl.tl;
					var k_pair = this.create(pair_bind_beh(cust, left, env));
					var fork = this.create(fork_beh(k_pair, head_ptrn, tail_ptrn));

					this.send(
						pair_of(Pr('value', Pr(NIL, env))), 
						fork
					);
				} else if (Pr.created(req)
				 && (req.hd === 'pair')
				 && Pr.created(req.tl)) {
					var pair = req.tl.hd;
					var env = req.tl.tl;

					this.send(
						Pr(cust, Pr('both', Pr(Pr(head_ptrn, tail_ptrn), env))), 
						pair
					);
				} else if (Pr.created(req) 
				 && (req.hd === 'both')
				 && Pr.created(req.tl)
				 && Pr.created(req.tl.hd)) {
					var h = req.tl.hd.hd;
					var t = req.tl.hd.tl;
					var env = req.tl.tl;
					var k_env = this.create(pair_match_beh(cust, 'eq', t, tail_ptrn));

					this.send(
						Pr(k_env, Pr('eq', Pr(h, env))),
						head_ptrn
					);
				} else if (Pr.created(req)
				 && (req.hd === 'value')
				 && Pr.created(req.tl)) {
					var env = req.tl.tl;
					var k_pair = this.create(pair_value_beh(cust));
					var fork = this.create(fork_beh(k_pair, head_ptrn, tail_ptrn));

					this.send(
						pair_of(Pr('value', Pr(NIL, env))), 
						fork
					);
				} else {
					this.send(UNDEF, cust);  // mismatch
				}
			}
		};
	};
	var pair_match_beh = function (cust, cmd, tail, ptrn) {
		return function (env) {
			if (env === UNDEF) {
				this.send(UNDEF, cust);
			} else {
				this.send(
					Pr(cust, Pr(cmd, Pr(tail, env))),
					ptrn
				);
			}
		};
	};
	var pair_bind_beh = function (cust, left, env) {
		return function (msg) {
			if (Pr.created(msg)) {
				var h = msg.hd;
				var t = msg.tl;
				
				if ((h !== UNDEF) && (t !== UNDEF)) {
					this.send(
						Pr(cust, Pr('match', Pr(msg, env))),
						left
					);
					return;  // <--- EARLY EXIT
				}
			}
			this.send(UNDEF, cust);
		};
	};
	var pair_value_beh = function (cust) {
		return function (msg) {
			if (Pr.created(msg)) {
				var h = msg.hd;
				var t = msg.tl;
				
				if ((h !== UNDEF) && (t !== UNDEF)) {
					this.send(msg, cust);
					return;  // <--- EARLY EXIT
				}
			}
			this.send(UNDEF, cust);
		};
	};
	/*
	CREATE self_ptrn WITH \(cust, cmd, arg, env).[
		SEND (k_self, #self) TO env
		CREATE k_self WITH \self.[
			SEND (cust, cmd, arg, env) TO SELF
			BECOME const_ptrn_beh(self)
		]
	]
	*/
	var self_ptrn_beh = function (msg) {
		if (Pr.created(msg)) {
			var cust = msg.hd;
			var req = msg.tl;
			
			if (Pr.created(req) 
			 && Pr.created(req.tl)) {
				var cmd = req.hd;
				var arg = req.tl.hd;
				var env = req.tl.tl;
				var k_self = this.create(
					function (value) {
//						this.send(msg, this.self);
//						this.become(const_ptrn_beh(value));
						this.send(
							msg,
							this.create(
								const_ptrn_beh(value),
								'self:'+value
							)
						);
					}
				);

				this.send(Pr(k_self, 'self'), env);
			}
		}
	};
	/*
	LET block_beh(vars, stmt, env) = \(cust, #exec, denv, sponsor).[
		CREATE env' WITH block_env_beh(env, denv)
		SEND (vars, env') TO extend
		CREATE extend WITH \(vlist, xenv).[
			CASE vlist OF
			(first, rest) : [
				SEND (k_declare, #declare, first) TO xenv
				CREATE k_declare WITH \xenv'.[
					SEND (rest, xenv') TO extend
				]
			]
			_ : [
				SEND (cust, #exec, xenv, sponsor) TO stmt
			]
		]
	]
	*/
	var block_beh = function (vars, stmt, env) {
		return function (msg) {
			if (Pr.created(msg)) {
				var cust = msg.hd;
				var req = msg.tl;
				
				if (Pr.created(req) 
				 && (req.hd === 'exec')
				 && Pr.created(req.tl)) {
					var denv = req.tl.hd;
					var sponsor = req.tl.tl;
					var extend = this.create(
						function (vlist_xenv) {
							if (Pr.created(vlist_xenv)) {
								var vlist = vlist_xenv.hd;
								var xenv = vlist_xenv.tl;
								
								if (Pr.created(vlist)) {
									var first = vlist.hd;
									var rest = vlist.tl;
									var k_declare = this.create(
										function (xenv_) {
											this.send(Pr(rest, xenv_), extend)
										}
									);
									
									this.send(Pr(k_declare, Pr('declare', first)), xenv);
								} else {
									this.send(
										Pr(cust, Pr('exec', Pr(xenv, sponsor))),
										stmt
									);
								}
							}
						}
					);
					var env_ = this.create(block_env_beh(env, denv), 'env:[]');

					this.send(Pr(vars, env_), extend);
				}
			}
		};
	};
	/*
	CREATE empty_stmt WITH \(cust, #exec, env, sponsor).[
		SEND #ok TO cust
	]
	*/
	var empty_stmt_beh = function (msg) {
		if (Pr.created(msg)) {
			var cust = msg.hd;
			var req = msg.tl;
			
			if (Pr.created(req) 
			 && (req.hd === 'exec')) {
				this.send('ok', cust);
			}
		}
	};
	/*
	LET stmt_pair_beh(h_stmt, t_stmt) = \(cust, #exec, env, sponsor).[
		CREATE fork WITH fork_beh(k_pair, h_stmt, t_stmt)
		SEND pair_of(#exec, env, sponsor) TO fork
		CREATE k_pair WITH \result.[
			SEND stmt_pair_result(result) TO cust
		]
	]
	LET stmt_pair_result = \result.(
		CASE result OF
		(#ok, #ok) : #ok
		(#fail, _) : #fail
		(_, #fail) : #fail
		(#ok, beh) : beh
		(beh, #ok) : beh
		_ : #fail
		END
	)
	*/
	var stmt_pair_beh = function (h_stmt, t_stmt) {
		return function (msg) {
			if (Pr.created(msg)) {
				var cust = msg.hd;
				var req = msg.tl;
				
				if (Pr.created(req) 
				 && (req.hd === 'exec')
				 && Pr.created(req.tl)) {
					var env = req.tl.hd;
					var sponsor = req.tl.tl;
					var k_pair = this.create(
						function (result) {
							if (Pr.created(result)) {
								var h = result.hd;
								var t = result.tl;
								
								if ((h === 'ok') && (t === 'ok')) {
									result = 'ok';
								} else if ((h === 'fail') || (t === 'fail')) {
									result = 'fail';
								} else if (h === 'ok') {
									result = t;
								} else if (t === 'ok') {
									result = h;
								} else {
									result = 'fail';
								}
							} else {
								result = 'fail';
							}
							this.send(result, cust);
						}
					);
					var fork = this.create(fork_beh(k_pair, h_stmt, t_stmt));

					this.send(pair_of(req), fork);
				}
			}
		};
	};
	/*
	LET def_stmt_beh(ptrn, expr) = \(cust, #exec, env, sponsor).[
		SEND (k_eval, #eval, env) TO expr
		CREATE k_eval WITH \value.[
			SEND (SELF, #match, value, env) TO ptrn
			BECOME \env'.[
				CASE env' OF
				? : [ SEND (cust, #throw, #mismatch, ptrn, value) TO sponsor ]
				_ : [ SEND #ok TO cust ]
				END
			]
		]
	]
	*/
	var def_stmt_beh = function (ptrn, expr) {
		return function (msg) {
			if (Pr.created(msg)) {
				var cust = msg.hd;
				var req = msg.tl;

				if (Pr.created(req)
				 && (req.hd === 'exec')
				 && Pr.created(req.tl)) {
					var env = req.tl.hd;
					var sponsor = req.tl.tl;
					var k_eval = this.create(
						function (value) {
							this.send(
								Pr(this.self, Pr('match', Pr(value, env))),
								ptrn
							);
							this.become(
								function (env_) {
									if (env_ === UNDEF) {
										this.send(
											Pr(cust, Pr('throw', Pr('mismatch', Pr(ptrn, value)))),
											sponsor
										);
									} else {
										this.send('ok', cust);
									}
								}
							);
						}
					);

					this.send(Pr(k_eval, Pr('eval', env)), expr);
				}
			}
		};
	};
	/*
	LET let_stmt_beh(eqtn) = \(cust, #exec, env, sponsor).[
		SEND (k_env, #unify, env) TO eqtn
		CREATE k_env WITH \env'.[
			CASE env' OF
			? : [ SEND (cust, #throw, #conflict, eqtn) TO sponsor ]
			_ : [ SEND #ok TO cust ]
			END
		]
	]
	*/
	var let_stmt_beh = function (eqtn) {
		return function (msg) {
			if (Pr.created(msg)) {
				var cust = msg.hd;
				var req = msg.tl;
				
				if (Pr.created(req) 
				 && (req.hd === 'exec')
				 && Pr.created(req.tl)) {
					var env = req.tl.hd;
					var sponsor = req.tl.tl;
					var k_env = this.create(
						function (env_) {
							if (env_ === UNDEF) {
								this.send(
									Pr(cust, Pr('throw', Pr('conflict', eqtn))), 
									sponsor
								);
							} else {
								this.send('ok', cust);
							}
						}
					);

					this.send(Pr(k_env, Pr('unify', env)), eqtn);
				}
			}
		};
	};
	/*
	LET after_send_stmt_beh(t_expr, m_expr, a_expr) = \(cust, #exec, env, sponsor).[
		SEND (k_delay, #eval, env) TO t_expr
		CREATE k_delay WITH \delay.[
			CREATE fork WITH fork_beh(k_send, m_expr, a_expr)
			SEND pair_of(#eval, env) TO fork
			CREATE k_send WITH \(msg, to).[
				SEND (cust, #after-send, delay, msg, to) TO sponsor
			]
		]
	]
	LET send_stmt_beh(m_expr, a_expr) = \(cust, #exec, env, sponsor).[
		CREATE fork WITH fork_beh(k_send, m_expr, a_expr)
		SEND pair_of(#eval, env) TO fork
		CREATE k_send WITH \(msg, to).[
			SEND (cust, #send, msg, to) TO sponsor
		]
	]
	*/
	var send_stmt_beh = function (m_expr, a_expr, t_expr) {
		if (t_expr) {
			return function (msg) {
				if (Pr.created(msg)) {
					var cust = msg.hd;
					var req = msg.tl;
					
					if (Pr.created(req) 
					 && (req.hd === 'exec')
					 && Pr.created(req.tl)) {
						var env = req.tl.hd;
						var sponsor = req.tl.tl;
						var k_delay = this.create(
							function (delay) {
								var k_send = this.create(
									function (msg_to) {
										if (Pr.created(msg_to)) {
											this.send(
												Pr(cust, Pr('after-send', Pr(delay, msg_to))),
												sponsor
											);
										}
									}
								);
								var fork = this.create(fork_beh(k_send, m_expr, a_expr));
			
								this.send(pair_of(Pr('eval', env)), fork);
							}
						);
						
						this.send(Pr(k_delay, Pr('eval', env)), t_expr);
					}
				}
			};
		}
		return function (msg) {
			if (Pr.created(msg)) {
				var cust = msg.hd;
				var req = msg.tl;
				
				if (Pr.created(req) 
				 && (req.hd === 'exec')
				 && Pr.created(req.tl)) {
					var env = req.tl.hd;
					var sponsor = req.tl.tl;
					var k_send = this.create(
						function (msg_to) {
							if (Pr.created(msg_to)) {
								this.send(
									Pr(cust, Pr('send', msg_to)),
									sponsor
								);
							}
						}
					);
					var fork = this.create(fork_beh(k_send, m_expr, a_expr));

					this.send(pair_of(Pr('eval', env)), fork);
				}
			}
		};
	};
	/*
	LET create_stmt_beh(ident, expr) = \(cust, #exec, env, sponsor).[
		SEND (k_create, #new) TO sponsor
		CREATE k_create WITH \actor.[
			SEND (SELF, #bind, ident, actor) TO env
			BECOME \env'.[
				SEND (SELF, #eval, env') TO expr
				BECOME \beh_fn.[
					SEND (cust, beh_fn, env') TO actor
				]
			]
		]
	]
	*/
	var create_stmt_beh = function (ident, expr) {
		return function (msg) {
			if (Pr.created(msg)) {
				var cust = msg.hd;
				var req = msg.tl;
				
				if (Pr.created(req) 
				 && (req.hd === 'exec')
				 && Pr.created(req.tl)) {
					var env = req.tl.hd;
					var sponsor = req.tl.tl;
					var k_create = this.create(
						function (actor) {
							actor.rename('@' + ident);
							this.send(Pr(this.self, Pr('bind', Pr(ident, actor))), env);
							this.become(
								function (env_) {
									this.send(Pr(this.self, Pr('eval', env_)), expr);
									this.become(
										function (beh_fn) {
											this.send(Pr(cust, Pr(beh_fn, env_)), actor);
										}
									);
								}
							);
						}
					);

					this.send(Pr(k_create, 'new'), sponsor);
				}
			}
		};
	};
	/*
	LET become_stmt_beh(expr) = \(cust, #exec, env, sponsor).[
		SEND (cust, #eval, env) TO expr
	]
	*/
	var become_stmt_beh = function (expr) {
		return function (msg) {
			if (Pr.created(msg)) {
				var cust = msg.hd;
				var req = msg.tl;
				
				if (Pr.created(req) 
				 && (req.hd === 'exec')
				 && Pr.created(req.tl)) {
					var env = req.tl.hd;
					var sponsor = req.tl.tl;

					this.send(Pr(cust, Pr('eval', env)), expr);
				}
			}
		};
	};
	/*
	LET throw_stmt_beh(expr) = \(cust, #exec, env, sponsor).[
		SEND (k_throw, #eval, env) TO expr
		CREATE k_throw WITH \exception.[
			SEND (cust, #throw, exception) TO sponsor
		]
	]
	*/
	var throw_stmt_beh = function (expr) {
		return function (msg) {
			if (Pr.created(msg)) {
				var cust = msg.hd;
				var req = msg.tl;
				
				if (Pr.created(req) 
				 && (req.hd === 'exec')
				 && Pr.created(req.tl)) {
					var env = req.tl.hd;
					var sponsor = req.tl.tl;
					var k_throw = this.create(
						function (exception) {
							this.send(
								Pr(cust, Pr('throw', exception)), 
								sponsor
							);
						}
					);

					this.send(Pr(k_throw, Pr('eval', env)), expr);
				}
			}
		};
	};
	/*
	LET expr_stmt_beh(expr) = \(cust, #exec, env, sponsor).[
		SEND (k_exec, #eval, env) TO expr
		CREATE k_exec WITH \block.[
			CASE block OF
			? : [ SEND #ok TO cust ] 
			NIL : []
			TRUE : []
			FALSE : []
			# FIXME: really need to ensure block is an actor
			_ : [ SEND (cust, #exec, env, sponsor) TO block ]
			END
		]
	]
	*/
	var expr_stmt_beh = function (expr) {
		return function (msg) {
			if (Pr.created(msg)) {
				var cust = msg.hd;
				var req = msg.tl;
				
				if (Pr.created(req) 
				 && (req.hd === 'exec')
				 && Pr.created(req.tl)) {
					var env = req.tl.hd;
					var sponsor = req.tl.tl;
					var k_exec = this.create(
						function (block) {
							if ((typeof block === 'object') && block.isActor) {
								this.send(msg, block);
							} else {
								this.send('ok', cust);
							}
						}
					);

					this.send(Pr(k_exec, Pr('eval', env)), expr);
				}
			}
		};
	};
	/*
	LET new_actor_beh = \(cust, beh_fn, env).[
		BECOME serializer_beh(NEW self_beh(SELF, beh_fn, env))
		SEND #ok TO cust
	]
	*/
	var new_actor_beh = function (msg) {
		if (Pr.created(msg)
		 && Pr.created(msg.tl)) {
			var cust = msg.hd;
			var beh_fn = msg.tl.hd;
			var env = msg.tl.tl;

			if (beh_fn === 'apply') {
				/* undefined application */
				this.send(UNDEF, cust);
			} else {
				this.become(serializer_beh(
					this.create(self_beh(this.self, beh_fn, env), 'actor')
				));
				this.send('ok', cust);
			}
		}
	};
	/*
	LET self_beh(self, beh_fn, env) = \(cust, sponsor, message).[
		SEND (SELF, #apply, message) TO beh_fn
		BECOME \block.[
			CREATE env' WITH self_env_beh(self, env)
			SEND (SELF, #exec, env', sponsor) TO block
			BECOME \result.[
				CASE result OF
				#fail : [
					BECOME self_beh(self, beh_fn, env)
					SEND #fail TO cust
				]
				#ok : [
					BECOME self_beh(self, beh_fn, env)
					SEND #ok TO cust
				]
				beh' : [
					BECOME self_beh(self, beh', env)
					SEND #ok TO cust
				]
				END
			]
		]
	]
	*/
	var self_beh = function (self, beh_fn, env) {
		return function (msg) {
			if (Pr.created(msg)
			 && Pr.created(msg.tl)) {
				var cust = msg.hd;
				var sponsor = msg.tl.hd;
				var message = msg.tl.tl;
			
				if (sponsor === 'apply') {
					/* undefined application */
					this.send(UNDEF, cust);
				} else {
					this.send(Pr(this.self, Pr('apply', message)), beh_fn);
					this.become(
						function (block) {
							var env_ = this.create(self_env_beh(self, env), 'self_env');

							if ((typeof block === 'object') && block.isActor) {
								this.send(
									Pr(this.self, Pr('exec', Pr(env_, sponsor))),
									block
								);
							} else {
								this.send(
									Pr(this.self, Pr('throw', 'behavior-block-required')),
									sponsor
								);
							}
							this.become(
								function (result) {
									if (result === 'fail') {
										this.become(self_beh(self, beh_fn, env));
										this.send('fail', cust);
									} else if (result === 'ok') {
										this.become(self_beh(self, beh_fn, env));
										this.send('ok', cust);
									} else {
										this.become(self_beh(self, result, env));
										this.send('ok', cust);
									}
								}
							);
						}
					);
				}
			}
		};
	};
	/*
	LET ok_xact_beh(mlist, alist) = \(cust, req).[
		CASE req OF
		#new : [
			CREATE actor WITH new_actor_beh
			BECOME ok_xact_beh(mlist, (actor, alist))
			SEND actor TO cust
		]
		(#send, msg, target) : [
			BECOME ok_xact_beh(((msg, target), mlist), alist)
			SEND #ok TO cust
		]
		(#after-send, delay, msg, target) : [
			BECOME ok_xact_beh((((delay, msg, target), timer_svc), mlist), alist)
			SEND #ok TO cust
		]
		(#throw, exception) : [  # raise an exception
			BECOME fail_xact_beh(exception)
			SEND #fail TO cust
		]
		#commit : [ SEND (mlist, alist) TO cust ]
		#revert : [ SEND (#exception, #ok) TO cust ]
		END
	]
	*/
	var ok_xact_beh = function (mlist, alist) {
		return function (msg) {
			var cust, req, msg_target;

			if (Pr.created(msg)) {
				cust = msg.hd;
				req = msg.tl;
				if (req === 'new') {
					var actor = this.create(new_actor_beh, 'self');

					this.become(ok_xact_beh(mlist, Pr(actor, alist)));
					this.send(actor, cust);
				} else if (Pr.created(req) 
				 && (req.hd === 'send')
				 && Pr.created(req.tl)) {
					msg_target = req.tl;
					this.become(ok_xact_beh(Pr(msg_target, mlist), alist));
					this.send('ok', cust);
				} else if (Pr.created(req) 
				 && (req.hd === 'after-send')
				 && Pr.created(req.tl)
				 && (typeof req.tl.hd === 'number')
				 && Pr.created(req.tl.tl)) {
				 	msg_target = Pr(
				 		Pr(req.tl.hd, req.tl.tl), 
				 		Humus.runtime.timer_svc  // <-- ACCESS GLOBAL SERVICE
				 	);
//				 	log('AFTER: ' + msg_target);
					this.become(ok_xact_beh(Pr(msg_target, mlist), alist));
					this.send('ok', cust);
				} else if (Pr.created(req)
				 && (req.hd === 'throw')) {
					this.become(fail_xact_beh(req.tl));
					this.send('fail', cust);
				} else if (req === 'commit') {
					this.send(Pr(mlist, alist), cust);
				} else if (req === 'revert') {
					this.send(Pr('exception', 'ok'), cust);
				}
			}
		};
	};
	/*
	LET fail_xact_beh(exception) = \(cust, req).[
		CASE req OF
		#new : [ SEND NEW new_actor_beh TO cust ]
		#commit : [ SEND (NIL, NIL) TO cust ]
		#revert : [ SEND (#exception, exception) TO cust ]
		_ : [ SEND #fail TO cust ]
		END
	]
	*/
	var fail_xact_beh = function (exception) {
		return function (msg) {
			if (Pr.created(msg)) {
				var cust = msg.hd;
				var req = msg.tl;
				
				if (req === 'new') {
					this.send(this.create(new_actor_beh, 'dead'), cust);
				} else if (req === 'commit') {
					this.send(Pr(NIL, NIL), cust);
				} else if (req === 'revert') {
					this.send(Pr('exception', exception), cust);
				} else {
					this.send('fail', cust);
				}
			}
		};
	};
	/*
	LET monitor_beh(config, action, sponsor) = \result.[
		CASE result OF
		#ok : [
			SEND (k_ok, #commit) TO sponsor
			CREATE k_ok WITH \(mlist, alist).[
				SEND (#trace, action, (mlist, alist)) TO config
				SEND mlist TO SELF
				BECOME \list.[
					IF $list = ((m, a), rest) [
						SEND (#send, m, a) TO config
						SEND rest TO SELF
					]
				]
			]
		]
		#fail : [
			SEND (k_fail, #revert) TO sponsor
			CREATE k_fail WITH \(#exception, exception).[
				SEND (#trace, action, (#exception, exception)) TO config
			]
		]
		END
	]
	*/
	var monitor_beh = function (config, action, sponsor) {
		return function (result) {
			if (result === 'ok') {
				var k_ok = this.create(
					function (msg) {
						if (Pr.created(msg)) {
							var mlist = msg.hd;
							var alist = msg.tl;
							
							this.send(
								Pr('trace', Pr(action, Pr(mlist, alist))), 
								config
							);
							this.send(mlist, this.self);
							this.become(
								function (list) {
									if (Pr.created(list)
									 && Pr.created(list.hd)) {
										var m_a = list.hd;
										var rest = list.tl;
										
										this.send(Pr('send', m_a), config);
										this.send(rest, this.self);
									}
								}
							);
						}
					}
				);
				
				this.send(Pr(k_ok, 'commit'), sponsor);
			} else {  // result === 'fail'
				var k_fail = this.create(
					function (msg) {
						if (Pr.created(msg)
						 && (msg.hd === 'exception')) {
							var exception = msg.tl;
							
							log('EXCEPTION ' + exception);
							this.send(
								Pr('trace', Pr(action, msg)), 
								config
							);
//						} else {
//							log(this.self + ' DOES NOT UNDERSTAND ' + msg);
						}
					}
				);
				
				this.send(Pr(k_fail, 'revert'), sponsor);
			}
		}
	};
	/*
	LET config_beh(log) = \msg.[
		CASE msg OF
		(#new, cust) : [
			CREATE actor WITH new_actor_beh
			SEND actor TO cust
			SEND (#trace, ?, (NIL, (actor, NIL))) TO SELF
		]
		(#send, message, target) : [
			CREATE sponsor WITH ok_xact_beh(NIL, NIL)
			CREATE monitor WITH monitor_beh(SELF, (message, target), sponsor)
			SEND (monitor, sponsor, message) TO target
		]
		(#trace, action, result) : [
			SEND (action, result) TO log
		]
		END
	]
	*/
	var config_beh = function (log) {
		return function (msg) {
			if (Pr.created(msg)) {
				if (msg.hd === 'new') {
					var cust = msg.tl;
					var actor = this.create(new_actor_beh, 'self');
					
					this.send(actor, cust);
					this.send(
						Pr('trace', Pr(UNDEF, Pr(NIL, Pr(actor, NIL)))), 
						this.self
					);
				} else if ((msg.hd === 'send')
				 && Pr.created(msg.tl)) {
					var action = msg.tl;
					var message = action.hd;
					var target = action.tl;
					var sponsor = this.create(
						ok_xact_beh(NIL, NIL), 
						'sponsor'
					);
					var monitor = this.create(
						monitor_beh(this.self, action, sponsor), 
						'monitor'
					);
					
					this.send(Pr(monitor, Pr(sponsor, message)), target);
				} else if (msg.hd === 'trace') {
					this.send(msg.tl, log);
				}
			}
		};
	};
	/*
	LET repl_sponsor_beh(config, alert) = \(cust, req).[
		CASE req OF
		#new : [
			SEND (#new, cust) TO config
		]
		(#send, message, target) : [
			SEND (#send, message, target) TO config
			SEND #ok TO cust
		]
		(#after-send, delay, message, target) : [
			AFTER delay SEND (#send, message, target) TO config
			SEND #ok TO cust
		]
		(#throw, exception) : [
			SEND req TO alert
			SEND #fail TO cust
		]
		END
	]
	*/
	var repl_sponsor_beh = function (config, alert) {
		return function (msg) {
			if (Pr.created(msg)) {
				var cust = msg.hd;
				var req = msg.tl;
				
//				log('REPL: ' + req);
				if (req === 'new') {
					this.send(Pr('new', cust), config);
				} else if (Pr.created(req) 
				 && (req.hd === 'send')
				 && Pr.created(req.tl)) {
					this.send(req, config);
					this.send('ok', cust);
				} else if (Pr.created(req) 
				 && (req.hd === 'after-send')
				 && Pr.created(req.tl)
				 && (typeof req.tl.hd === 'number')
				 && Pr.created(req.tl.tl)) {
				 	var delay = req.tl.hd;

				 	req = Pr('send', req.tl.tl);
//				 	log('AFTER ' + delay + ' SEND ' + req + ' TO ' + config);
					this.sendAfter(delay, req, config);
					this.send('ok', cust);
				} else if (Pr.created(req) 
				 && (req.hd === 'throw')) {
					if (alert) {
						this.send(req, alert);
					}
					this.send('fail', cust);
				}
			}
		};
	};
	/*
	LET upcall_beh(meta) = \(cust, sponsor, message).[
		SEND message TO meta
		SEND #ok TO cust
	]
	*/
	var upcall_beh = function (meta) {
		return function (msg) {
			if (Pr.created(msg)
			 && Pr.created(msg.tl)) {
				var cust = msg.hd;
				var sponsor = msg.tl.hd;
				var message = msg.tl.tl;
			
				if (sponsor === 'apply') {
					/* undefined application */
					this.send(UNDEF, cust);
				} else {
					this.send(message, meta);
					this.send('ok', cust);
				}
			}
		};
	};
	/*
	LET downcall_beh(config, target) = \message.[
		SEND (#send, message, target) TO config
	]
	*/
	var downcall_beh = function (config, target) {
		return function (message) {
			this.send(Pr('send', Pr(message, target)), config);
		};
	};
	/*
	LET native_fn_beh(fn) = \(cust, #apply, arg).[
		SEND fn(arg) TO cust
	]
	*/
	var native_fn_beh = function (fn) {
		return function (msg) {
			if (Pr.created(msg)) {
				var cust = msg.hd;
				var req = msg.tl;
				
				if (Pr.created(req) 
				 && (req.hd === 'apply')) {
					var arg = req.tl;

					this.send(fn(arg), cust);
				}
			}
		};
	};
	
	var factory;
	var constructor = function Gen_Meta(cfg) {
		this.config = cfg;
		this.Actor = (function () {  // private class -- needs access to 'cfg'
			var factory;
		
			factory = function (beh, id) {
				var self = cfg.create(beh, id);
				
				self.factory = factory;
				return self;
			};
			factory.created = function (instance) {
				return ((typeof instance === 'object')
					&&  (instance !== null)
					&&  (instance.factory === factory));
			};
			return factory;
		})();
	}
	.field('version', version)
	.method('tag_beh', tag_beh)
	.method('join_beh', join_beh)
	.method('fork_beh', fork_beh)
	.method('call_pair_beh', call_pair_beh)
	.method('pair_of', pair_of)
	.method('serializer_beh', serializer_beh)
	.method('undefined_beh', undefined_beh)
	.method('empty_env_beh', empty_env_beh)
	.method('env_beh', env_beh)
	.method('dynamic_env_beh', dynamic_env_beh)
	.method('repl_env_beh', repl_env_beh)  // performance optimization
//	.method('block_env_beh', block_env_beh)
//	.method('self_env_beh', self_env_beh)
	.method('const_expr_beh', const_expr_beh)
	.method('ident_expr_beh', ident_expr_beh)
	.method('abs_expr_beh', abs_expr_beh)
	.method('closure_beh', closure_beh)
	.method('app_expr_beh', app_expr_beh)
	.method('pair_expr_beh', pair_expr_beh)
	.method('case_expr_beh', case_expr_beh)
	.method('case_choice_beh', case_choice_beh)
	.method('case_end_beh', case_end_beh)
	.method('if_expr_beh', if_expr_beh)
	.method('let_expr_beh', let_expr_beh)
	.method('block_expr_beh', block_expr_beh)
	.method('now_expr_beh', now_expr_beh)  // FIXME: non-standard extension
	.method('self_expr_beh', self_expr_beh)
	.method('new_expr_beh', new_expr_beh)
	.method('eqtn_beh', eqtn_beh)
	.method('const_ptrn_beh', const_ptrn_beh)
	.method('value_ptrn_beh', value_ptrn_beh)
	.method('ident_ptrn_beh', ident_ptrn_beh)
	.method('any_ptrn_beh', any_ptrn_beh)
	.method('pair_ptrn_beh', pair_ptrn_beh)
	.method('self_ptrn_beh', self_ptrn_beh)
	.method('block_beh', block_beh)
	.method('empty_stmt_beh', empty_stmt_beh)
	.method('stmt_pair_beh', stmt_pair_beh)
	.method('def_stmt_beh', def_stmt_beh)
	.method('let_stmt_beh', let_stmt_beh)
	.method('send_stmt_beh', send_stmt_beh)
	.method('create_stmt_beh', create_stmt_beh)
	.method('become_stmt_beh', become_stmt_beh)
	.method('throw_stmt_beh', throw_stmt_beh)
	.method('expr_stmt_beh', expr_stmt_beh)
	.method('config_beh', config_beh)
	.method('repl_sponsor_beh', repl_sponsor_beh)
	.method('upcall_beh', upcall_beh)
	.method('downcall_beh', downcall_beh)
	.method('native_fn_beh', native_fn_beh)
	.override('toString', function () {
		return '<Gen_Meta v' + this.version + '>';
	});

	factory = function (cfg) {
		var self = new constructor(cfg);
		
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
