var config = require("./config.js");

if (typeof String.prototype.startsWith != 'function') {
	String.prototype.startsWith = function(str) {
		return this.slice(0, str.length) == str;
	};
}

if (typeof String.prototype.endsWith != 'function') {
	String.prototype.endsWith = function(str) {
		return this.slice(-str.length) == str;
	};
}

var brewArray = function(length) {
	var arr = new Array(length || 0), i = length;
	if (arguments.length > 1) {
		var args = Array.prototype.slice.call(arguments, 1);
		while (i--)
			arr[length - 1 - i] = brewArray.apply(this, args);
	}
	return arr;
}

/**
 * <p>
 * Generate a decorated callback function. The decorated callback function uses the provided <code>this</code> scope
 * to generate a callback closure which can subsequently used where the value of <code>this</code> is likely to be
 * mangled or otherwise an unknown value.
 * </p>
 * 
 * <p>
 * On invoke by the calling function the callback closure passes all provided function call arguments to the decorated
 * child function. The value returned by the child function is returned to the calling function without modification.
 * Any exception raised in the child function are passed to the calling function without handling or reporting.
 * </p>
 * 
 * <p>
 * This is necessary because generic callbacks (from event-places like <code>window</code>, <code>document</code>
 * and <code>canvas</code>) mangle the logical value of the "this" context. Because we are reliant on the
 * <code>this</code> scope pointing to a game object or the game itself, a decorator closure is required to un-mangle
 * the <code>this</code> reference.
 * </p>
 * 
 * @param fn
 *            The function reference
 * @param fncontext
 *            The context which "this" refers to
 */
var decoratedCallback = function(fn, fncontext) {
	return function() {
		fn.apply(fncontext, arguments);
	}
};

var assert = function(cond, message) {
	if (cond)
		return;
	if (typeof Error !== "undefined")
		throw new Error(message || "Assertion failed!");
	throw message || "Assertion failed!";
};

/**
 * The global class type dictionary, for debugging and redefinition later.
 */
var ClassDict = {
	defns : {},
	defnClass : function(proto, ctor, cfn) {
		var tracer = new Error();
		if (ClassDict.defns === null) // no dict?
			ClassDict.defns = {}; // create dict
		if (ClassDict.defns[cfn] === undefined || ClassDict.defns[cfn] === null) // no table?
			ClassDict.defns[cfn] = []; // create
		ClassDict.defns[cfn].push({ // store
			proto : proto, // the prototype...
			ctor : ctor, // ... the constructor callable...
			tracer : tracer.stack
		}); // ... and the defn call stack

		if (config.debug.classes.dictionary_create) {
			console.log("DEBUG_DICT_CREATE", "defnClass", "Defining named class", cfn);
			console.trace("DEBUG_DICT_CREATE", "defnClass", ClassDict.defns[cfn]);
		}
		if (config.debug.classes.structure) {
			console.log("DEBUG_CLASS_STR", "Introspect", cfn, "Constructor", proto.constructor);
			if (proto.init !== undefined && proto.init !== null)
				console.log("DEBUG_CLASS_STR", "Introspect", cfn, "Initter", proto.init);
			else
				console.log("DEBUG_CLASS_STR", "Introspect", cfn, "Initter", "[<void>]");
		}
	},

	ldefClass : function(cfn) {
		function _noSuchClass(cfn) {
			if (cfn == "Exception") { // calling for Exception?
				if (config.debug.classes.dictionary_usage) // problem?
					console.error("DEBUG_DICT_USE", "ldefClass", "System called for", cfn, "but could not offer, panic!");
				throw new Error("Class dictionary is corrupt."); // yes, houstin
			} else {
				if (config.debug.classes.dictionary_usage) // report cfn!
					console.warn("DEBUG_DICT_USE", "ldefClass", "Class", cfn, "not found!");
				var ex = ClassDict.ldefClass("Exception").ctor; // get exception
				throw (new ex("No such class " + cfn)); // throw new (Exception)
			}
		}
		if (ClassDict.defns === null) // no classes?
			_noSuchClass(cfn);
		if (ClassDict.defns[cfn] === undefined || ClassDict.defns[cfn] === null) // none for name
			_noSuchClass(cfn);
		var map = ClassDict.defns[cfn]; // get table
		if (map.length == 0) // no classes seen?
			_noSuchClass(cfn);
		return ClassDict.defns[cfn][map.length - 1]; // latest declaration!
	},

	classTree : function(o) {
		if (o === undefined) // nothing
			console.log("undefined");
		else if (o === null) // null
			console.log("null");
		else {
			var ctr = o.constructor; // what ctr?
			if (ctr === undefined || ctr === null) // no ctr?
				console.log("primitive"); // prim!
			else
				// cplx!
				console.log("constructor " + o.constructor.name);
		}
	}
};

var ClassBuilder = (function(basetype, baseproto) {
	/** If the cb is currently initializing an inherited object */
	var __initializing = false;
	/** The roothint type, or empty */
	var __basetype = basetype || {};
	/** regex to match super variables, or all vars if regex is unsupported */
	var __stRgx = /xyz/.test(function() {
		xyz;
	}) ? /\b_super\b/ : /.*/;

	// Class is instantiated voidable here, since later on we change the prototype.
	function Class() { /* void */
	}

	// base prototype or empty
	Class.prototype = baseproto || {};

	// default system constructor
	Class.prototype.constructor = __basetype.ctr || function() { /* void */
	};

	/** Class.init is overridable via __basetype */
	Class.prototype.init = __basetype.init || function() { /* void */
	}

	/** Class.toString is overridable via __basetype */
	Class.prototype.toString = __basetype.toString || function() {
		if (this === undefined)
			return "undefined";
		if (this === null)
			return "null";
		if (this.classinfo == undefined || this.classinfo == null)
			return "Class?"; // we hope??
		if (this.classinfo.name === undefined || this.classinfo.name === null)
			return "AnonymousClass";
		return this.classinfo.name; // a wild [x] appeared!
	}

	/** Class.byName is overridable via __basetype */
	Class.prototype.byName = __basetype.byname || function(name) {
		return ClassDict.ldefClass(name);
	}

	Class.prototype.getClass = function() {
		if (this === undefined)
			return undefined;
		if (this === null)
			return null;
		if (this.classinfo === undefined || this.classinfo === null)
			return {
				name : "Class?" // we hope??
			};
		if (this.classinfo.name === undefined || this.classinfo.name === null)
			return {
				name : "AnonymousClass" // no debug attached
			};
		return this.classinfo;
	}

	/**
	 * Class.extend is overridable via __basetype. This is extension is not recommended for general usage, since it can
	 * break the ClassBuilder or ClassDict.
	 */
	Class.extend = __basetype.extend
			|| function(prop, classfulName) {
				if (config.debug.classes.define)
					console.log("DEBUG_CLASS_STR", "Class.extend", "Creating extends{} class...");
				var _super = this.prototype; // the _super is this' prototype
				__initializing = true;
				var prototype = new this(); // create a new this
				__initializing = false;

				for ( var name in prop) { // each new class decl...
					if (typeof prop[name] != "function" || // not a function decl
					typeof _super[name] != "function" || // not a function in super decl
					!__stRgx.test(prop[name])) // not the super container
						prototype[name] = prop[name]; // straight copy to new proto
					else
						prototype[name] = (function(name, fn) { // wrap the callee
							if (config.debug.classes.define)
								console.trace("DEBUG_CLASS_DEFINE", "ClassBuild", "Tranforming method",
										(classfulName !== undefined) ? classfulName : "[anon]", ".", name);
							return function() { // new wrapper...
								var tmp = this._super; // store super
								this._super = _super[name]; // new _super (from this' prototype)
								var ret = null;
								try {
									if (config.debug.classes.call) {
										console.trace("DEBUG_CLASS_CALL", "ExtendedAnonProxy", "Invoking method",
												(classfulName !== undefined) ? classfulName : "[anon]", name);
										console.trace("DEBUG_CLASS_CALL", "ExtendedAnonProxy", "... class' _super:", this._super);
									}
									ret = fn.apply(this, arguments); // call callee
								} catch (e) { // callee threw?
									this._super = tmp; // restore _super
									if (config.debug.classes.cfr)
										console.trace("DEBUG_CLASS_CFR", "ExtendedAnonProxy", "Error when invoking named method", name,
												"with _super supertype.", e);
									throw e; // throw e
								}
								this._super = tmp; // restore _super
								return ret; // return value
							};
						})(name, prop[name]);
				}

				/**
				 * Virtual constructor for synthetically loaded classes via extend()
				 */
				function LoadedClass() {
					if (!__initializing && this.init) { // doing init?
						try {
							this.init.apply(this, arguments); // do init now
						} catch (e) { // bad things?
							if (config.debug.classes.cfr)
								console.trace("DEBUG_CLASS_CFR", "ClassLoader", "Error when invoking class initializer for class",
										((this.classinfo !== undefined) ? this.classinfo.name : "[anon]"), e, e.toString());

							var e1 = null; // future retn
							var cle = null;
							try { // find cle
								cle = ClassDict.ldefClass("ErrorInClsInitException");
							} catch (e) { /* void */
							}
							if (cle === null) { // no cle?
								cle = ClassDict.ldefClass("ClassLoadException");
								cle = cle.ctor.extend({ // build it now
									subErr : null,
									init : function(s, n) {
										this._super.call(this, s);
										this.subErr = n;
									},
									toString : function() {
										return this._super() + "\r\nCaused by: " + this.subErr.toString()
									}
								}, "ErrorInClsInitException");
							}
							if (e instanceof Exception) { // got ex?
								try { // wrap it
									e1 = new cle("Unhandled Exception in class constructor.", e);
								} catch (e2) { // uh oh?
									console.error("Classful machine error.", e2, e2.stack);
									throw new Error("CLASS_CFR: Exception in CLE class constructor.", e2);
								}
							} else if (e instanceof Error) {
								e1 = e; // raw error?
							} else {
								try { // object??
									e1 = new cle("Unsupported Object thrown from class constructor.", e);
								} catch (e3) { // well, we tried?
									console.error("Classful machine error.", e3, e3.stack);
									throw new Error("CLASS_CFR: Exception in CLE class constructor.");
								}
							}
							throw e1; // throw wrapped
						}
					}
				}

				LoadedClass.prototype = prototype; // set prototype
				LoadedClass.prototype.constructor = LoadedClass; // set constructor
				if (__basetype !== undefined && __basetype !== null)
					LoadedClass.__basetype = __basetype; // copy root base type

				// if a name is set, register us
				if (classfulName !== undefined && classfulName !== null) {
					ClassDict.defnClass(LoadedClass.prototype, LoadedClass, classfulName);
					LoadedClass.prototype.classinfo = {}; // store debug info
					LoadedClass.prototype.classinfo.name = classfulName;
				}
				LoadedClass.extend = arguments.callee; // extend().extend()...

				if (config.debug.classes.define) {
					if (LoadedClass.prototype.classinfo !== undefined && LoadedClass.prototype.classinfo !== null) {
						console.log("DEBUG_CLASS_STR", "Class.extend", "Successfully created named class",
								LoadedClass.prototype.classinfo.name, "extending class",
								(this.classinfo !== undefined && this.classinfo.name !== undefined) ? this.classinfo.name : "[anon]");
					} else {
						console.log("DEBUG_CLASS_STR", "Class.extend", "Successfully created anonymous class extending [ommitted].");
					}
				}
				if (config.debug.classes.structure)
					console.trace("DEBUG_CLASS_STR", "Class.extend", [ LoadedClass ]);
				return LoadedClass;
			};
	return Class;
});

/**
 * The formal Class type definition.
 */
var Class = ClassBuilder();
Class.classinfo = {
	name : "Class"
};
ClassDict.defnClass(Class.prototype, Class, Class.classinfo.name);

/**
 * <p>
 * This is an ugly workaround to allow us to use 'classful' exception objects rather than Error directly. It also
 * reduces the amount of code required to define new Errors.
 * </p>
 * 
 * <p>
 * Exception is a separate ClassBuilder since it must have the parent type of Error to properly work. While Exceptions
 * still behave like normal 'classes' (fields, extend, functions, etc), they cannot be compared to the base type Class
 * like in normal object-oriented languages.
 * </p>
 * 
 * <p>
 * If you must throw a once-off Exception, it is suggested you use the following polyfill, rather than instantiating the
 * Exception class directly.
 * 
 * <pre>
 * throw new Common.Exception.extend({ init: functiion() { ... } }, &quot;ClassName&quot;);
 * </pre>
 * 
 * </p>
 */
var Exception = ClassBuilder({
	init : function(message) {
		Error.captureStackTrace(this, this.constructor);
		this.name = ((this.classinfo !== undefined) ? this.classinfo.name || this.constructor.name : this.constructor.name);
		this.message = message;
	},
	toString : function() {
		return ((this.name === undefined || this.name === null) ? "Exception" : this.name) + ": " + this.message;
	}
}, null, Object.create(Error.prototype));
Exception.classinfo = {
	name : "Exception"
};
ClassDict.defnClass(Exception.prototype, Exception, Exception.classinfo.name);

var ClassLoadException = Exception.extend({
	init : function(message) {
		this._super.call(this, message);
	}
}, "ClassLoadException");

var Network = {
	CODE_PROTO_ERROR : 3001,
	CODE_HANDSHAKE_ERR : 3002,
	CODE_DISCONNECT : 3003
};

module.exports = {
	assert : assert,
	brewArray : brewArray,
	Class : Class,
	Exception : Exception,
	decoratedCallback : decoratedCallback,
	Network : Network
}