(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){
;(function(undefined) {
    'use strict';
    /**
     * BottleJS v1.6.1 - 2017-05-17
     * A powerful dependency injection micro container
     *
     * Copyright (c) 2017 Stephen Young
     * Licensed MIT
     */
    
    /**
     * Unique id counter;
     *
     * @type Number
     */
    var id = 0;
    
    /**
     * Local slice alias
     *
     * @type Functions
     */
    var slice = Array.prototype.slice;
    
    /**
     * Iterator used to walk down a nested object.
     *
     * If Bottle.config.strict is true, this method will throw an exception if it encounters an
     * undefined path
     *
     * @param Object obj
     * @param String prop
     * @return mixed
     * @throws Error if Bottle is unable to resolve the requested service.
     */
    var getNested = function getNested(obj, prop) {
        var service = obj[prop];
        if (service === undefined && globalConfig.strict) {
            throw new Error('Bottle was unable to resolve a service.  `' + prop + '` is undefined.');
        }
        return service;
    };
    
    /**
     * Get a nested bottle. Will set and return if not set.
     *
     * @param String name
     * @return Bottle
     */
    var getNestedBottle = function getNestedBottle(name) {
        return this.nested[name] || (this.nested[name] = Bottle.pop());
    };
    
    /**
     * Get a service stored under a nested key
     *
     * @param String fullname
     * @return Service
     */
    var getNestedService = function getNestedService(fullname) {
        return fullname.split('.').reduce(getNested, this);
    };
    
    /**
     * Register a constant
     *
     * @param String name
     * @param mixed value
     * @return Bottle
     */
    var constant = function constant(name, value) {
        var parts = name.split('.');
        name = parts.pop();
        defineConstant.call(parts.reduce(setValueObject, this.container), name, value);
        return this;
    };
    
    var defineConstant = function defineConstant(name, value) {
        Object.defineProperty(this, name, {
            configurable : false,
            enumerable : true,
            value : value,
            writable : false
        });
    };
    
    /**
     * Register decorator.
     *
     * @param String fullname
     * @param Function func
     * @return Bottle
     */
    var decorator = function decorator(fullname, func) {
        var parts, name;
        if (typeof fullname === 'function') {
            func = fullname;
            fullname = '__global__';
        }
    
        parts = fullname.split('.');
        name = parts.shift();
        if (parts.length) {
            getNestedBottle.call(this, name).decorator(parts.join('.'), func);
        } else {
            if (!this.decorators[name]) {
                this.decorators[name] = [];
            }
            this.decorators[name].push(func);
        }
        return this;
    };
    
    /**
     * Register a function that will be executed when Bottle#resolve is called.
     *
     * @param Function func
     * @return Bottle
     */
    var defer = function defer(func) {
        this.deferred.push(func);
        return this;
    };
    
    
    /**
     * Immediately instantiates the provided list of services and returns them.
     *
     * @param Array services
     * @return Array Array of instances (in the order they were provided)
     */
    var digest = function digest(services) {
        return (services || []).map(getNestedService, this.container);
    };
    
    /**
     * Register a factory inside a generic provider.
     *
     * @param String name
     * @param Function Factory
     * @return Bottle
     */
    var factory = function factory(name, Factory) {
        return provider.call(this, name, function GenericProvider() {
            this.$get = Factory;
        });
    };
    
    /**
     * Register an instance factory inside a generic factory.
     *
     * @param {String} name - The name of the service
     * @param {Function} Factory - The factory function, matches the signature required for the
     * `factory` method
     * @return Bottle
     */
    var instanceFactory = function instanceFactory(name, Factory) {
        return factory.call(this, name, function GenericInstanceFactory(container) {
            return {
                instance : Factory.bind(Factory, container)
            };
        });
    };
    
    /**
     * A filter function for removing bottle container methods and providers from a list of keys
     */
    var byMethod = function byMethod(name) {
        return !/^\$(?:decorator|register|list)$|Provider$/.test(name);
    };
    
    /**
     * List the services registered on the container.
     *
     * @param Object container
     * @return Array
     */
    var list = function list(container) {
        return Object.keys(container || this.container || {}).filter(byMethod);
    };
    
    /**
     * Function used by provider to set up middleware for each request.
     *
     * @param Number id
     * @param String name
     * @param Object instance
     * @param Object container
     * @return void
     */
    var applyMiddleware = function applyMiddleware(middleware, name, instance, container) {
        var descriptor = {
            configurable : true,
            enumerable : true
        };
        if (middleware.length) {
            descriptor.get = function getWithMiddlewear() {
                var index = 0;
                var next = function nextMiddleware(err) {
                    if (err) {
                        throw err;
                    }
                    if (middleware[index]) {
                        middleware[index++](instance, next);
                    }
                };
                next();
                return instance;
            };
        } else {
            descriptor.value = instance;
            descriptor.writable = true;
        }
    
        Object.defineProperty(container, name, descriptor);
    
        return container[name];
    };
    
    /**
     * Register middleware.
     *
     * @param String name
     * @param Function func
     * @return Bottle
     */
    var middleware = function middleware(fullname, func) {
        var parts, name;
        if (typeof fullname === 'function') {
            func = fullname;
            fullname = '__global__';
        }
    
        parts = fullname.split('.');
        name = parts.shift();
        if (parts.length) {
            getNestedBottle.call(this, name).middleware(parts.join('.'), func);
        } else {
            if (!this.middlewares[name]) {
                this.middlewares[name] = [];
            }
            this.middlewares[name].push(func);
        }
        return this;
    };
    
    /**
     * Named bottle instances
     *
     * @type Object
     */
    var bottles = {};
    
    /**
     * Get an instance of bottle.
     *
     * If a name is provided the instance will be stored in a local hash.  Calling Bottle.pop multiple
     * times with the same name will return the same instance.
     *
     * @param String name
     * @return Bottle
     */
    var pop = function pop(name) {
        var instance;
        if (typeof name === 'string') {
            instance = bottles[name];
            if (!instance) {
                bottles[name] = instance = new Bottle();
                instance.constant('BOTTLE_NAME', name);
            }
            return instance;
        }
        return new Bottle();
    };
    
    /**
     * Clear all named bottles.
     */
    var clear = function clear(name) {
        if (typeof name === 'string') {
            delete bottles[name];
        } else {
            bottles = {};
        }
    };
    
    /**
     * Used to process decorators in the provider
     *
     * @param Object instance
     * @param Function func
     * @return Mixed
     */
    var reducer = function reducer(instance, func) {
        return func(instance);
    };
    
    /**
     * Register a provider.
     *
     * @param String fullname
     * @param Function Provider
     * @return Bottle
     */
    var provider = function provider(fullname, Provider) {
        var parts, name;
        parts = fullname.split('.');
        if (this.providerMap[fullname] && parts.length === 1 && !this.container[fullname + 'Provider']) {
            return console.error(fullname + ' provider already instantiated.');
        }
        this.originalProviders[fullname] = Provider;
        this.providerMap[fullname] = true;
    
        name = parts.shift();
    
        if (parts.length) {
            createSubProvider.call(this, name, Provider, parts);
            return this;
        }
        return createProvider.call(this, name, Provider);
    };
    
    /**
     * Get decorators and middleware including globals
     *
     * @return array
     */
    var getWithGlobal = function getWithGlobal(collection, name) {
        return (collection[name] || []).concat(collection.__global__ || []);
    };
    
    /**
     * Create the provider properties on the container
     *
     * @param String name
     * @param Function Provider
     * @return Bottle
     */
    var createProvider = function createProvider(name, Provider) {
        var providerName, properties, container, id, decorators, middlewares;
    
        id = this.id;
        container = this.container;
        decorators = this.decorators;
        middlewares = this.middlewares;
        providerName = name + 'Provider';
    
        properties = Object.create(null);
        properties[providerName] = {
            configurable : true,
            enumerable : true,
            get : function getProvider() {
                var instance = new Provider();
                delete container[providerName];
                container[providerName] = instance;
                return instance;
            }
        };
    
        properties[name] = {
            configurable : true,
            enumerable : true,
            get : function getService() {
                var provider = container[providerName];
                var instance;
                if (provider) {
                    // filter through decorators
                    instance = getWithGlobal(decorators, name).reduce(reducer, provider.$get(container));
    
                    delete container[providerName];
                    delete container[name];
                }
                return instance === undefined ? instance : applyMiddleware(getWithGlobal(middlewares, name),
                    name, instance, container);
            }
        };
    
        Object.defineProperties(container, properties);
        return this;
    };
    
    /**
     * Creates a bottle container on the current bottle container, and registers
     * the provider under the sub container.
     *
     * @param String name
     * @param Function Provider
     * @param Array parts
     * @return Bottle
     */
    var createSubProvider = function createSubProvider(name, Provider, parts) {
        var bottle;
        bottle = getNestedBottle.call(this, name);
        this.factory(name, function SubProviderFactory() {
            return bottle.container;
        });
        return bottle.provider(parts.join('.'), Provider);
    };
    
    /**
     * Register a service, factory, provider, or value based on properties on the object.
     *
     * properties:
     *  * Obj.$name   String required ex: `'Thing'`
     *  * Obj.$type   String optional 'service', 'factory', 'provider', 'value'.  Default: 'service'
     *  * Obj.$inject Mixed  optional only useful with $type 'service' name or array of names
     *  * Obj.$value  Mixed  optional Normally Obj is registered on the container.  However, if this
     *                       property is included, it's value will be registered on the container
     *                       instead of the object itsself.  Useful for registering objects on the
     *                       bottle container without modifying those objects with bottle specific keys.
     *
     * @param Function Obj
     * @return Bottle
     */
    var register = function register(Obj) {
        var value = Obj.$value === undefined ? Obj : Obj.$value;
        return this[Obj.$type || 'service'].apply(this, [Obj.$name, value].concat(Obj.$inject || []));
    };
    
    /**
     * Deletes providers from the map and container.
     *
     * @param String name
     * @return void
     */
    var removeProviderMap = function resetProvider(name) {
        delete this.providerMap[name];
        delete this.container[name];
        delete this.container[name + 'Provider'];
    };
    
    /**
     * Resets all providers on a bottle instance.
     *
     * @return void
     */
    var resetProviders = function resetProviders() {
        var providers = this.originalProviders;
        Object.keys(this.originalProviders).forEach(function resetPrvider(provider) {
            var parts = provider.split('.');
            if (parts.length > 1) {
                removeProviderMap.call(this, parts[0]);
                parts.forEach(removeProviderMap, getNestedBottle.call(this, parts[0]));
            }
            removeProviderMap.call(this, provider);
            this.provider(provider, providers[provider]);
        }, this);
    };
    
    
    /**
     * Execute any deferred functions
     *
     * @param Mixed data
     * @return Bottle
     */
    var resolve = function resolve(data) {
        this.deferred.forEach(function deferredIterator(func) {
            func(data);
        });
    
        return this;
    };
    
    /**
     * Register a service inside a generic factory.
     *
     * @param String name
     * @param Function Service
     * @return Bottle
     */
    var service = function service(name, Service) {
        var deps = arguments.length > 2 ? slice.call(arguments, 2) : null;
        var bottle = this;
        return factory.call(this, name, function GenericFactory() {
            var ServiceCopy = Service;
            if (deps) {
                var args = deps.map(getNestedService, bottle.container);
                args.unshift(Service);
                ServiceCopy = Service.bind.apply(Service, args);
            }
            return new ServiceCopy();
        });
    };
    
    /**
     * Register a value
     *
     * @param String name
     * @param mixed val
     * @return Bottle
     */
    var value = function value(name, val) {
        var parts;
        parts = name.split('.');
        name = parts.pop();
        defineValue.call(parts.reduce(setValueObject, this.container), name, val);
        return this;
    };
    
    /**
     * Iterator for setting a plain object literal via defineValue
     *
     * @param Object container
     * @param string name
     */
    var setValueObject = function setValueObject(container, name) {
        var nestedContainer = container[name];
        if (!nestedContainer) {
            nestedContainer = {};
            defineValue.call(container, name, nestedContainer);
        }
        return nestedContainer;
    };
    
    /**
     * Define a mutable property on the container.
     *
     * @param String name
     * @param mixed val
     * @return void
     * @scope container
     */
    var defineValue = function defineValue(name, val) {
        Object.defineProperty(this, name, {
            configurable : true,
            enumerable : true,
            value : val,
            writable : true
        });
    };
    
    
    /**
     * Bottle constructor
     *
     * @param String name Optional name for functional construction
     */
    var Bottle = function Bottle(name) {
        if (!(this instanceof Bottle)) {
            return Bottle.pop(name);
        }
    
        this.id = id++;
    
        this.decorators = {};
        this.middlewares = {};
        this.nested = {};
        this.providerMap = {};
        this.originalProviders = {};
        this.deferred = [];
        this.container = {
            $decorator : decorator.bind(this),
            $register : register.bind(this),
            $list : list.bind(this)
        };
    };
    
    /**
     * Bottle prototype
     */
    Bottle.prototype = {
        constant : constant,
        decorator : decorator,
        defer : defer,
        digest : digest,
        factory : factory,
        instanceFactory: instanceFactory,
        list : list,
        middleware : middleware,
        provider : provider,
        resetProviders : resetProviders,
        register : register,
        resolve : resolve,
        service : service,
        value : value
    };
    
    /**
     * Bottle static
     */
    Bottle.pop = pop;
    Bottle.clear = clear;
    Bottle.list = list;
    
    /**
     * Global config
     */
    var globalConfig = Bottle.config = {
        strict : false
    };
    
    /**
     * Exports script adapted from lodash v2.4.1 Modern Build
     *
     * @see http://lodash.com/
     */
    
    /**
     * Valid object type map
     *
     * @type Object
     */
    var objectTypes = {
        'function' : true,
        'object' : true
    };
    
    (function exportBottle(root) {
    
        /**
         * Free variable exports
         *
         * @type Function
         */
        var freeExports = objectTypes[typeof exports] && exports && !exports.nodeType && exports;
    
        /**
         * Free variable module
         *
         * @type Object
         */
        var freeModule = objectTypes[typeof module] && module && !module.nodeType && module;
    
        /**
         * CommonJS module.exports
         *
         * @type Function
         */
        var moduleExports = freeModule && freeModule.exports === freeExports && freeExports;
    
        /**
         * Free variable `global`
         *
         * @type Object
         */
        var freeGlobal = objectTypes[typeof global] && global;
        if (freeGlobal && (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal)) {
            root = freeGlobal;
        }
    
        /**
         * Export
         */
        if (typeof define === 'function' && typeof define.amd === 'object' && define.amd) {
            root.Bottle = Bottle;
            define(function() { return Bottle; });
        } else if (freeExports && freeModule) {
            if (moduleExports) {
                (freeModule.exports = Bottle).Bottle = Bottle;
            } else {
                freeExports.Bottle = Bottle;
            }
        } else {
            root.Bottle = Bottle;
        }
    }((objectTypes[typeof window] && window) || this));
    
}.call(this));
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],2:[function(require,module,exports){
'use strict';

var assign        = require('es5-ext/object/assign')
  , normalizeOpts = require('es5-ext/object/normalize-options')
  , isCallable    = require('es5-ext/object/is-callable')
  , contains      = require('es5-ext/string/#/contains')

  , d;

d = module.exports = function (dscr, value/*, options*/) {
	var c, e, w, options, desc;
	if ((arguments.length < 2) || (typeof dscr !== 'string')) {
		options = value;
		value = dscr;
		dscr = null;
	} else {
		options = arguments[2];
	}
	if (dscr == null) {
		c = w = true;
		e = false;
	} else {
		c = contains.call(dscr, 'c');
		e = contains.call(dscr, 'e');
		w = contains.call(dscr, 'w');
	}

	desc = { value: value, configurable: c, enumerable: e, writable: w };
	return !options ? desc : assign(normalizeOpts(options), desc);
};

d.gs = function (dscr, get, set/*, options*/) {
	var c, e, options, desc;
	if (typeof dscr !== 'string') {
		options = set;
		set = get;
		get = dscr;
		dscr = null;
	} else {
		options = arguments[3];
	}
	if (get == null) {
		get = undefined;
	} else if (!isCallable(get)) {
		options = get;
		get = set = undefined;
	} else if (set == null) {
		set = undefined;
	} else if (!isCallable(set)) {
		options = set;
		set = undefined;
	}
	if (dscr == null) {
		c = true;
		e = false;
	} else {
		c = contains.call(dscr, 'c');
		e = contains.call(dscr, 'e');
	}

	desc = { get: get, set: set, configurable: c, enumerable: e };
	return !options ? desc : assign(normalizeOpts(options), desc);
};

},{"es5-ext/object/assign":3,"es5-ext/object/is-callable":6,"es5-ext/object/normalize-options":10,"es5-ext/string/#/contains":13}],3:[function(require,module,exports){
'use strict';

module.exports = require('./is-implemented')()
	? Object.assign
	: require('./shim');

},{"./is-implemented":4,"./shim":5}],4:[function(require,module,exports){
'use strict';

module.exports = function () {
	var assign = Object.assign, obj;
	if (typeof assign !== 'function') return false;
	obj = { foo: 'raz' };
	assign(obj, { bar: 'dwa' }, { trzy: 'trzy' });
	return (obj.foo + obj.bar + obj.trzy) === 'razdwatrzy';
};

},{}],5:[function(require,module,exports){
'use strict';

var keys  = require('../keys')
  , value = require('../valid-value')

  , max = Math.max;

module.exports = function (dest, src/*, …srcn*/) {
	var error, i, l = max(arguments.length, 2), assign;
	dest = Object(value(dest));
	assign = function (key) {
		try { dest[key] = src[key]; } catch (e) {
			if (!error) error = e;
		}
	};
	for (i = 1; i < l; ++i) {
		src = arguments[i];
		keys(src).forEach(assign);
	}
	if (error !== undefined) throw error;
	return dest;
};

},{"../keys":7,"../valid-value":12}],6:[function(require,module,exports){
// Deprecated

'use strict';

module.exports = function (obj) { return typeof obj === 'function'; };

},{}],7:[function(require,module,exports){
'use strict';

module.exports = require('./is-implemented')()
	? Object.keys
	: require('./shim');

},{"./is-implemented":8,"./shim":9}],8:[function(require,module,exports){
'use strict';

module.exports = function () {
	try {
		Object.keys('primitive');
		return true;
	} catch (e) { return false; }
};

},{}],9:[function(require,module,exports){
'use strict';

var keys = Object.keys;

module.exports = function (object) {
	return keys(object == null ? object : Object(object));
};

},{}],10:[function(require,module,exports){
'use strict';

var forEach = Array.prototype.forEach, create = Object.create;

var process = function (src, obj) {
	var key;
	for (key in src) obj[key] = src[key];
};

module.exports = function (options/*, …options*/) {
	var result = create(null);
	forEach.call(arguments, function (options) {
		if (options == null) return;
		process(Object(options), result);
	});
	return result;
};

},{}],11:[function(require,module,exports){
'use strict';

module.exports = function (fn) {
	if (typeof fn !== 'function') throw new TypeError(fn + " is not a function");
	return fn;
};

},{}],12:[function(require,module,exports){
'use strict';

module.exports = function (value) {
	if (value == null) throw new TypeError("Cannot use null or undefined");
	return value;
};

},{}],13:[function(require,module,exports){
'use strict';

module.exports = require('./is-implemented')()
	? String.prototype.contains
	: require('./shim');

},{"./is-implemented":14,"./shim":15}],14:[function(require,module,exports){
'use strict';

var str = 'razdwatrzy';

module.exports = function () {
	if (typeof str.contains !== 'function') return false;
	return ((str.contains('dwa') === true) && (str.contains('foo') === false));
};

},{}],15:[function(require,module,exports){
'use strict';

var indexOf = String.prototype.indexOf;

module.exports = function (searchString/*, position*/) {
	return indexOf.call(this, searchString, arguments[1]) > -1;
};

},{}],16:[function(require,module,exports){
'use strict';

var d        = require('d')
  , callable = require('es5-ext/object/valid-callable')

  , apply = Function.prototype.apply, call = Function.prototype.call
  , create = Object.create, defineProperty = Object.defineProperty
  , defineProperties = Object.defineProperties
  , hasOwnProperty = Object.prototype.hasOwnProperty
  , descriptor = { configurable: true, enumerable: false, writable: true }

  , on, once, off, emit, methods, descriptors, base;

on = function (type, listener) {
	var data;

	callable(listener);

	if (!hasOwnProperty.call(this, '__ee__')) {
		data = descriptor.value = create(null);
		defineProperty(this, '__ee__', descriptor);
		descriptor.value = null;
	} else {
		data = this.__ee__;
	}
	if (!data[type]) data[type] = listener;
	else if (typeof data[type] === 'object') data[type].push(listener);
	else data[type] = [data[type], listener];

	return this;
};

once = function (type, listener) {
	var once, self;

	callable(listener);
	self = this;
	on.call(this, type, once = function () {
		off.call(self, type, once);
		apply.call(listener, this, arguments);
	});

	once.__eeOnceListener__ = listener;
	return this;
};

off = function (type, listener) {
	var data, listeners, candidate, i;

	callable(listener);

	if (!hasOwnProperty.call(this, '__ee__')) return this;
	data = this.__ee__;
	if (!data[type]) return this;
	listeners = data[type];

	if (typeof listeners === 'object') {
		for (i = 0; (candidate = listeners[i]); ++i) {
			if ((candidate === listener) ||
					(candidate.__eeOnceListener__ === listener)) {
				if (listeners.length === 2) data[type] = listeners[i ? 0 : 1];
				else listeners.splice(i, 1);
			}
		}
	} else {
		if ((listeners === listener) ||
				(listeners.__eeOnceListener__ === listener)) {
			delete data[type];
		}
	}

	return this;
};

emit = function (type) {
	var i, l, listener, listeners, args;

	if (!hasOwnProperty.call(this, '__ee__')) return;
	listeners = this.__ee__[type];
	if (!listeners) return;

	if (typeof listeners === 'object') {
		l = arguments.length;
		args = new Array(l - 1);
		for (i = 1; i < l; ++i) args[i - 1] = arguments[i];

		listeners = listeners.slice();
		for (i = 0; (listener = listeners[i]); ++i) {
			apply.call(listener, this, args);
		}
	} else {
		switch (arguments.length) {
		case 1:
			call.call(listeners, this);
			break;
		case 2:
			call.call(listeners, this, arguments[1]);
			break;
		case 3:
			call.call(listeners, this, arguments[1], arguments[2]);
			break;
		default:
			l = arguments.length;
			args = new Array(l - 1);
			for (i = 1; i < l; ++i) {
				args[i - 1] = arguments[i];
			}
			apply.call(listeners, this, args);
		}
	}
};

methods = {
	on: on,
	once: once,
	off: off,
	emit: emit
};

descriptors = {
	on: d(on),
	once: d(once),
	off: d(off),
	emit: d(emit)
};

base = defineProperties({}, descriptors);

module.exports = exports = function (o) {
	return (o == null) ? create(base) : defineProperties(Object(o), descriptors);
};
exports.methods = methods;

},{"d":2,"es5-ext/object/valid-callable":11}],17:[function(require,module,exports){
const guid = require('./guid');
const container = require('./container');
const ee = require('event-emitter');

const clone = (obj) => {
	const c = {};
	for (let key in obj) {
		c[key] = obj[key];
	}
	return c;
};

class App {
	constructor() {
		this.map = {};
		this._startMap = {};
		this._destroyMap = {};

		this.renderer = container.renderer;
		this.animate = this.animate.bind(this);
		
		this.time = 0;
		this.deltaTime = 1000 / 60;

		container.app = this;
	}

	add(type, props) {
		const component = new type(props);
		component._id = guid();
		this.map[component._id] = component;
		this._startMap[component._id] = component;
		this.emit('add', component);
		return component;
	}

	destroy(component) {
		this._destroyMap[component._id] = component;
		this.emit('destroy', component);
	}

	tick(dt) {
		let id, component;

		const _startMap = clone(this._startMap);
		this._startMap = {};

		for (id in _startMap) {
			component = _startMap[id];
			if (component.start != null) {
				component.start();
			}
		}

		for (id in this.map) {
			component = this.map[id];
			if (component.tick != null) {
				component.tick(dt);
			}
		}

		const _destroyMap = clone(this._destroyMap);
		this._destroyMap = {};
		
		for (id in _destroyMap) {
			component = _destroyMap[id];
			if (component.destroy != null) {
				component.destroy();
			}
			delete this.map[component._id];
		}

		this.renderer.render();
	}

	animate() {
		const frameRate = 1 / 60;
		
		this.tick(frameRate);

		this.time += frameRate;
		this.deltaTime = frameRate;

		requestAnimationFrame(this.animate);
	}

	start() {
		this.animate();
	}
};

ee(App.prototype);

module.exports = new App();
},{"./container":31,"./guid":32,"event-emitter":16}],18:[function(require,module,exports){
const container = require('../container');
const randomQuaternion = require('../utils/math').randomQuaternion;

class Asteroid {
	constructor(props) {
		this.scene = container.scene;
		const geometry = new THREE.BoxGeometry(10, 10, 10);
		this.object = new THREE.Mesh(geometry);
		this.object.quaternion.copy(randomQuaternion());
	}

	start() {
		this.scene.add(this.object);
	}

	tick(dt) {

	}

	destroy() {
		this.scene.remove(this.object);	
	}
}

module.exports = Asteroid;
},{"../container":31,"../utils/math":36}],19:[function(require,module,exports){
const container = require('../container');
const linearBillboard = require('../utils/math').linearBillboard;

class Beam {
	constructor(props) {
		this.target = props.target;
		this.turrent = props.turrent;

		this.scene = container.scene;		
		this.camera = container.camera;
		this.app = container.app;

		this.length = 0;
		const height = 0.5;

		this.dir = this.target.position.clone().sub(this.turrent.position).normalize();
		this.quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), this.dir);

		this.geometry = new THREE.Geometry();
		this.geometry.vertices.push(
			new THREE.Vector3(0, -height, 0),
			new THREE.Vector3(0, height, 0),
			new THREE.Vector3(1, height, 0),
			new THREE.Vector3(1, -height, 0)
		);

		this.geometry.faces.push(
			new THREE.Face3(2, 1, 0),
			new THREE.Face3(2, 0, 3)
		);

		this.material = new THREE.MeshBasicMaterial({
			color: 0xffffff,
			side: THREE.DoubleSide
		});

		this.mesh = new THREE.Mesh(this.geometry, this.material);
		
		this.object = new THREE.Object3D();
		this.object.add(this.mesh);

		this.r = Math.random() * Math.PI / 2;

		this.life = 1.0;
		this.counter = 0;

		this.speed = 50;
	}

	start() {
		this.scene.add(this.object);
	}

	tick(dt) {
		this.dir = this.target.position.clone().sub(this.turrent.position).normalize();
		this.quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), this.dir);
		this.length += this.speed;

		linearBillboard(this.camera, this.object, this.dir, this.quaternion);

		const date = new Date().getTime();

		const widthNoise =
	    Math.sin(date / 17 + this.r) * 0.3 +
  	  Math.sin((date + 123 + this.r) / 27) * 0.4 +
    	Math.sin((date + 234 + this.r) / 13) * 0.4;

    const t = this.counter / this.life;
    const width = 2;

		this.mesh.scale.y = Math.sin(t * Math.PI) * width + widthNoise;
		this.mesh.scale.y *= 0.7;
		this.mesh.scale.x = this.length;

		this.object.position.copy(this.turrent.position);

		this.counter += dt;
		if (this.counter > this.life) {
			this.app.destroy(this);
		}
	}

	destroy() {
		this.scene.remove(this.object);	
	}
}	

module.exports = Beam;
},{"../container":31,"../utils/math":36}],20:[function(require,module,exports){
const container = require('../container');

class DragCamera {
	constructor(props) {
		this.rotation = new THREE.Euler(-Math.PI / 4, Math.PI / 4, 0, 'YXZ');
		this.distance = 50;
		this.target = new THREE.Vector3();
		this.camera = container.camera;
		this.up = new THREE.Vector3(0, 1, 0);
		this.isDrag = false;
		this.lastX = 0;
		this.lastY = 0;
		this.xSpeed = 0.01;
		this.ySpeed = 0.01;

		this.onMouseWheel = this.onMouseWheel.bind(this);
		this.onMouseDown = this.onMouseDown.bind(this);
		this.onMouseUp = this.onMouseUp.bind(this);
		this.onMouseMove = this.onMouseMove.bind(this);
	}

	start() {
		window.addEventListener('mousewheel', this.onMouseWheel);
		window.addEventListener('mousedown', this.onMouseDown);
		window.addEventListener('mouseup', this.onMouseUp);
		window.addEventListener('mousemove', this.onMouseMove);
	}

	onMouseWheel(e) {
		const scale = 1 + e.deltaY / 1000;
		this.distance *= scale;
	}

	onMouseDown(e) {
		this.isDrag = true;
	}

	onMouseUp(e) {
		this.isDrag = false;
	}

	onMouseMove(e) {
		if (this.isDrag) {
			const diffX = e.clientX - this.lastX;
			const diffY = e.clientY - this.lastY;

			this.rotation.x += diffY * this.ySpeed;
			this.rotation.y += diffX * this.xSpeed;
		}

		this.lastX = e.clientX;
		this.lastY = e.clientY;
	}
	
	tick() {
		const position = this.target.clone()
			.add(new THREE.Vector3(0, 0, 1)
				.applyEuler(this.rotation)
				.multiplyScalar(this.distance));
		this.camera.position.copy(position);
		this.camera.lookAt(this.target, this.up);
	}

	destroy() {
		window.removeEventListener('mousewheel', this.onMouseWheel);
	}
};

module.exports = DragCamera;
},{"../container":31}],21:[function(require,module,exports){
const container = require('../container');
const ParticleSystem = require('./particlesystem');

class Engine {
  constructor(props) {
    this.props = props;
    this.object = new THREE.Object3D();
    this.scene = container.scene;
    this.app = container.app;
    this.particleVelocity = new THREE.Vector3();
    this.amount = 0;

    this.particleSystem = this.app.add(ParticleSystem, {
      scale: [ ((p) => {
      	return p._size;
      }), 0],
      life: ((p) => {
        return p._size * 150;
      }),
      interval: 30,
      velocity: this.particleVelocity,
      autoPlay: false,
      onParticle: (p) => {
        p._size = Math.random() + 1;
      }
    });
  }

  start() {
    const ship = this.props.ship;
    const coord = this.props.coord;
    ship.innerObject.add(this.object);
    this.object.position
      .fromArray(coord)
      .add(new THREE.Vector3(0.5, 0.5, 0.5))
      .add(new THREE.Vector3(0, 0, 1));

    this.updateParticleSystem();
  }

  tick(dt) {
    this.updateParticleSystem();
  }

  destroy() {
    this.app.destroy(this.particleSystem);
  }

  updateParticleSystem() {
    if (this.amount === 0 && this.particleSystem.playing) {
      this.particleSystem.pause();
    } else if (this.amount > 0 && !this.particleSystem.playing) {
      this.particleSystem.play();
    }
    this.particleSystem.position.copy(this.object.getWorldPosition());
    const rotation = this.object.getWorldRotation();
    const direction = new THREE.Vector3(0, 0, 1).applyEuler(rotation);
    this.particleVelocity.copy(direction.multiplyScalar(10));
  }
};

module.exports = Engine;

},{"../container":31,"./particlesystem":25}],22:[function(require,module,exports){
const container = require('../container');

class Grid {
  constructor(props) {
    this.axis = [ 1, Math.sqrt(3) / 2, Math.sqrt(3) / 4 ];
    this.scene = container.scene;
  }

  hexToScreen(i, j) {
  	return [ this.axis[0] * i + ((j % 2 === 0) ? this.axis[2] : 0), this.axis[1] * j ];
  }

  start() {
    // for (let i = 0; i < 10; i++) {
    //   for (let j = 0; j < 10; j++) {

    //     const sprite = new THREE.Sprite();
    //     const screen = this.hexToScreen(i, j);
    //     sprite.position.x = screen[0] * 10;
    //     sprite.position.z = screen[1] * 10;

    //     this.scene.add(sprite);

    //   }
    // }
  }
}

module.exports = Grid;

},{"../container":31}],23:[function(require,module,exports){
const container = require('../container');

class Laser {
  constructor(props) {
    this.target = props.target;
    this.turrent = props.turrent;

    this.scene = container.scene;
    this.app = container.app;

    this.object = new THREE.Sprite();

    this.speed = 40;

    this.life = 10000;
  }

  start() {
  	this.object.position.copy(this.turrent.position);
  	this.scene.add(this.object);

  	this.velocity = this.target.position.clone().sub(this.turrent.position).normalize().multiplyScalar(this.speed);

  	this.dieTime = new Date().getTime() + this.life;
  }

  destroy() {
  	this.scene.remove(this.object);
  }

  tick(dt) {
  	this.object.position.add(this.velocity.clone().multiplyScalar(dt));

  	if (new Date().getTime() > this.dieTime) {
  		this.app.destroy(this);
  	}
  }
}

module.exports = Laser;

},{"../container":31}],24:[function(require,module,exports){
const container = require('../container');

class Value {
	constructor(value, object) {
		this.value = value;
		this.object = object;

		this.isNumber = typeof value === 'number';
		this.isFunc = typeof value === 'function';
		// Linear intervals
		this.intervals = [];

		if (Array.isArray(value)) {
			const values = value.map((v) => {
				if (typeof v === 'function') {
					return v(this.object);
				}
				return v;
			});

			for (let i = 0; i < values.length; i++) {
				const interval = {
					t: i / values.length,
					v: values[i]
				};
				if (i < values.length - 1) {
					interval.vd = values[i + 1] - values[i];
				}
				this.intervals.push(interval);
			}
		}
	}

	get(t) {
		t = t || 0;
		if (this.isNumber) {
			return this.value;
		} else if (this.isFunc) {
			return this.value(this.object);
		} else if (this.intervals.length > 0) {
			let interval;
			if (t > 1) {
				return this.intervals[this.intervals.length - 1].v;
			}

			for (let i = 0; i < this.intervals.length; i++) {
				interval = this.intervals[i];
				if (t < interval.t) {
					continue;
				}

				const td = t - interval.t;
				const vd = interval.vd;
				return interval.v + td * vd;
			}
		}
	}
}

class Particle {
	constructor(props) {
		this.props = props;

		this.parent = props.parent;
		this.object = new THREE.Sprite(props.material);
		this.app = container.app;
	}

	initProps() {
		this.life = new Value(this.props.life, this);
		this.velocity = this.props.velocity;
		this.scale = new Value(this.props.scale, this);
	}

	start() {
		this.parent.add(this.object);
		this.startTimer = new Date().getTime();
		this.timer = new Date().getTime() + this.life.get();
	}

	tick(dt) {
		this.object.position.add(this.velocity.clone().multiplyScalar(dt));
		const t = (new Date().getTime() - this.startTimer) / this.life.get();
		const scale = this.scale.get(t);
		this.object.scale.set(scale, scale, scale);

		if (new Date().getTime() > this.timer) {
			this.app.destroy(this);
		}
	}

	destroy() {
		this.object.parent.remove(this.object);
	}
}

module.exports = Particle;
},{"../container":31}],25:[function(require,module,exports){
const container = require('../container');
const Particle = require('./particle');

const defaultMaterial = new THREE.SpriteMaterial();

class ParticleSystem {
	constructor(props) {
		props = props || {};

		this.material = props.material || defaultMaterial;
		this.materials = this.material.length > 0 ? this.material : [];
		this.parent = props.parent || container.scene;
		this.autoPlay = props.autoPlay === undefined ? true : props.autoPlay;
		this.onParticle = props.onParticle;

		this.particleProps = props.particleProps;

		if (this.particleProps == null) {
			this.life = props.life;
			this.interval = props.interval;
			this.velocity = props.velocity;
			this.scale = props.scale;
			this.defaultParticleProps(this);
		}

		this._timeout = null;
		this.emit = this.emit.bind(this);
		this.app = container.app;
		this.position = new THREE.Vector3();

		this.playing = false;
	}

	defaultParticleProps(obj) {
		obj.life = obj.life || 5000;
		obj.interval = obj.interval || 1000;
		obj.velocity = obj.velocity || new THREE.Vector3(0, 2, 0);
		obj.scale = obj.scale || 1;	
		obj.parent = obj.parent || container.scene;
		return obj;
	}

	start() {
		if (this.autoPlay) {
			this.play();	
		}
	}

	play() {
		this.emit();
		this.playing = true;
	}

	pause() {
		if (this._timeout != null) {
			clearTimeout(this._timeout);
		}
		this.playing = false;
	}

	emit() {
		let props;
		const material = this.materials.length > 0 ? this.materials[Math.floor(Math.random() * this.materials.length)] : this.material;
		if (this.particleProps == null) {
			props = {
				life: this.life,
				velocity: this.velocity,
				material: material,
				parent: this.parent,
				scale: this.scale
			};
		} else {
			props = this.defaultParticleProps(this.particleProps());
		}
		const particle = this.app.add(Particle, props);
		if (this.onParticle != null) {
			this.onParticle(particle);
		}
		particle.initProps();
		particle.object.position.copy(this.position);
		this._timeout = setTimeout(this.emit, this.interval);
	}
}

module.exports = ParticleSystem;
},{"../container":31,"./particle":24}],26:[function(require,module,exports){
const container = require('../../container');

class AI {
	constructor(props) {
		this.ships = container.ships;

		this.ship = props.ship;
		this.thinkCooldown = 0.1;
		this.nextThink = 0;
		this.target = null;
	}

	think() {
		if (this.target == null) {
			const ships = this.ships.getTargets(this.ship);

			if (ships.length > 0) {
				ships.sort((a, b) => {
					return a.position.distanceTo(this.ship.position) - 
						b.position.distanceTo(this.ship.position);
				});
				this.target = ships[0];
			} 
		}

		if (this.target == null) {
			return;
		}

		// this.ship.orbit(this.target.position, 50);

		// demo
		// this.ascend(10);
		
		for (let i = 0; i < this.ship.turrents.length; i ++) {
			const turrent = this.ship.turrents[i];
			turrent.fire({
				position: this.target.position,
				velocity: this.target.velocity
			});
		}
	}

	start() {
		this.nextThink = new Date().getTime() + this.thinkCooldown;
	}

	tick(dt) {
		if (new Date().getTime() > this.nextThink) {
			this.think();
			this.nextThink = new Date().getTime() + this.thinkCooldown;
		}
	}
};

module.exports = AI;
},{"../../container":31}],27:[function(require,module,exports){
(function (global){
const container = require('../../container');
const THREE = (typeof window !== "undefined" ? window['THREE'] : typeof global !== "undefined" ? global['THREE'] : null);
const Chunks = require('../../voxel/chunks');
const mesher = require('../../voxel/mesher');
const reader = require('./reader');
const normalizeAngle = require('../../utils/math').normalizeAngle;
const clamp = require('../../utils/math').clamp;
const AI = require('./ai');

class Ship {
	constructor(props) {
		this.__isShip = true;

		this.props = props;
		this.scene = container.scene;
		this.object = new THREE.Object3D();
		this.object.rotation.order = 'YXZ';

		if (props.rotation != null) {
			this.object.rotation.copy(props.rotation);
		}

		this.innerObject = new THREE.Object3D();
		this.innerObject.rotation.order = 'YXZ';
		this.object.add(this.innerObject);
		this.chunks = new Chunks();

		this.engines = [];
		this.turrents = [];

		this.turnSpeed = 0;

		this.turnAmount = 0;
		this.forwardAmount = 0;
		this.maxTurnSpeed = 0.03;
		this.power = 0.4;

		this.velocity = new THREE.Vector3();

		this.hull = [];

		this.ai = new AI({
			ship: this
		});

		this.side = props.side || 0;

		this.hull = [];
		this.center = new THREE.Vector3();
	}

	get position() {
		return this.object.position;
	}

	get rotation() {
		return this.object.rotation;
	}

	start() {
		this.material = [ null, new THREE.MeshBasicMaterial({
			color: 0xffffff
		}) ];

		this.scene.add(this.object);
	
		const result = reader(this.props.data, this);

		this.ai.start();
	}

	tick(dt) {
		this.ai.tick(dt);
		mesher(this.chunks, this.innerObject, this.material);

		// Step turrents
		for (let i = 0; i < this.turrents.length; i ++) {
			const turrent = this.turrents[i];
			turrent.tick(dt);
		}

		// Step yaw
		const turnAcceleration = 0.1;
		const desiredTurnSpeed = this.turnAmount * this.maxTurnSpeed;

		if (this.turnSpeed < desiredTurnSpeed) {
			this.turnSpeed += turnAcceleration * dt;
		} else if (this.turnSpeed > desiredTurnSpeed) {
			this.turnSpeed -= turnAcceleration * dt;
		}

		if (this.turnSpeed < -this.maxTurnSpeed) {
			this.turnSpeed = -this.maxTurnSpeed;
		} else if (this.turnSpeed > this.maxTurnSpeed) {
			this.turnSpeed = this.maxTurnSpeed;
		}

		// Step roll
		this.object.rotation.y += this.turnSpeed;

		const ratio = this.turnSpeed / this.maxTurnSpeed;

		const maxRollAmount = Math.PI / 4;
		const angle = ratio * maxRollAmount;

		this.object.rotation.z += (angle - this.object.rotation.z) * 0.01;

		// this.turnAmount = 0;

		// Step forward
		const acc = new THREE.Vector3(0, 0, -1)
			.applyEuler(this.object.rotation)
			.multiplyScalar(this.forwardAmount * this.power * dt);

		this.velocity.add(acc);
		this.object.position.add(this.velocity);

		this.velocity.multiplyScalar(0.97);

		this.engines.forEach((engine) => {
			engine.amount = this.forwardAmount;
		});
	}

	ascend(y) {
		const yDiff = y - this.object.position.y;
		const desiredYSpeed = yDiff * 0.1;
		const ySpeedDiff = desiredYSpeed - this.velocity.y;
		const desiredYAcc = ySpeedDiff * 0.1;

		let ratio = desiredYAcc / this.power;
		if (ratio > 1.0) {
			ratio = 1.0;
		} else if (ratio < -1.0) {
			ratio = -1.0;
		}

		let desiredPitch = Math.asin(ratio);

		const maxPitch = 0.3

		if (desiredPitch > maxPitch) {
			desiredPitch = maxPitch;
		} else if (desiredPitch < -maxPitch) {
			desiredPitch = -maxPitch;
		}

		const pitchDiff = desiredPitch - this.rotation.x;

		const desiredPitchSpeed = pitchDiff;

		const maxPitchSpeed = 0.03;


		this.rotation.x += clamp(desiredPitchSpeed, -maxPitchSpeed, maxPitchSpeed);
	}

	turn(amount) {
		this.turnAmount = amount;
	}

	forward(amount) {
		this.forwardAmount = amount;
	}

	align(point) {
		const angleDiff = this.getAngleDiff(point);
		const desiredTurnSpeed = angleDiff;

		let desiredTurnAmount = desiredTurnSpeed / this.maxTurnSpeed;
		if (desiredTurnAmount > 1) {
			desiredTurnAmount = 1;
		} else if (desiredTurnAmount < -1) {
			desiredTurnAmount = -1;
		}

		this.turn(desiredTurnAmount);
	}

	orbit(point, distance) {
		let dis = this.object.position.clone().sub(point);
		dis.y = 0;
		dis = dis.normalize().multiplyScalar(distance);
		const a = point.clone().add(
			dis.clone().applyEuler(new THREE.Euler(0, Math.PI / 3, 0)));
		const b = point.clone().add(
			dis.clone().applyEuler(new THREE.Euler(0, -Math.PI / 3, 0)));

		const diffA = this.getAngleDiff(a);
		const diffB = this.getAngleDiff(b);

		if (Math.abs(diffA) < Math.abs(diffB)) {
			this.align(a);
		} else {
			this.align(b);
		}

		this.forward(1.0);
	}

	getAngleDiff(point) {
		const angle = Math.atan2(point.x - this.object.position.x, point.z - this.object.position.z) - Math.PI;
		const angleDiff = angle - this.object.rotation.y;
		return normalizeAngle(angleDiff);
	}

	destroy() {

	}
}

module.exports = Ship;
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../../container":31,"../../utils/math":36,"../../voxel/chunks":38,"../../voxel/mesher":39,"./ai":26,"./reader":28}],28:[function(require,module,exports){
const container = require('../../container');
const Engine = require('../engine');
const Turrent = require('./turrent');
const Beam = require('../beam');
const Laser = require('../laser');

const reader = (data, ship) => {
	const lines = data.split('\n');
	const chunks = ship.chunks;
	const engines = ship.engines;

	let line;
	let current;
	let z = 0;
	let char;

	const result = {
		modules: []
	};

	const app = container.app;

	for (let i = 0; i < lines.length; i++) {
		line = lines[i];

		if (line === 'HULL') {
			current = 'HULL';
			z = 0;
		} else if (line === 'MODULES') {
			current = 'MODULES';
			z = 0;
		} else if (current === 'HULL') {
			for (let x = 0; x < line.length; x++) {
				char = line[x];

				if (char === '0') {
					chunks.set(x, 0, z, 1);
					ship.hull.push([x, 0, z, 1]);
				}
			}
			z++;
		} else if (current === 'MODULES') {
			for (let x = 0; x < line.length; x++) {
				char = line[x];
				if (char === 'E') {
					const engine = app.add(Engine, {
						ship: ship,
						coord: [x, 0, z]
					});
					engines.push(engine);
				} else if (char === 'L' || char === 'l') {
					const type = Laser;
					const cooldown = 0.1;
					const reloadTime = 1.0;
					const clip = 5;

					ship.turrents.push(new Turrent({
						coord: [x, 0, z],
						ship: ship,
						type, cooldown, reloadTime, clip
					}));
				}
			}
			z++;
		}
	}

	const center = [ 0, 0, 0 ];
	for (let i = 0; i < ship.hull.length; i++) {
		const v = ship.hull[i];
		center[0] += v[0];
		center[1] += v[1];
		center[2] += v[2];
	}
	center[0] /= ship.hull.length;
	center[1] /= ship.hull.length;
	center[2] /= ship.hull.length;
	
	center[0] += 0.5;
	center[1] += 0.5;
	center[2] += 0.5;

	ship.center.fromArray(center);

	ship.innerObject.position.fromArray(center).multiplyScalar(-1);

	return result;
};

module.exports = reader;
},{"../../container":31,"../beam":19,"../engine":21,"../laser":23,"./turrent":30}],29:[function(require,module,exports){
const container = require('../../container');

class Ships {
  constructor() {
    this.app = container.app;
    container.ships = this;
    this.onAdd = this.onAdd.bind(this);
    this.onDestroy = this.onDestroy.bind(this);

    this.sides = {};
  }

  getTargets(ship) {
  	const targets = [];
  	for (let side in this.sides) {
      if (side === ship.side) {
        continue;
      }
  		for (let id in this.sides[side]) {
  			targets.push(this.sides[side][id]);
  		}
  	}

  	return targets;
  }

  onAdd(component) {
    if (!component.__isShip) {
			return;
    }

    if (this.sides[component.side] == null) {
    	this.sides[component.side] = {};
    }

    this.sides[component.side][component._id] = component;
  }

  onDestroy(component) {
    if (!component.__isShip) {
			return;
    }

    delete this.sides[component.side][component._id];
  }

  start() {
    for (let id in this.app.map) {
      this.onAdd(this.app.map[id]);
    }
    this.app.on('add', this.onAdd);
    this.app.on('destory', this.onDestroy);
  }

  destroy() {
  	this.app.off('add', this.onAdd);
  	this.app.off('destory', this.onDestroy);
  }
}

module.exports = Ships;

},{"../../container":31}],30:[function(require,module,exports){
const container = require('../../container');

class Turrent {
	constructor(props) {
		this.app = container.app;

		this.localPosition = 
			new THREE.Vector3()
				.fromArray(props.coord)
				.add(new THREE.Vector3(0.5, 0.5, 0.5));
		this.ship = props.ship;

		this.type = props.type;

		this.cooldown = props.cooldown || 0;
		this.clip = props.clip || 0;
		this.reloadTime = props.reloadTime || 1;

		this.ammo = this.clip;

		this._counter = 0;
		this._reloadTimer = 0;
	}

	tick(dt) {
		if (this.cooldown == 0) {
			return;
		}
		if (this._counter > this.cooldown) {
			return;
		}
		this._counter += dt;
	}

	fire(target) {
		if (this.ammo <= 0) {
			if (this._reloadTimer === 0) {
				// Set reload timer
				this._reloadTimer = this.app.time + this.reloadTime;
				return;
			} else if (this.app.time > this._reloadTimer) {
				// Reload done
				this._reloadTimer = 0;
				this.ammo = this.clip;
			} else {
				// Reloading...
				return;
			}
		}

		if (this.cooldown == 0) {
			return;
		}

		if (this._counter > this.cooldown) {
			this._fire(target);
			this.ammo--;
			this._counter -= this.cooldown;
		}
	}

	get position() {
		return this.ship.innerObject.localToWorld(this.localPosition.clone());
	}

	// target { position }
	_fire(target) {
		const vector = target.position.clone().sub(this.position);

		this.app.add(this.type, {
			target: target,
			turrent: this
		});
	}
}

module.exports = Turrent;
},{"../../container":31}],31:[function(require,module,exports){
const Bottle = require('bottlejs');
const renderer = require('./renderer');

const bottle = new Bottle();
const container = bottle.container;

container.renderer = renderer;
container.scene = renderer.scene;
container.camera = renderer.camera;

module.exports = container;
},{"./renderer":34,"bottlejs":1}],32:[function(require,module,exports){
function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
    s4() + '-' + s4() + s4() + s4();
}

module.exports = guid;
},{}],33:[function(require,module,exports){
const app = require('./app');
const Ship = require('./components/ship');
const DragCamera = require('./components/dragcamera');
const Asteroid = require('./components/asteroid');
const Grid = require('./components/grid');
const Ships = require('./components/ship/ships');

app.start();

const frigate = require('./ships/frigate');

app.add(Ships);

const ship = app.add(Ship, { 
	data: frigate, 
	side: '0',
	rotation: new THREE.Euler(0, Math.random() * Math.PI * 2) });
ship.position.x = (Math.random() - 0.5) * 100;
ship.position.z = (Math.random() - 0.5) * 100;

const ship2 = app.add(Ship, { 
	data: frigate, 
	side: '1',
	rotation: new THREE.Euler(0, Math.random() * Math.PI * 2) });
ship2.position.x = (Math.random() - 0.5) * 100;
ship2.position.z = (Math.random() - 0.5) * 100;

// app.add(Asteroid);
const dragCamera = app.add(DragCamera);
dragCamera.distance = 200;

app.add(Grid);
},{"./app":17,"./components/asteroid":18,"./components/dragcamera":20,"./components/grid":22,"./components/ship":27,"./components/ship/ships":29,"./ships/frigate":35}],34:[function(require,module,exports){
(function (global){
const THREE = (typeof window !== "undefined" ? window['THREE'] : typeof global !== "undefined" ? global['THREE'] : null);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000);
camera.position.z = 5;

const render = () => {
	renderer.render(scene, camera);
};

const animate = () => {
	render();
	requestAnimationFrame(animate);
};

const onResize = () => {
	renderer.setSize(window.innerWidth, window.innerHeight);
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
};

window.addEventListener('resize', onResize);

animate();

module.exports = {
	render,
	scene,
	camera
};
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],35:[function(require,module,exports){
module.exports = `
HULL
 0         0
 0   0 0   0
0000000000000
0000000000000
 0   0 0   0
          

MODULES
 0         0
 0   0l0   0
0000000000000
000000C000000
 E   0 0   E
          
`
},{}],36:[function(require,module,exports){
const randomUnitVector = () => {
  const theta = Math.random() * 2.0 * Math.PI;

  const rawX = Math.sin(theta);

  const rawY = Math.cos(theta);

  const z = Math.random() * 2.0 - 1.0;

  const phi = Math.asin(z);

  const scalar = Math.cos(phi);

  const x = rawX * scalar;

  const y = rawY * scalar;

  return new THREE.Vector3(x, y, z);  
}

const randomQuaternion = () => {
	const vector = randomUnitVector();
	return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), vector);
};

const normalizeAngle = (angle) => {
	angle %= (Math.PI * 2);
	if (angle > Math.PI) {
		angle -= Math.PI * 2;
	} else if (angle < -Math.PI) {
		angle += Math.PI * 2;
	}

	return angle;
};

const clamp = (v, min, max) => {
	if (v < min) {
		return min;
	} else if (v > max) {
		return max;
	}
	return v;
};

const linearBillboard = (camera, object, dir, quaternion) => {
	const a = object.position.clone().sub(camera.position).normalize();
	const b = a.clone().projectOnPlane(dir).normalize();
	const c = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion);

	const quat2 = new THREE.Quaternion().setFromUnitVectors(c, b);

	object.quaternion.copy(new THREE.Quaternion());
	object.quaternion.multiply(quat2);
	object.quaternion.multiply(quaternion);
}

module.exports = { randomUnitVector, randomQuaternion, normalizeAngle, clamp, linearBillboard };

},{}],37:[function(require,module,exports){
class Chunk {
	constructor(size) {
		this.size = size;
		this.yz = size * size;
		this.data = [];
	}

	get(i, j, k) {
		const index = i * this.yz + j * this.size + k;
		return this.data[index];
	}

	set(i, j, k, v) {
		const index = i * this.yz + j * this.size + k;
		this.data[index] = v;
	}
}

module.exports = Chunk;
},{}],38:[function(require,module,exports){
const Chunk = require('./chunk');

class Chunks {
	constructor(size) {
		this.size = size || 16;
		this.map = {};
	}

	get(i, j, k) {
		const origin = this.getOrigin(i, j, k);
		const id = origin.join(',');

		const region = this.map[id];
		if (region == null) {
			return null;
		} 

		return region.chunk.get(i - origin[0], j - origin[1], k - origin[2]);
	}

	set(i, j, k, v) {
		const origin = this.getOrigin(i, j, k);
		const id = origin.join(',');

		let region = this.map[id];
		if (region == null) {
			region = this.map[id] = {
				chunk: new Chunk(this.size),
				origin: origin
			};
		}
		region.dirty = true;

		region.chunk.set(i - origin[0], j - origin[1], k - origin[2], v);
	}

	getOrigin(i, j, k) {
		return [ 
			Math.floor(i / this.size) * this.size,
			Math.floor(j / this.size) * this.size,
			Math.floor(k / this.size) * this.size
		]
	}
};

module.exports = Chunks;
},{"./chunk":37}],39:[function(require,module,exports){
const mesher = require('./monotone').mesher;

const meshRegion = (region, object, material) => {
	if (region.mesh != null) {
		object.remove(region.mesh);
		region.mesh.geometry.dispose();
	}

	const geometry = new THREE.Geometry();
	const mesh = new THREE.Mesh(geometry, material);

	const chunk = region.chunk;

	const f = chunk.get.bind(chunk);
	const dims = [ chunk.size, chunk.size, chunk.size ];

	const result = mesher(f, dims);

	result.vertices.forEach((v) => {
		geometry.vertices.push(new THREE.Vector3(v[0], v[1], v[2]));
	});

	result.faces.forEach((f) => {
		const face = new THREE.Face3(f[0], f[1], f[2]);
		face.materialIndex = f[3];
		geometry.faces.push(face);
	});

	object.add(mesh);
	region.mesh = mesh;
};

const meshChunks = (chunks, object, material) => {
	let id, region;
	for (id in chunks.map) {
		region = chunks.map[id];
		if (region.dirty) {
			meshRegion(region, object, material);
			region.dirty = false;
		}
	}
};

module.exports = meshChunks;
},{"./monotone":40}],40:[function(require,module,exports){
"use strict";

var MonotoneMesh = (function(){

function MonotonePolygon(c, v, ul, ur) {
  this.color  = c;
  this.left   = [[ul, v]];
  this.right  = [[ur, v]];
};

MonotonePolygon.prototype.close_off = function(v) {
  this.left.push([ this.left[this.left.length-1][0], v ]);
  this.right.push([ this.right[this.right.length-1][0], v ]);
};

MonotonePolygon.prototype.merge_run = function(v, u_l, u_r) {
  var l = this.left[this.left.length-1][0]
    , r = this.right[this.right.length-1][0]; 
  if(l !== u_l) {
    this.left.push([ l, v ]);
    this.left.push([ u_l, v ]);
  }
  if(r !== u_r) {
    this.right.push([ r, v ]);
    this.right.push([ u_r, v ]);
  }
};


return function(f, dims) {
  //Sweep over 3-axes
  var vertices = [], faces = [];
  for(var d=0; d<3; ++d) {
    var i, j, k
      , u = (d+1)%3   //u and v are orthogonal directions to d
      , v = (d+2)%3
      , x = new Int32Array(3)
      , q = new Int32Array(3)
      , runs = new Int32Array(2 * (dims[u]+1))
      , frontier = new Int32Array(dims[u])  //Frontier is list of pointers to polygons
      , next_frontier = new Int32Array(dims[u])
      , left_index = new Int32Array(2 * dims[v])
      , right_index = new Int32Array(2 * dims[v])
      , stack = new Int32Array(24 * dims[v])
      , delta = [[0,0], [0,0]];
    //q points along d-direction
    q[d] = 1;
    //Initialize sentinel
    for(x[d]=-1; x[d]<dims[d]; ) {
      // --- Perform monotone polygon subdivision ---
      var n = 0
        , polygons = []
        , nf = 0;
      for(x[v]=0; x[v]<dims[v]; ++x[v]) {
        //Make one pass over the u-scan line of the volume to run-length encode polygon
        var nr = 0, p = 0, c = 0;
        for(x[u]=0; x[u]<dims[u]; ++x[u], p = c) {
          //Compute the type for this face
          var a = (0    <= x[d]      ? f(x[0],      x[1],      x[2])      : 0)
            , b = (x[d] <  dims[d]-1 ? f(x[0]+q[0], x[1]+q[1], x[2]+q[2]) : 0);
          c = a;
          if((!a) === (!b)) {
            c = 0;
          } else if(!a) {
            c = -b;
          }
          //If cell type doesn't match, start a new run
          if(p !== c) {
            runs[nr++] = x[u];
            runs[nr++] = c;
          }
        }
        //Add sentinel run
        runs[nr++] = dims[u];
        runs[nr++] = 0;
        //Update frontier by merging runs
        var fp = 0;
        for(var i=0, j=0; i<nf && j<nr-2; ) {
          var p    = polygons[frontier[i]]
            , p_l  = p.left[p.left.length-1][0]
            , p_r  = p.right[p.right.length-1][0]
            , p_c  = p.color
            , r_l  = runs[j]    //Start of run
            , r_r  = runs[j+2]  //End of run
            , r_c  = runs[j+1]; //Color of run
          //Check if we can merge run with polygon
          if(r_r > p_l && p_r > r_l && r_c === p_c) {
            //Merge run
            p.merge_run(x[v], r_l, r_r);
            //Insert polygon into frontier
            next_frontier[fp++] = frontier[i];
            ++i;
            j += 2;
          } else {
            //Check if we need to advance the run pointer
            if(r_r <= p_r) {
              if(!!r_c) {
                var n_poly = new MonotonePolygon(r_c, x[v], r_l, r_r);
                next_frontier[fp++] = polygons.length;
                polygons.push(n_poly);
              }
              j += 2;
            }
            //Check if we need to advance the frontier pointer
            if(p_r <= r_r) {
              p.close_off(x[v]);
              ++i;
            }
          }
        }
        //Close off any residual polygons
        for(; i<nf; ++i) {
          polygons[frontier[i]].close_off(x[v]);
        }
        //Add any extra runs to frontier
        for(; j<nr-2; j+=2) {
          var r_l  = runs[j]
            , r_r  = runs[j+2]
            , r_c  = runs[j+1];
          if(!!r_c) {
            var n_poly = new MonotonePolygon(r_c, x[v], r_l, r_r);
            next_frontier[fp++] = polygons.length;
            polygons.push(n_poly);
          }
        }
        //Swap frontiers
        var tmp = next_frontier;
        next_frontier = frontier;
        frontier = tmp;
        nf = fp;
      }
      //Close off frontier
      for(var i=0; i<nf; ++i) {
        var p = polygons[frontier[i]];
        p.close_off(dims[v]);
      }
      // --- Monotone subdivision of polygon is complete at this point ---
      
      x[d]++;
      
      //Now we just need to triangulate each monotone polygon
      for(var i=0; i<polygons.length; ++i) {
        var p = polygons[i]
          , c = p.color
          , flipped = false;
        if(c < 0) {
          flipped = true;
          c = -c;
        }
        for(var j=0; j<p.left.length; ++j) {
          left_index[j] = vertices.length;
          var y = [0.0,0.0,0.0]
            , z = p.left[j];
          y[d] = x[d];
          y[u] = z[0];
          y[v] = z[1];
          vertices.push(y);
        }
        for(var j=0; j<p.right.length; ++j) {
          right_index[j] = vertices.length;
          var y = [0.0,0.0,0.0]
            , z = p.right[j];
          y[d] = x[d];
          y[u] = z[0];
          y[v] = z[1];
          vertices.push(y);
        }
        //Triangulate the monotone polygon
        var bottom = 0
          , top = 0
          , l_i = 1
          , r_i = 1
          , side = true;  //true = right, false = left
        
        stack[top++] = left_index[0];
        stack[top++] = p.left[0][0];
        stack[top++] = p.left[0][1];
        
        stack[top++] = right_index[0];
        stack[top++] = p.right[0][0];
        stack[top++] = p.right[0][1];
        
        while(l_i < p.left.length || r_i < p.right.length) {
          //Compute next side
          var n_side = false;
          if(l_i === p.left.length) {
            n_side = true;
          } else if(r_i !== p.right.length) {
            var l = p.left[l_i]
              , r = p.right[r_i];
            n_side = l[1] > r[1];
          }
          var idx = n_side ? right_index[r_i] : left_index[l_i]
            , vert = n_side ? p.right[r_i] : p.left[l_i];
          if(n_side !== side) {
            //Opposite side
            while(bottom+3 < top) {
              if(flipped === n_side) {
                faces.push([ stack[bottom], stack[bottom+3], idx, c]);
              } else {
                faces.push([ stack[bottom+3], stack[bottom], idx, c]);              
              }
              bottom += 3;
            }
          } else {
            //Same side
            while(bottom+3 < top) {
              //Compute convexity
              for(var j=0; j<2; ++j)
              for(var k=0; k<2; ++k) {
                delta[j][k] = stack[top-3*(j+1)+k+1] - vert[k];
              }
              var det = delta[0][0] * delta[1][1] - delta[1][0] * delta[0][1];
              if(n_side === (det > 0)) {
                break;
              }
              if(det !== 0) {
                if(flipped === n_side) {
                  faces.push([ stack[top-3], stack[top-6], idx, c ]);
                } else {
                  faces.push([ stack[top-6], stack[top-3], idx, c ]);
                }
              }
              top -= 3;
            }
          }
          //Push vertex
          stack[top++] = idx;
          stack[top++] = vert[0];
          stack[top++] = vert[1];
          //Update loop index
          if(n_side) {
            ++r_i;
          } else {
            ++l_i;
          }
          side = n_side;
        }
      }
    }
  }
  return { vertices:vertices, faces:faces };
}
})();

if(exports) {
  exports.mesher = MonotoneMesh;
}

},{}]},{},[33])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYm90dGxlanMvZGlzdC9ib3R0bGUuanMiLCJub2RlX21vZHVsZXMvZC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9lczUtZXh0L29iamVjdC9hc3NpZ24vaW5kZXguanMiLCJub2RlX21vZHVsZXMvZXM1LWV4dC9vYmplY3QvYXNzaWduL2lzLWltcGxlbWVudGVkLmpzIiwibm9kZV9tb2R1bGVzL2VzNS1leHQvb2JqZWN0L2Fzc2lnbi9zaGltLmpzIiwibm9kZV9tb2R1bGVzL2VzNS1leHQvb2JqZWN0L2lzLWNhbGxhYmxlLmpzIiwibm9kZV9tb2R1bGVzL2VzNS1leHQvb2JqZWN0L2tleXMvaW5kZXguanMiLCJub2RlX21vZHVsZXMvZXM1LWV4dC9vYmplY3Qva2V5cy9pcy1pbXBsZW1lbnRlZC5qcyIsIm5vZGVfbW9kdWxlcy9lczUtZXh0L29iamVjdC9rZXlzL3NoaW0uanMiLCJub2RlX21vZHVsZXMvZXM1LWV4dC9vYmplY3Qvbm9ybWFsaXplLW9wdGlvbnMuanMiLCJub2RlX21vZHVsZXMvZXM1LWV4dC9vYmplY3QvdmFsaWQtY2FsbGFibGUuanMiLCJub2RlX21vZHVsZXMvZXM1LWV4dC9vYmplY3QvdmFsaWQtdmFsdWUuanMiLCJub2RlX21vZHVsZXMvZXM1LWV4dC9zdHJpbmcvIy9jb250YWlucy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9lczUtZXh0L3N0cmluZy8jL2NvbnRhaW5zL2lzLWltcGxlbWVudGVkLmpzIiwibm9kZV9tb2R1bGVzL2VzNS1leHQvc3RyaW5nLyMvY29udGFpbnMvc2hpbS5qcyIsIm5vZGVfbW9kdWxlcy9ldmVudC1lbWl0dGVyL2luZGV4LmpzIiwic3JjL2FwcC5qcyIsInNyYy9jb21wb25lbnRzL2FzdGVyb2lkLmpzIiwic3JjL2NvbXBvbmVudHMvYmVhbS5qcyIsInNyYy9jb21wb25lbnRzL2RyYWdjYW1lcmEuanMiLCJzcmMvY29tcG9uZW50cy9lbmdpbmUuanMiLCJzcmMvY29tcG9uZW50cy9ncmlkLmpzIiwic3JjL2NvbXBvbmVudHMvbGFzZXIuanMiLCJzcmMvY29tcG9uZW50cy9wYXJ0aWNsZS5qcyIsInNyYy9jb21wb25lbnRzL3BhcnRpY2xlc3lzdGVtLmpzIiwic3JjL2NvbXBvbmVudHMvc2hpcC9haS5qcyIsInNyYy9jb21wb25lbnRzL3NoaXAvaW5kZXguanMiLCJzcmMvY29tcG9uZW50cy9zaGlwL3JlYWRlci5qcyIsInNyYy9jb21wb25lbnRzL3NoaXAvc2hpcHMuanMiLCJzcmMvY29tcG9uZW50cy9zaGlwL3R1cnJlbnQuanMiLCJzcmMvY29udGFpbmVyLmpzIiwic3JjL2d1aWQuanMiLCJzcmMvaW5kZXguanMiLCJzcmMvcmVuZGVyZXIuanMiLCJzcmMvc2hpcHMvZnJpZ2F0ZS5qcyIsInNyYy91dGlscy9tYXRoLmpzIiwic3JjL3ZveGVsL2NodW5rLmpzIiwic3JjL3ZveGVsL2NodW5rcy5qcyIsInNyYy92b3hlbC9tZXNoZXIuanMiLCJzcmMvdm94ZWwvbW9ub3RvbmUuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2xwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3ZEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDbk5BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQy9CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNoQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiOyhmdW5jdGlvbih1bmRlZmluZWQpIHtcbiAgICAndXNlIHN0cmljdCc7XG4gICAgLyoqXG4gICAgICogQm90dGxlSlMgdjEuNi4xIC0gMjAxNy0wNS0xN1xuICAgICAqIEEgcG93ZXJmdWwgZGVwZW5kZW5jeSBpbmplY3Rpb24gbWljcm8gY29udGFpbmVyXG4gICAgICpcbiAgICAgKiBDb3B5cmlnaHQgKGMpIDIwMTcgU3RlcGhlbiBZb3VuZ1xuICAgICAqIExpY2Vuc2VkIE1JVFxuICAgICAqL1xuICAgIFxuICAgIC8qKlxuICAgICAqIFVuaXF1ZSBpZCBjb3VudGVyO1xuICAgICAqXG4gICAgICogQHR5cGUgTnVtYmVyXG4gICAgICovXG4gICAgdmFyIGlkID0gMDtcbiAgICBcbiAgICAvKipcbiAgICAgKiBMb2NhbCBzbGljZSBhbGlhc1xuICAgICAqXG4gICAgICogQHR5cGUgRnVuY3Rpb25zXG4gICAgICovXG4gICAgdmFyIHNsaWNlID0gQXJyYXkucHJvdG90eXBlLnNsaWNlO1xuICAgIFxuICAgIC8qKlxuICAgICAqIEl0ZXJhdG9yIHVzZWQgdG8gd2FsayBkb3duIGEgbmVzdGVkIG9iamVjdC5cbiAgICAgKlxuICAgICAqIElmIEJvdHRsZS5jb25maWcuc3RyaWN0IGlzIHRydWUsIHRoaXMgbWV0aG9kIHdpbGwgdGhyb3cgYW4gZXhjZXB0aW9uIGlmIGl0IGVuY291bnRlcnMgYW5cbiAgICAgKiB1bmRlZmluZWQgcGF0aFxuICAgICAqXG4gICAgICogQHBhcmFtIE9iamVjdCBvYmpcbiAgICAgKiBAcGFyYW0gU3RyaW5nIHByb3BcbiAgICAgKiBAcmV0dXJuIG1peGVkXG4gICAgICogQHRocm93cyBFcnJvciBpZiBCb3R0bGUgaXMgdW5hYmxlIHRvIHJlc29sdmUgdGhlIHJlcXVlc3RlZCBzZXJ2aWNlLlxuICAgICAqL1xuICAgIHZhciBnZXROZXN0ZWQgPSBmdW5jdGlvbiBnZXROZXN0ZWQob2JqLCBwcm9wKSB7XG4gICAgICAgIHZhciBzZXJ2aWNlID0gb2JqW3Byb3BdO1xuICAgICAgICBpZiAoc2VydmljZSA9PT0gdW5kZWZpbmVkICYmIGdsb2JhbENvbmZpZy5zdHJpY3QpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQm90dGxlIHdhcyB1bmFibGUgdG8gcmVzb2x2ZSBhIHNlcnZpY2UuICBgJyArIHByb3AgKyAnYCBpcyB1bmRlZmluZWQuJyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHNlcnZpY2U7XG4gICAgfTtcbiAgICBcbiAgICAvKipcbiAgICAgKiBHZXQgYSBuZXN0ZWQgYm90dGxlLiBXaWxsIHNldCBhbmQgcmV0dXJuIGlmIG5vdCBzZXQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gU3RyaW5nIG5hbWVcbiAgICAgKiBAcmV0dXJuIEJvdHRsZVxuICAgICAqL1xuICAgIHZhciBnZXROZXN0ZWRCb3R0bGUgPSBmdW5jdGlvbiBnZXROZXN0ZWRCb3R0bGUobmFtZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5uZXN0ZWRbbmFtZV0gfHwgKHRoaXMubmVzdGVkW25hbWVdID0gQm90dGxlLnBvcCgpKTtcbiAgICB9O1xuICAgIFxuICAgIC8qKlxuICAgICAqIEdldCBhIHNlcnZpY2Ugc3RvcmVkIHVuZGVyIGEgbmVzdGVkIGtleVxuICAgICAqXG4gICAgICogQHBhcmFtIFN0cmluZyBmdWxsbmFtZVxuICAgICAqIEByZXR1cm4gU2VydmljZVxuICAgICAqL1xuICAgIHZhciBnZXROZXN0ZWRTZXJ2aWNlID0gZnVuY3Rpb24gZ2V0TmVzdGVkU2VydmljZShmdWxsbmFtZSkge1xuICAgICAgICByZXR1cm4gZnVsbG5hbWUuc3BsaXQoJy4nKS5yZWR1Y2UoZ2V0TmVzdGVkLCB0aGlzKTtcbiAgICB9O1xuICAgIFxuICAgIC8qKlxuICAgICAqIFJlZ2lzdGVyIGEgY29uc3RhbnRcbiAgICAgKlxuICAgICAqIEBwYXJhbSBTdHJpbmcgbmFtZVxuICAgICAqIEBwYXJhbSBtaXhlZCB2YWx1ZVxuICAgICAqIEByZXR1cm4gQm90dGxlXG4gICAgICovXG4gICAgdmFyIGNvbnN0YW50ID0gZnVuY3Rpb24gY29uc3RhbnQobmFtZSwgdmFsdWUpIHtcbiAgICAgICAgdmFyIHBhcnRzID0gbmFtZS5zcGxpdCgnLicpO1xuICAgICAgICBuYW1lID0gcGFydHMucG9wKCk7XG4gICAgICAgIGRlZmluZUNvbnN0YW50LmNhbGwocGFydHMucmVkdWNlKHNldFZhbHVlT2JqZWN0LCB0aGlzLmNvbnRhaW5lciksIG5hbWUsIHZhbHVlKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfTtcbiAgICBcbiAgICB2YXIgZGVmaW5lQ29uc3RhbnQgPSBmdW5jdGlvbiBkZWZpbmVDb25zdGFudChuYW1lLCB2YWx1ZSkge1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgbmFtZSwge1xuICAgICAgICAgICAgY29uZmlndXJhYmxlIDogZmFsc2UsXG4gICAgICAgICAgICBlbnVtZXJhYmxlIDogdHJ1ZSxcbiAgICAgICAgICAgIHZhbHVlIDogdmFsdWUsXG4gICAgICAgICAgICB3cml0YWJsZSA6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgIH07XG4gICAgXG4gICAgLyoqXG4gICAgICogUmVnaXN0ZXIgZGVjb3JhdG9yLlxuICAgICAqXG4gICAgICogQHBhcmFtIFN0cmluZyBmdWxsbmFtZVxuICAgICAqIEBwYXJhbSBGdW5jdGlvbiBmdW5jXG4gICAgICogQHJldHVybiBCb3R0bGVcbiAgICAgKi9cbiAgICB2YXIgZGVjb3JhdG9yID0gZnVuY3Rpb24gZGVjb3JhdG9yKGZ1bGxuYW1lLCBmdW5jKSB7XG4gICAgICAgIHZhciBwYXJ0cywgbmFtZTtcbiAgICAgICAgaWYgKHR5cGVvZiBmdWxsbmFtZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgZnVuYyA9IGZ1bGxuYW1lO1xuICAgICAgICAgICAgZnVsbG5hbWUgPSAnX19nbG9iYWxfXyc7XG4gICAgICAgIH1cbiAgICBcbiAgICAgICAgcGFydHMgPSBmdWxsbmFtZS5zcGxpdCgnLicpO1xuICAgICAgICBuYW1lID0gcGFydHMuc2hpZnQoKTtcbiAgICAgICAgaWYgKHBhcnRzLmxlbmd0aCkge1xuICAgICAgICAgICAgZ2V0TmVzdGVkQm90dGxlLmNhbGwodGhpcywgbmFtZSkuZGVjb3JhdG9yKHBhcnRzLmpvaW4oJy4nKSwgZnVuYyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuZGVjb3JhdG9yc1tuYW1lXSkge1xuICAgICAgICAgICAgICAgIHRoaXMuZGVjb3JhdG9yc1tuYW1lXSA9IFtdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5kZWNvcmF0b3JzW25hbWVdLnB1c2goZnVuYyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfTtcbiAgICBcbiAgICAvKipcbiAgICAgKiBSZWdpc3RlciBhIGZ1bmN0aW9uIHRoYXQgd2lsbCBiZSBleGVjdXRlZCB3aGVuIEJvdHRsZSNyZXNvbHZlIGlzIGNhbGxlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBGdW5jdGlvbiBmdW5jXG4gICAgICogQHJldHVybiBCb3R0bGVcbiAgICAgKi9cbiAgICB2YXIgZGVmZXIgPSBmdW5jdGlvbiBkZWZlcihmdW5jKSB7XG4gICAgICAgIHRoaXMuZGVmZXJyZWQucHVzaChmdW5jKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfTtcbiAgICBcbiAgICBcbiAgICAvKipcbiAgICAgKiBJbW1lZGlhdGVseSBpbnN0YW50aWF0ZXMgdGhlIHByb3ZpZGVkIGxpc3Qgb2Ygc2VydmljZXMgYW5kIHJldHVybnMgdGhlbS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBBcnJheSBzZXJ2aWNlc1xuICAgICAqIEByZXR1cm4gQXJyYXkgQXJyYXkgb2YgaW5zdGFuY2VzIChpbiB0aGUgb3JkZXIgdGhleSB3ZXJlIHByb3ZpZGVkKVxuICAgICAqL1xuICAgIHZhciBkaWdlc3QgPSBmdW5jdGlvbiBkaWdlc3Qoc2VydmljZXMpIHtcbiAgICAgICAgcmV0dXJuIChzZXJ2aWNlcyB8fCBbXSkubWFwKGdldE5lc3RlZFNlcnZpY2UsIHRoaXMuY29udGFpbmVyKTtcbiAgICB9O1xuICAgIFxuICAgIC8qKlxuICAgICAqIFJlZ2lzdGVyIGEgZmFjdG9yeSBpbnNpZGUgYSBnZW5lcmljIHByb3ZpZGVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIFN0cmluZyBuYW1lXG4gICAgICogQHBhcmFtIEZ1bmN0aW9uIEZhY3RvcnlcbiAgICAgKiBAcmV0dXJuIEJvdHRsZVxuICAgICAqL1xuICAgIHZhciBmYWN0b3J5ID0gZnVuY3Rpb24gZmFjdG9yeShuYW1lLCBGYWN0b3J5KSB7XG4gICAgICAgIHJldHVybiBwcm92aWRlci5jYWxsKHRoaXMsIG5hbWUsIGZ1bmN0aW9uIEdlbmVyaWNQcm92aWRlcigpIHtcbiAgICAgICAgICAgIHRoaXMuJGdldCA9IEZhY3Rvcnk7XG4gICAgICAgIH0pO1xuICAgIH07XG4gICAgXG4gICAgLyoqXG4gICAgICogUmVnaXN0ZXIgYW4gaW5zdGFuY2UgZmFjdG9yeSBpbnNpZGUgYSBnZW5lcmljIGZhY3RvcnkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBzZXJ2aWNlXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gRmFjdG9yeSAtIFRoZSBmYWN0b3J5IGZ1bmN0aW9uLCBtYXRjaGVzIHRoZSBzaWduYXR1cmUgcmVxdWlyZWQgZm9yIHRoZVxuICAgICAqIGBmYWN0b3J5YCBtZXRob2RcbiAgICAgKiBAcmV0dXJuIEJvdHRsZVxuICAgICAqL1xuICAgIHZhciBpbnN0YW5jZUZhY3RvcnkgPSBmdW5jdGlvbiBpbnN0YW5jZUZhY3RvcnkobmFtZSwgRmFjdG9yeSkge1xuICAgICAgICByZXR1cm4gZmFjdG9yeS5jYWxsKHRoaXMsIG5hbWUsIGZ1bmN0aW9uIEdlbmVyaWNJbnN0YW5jZUZhY3RvcnkoY29udGFpbmVyKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIGluc3RhbmNlIDogRmFjdG9yeS5iaW5kKEZhY3RvcnksIGNvbnRhaW5lcilcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0pO1xuICAgIH07XG4gICAgXG4gICAgLyoqXG4gICAgICogQSBmaWx0ZXIgZnVuY3Rpb24gZm9yIHJlbW92aW5nIGJvdHRsZSBjb250YWluZXIgbWV0aG9kcyBhbmQgcHJvdmlkZXJzIGZyb20gYSBsaXN0IG9mIGtleXNcbiAgICAgKi9cbiAgICB2YXIgYnlNZXRob2QgPSBmdW5jdGlvbiBieU1ldGhvZChuYW1lKSB7XG4gICAgICAgIHJldHVybiAhL15cXCQoPzpkZWNvcmF0b3J8cmVnaXN0ZXJ8bGlzdCkkfFByb3ZpZGVyJC8udGVzdChuYW1lKTtcbiAgICB9O1xuICAgIFxuICAgIC8qKlxuICAgICAqIExpc3QgdGhlIHNlcnZpY2VzIHJlZ2lzdGVyZWQgb24gdGhlIGNvbnRhaW5lci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBPYmplY3QgY29udGFpbmVyXG4gICAgICogQHJldHVybiBBcnJheVxuICAgICAqL1xuICAgIHZhciBsaXN0ID0gZnVuY3Rpb24gbGlzdChjb250YWluZXIpIHtcbiAgICAgICAgcmV0dXJuIE9iamVjdC5rZXlzKGNvbnRhaW5lciB8fCB0aGlzLmNvbnRhaW5lciB8fCB7fSkuZmlsdGVyKGJ5TWV0aG9kKTtcbiAgICB9O1xuICAgIFxuICAgIC8qKlxuICAgICAqIEZ1bmN0aW9uIHVzZWQgYnkgcHJvdmlkZXIgdG8gc2V0IHVwIG1pZGRsZXdhcmUgZm9yIGVhY2ggcmVxdWVzdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBOdW1iZXIgaWRcbiAgICAgKiBAcGFyYW0gU3RyaW5nIG5hbWVcbiAgICAgKiBAcGFyYW0gT2JqZWN0IGluc3RhbmNlXG4gICAgICogQHBhcmFtIE9iamVjdCBjb250YWluZXJcbiAgICAgKiBAcmV0dXJuIHZvaWRcbiAgICAgKi9cbiAgICB2YXIgYXBwbHlNaWRkbGV3YXJlID0gZnVuY3Rpb24gYXBwbHlNaWRkbGV3YXJlKG1pZGRsZXdhcmUsIG5hbWUsIGluc3RhbmNlLCBjb250YWluZXIpIHtcbiAgICAgICAgdmFyIGRlc2NyaXB0b3IgPSB7XG4gICAgICAgICAgICBjb25maWd1cmFibGUgOiB0cnVlLFxuICAgICAgICAgICAgZW51bWVyYWJsZSA6IHRydWVcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKG1pZGRsZXdhcmUubGVuZ3RoKSB7XG4gICAgICAgICAgICBkZXNjcmlwdG9yLmdldCA9IGZ1bmN0aW9uIGdldFdpdGhNaWRkbGV3ZWFyKCkge1xuICAgICAgICAgICAgICAgIHZhciBpbmRleCA9IDA7XG4gICAgICAgICAgICAgICAgdmFyIG5leHQgPSBmdW5jdGlvbiBuZXh0TWlkZGxld2FyZShlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChtaWRkbGV3YXJlW2luZGV4XSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWlkZGxld2FyZVtpbmRleCsrXShpbnN0YW5jZSwgbmV4dCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIG5leHQoKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gaW5zdGFuY2U7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZGVzY3JpcHRvci52YWx1ZSA9IGluc3RhbmNlO1xuICAgICAgICAgICAgZGVzY3JpcHRvci53cml0YWJsZSA9IHRydWU7XG4gICAgICAgIH1cbiAgICBcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGNvbnRhaW5lciwgbmFtZSwgZGVzY3JpcHRvcik7XG4gICAgXG4gICAgICAgIHJldHVybiBjb250YWluZXJbbmFtZV07XG4gICAgfTtcbiAgICBcbiAgICAvKipcbiAgICAgKiBSZWdpc3RlciBtaWRkbGV3YXJlLlxuICAgICAqXG4gICAgICogQHBhcmFtIFN0cmluZyBuYW1lXG4gICAgICogQHBhcmFtIEZ1bmN0aW9uIGZ1bmNcbiAgICAgKiBAcmV0dXJuIEJvdHRsZVxuICAgICAqL1xuICAgIHZhciBtaWRkbGV3YXJlID0gZnVuY3Rpb24gbWlkZGxld2FyZShmdWxsbmFtZSwgZnVuYykge1xuICAgICAgICB2YXIgcGFydHMsIG5hbWU7XG4gICAgICAgIGlmICh0eXBlb2YgZnVsbG5hbWUgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGZ1bmMgPSBmdWxsbmFtZTtcbiAgICAgICAgICAgIGZ1bGxuYW1lID0gJ19fZ2xvYmFsX18nO1xuICAgICAgICB9XG4gICAgXG4gICAgICAgIHBhcnRzID0gZnVsbG5hbWUuc3BsaXQoJy4nKTtcbiAgICAgICAgbmFtZSA9IHBhcnRzLnNoaWZ0KCk7XG4gICAgICAgIGlmIChwYXJ0cy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGdldE5lc3RlZEJvdHRsZS5jYWxsKHRoaXMsIG5hbWUpLm1pZGRsZXdhcmUocGFydHMuam9pbignLicpLCBmdW5jKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5taWRkbGV3YXJlc1tuYW1lXSkge1xuICAgICAgICAgICAgICAgIHRoaXMubWlkZGxld2FyZXNbbmFtZV0gPSBbXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMubWlkZGxld2FyZXNbbmFtZV0ucHVzaChmdW5jKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9O1xuICAgIFxuICAgIC8qKlxuICAgICAqIE5hbWVkIGJvdHRsZSBpbnN0YW5jZXNcbiAgICAgKlxuICAgICAqIEB0eXBlIE9iamVjdFxuICAgICAqL1xuICAgIHZhciBib3R0bGVzID0ge307XG4gICAgXG4gICAgLyoqXG4gICAgICogR2V0IGFuIGluc3RhbmNlIG9mIGJvdHRsZS5cbiAgICAgKlxuICAgICAqIElmIGEgbmFtZSBpcyBwcm92aWRlZCB0aGUgaW5zdGFuY2Ugd2lsbCBiZSBzdG9yZWQgaW4gYSBsb2NhbCBoYXNoLiAgQ2FsbGluZyBCb3R0bGUucG9wIG11bHRpcGxlXG4gICAgICogdGltZXMgd2l0aCB0aGUgc2FtZSBuYW1lIHdpbGwgcmV0dXJuIHRoZSBzYW1lIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIFN0cmluZyBuYW1lXG4gICAgICogQHJldHVybiBCb3R0bGVcbiAgICAgKi9cbiAgICB2YXIgcG9wID0gZnVuY3Rpb24gcG9wKG5hbWUpIHtcbiAgICAgICAgdmFyIGluc3RhbmNlO1xuICAgICAgICBpZiAodHlwZW9mIG5hbWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBpbnN0YW5jZSA9IGJvdHRsZXNbbmFtZV07XG4gICAgICAgICAgICBpZiAoIWluc3RhbmNlKSB7XG4gICAgICAgICAgICAgICAgYm90dGxlc1tuYW1lXSA9IGluc3RhbmNlID0gbmV3IEJvdHRsZSgpO1xuICAgICAgICAgICAgICAgIGluc3RhbmNlLmNvbnN0YW50KCdCT1RUTEVfTkFNRScsIG5hbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGluc3RhbmNlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXcgQm90dGxlKCk7XG4gICAgfTtcbiAgICBcbiAgICAvKipcbiAgICAgKiBDbGVhciBhbGwgbmFtZWQgYm90dGxlcy5cbiAgICAgKi9cbiAgICB2YXIgY2xlYXIgPSBmdW5jdGlvbiBjbGVhcihuYW1lKSB7XG4gICAgICAgIGlmICh0eXBlb2YgbmFtZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIGRlbGV0ZSBib3R0bGVzW25hbWVdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYm90dGxlcyA9IHt9O1xuICAgICAgICB9XG4gICAgfTtcbiAgICBcbiAgICAvKipcbiAgICAgKiBVc2VkIHRvIHByb2Nlc3MgZGVjb3JhdG9ycyBpbiB0aGUgcHJvdmlkZXJcbiAgICAgKlxuICAgICAqIEBwYXJhbSBPYmplY3QgaW5zdGFuY2VcbiAgICAgKiBAcGFyYW0gRnVuY3Rpb24gZnVuY1xuICAgICAqIEByZXR1cm4gTWl4ZWRcbiAgICAgKi9cbiAgICB2YXIgcmVkdWNlciA9IGZ1bmN0aW9uIHJlZHVjZXIoaW5zdGFuY2UsIGZ1bmMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmMoaW5zdGFuY2UpO1xuICAgIH07XG4gICAgXG4gICAgLyoqXG4gICAgICogUmVnaXN0ZXIgYSBwcm92aWRlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBTdHJpbmcgZnVsbG5hbWVcbiAgICAgKiBAcGFyYW0gRnVuY3Rpb24gUHJvdmlkZXJcbiAgICAgKiBAcmV0dXJuIEJvdHRsZVxuICAgICAqL1xuICAgIHZhciBwcm92aWRlciA9IGZ1bmN0aW9uIHByb3ZpZGVyKGZ1bGxuYW1lLCBQcm92aWRlcikge1xuICAgICAgICB2YXIgcGFydHMsIG5hbWU7XG4gICAgICAgIHBhcnRzID0gZnVsbG5hbWUuc3BsaXQoJy4nKTtcbiAgICAgICAgaWYgKHRoaXMucHJvdmlkZXJNYXBbZnVsbG5hbWVdICYmIHBhcnRzLmxlbmd0aCA9PT0gMSAmJiAhdGhpcy5jb250YWluZXJbZnVsbG5hbWUgKyAnUHJvdmlkZXInXSkge1xuICAgICAgICAgICAgcmV0dXJuIGNvbnNvbGUuZXJyb3IoZnVsbG5hbWUgKyAnIHByb3ZpZGVyIGFscmVhZHkgaW5zdGFudGlhdGVkLicpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMub3JpZ2luYWxQcm92aWRlcnNbZnVsbG5hbWVdID0gUHJvdmlkZXI7XG4gICAgICAgIHRoaXMucHJvdmlkZXJNYXBbZnVsbG5hbWVdID0gdHJ1ZTtcbiAgICBcbiAgICAgICAgbmFtZSA9IHBhcnRzLnNoaWZ0KCk7XG4gICAgXG4gICAgICAgIGlmIChwYXJ0cy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGNyZWF0ZVN1YlByb3ZpZGVyLmNhbGwodGhpcywgbmFtZSwgUHJvdmlkZXIsIHBhcnRzKTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjcmVhdGVQcm92aWRlci5jYWxsKHRoaXMsIG5hbWUsIFByb3ZpZGVyKTtcbiAgICB9O1xuICAgIFxuICAgIC8qKlxuICAgICAqIEdldCBkZWNvcmF0b3JzIGFuZCBtaWRkbGV3YXJlIGluY2x1ZGluZyBnbG9iYWxzXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIGFycmF5XG4gICAgICovXG4gICAgdmFyIGdldFdpdGhHbG9iYWwgPSBmdW5jdGlvbiBnZXRXaXRoR2xvYmFsKGNvbGxlY3Rpb24sIG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIChjb2xsZWN0aW9uW25hbWVdIHx8IFtdKS5jb25jYXQoY29sbGVjdGlvbi5fX2dsb2JhbF9fIHx8IFtdKTtcbiAgICB9O1xuICAgIFxuICAgIC8qKlxuICAgICAqIENyZWF0ZSB0aGUgcHJvdmlkZXIgcHJvcGVydGllcyBvbiB0aGUgY29udGFpbmVyXG4gICAgICpcbiAgICAgKiBAcGFyYW0gU3RyaW5nIG5hbWVcbiAgICAgKiBAcGFyYW0gRnVuY3Rpb24gUHJvdmlkZXJcbiAgICAgKiBAcmV0dXJuIEJvdHRsZVxuICAgICAqL1xuICAgIHZhciBjcmVhdGVQcm92aWRlciA9IGZ1bmN0aW9uIGNyZWF0ZVByb3ZpZGVyKG5hbWUsIFByb3ZpZGVyKSB7XG4gICAgICAgIHZhciBwcm92aWRlck5hbWUsIHByb3BlcnRpZXMsIGNvbnRhaW5lciwgaWQsIGRlY29yYXRvcnMsIG1pZGRsZXdhcmVzO1xuICAgIFxuICAgICAgICBpZCA9IHRoaXMuaWQ7XG4gICAgICAgIGNvbnRhaW5lciA9IHRoaXMuY29udGFpbmVyO1xuICAgICAgICBkZWNvcmF0b3JzID0gdGhpcy5kZWNvcmF0b3JzO1xuICAgICAgICBtaWRkbGV3YXJlcyA9IHRoaXMubWlkZGxld2FyZXM7XG4gICAgICAgIHByb3ZpZGVyTmFtZSA9IG5hbWUgKyAnUHJvdmlkZXInO1xuICAgIFxuICAgICAgICBwcm9wZXJ0aWVzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICAgICAgcHJvcGVydGllc1twcm92aWRlck5hbWVdID0ge1xuICAgICAgICAgICAgY29uZmlndXJhYmxlIDogdHJ1ZSxcbiAgICAgICAgICAgIGVudW1lcmFibGUgOiB0cnVlLFxuICAgICAgICAgICAgZ2V0IDogZnVuY3Rpb24gZ2V0UHJvdmlkZXIoKSB7XG4gICAgICAgICAgICAgICAgdmFyIGluc3RhbmNlID0gbmV3IFByb3ZpZGVyKCk7XG4gICAgICAgICAgICAgICAgZGVsZXRlIGNvbnRhaW5lcltwcm92aWRlck5hbWVdO1xuICAgICAgICAgICAgICAgIGNvbnRhaW5lcltwcm92aWRlck5hbWVdID0gaW5zdGFuY2U7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGluc3RhbmNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIFxuICAgICAgICBwcm9wZXJ0aWVzW25hbWVdID0ge1xuICAgICAgICAgICAgY29uZmlndXJhYmxlIDogdHJ1ZSxcbiAgICAgICAgICAgIGVudW1lcmFibGUgOiB0cnVlLFxuICAgICAgICAgICAgZ2V0IDogZnVuY3Rpb24gZ2V0U2VydmljZSgpIHtcbiAgICAgICAgICAgICAgICB2YXIgcHJvdmlkZXIgPSBjb250YWluZXJbcHJvdmlkZXJOYW1lXTtcbiAgICAgICAgICAgICAgICB2YXIgaW5zdGFuY2U7XG4gICAgICAgICAgICAgICAgaWYgKHByb3ZpZGVyKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGZpbHRlciB0aHJvdWdoIGRlY29yYXRvcnNcbiAgICAgICAgICAgICAgICAgICAgaW5zdGFuY2UgPSBnZXRXaXRoR2xvYmFsKGRlY29yYXRvcnMsIG5hbWUpLnJlZHVjZShyZWR1Y2VyLCBwcm92aWRlci4kZ2V0KGNvbnRhaW5lcikpO1xuICAgIFxuICAgICAgICAgICAgICAgICAgICBkZWxldGUgY29udGFpbmVyW3Byb3ZpZGVyTmFtZV07XG4gICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBjb250YWluZXJbbmFtZV07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBpbnN0YW5jZSA9PT0gdW5kZWZpbmVkID8gaW5zdGFuY2UgOiBhcHBseU1pZGRsZXdhcmUoZ2V0V2l0aEdsb2JhbChtaWRkbGV3YXJlcywgbmFtZSksXG4gICAgICAgICAgICAgICAgICAgIG5hbWUsIGluc3RhbmNlLCBjb250YWluZXIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIFxuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyhjb250YWluZXIsIHByb3BlcnRpZXMpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9O1xuICAgIFxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBib3R0bGUgY29udGFpbmVyIG9uIHRoZSBjdXJyZW50IGJvdHRsZSBjb250YWluZXIsIGFuZCByZWdpc3RlcnNcbiAgICAgKiB0aGUgcHJvdmlkZXIgdW5kZXIgdGhlIHN1YiBjb250YWluZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gU3RyaW5nIG5hbWVcbiAgICAgKiBAcGFyYW0gRnVuY3Rpb24gUHJvdmlkZXJcbiAgICAgKiBAcGFyYW0gQXJyYXkgcGFydHNcbiAgICAgKiBAcmV0dXJuIEJvdHRsZVxuICAgICAqL1xuICAgIHZhciBjcmVhdGVTdWJQcm92aWRlciA9IGZ1bmN0aW9uIGNyZWF0ZVN1YlByb3ZpZGVyKG5hbWUsIFByb3ZpZGVyLCBwYXJ0cykge1xuICAgICAgICB2YXIgYm90dGxlO1xuICAgICAgICBib3R0bGUgPSBnZXROZXN0ZWRCb3R0bGUuY2FsbCh0aGlzLCBuYW1lKTtcbiAgICAgICAgdGhpcy5mYWN0b3J5KG5hbWUsIGZ1bmN0aW9uIFN1YlByb3ZpZGVyRmFjdG9yeSgpIHtcbiAgICAgICAgICAgIHJldHVybiBib3R0bGUuY29udGFpbmVyO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGJvdHRsZS5wcm92aWRlcihwYXJ0cy5qb2luKCcuJyksIFByb3ZpZGVyKTtcbiAgICB9O1xuICAgIFxuICAgIC8qKlxuICAgICAqIFJlZ2lzdGVyIGEgc2VydmljZSwgZmFjdG9yeSwgcHJvdmlkZXIsIG9yIHZhbHVlIGJhc2VkIG9uIHByb3BlcnRpZXMgb24gdGhlIG9iamVjdC5cbiAgICAgKlxuICAgICAqIHByb3BlcnRpZXM6XG4gICAgICogICogT2JqLiRuYW1lICAgU3RyaW5nIHJlcXVpcmVkIGV4OiBgJ1RoaW5nJ2BcbiAgICAgKiAgKiBPYmouJHR5cGUgICBTdHJpbmcgb3B0aW9uYWwgJ3NlcnZpY2UnLCAnZmFjdG9yeScsICdwcm92aWRlcicsICd2YWx1ZScuICBEZWZhdWx0OiAnc2VydmljZSdcbiAgICAgKiAgKiBPYmouJGluamVjdCBNaXhlZCAgb3B0aW9uYWwgb25seSB1c2VmdWwgd2l0aCAkdHlwZSAnc2VydmljZScgbmFtZSBvciBhcnJheSBvZiBuYW1lc1xuICAgICAqICAqIE9iai4kdmFsdWUgIE1peGVkICBvcHRpb25hbCBOb3JtYWxseSBPYmogaXMgcmVnaXN0ZXJlZCBvbiB0aGUgY29udGFpbmVyLiAgSG93ZXZlciwgaWYgdGhpc1xuICAgICAqICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eSBpcyBpbmNsdWRlZCwgaXQncyB2YWx1ZSB3aWxsIGJlIHJlZ2lzdGVyZWQgb24gdGhlIGNvbnRhaW5lclxuICAgICAqICAgICAgICAgICAgICAgICAgICAgICBpbnN0ZWFkIG9mIHRoZSBvYmplY3QgaXRzc2VsZi4gIFVzZWZ1bCBmb3IgcmVnaXN0ZXJpbmcgb2JqZWN0cyBvbiB0aGVcbiAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgYm90dGxlIGNvbnRhaW5lciB3aXRob3V0IG1vZGlmeWluZyB0aG9zZSBvYmplY3RzIHdpdGggYm90dGxlIHNwZWNpZmljIGtleXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gRnVuY3Rpb24gT2JqXG4gICAgICogQHJldHVybiBCb3R0bGVcbiAgICAgKi9cbiAgICB2YXIgcmVnaXN0ZXIgPSBmdW5jdGlvbiByZWdpc3RlcihPYmopIHtcbiAgICAgICAgdmFyIHZhbHVlID0gT2JqLiR2YWx1ZSA9PT0gdW5kZWZpbmVkID8gT2JqIDogT2JqLiR2YWx1ZTtcbiAgICAgICAgcmV0dXJuIHRoaXNbT2JqLiR0eXBlIHx8ICdzZXJ2aWNlJ10uYXBwbHkodGhpcywgW09iai4kbmFtZSwgdmFsdWVdLmNvbmNhdChPYmouJGluamVjdCB8fCBbXSkpO1xuICAgIH07XG4gICAgXG4gICAgLyoqXG4gICAgICogRGVsZXRlcyBwcm92aWRlcnMgZnJvbSB0aGUgbWFwIGFuZCBjb250YWluZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gU3RyaW5nIG5hbWVcbiAgICAgKiBAcmV0dXJuIHZvaWRcbiAgICAgKi9cbiAgICB2YXIgcmVtb3ZlUHJvdmlkZXJNYXAgPSBmdW5jdGlvbiByZXNldFByb3ZpZGVyKG5hbWUpIHtcbiAgICAgICAgZGVsZXRlIHRoaXMucHJvdmlkZXJNYXBbbmFtZV07XG4gICAgICAgIGRlbGV0ZSB0aGlzLmNvbnRhaW5lcltuYW1lXTtcbiAgICAgICAgZGVsZXRlIHRoaXMuY29udGFpbmVyW25hbWUgKyAnUHJvdmlkZXInXTtcbiAgICB9O1xuICAgIFxuICAgIC8qKlxuICAgICAqIFJlc2V0cyBhbGwgcHJvdmlkZXJzIG9uIGEgYm90dGxlIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHJldHVybiB2b2lkXG4gICAgICovXG4gICAgdmFyIHJlc2V0UHJvdmlkZXJzID0gZnVuY3Rpb24gcmVzZXRQcm92aWRlcnMoKSB7XG4gICAgICAgIHZhciBwcm92aWRlcnMgPSB0aGlzLm9yaWdpbmFsUHJvdmlkZXJzO1xuICAgICAgICBPYmplY3Qua2V5cyh0aGlzLm9yaWdpbmFsUHJvdmlkZXJzKS5mb3JFYWNoKGZ1bmN0aW9uIHJlc2V0UHJ2aWRlcihwcm92aWRlcikge1xuICAgICAgICAgICAgdmFyIHBhcnRzID0gcHJvdmlkZXIuc3BsaXQoJy4nKTtcbiAgICAgICAgICAgIGlmIChwYXJ0cy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICAgICAgcmVtb3ZlUHJvdmlkZXJNYXAuY2FsbCh0aGlzLCBwYXJ0c1swXSk7XG4gICAgICAgICAgICAgICAgcGFydHMuZm9yRWFjaChyZW1vdmVQcm92aWRlck1hcCwgZ2V0TmVzdGVkQm90dGxlLmNhbGwodGhpcywgcGFydHNbMF0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlbW92ZVByb3ZpZGVyTWFwLmNhbGwodGhpcywgcHJvdmlkZXIpO1xuICAgICAgICAgICAgdGhpcy5wcm92aWRlcihwcm92aWRlciwgcHJvdmlkZXJzW3Byb3ZpZGVyXSk7XG4gICAgICAgIH0sIHRoaXMpO1xuICAgIH07XG4gICAgXG4gICAgXG4gICAgLyoqXG4gICAgICogRXhlY3V0ZSBhbnkgZGVmZXJyZWQgZnVuY3Rpb25zXG4gICAgICpcbiAgICAgKiBAcGFyYW0gTWl4ZWQgZGF0YVxuICAgICAqIEByZXR1cm4gQm90dGxlXG4gICAgICovXG4gICAgdmFyIHJlc29sdmUgPSBmdW5jdGlvbiByZXNvbHZlKGRhdGEpIHtcbiAgICAgICAgdGhpcy5kZWZlcnJlZC5mb3JFYWNoKGZ1bmN0aW9uIGRlZmVycmVkSXRlcmF0b3IoZnVuYykge1xuICAgICAgICAgICAgZnVuYyhkYXRhKTtcbiAgICAgICAgfSk7XG4gICAgXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG4gICAgXG4gICAgLyoqXG4gICAgICogUmVnaXN0ZXIgYSBzZXJ2aWNlIGluc2lkZSBhIGdlbmVyaWMgZmFjdG9yeS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBTdHJpbmcgbmFtZVxuICAgICAqIEBwYXJhbSBGdW5jdGlvbiBTZXJ2aWNlXG4gICAgICogQHJldHVybiBCb3R0bGVcbiAgICAgKi9cbiAgICB2YXIgc2VydmljZSA9IGZ1bmN0aW9uIHNlcnZpY2UobmFtZSwgU2VydmljZSkge1xuICAgICAgICB2YXIgZGVwcyA9IGFyZ3VtZW50cy5sZW5ndGggPiAyID8gc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpIDogbnVsbDtcbiAgICAgICAgdmFyIGJvdHRsZSA9IHRoaXM7XG4gICAgICAgIHJldHVybiBmYWN0b3J5LmNhbGwodGhpcywgbmFtZSwgZnVuY3Rpb24gR2VuZXJpY0ZhY3RvcnkoKSB7XG4gICAgICAgICAgICB2YXIgU2VydmljZUNvcHkgPSBTZXJ2aWNlO1xuICAgICAgICAgICAgaWYgKGRlcHMpIHtcbiAgICAgICAgICAgICAgICB2YXIgYXJncyA9IGRlcHMubWFwKGdldE5lc3RlZFNlcnZpY2UsIGJvdHRsZS5jb250YWluZXIpO1xuICAgICAgICAgICAgICAgIGFyZ3MudW5zaGlmdChTZXJ2aWNlKTtcbiAgICAgICAgICAgICAgICBTZXJ2aWNlQ29weSA9IFNlcnZpY2UuYmluZC5hcHBseShTZXJ2aWNlLCBhcmdzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBuZXcgU2VydmljZUNvcHkoKTtcbiAgICAgICAgfSk7XG4gICAgfTtcbiAgICBcbiAgICAvKipcbiAgICAgKiBSZWdpc3RlciBhIHZhbHVlXG4gICAgICpcbiAgICAgKiBAcGFyYW0gU3RyaW5nIG5hbWVcbiAgICAgKiBAcGFyYW0gbWl4ZWQgdmFsXG4gICAgICogQHJldHVybiBCb3R0bGVcbiAgICAgKi9cbiAgICB2YXIgdmFsdWUgPSBmdW5jdGlvbiB2YWx1ZShuYW1lLCB2YWwpIHtcbiAgICAgICAgdmFyIHBhcnRzO1xuICAgICAgICBwYXJ0cyA9IG5hbWUuc3BsaXQoJy4nKTtcbiAgICAgICAgbmFtZSA9IHBhcnRzLnBvcCgpO1xuICAgICAgICBkZWZpbmVWYWx1ZS5jYWxsKHBhcnRzLnJlZHVjZShzZXRWYWx1ZU9iamVjdCwgdGhpcy5jb250YWluZXIpLCBuYW1lLCB2YWwpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9O1xuICAgIFxuICAgIC8qKlxuICAgICAqIEl0ZXJhdG9yIGZvciBzZXR0aW5nIGEgcGxhaW4gb2JqZWN0IGxpdGVyYWwgdmlhIGRlZmluZVZhbHVlXG4gICAgICpcbiAgICAgKiBAcGFyYW0gT2JqZWN0IGNvbnRhaW5lclxuICAgICAqIEBwYXJhbSBzdHJpbmcgbmFtZVxuICAgICAqL1xuICAgIHZhciBzZXRWYWx1ZU9iamVjdCA9IGZ1bmN0aW9uIHNldFZhbHVlT2JqZWN0KGNvbnRhaW5lciwgbmFtZSkge1xuICAgICAgICB2YXIgbmVzdGVkQ29udGFpbmVyID0gY29udGFpbmVyW25hbWVdO1xuICAgICAgICBpZiAoIW5lc3RlZENvbnRhaW5lcikge1xuICAgICAgICAgICAgbmVzdGVkQ29udGFpbmVyID0ge307XG4gICAgICAgICAgICBkZWZpbmVWYWx1ZS5jYWxsKGNvbnRhaW5lciwgbmFtZSwgbmVzdGVkQ29udGFpbmVyKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbmVzdGVkQ29udGFpbmVyO1xuICAgIH07XG4gICAgXG4gICAgLyoqXG4gICAgICogRGVmaW5lIGEgbXV0YWJsZSBwcm9wZXJ0eSBvbiB0aGUgY29udGFpbmVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIFN0cmluZyBuYW1lXG4gICAgICogQHBhcmFtIG1peGVkIHZhbFxuICAgICAqIEByZXR1cm4gdm9pZFxuICAgICAqIEBzY29wZSBjb250YWluZXJcbiAgICAgKi9cbiAgICB2YXIgZGVmaW5lVmFsdWUgPSBmdW5jdGlvbiBkZWZpbmVWYWx1ZShuYW1lLCB2YWwpIHtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIG5hbWUsIHtcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZSA6IHRydWUsXG4gICAgICAgICAgICBlbnVtZXJhYmxlIDogdHJ1ZSxcbiAgICAgICAgICAgIHZhbHVlIDogdmFsLFxuICAgICAgICAgICAgd3JpdGFibGUgOiB0cnVlXG4gICAgICAgIH0pO1xuICAgIH07XG4gICAgXG4gICAgXG4gICAgLyoqXG4gICAgICogQm90dGxlIGNvbnN0cnVjdG9yXG4gICAgICpcbiAgICAgKiBAcGFyYW0gU3RyaW5nIG5hbWUgT3B0aW9uYWwgbmFtZSBmb3IgZnVuY3Rpb25hbCBjb25zdHJ1Y3Rpb25cbiAgICAgKi9cbiAgICB2YXIgQm90dGxlID0gZnVuY3Rpb24gQm90dGxlKG5hbWUpIHtcbiAgICAgICAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIEJvdHRsZSkpIHtcbiAgICAgICAgICAgIHJldHVybiBCb3R0bGUucG9wKG5hbWUpO1xuICAgICAgICB9XG4gICAgXG4gICAgICAgIHRoaXMuaWQgPSBpZCsrO1xuICAgIFxuICAgICAgICB0aGlzLmRlY29yYXRvcnMgPSB7fTtcbiAgICAgICAgdGhpcy5taWRkbGV3YXJlcyA9IHt9O1xuICAgICAgICB0aGlzLm5lc3RlZCA9IHt9O1xuICAgICAgICB0aGlzLnByb3ZpZGVyTWFwID0ge307XG4gICAgICAgIHRoaXMub3JpZ2luYWxQcm92aWRlcnMgPSB7fTtcbiAgICAgICAgdGhpcy5kZWZlcnJlZCA9IFtdO1xuICAgICAgICB0aGlzLmNvbnRhaW5lciA9IHtcbiAgICAgICAgICAgICRkZWNvcmF0b3IgOiBkZWNvcmF0b3IuYmluZCh0aGlzKSxcbiAgICAgICAgICAgICRyZWdpc3RlciA6IHJlZ2lzdGVyLmJpbmQodGhpcyksXG4gICAgICAgICAgICAkbGlzdCA6IGxpc3QuYmluZCh0aGlzKVxuICAgICAgICB9O1xuICAgIH07XG4gICAgXG4gICAgLyoqXG4gICAgICogQm90dGxlIHByb3RvdHlwZVxuICAgICAqL1xuICAgIEJvdHRsZS5wcm90b3R5cGUgPSB7XG4gICAgICAgIGNvbnN0YW50IDogY29uc3RhbnQsXG4gICAgICAgIGRlY29yYXRvciA6IGRlY29yYXRvcixcbiAgICAgICAgZGVmZXIgOiBkZWZlcixcbiAgICAgICAgZGlnZXN0IDogZGlnZXN0LFxuICAgICAgICBmYWN0b3J5IDogZmFjdG9yeSxcbiAgICAgICAgaW5zdGFuY2VGYWN0b3J5OiBpbnN0YW5jZUZhY3RvcnksXG4gICAgICAgIGxpc3QgOiBsaXN0LFxuICAgICAgICBtaWRkbGV3YXJlIDogbWlkZGxld2FyZSxcbiAgICAgICAgcHJvdmlkZXIgOiBwcm92aWRlcixcbiAgICAgICAgcmVzZXRQcm92aWRlcnMgOiByZXNldFByb3ZpZGVycyxcbiAgICAgICAgcmVnaXN0ZXIgOiByZWdpc3RlcixcbiAgICAgICAgcmVzb2x2ZSA6IHJlc29sdmUsXG4gICAgICAgIHNlcnZpY2UgOiBzZXJ2aWNlLFxuICAgICAgICB2YWx1ZSA6IHZhbHVlXG4gICAgfTtcbiAgICBcbiAgICAvKipcbiAgICAgKiBCb3R0bGUgc3RhdGljXG4gICAgICovXG4gICAgQm90dGxlLnBvcCA9IHBvcDtcbiAgICBCb3R0bGUuY2xlYXIgPSBjbGVhcjtcbiAgICBCb3R0bGUubGlzdCA9IGxpc3Q7XG4gICAgXG4gICAgLyoqXG4gICAgICogR2xvYmFsIGNvbmZpZ1xuICAgICAqL1xuICAgIHZhciBnbG9iYWxDb25maWcgPSBCb3R0bGUuY29uZmlnID0ge1xuICAgICAgICBzdHJpY3QgOiBmYWxzZVxuICAgIH07XG4gICAgXG4gICAgLyoqXG4gICAgICogRXhwb3J0cyBzY3JpcHQgYWRhcHRlZCBmcm9tIGxvZGFzaCB2Mi40LjEgTW9kZXJuIEJ1aWxkXG4gICAgICpcbiAgICAgKiBAc2VlIGh0dHA6Ly9sb2Rhc2guY29tL1xuICAgICAqL1xuICAgIFxuICAgIC8qKlxuICAgICAqIFZhbGlkIG9iamVjdCB0eXBlIG1hcFxuICAgICAqXG4gICAgICogQHR5cGUgT2JqZWN0XG4gICAgICovXG4gICAgdmFyIG9iamVjdFR5cGVzID0ge1xuICAgICAgICAnZnVuY3Rpb24nIDogdHJ1ZSxcbiAgICAgICAgJ29iamVjdCcgOiB0cnVlXG4gICAgfTtcbiAgICBcbiAgICAoZnVuY3Rpb24gZXhwb3J0Qm90dGxlKHJvb3QpIHtcbiAgICBcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEZyZWUgdmFyaWFibGUgZXhwb3J0c1xuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSBGdW5jdGlvblxuICAgICAgICAgKi9cbiAgICAgICAgdmFyIGZyZWVFeHBvcnRzID0gb2JqZWN0VHlwZXNbdHlwZW9mIGV4cG9ydHNdICYmIGV4cG9ydHMgJiYgIWV4cG9ydHMubm9kZVR5cGUgJiYgZXhwb3J0cztcbiAgICBcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEZyZWUgdmFyaWFibGUgbW9kdWxlXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIE9iamVjdFxuICAgICAgICAgKi9cbiAgICAgICAgdmFyIGZyZWVNb2R1bGUgPSBvYmplY3RUeXBlc1t0eXBlb2YgbW9kdWxlXSAmJiBtb2R1bGUgJiYgIW1vZHVsZS5ub2RlVHlwZSAmJiBtb2R1bGU7XG4gICAgXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDb21tb25KUyBtb2R1bGUuZXhwb3J0c1xuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSBGdW5jdGlvblxuICAgICAgICAgKi9cbiAgICAgICAgdmFyIG1vZHVsZUV4cG9ydHMgPSBmcmVlTW9kdWxlICYmIGZyZWVNb2R1bGUuZXhwb3J0cyA9PT0gZnJlZUV4cG9ydHMgJiYgZnJlZUV4cG9ydHM7XG4gICAgXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBGcmVlIHZhcmlhYmxlIGBnbG9iYWxgXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIE9iamVjdFxuICAgICAgICAgKi9cbiAgICAgICAgdmFyIGZyZWVHbG9iYWwgPSBvYmplY3RUeXBlc1t0eXBlb2YgZ2xvYmFsXSAmJiBnbG9iYWw7XG4gICAgICAgIGlmIChmcmVlR2xvYmFsICYmIChmcmVlR2xvYmFsLmdsb2JhbCA9PT0gZnJlZUdsb2JhbCB8fCBmcmVlR2xvYmFsLndpbmRvdyA9PT0gZnJlZUdsb2JhbCkpIHtcbiAgICAgICAgICAgIHJvb3QgPSBmcmVlR2xvYmFsO1xuICAgICAgICB9XG4gICAgXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBFeHBvcnRcbiAgICAgICAgICovXG4gICAgICAgIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIHR5cGVvZiBkZWZpbmUuYW1kID09PSAnb2JqZWN0JyAmJiBkZWZpbmUuYW1kKSB7XG4gICAgICAgICAgICByb290LkJvdHRsZSA9IEJvdHRsZTtcbiAgICAgICAgICAgIGRlZmluZShmdW5jdGlvbigpIHsgcmV0dXJuIEJvdHRsZTsgfSk7XG4gICAgICAgIH0gZWxzZSBpZiAoZnJlZUV4cG9ydHMgJiYgZnJlZU1vZHVsZSkge1xuICAgICAgICAgICAgaWYgKG1vZHVsZUV4cG9ydHMpIHtcbiAgICAgICAgICAgICAgICAoZnJlZU1vZHVsZS5leHBvcnRzID0gQm90dGxlKS5Cb3R0bGUgPSBCb3R0bGU7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGZyZWVFeHBvcnRzLkJvdHRsZSA9IEJvdHRsZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJvb3QuQm90dGxlID0gQm90dGxlO1xuICAgICAgICB9XG4gICAgfSgob2JqZWN0VHlwZXNbdHlwZW9mIHdpbmRvd10gJiYgd2luZG93KSB8fCB0aGlzKSk7XG4gICAgXG59LmNhbGwodGhpcykpOyIsIid1c2Ugc3RyaWN0JztcblxudmFyIGFzc2lnbiAgICAgICAgPSByZXF1aXJlKCdlczUtZXh0L29iamVjdC9hc3NpZ24nKVxuICAsIG5vcm1hbGl6ZU9wdHMgPSByZXF1aXJlKCdlczUtZXh0L29iamVjdC9ub3JtYWxpemUtb3B0aW9ucycpXG4gICwgaXNDYWxsYWJsZSAgICA9IHJlcXVpcmUoJ2VzNS1leHQvb2JqZWN0L2lzLWNhbGxhYmxlJylcbiAgLCBjb250YWlucyAgICAgID0gcmVxdWlyZSgnZXM1LWV4dC9zdHJpbmcvIy9jb250YWlucycpXG5cbiAgLCBkO1xuXG5kID0gbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoZHNjciwgdmFsdWUvKiwgb3B0aW9ucyovKSB7XG5cdHZhciBjLCBlLCB3LCBvcHRpb25zLCBkZXNjO1xuXHRpZiAoKGFyZ3VtZW50cy5sZW5ndGggPCAyKSB8fCAodHlwZW9mIGRzY3IgIT09ICdzdHJpbmcnKSkge1xuXHRcdG9wdGlvbnMgPSB2YWx1ZTtcblx0XHR2YWx1ZSA9IGRzY3I7XG5cdFx0ZHNjciA9IG51bGw7XG5cdH0gZWxzZSB7XG5cdFx0b3B0aW9ucyA9IGFyZ3VtZW50c1syXTtcblx0fVxuXHRpZiAoZHNjciA9PSBudWxsKSB7XG5cdFx0YyA9IHcgPSB0cnVlO1xuXHRcdGUgPSBmYWxzZTtcblx0fSBlbHNlIHtcblx0XHRjID0gY29udGFpbnMuY2FsbChkc2NyLCAnYycpO1xuXHRcdGUgPSBjb250YWlucy5jYWxsKGRzY3IsICdlJyk7XG5cdFx0dyA9IGNvbnRhaW5zLmNhbGwoZHNjciwgJ3cnKTtcblx0fVxuXG5cdGRlc2MgPSB7IHZhbHVlOiB2YWx1ZSwgY29uZmlndXJhYmxlOiBjLCBlbnVtZXJhYmxlOiBlLCB3cml0YWJsZTogdyB9O1xuXHRyZXR1cm4gIW9wdGlvbnMgPyBkZXNjIDogYXNzaWduKG5vcm1hbGl6ZU9wdHMob3B0aW9ucyksIGRlc2MpO1xufTtcblxuZC5ncyA9IGZ1bmN0aW9uIChkc2NyLCBnZXQsIHNldC8qLCBvcHRpb25zKi8pIHtcblx0dmFyIGMsIGUsIG9wdGlvbnMsIGRlc2M7XG5cdGlmICh0eXBlb2YgZHNjciAhPT0gJ3N0cmluZycpIHtcblx0XHRvcHRpb25zID0gc2V0O1xuXHRcdHNldCA9IGdldDtcblx0XHRnZXQgPSBkc2NyO1xuXHRcdGRzY3IgPSBudWxsO1xuXHR9IGVsc2Uge1xuXHRcdG9wdGlvbnMgPSBhcmd1bWVudHNbM107XG5cdH1cblx0aWYgKGdldCA9PSBudWxsKSB7XG5cdFx0Z2V0ID0gdW5kZWZpbmVkO1xuXHR9IGVsc2UgaWYgKCFpc0NhbGxhYmxlKGdldCkpIHtcblx0XHRvcHRpb25zID0gZ2V0O1xuXHRcdGdldCA9IHNldCA9IHVuZGVmaW5lZDtcblx0fSBlbHNlIGlmIChzZXQgPT0gbnVsbCkge1xuXHRcdHNldCA9IHVuZGVmaW5lZDtcblx0fSBlbHNlIGlmICghaXNDYWxsYWJsZShzZXQpKSB7XG5cdFx0b3B0aW9ucyA9IHNldDtcblx0XHRzZXQgPSB1bmRlZmluZWQ7XG5cdH1cblx0aWYgKGRzY3IgPT0gbnVsbCkge1xuXHRcdGMgPSB0cnVlO1xuXHRcdGUgPSBmYWxzZTtcblx0fSBlbHNlIHtcblx0XHRjID0gY29udGFpbnMuY2FsbChkc2NyLCAnYycpO1xuXHRcdGUgPSBjb250YWlucy5jYWxsKGRzY3IsICdlJyk7XG5cdH1cblxuXHRkZXNjID0geyBnZXQ6IGdldCwgc2V0OiBzZXQsIGNvbmZpZ3VyYWJsZTogYywgZW51bWVyYWJsZTogZSB9O1xuXHRyZXR1cm4gIW9wdGlvbnMgPyBkZXNjIDogYXNzaWduKG5vcm1hbGl6ZU9wdHMob3B0aW9ucyksIGRlc2MpO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2lzLWltcGxlbWVudGVkJykoKVxuXHQ/IE9iamVjdC5hc3NpZ25cblx0OiByZXF1aXJlKCcuL3NoaW0nKTtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoKSB7XG5cdHZhciBhc3NpZ24gPSBPYmplY3QuYXNzaWduLCBvYmo7XG5cdGlmICh0eXBlb2YgYXNzaWduICE9PSAnZnVuY3Rpb24nKSByZXR1cm4gZmFsc2U7XG5cdG9iaiA9IHsgZm9vOiAncmF6JyB9O1xuXHRhc3NpZ24ob2JqLCB7IGJhcjogJ2R3YScgfSwgeyB0cnp5OiAndHJ6eScgfSk7XG5cdHJldHVybiAob2JqLmZvbyArIG9iai5iYXIgKyBvYmoudHJ6eSkgPT09ICdyYXpkd2F0cnp5Jztcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBrZXlzICA9IHJlcXVpcmUoJy4uL2tleXMnKVxuICAsIHZhbHVlID0gcmVxdWlyZSgnLi4vdmFsaWQtdmFsdWUnKVxuXG4gICwgbWF4ID0gTWF0aC5tYXg7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGRlc3QsIHNyYy8qLCDigKZzcmNuKi8pIHtcblx0dmFyIGVycm9yLCBpLCBsID0gbWF4KGFyZ3VtZW50cy5sZW5ndGgsIDIpLCBhc3NpZ247XG5cdGRlc3QgPSBPYmplY3QodmFsdWUoZGVzdCkpO1xuXHRhc3NpZ24gPSBmdW5jdGlvbiAoa2V5KSB7XG5cdFx0dHJ5IHsgZGVzdFtrZXldID0gc3JjW2tleV07IH0gY2F0Y2ggKGUpIHtcblx0XHRcdGlmICghZXJyb3IpIGVycm9yID0gZTtcblx0XHR9XG5cdH07XG5cdGZvciAoaSA9IDE7IGkgPCBsOyArK2kpIHtcblx0XHRzcmMgPSBhcmd1bWVudHNbaV07XG5cdFx0a2V5cyhzcmMpLmZvckVhY2goYXNzaWduKTtcblx0fVxuXHRpZiAoZXJyb3IgIT09IHVuZGVmaW5lZCkgdGhyb3cgZXJyb3I7XG5cdHJldHVybiBkZXN0O1xufTtcbiIsIi8vIERlcHJlY2F0ZWRcblxuJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChvYmopIHsgcmV0dXJuIHR5cGVvZiBvYmogPT09ICdmdW5jdGlvbic7IH07XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9pcy1pbXBsZW1lbnRlZCcpKClcblx0PyBPYmplY3Qua2V5c1xuXHQ6IHJlcXVpcmUoJy4vc2hpbScpO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uICgpIHtcblx0dHJ5IHtcblx0XHRPYmplY3Qua2V5cygncHJpbWl0aXZlJyk7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH0gY2F0Y2ggKGUpIHsgcmV0dXJuIGZhbHNlOyB9XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIga2V5cyA9IE9iamVjdC5rZXlzO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChvYmplY3QpIHtcblx0cmV0dXJuIGtleXMob2JqZWN0ID09IG51bGwgPyBvYmplY3QgOiBPYmplY3Qob2JqZWN0KSk7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgZm9yRWFjaCA9IEFycmF5LnByb3RvdHlwZS5mb3JFYWNoLCBjcmVhdGUgPSBPYmplY3QuY3JlYXRlO1xuXG52YXIgcHJvY2VzcyA9IGZ1bmN0aW9uIChzcmMsIG9iaikge1xuXHR2YXIga2V5O1xuXHRmb3IgKGtleSBpbiBzcmMpIG9ialtrZXldID0gc3JjW2tleV07XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChvcHRpb25zLyosIOKApm9wdGlvbnMqLykge1xuXHR2YXIgcmVzdWx0ID0gY3JlYXRlKG51bGwpO1xuXHRmb3JFYWNoLmNhbGwoYXJndW1lbnRzLCBmdW5jdGlvbiAob3B0aW9ucykge1xuXHRcdGlmIChvcHRpb25zID09IG51bGwpIHJldHVybjtcblx0XHRwcm9jZXNzKE9iamVjdChvcHRpb25zKSwgcmVzdWx0KTtcblx0fSk7XG5cdHJldHVybiByZXN1bHQ7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChmbikge1xuXHRpZiAodHlwZW9mIGZuICE9PSAnZnVuY3Rpb24nKSB0aHJvdyBuZXcgVHlwZUVycm9yKGZuICsgXCIgaXMgbm90IGEgZnVuY3Rpb25cIik7XG5cdHJldHVybiBmbjtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKHZhbHVlKSB7XG5cdGlmICh2YWx1ZSA9PSBudWxsKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IHVzZSBudWxsIG9yIHVuZGVmaW5lZFwiKTtcblx0cmV0dXJuIHZhbHVlO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2lzLWltcGxlbWVudGVkJykoKVxuXHQ/IFN0cmluZy5wcm90b3R5cGUuY29udGFpbnNcblx0OiByZXF1aXJlKCcuL3NoaW0nKTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHN0ciA9ICdyYXpkd2F0cnp5JztcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoKSB7XG5cdGlmICh0eXBlb2Ygc3RyLmNvbnRhaW5zICE9PSAnZnVuY3Rpb24nKSByZXR1cm4gZmFsc2U7XG5cdHJldHVybiAoKHN0ci5jb250YWlucygnZHdhJykgPT09IHRydWUpICYmIChzdHIuY29udGFpbnMoJ2ZvbycpID09PSBmYWxzZSkpO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGluZGV4T2YgPSBTdHJpbmcucHJvdG90eXBlLmluZGV4T2Y7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKHNlYXJjaFN0cmluZy8qLCBwb3NpdGlvbiovKSB7XG5cdHJldHVybiBpbmRleE9mLmNhbGwodGhpcywgc2VhcmNoU3RyaW5nLCBhcmd1bWVudHNbMV0pID4gLTE7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgZCAgICAgICAgPSByZXF1aXJlKCdkJylcbiAgLCBjYWxsYWJsZSA9IHJlcXVpcmUoJ2VzNS1leHQvb2JqZWN0L3ZhbGlkLWNhbGxhYmxlJylcblxuICAsIGFwcGx5ID0gRnVuY3Rpb24ucHJvdG90eXBlLmFwcGx5LCBjYWxsID0gRnVuY3Rpb24ucHJvdG90eXBlLmNhbGxcbiAgLCBjcmVhdGUgPSBPYmplY3QuY3JlYXRlLCBkZWZpbmVQcm9wZXJ0eSA9IE9iamVjdC5kZWZpbmVQcm9wZXJ0eVxuICAsIGRlZmluZVByb3BlcnRpZXMgPSBPYmplY3QuZGVmaW5lUHJvcGVydGllc1xuICAsIGhhc093blByb3BlcnR5ID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eVxuICAsIGRlc2NyaXB0b3IgPSB7IGNvbmZpZ3VyYWJsZTogdHJ1ZSwgZW51bWVyYWJsZTogZmFsc2UsIHdyaXRhYmxlOiB0cnVlIH1cblxuICAsIG9uLCBvbmNlLCBvZmYsIGVtaXQsIG1ldGhvZHMsIGRlc2NyaXB0b3JzLCBiYXNlO1xuXG5vbiA9IGZ1bmN0aW9uICh0eXBlLCBsaXN0ZW5lcikge1xuXHR2YXIgZGF0YTtcblxuXHRjYWxsYWJsZShsaXN0ZW5lcik7XG5cblx0aWYgKCFoYXNPd25Qcm9wZXJ0eS5jYWxsKHRoaXMsICdfX2VlX18nKSkge1xuXHRcdGRhdGEgPSBkZXNjcmlwdG9yLnZhbHVlID0gY3JlYXRlKG51bGwpO1xuXHRcdGRlZmluZVByb3BlcnR5KHRoaXMsICdfX2VlX18nLCBkZXNjcmlwdG9yKTtcblx0XHRkZXNjcmlwdG9yLnZhbHVlID0gbnVsbDtcblx0fSBlbHNlIHtcblx0XHRkYXRhID0gdGhpcy5fX2VlX187XG5cdH1cblx0aWYgKCFkYXRhW3R5cGVdKSBkYXRhW3R5cGVdID0gbGlzdGVuZXI7XG5cdGVsc2UgaWYgKHR5cGVvZiBkYXRhW3R5cGVdID09PSAnb2JqZWN0JykgZGF0YVt0eXBlXS5wdXNoKGxpc3RlbmVyKTtcblx0ZWxzZSBkYXRhW3R5cGVdID0gW2RhdGFbdHlwZV0sIGxpc3RlbmVyXTtcblxuXHRyZXR1cm4gdGhpcztcbn07XG5cbm9uY2UgPSBmdW5jdGlvbiAodHlwZSwgbGlzdGVuZXIpIHtcblx0dmFyIG9uY2UsIHNlbGY7XG5cblx0Y2FsbGFibGUobGlzdGVuZXIpO1xuXHRzZWxmID0gdGhpcztcblx0b24uY2FsbCh0aGlzLCB0eXBlLCBvbmNlID0gZnVuY3Rpb24gKCkge1xuXHRcdG9mZi5jYWxsKHNlbGYsIHR5cGUsIG9uY2UpO1xuXHRcdGFwcGx5LmNhbGwobGlzdGVuZXIsIHRoaXMsIGFyZ3VtZW50cyk7XG5cdH0pO1xuXG5cdG9uY2UuX19lZU9uY2VMaXN0ZW5lcl9fID0gbGlzdGVuZXI7XG5cdHJldHVybiB0aGlzO1xufTtcblxub2ZmID0gZnVuY3Rpb24gKHR5cGUsIGxpc3RlbmVyKSB7XG5cdHZhciBkYXRhLCBsaXN0ZW5lcnMsIGNhbmRpZGF0ZSwgaTtcblxuXHRjYWxsYWJsZShsaXN0ZW5lcik7XG5cblx0aWYgKCFoYXNPd25Qcm9wZXJ0eS5jYWxsKHRoaXMsICdfX2VlX18nKSkgcmV0dXJuIHRoaXM7XG5cdGRhdGEgPSB0aGlzLl9fZWVfXztcblx0aWYgKCFkYXRhW3R5cGVdKSByZXR1cm4gdGhpcztcblx0bGlzdGVuZXJzID0gZGF0YVt0eXBlXTtcblxuXHRpZiAodHlwZW9mIGxpc3RlbmVycyA9PT0gJ29iamVjdCcpIHtcblx0XHRmb3IgKGkgPSAwOyAoY2FuZGlkYXRlID0gbGlzdGVuZXJzW2ldKTsgKytpKSB7XG5cdFx0XHRpZiAoKGNhbmRpZGF0ZSA9PT0gbGlzdGVuZXIpIHx8XG5cdFx0XHRcdFx0KGNhbmRpZGF0ZS5fX2VlT25jZUxpc3RlbmVyX18gPT09IGxpc3RlbmVyKSkge1xuXHRcdFx0XHRpZiAobGlzdGVuZXJzLmxlbmd0aCA9PT0gMikgZGF0YVt0eXBlXSA9IGxpc3RlbmVyc1tpID8gMCA6IDFdO1xuXHRcdFx0XHRlbHNlIGxpc3RlbmVycy5zcGxpY2UoaSwgMSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9IGVsc2Uge1xuXHRcdGlmICgobGlzdGVuZXJzID09PSBsaXN0ZW5lcikgfHxcblx0XHRcdFx0KGxpc3RlbmVycy5fX2VlT25jZUxpc3RlbmVyX18gPT09IGxpc3RlbmVyKSkge1xuXHRcdFx0ZGVsZXRlIGRhdGFbdHlwZV07XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIHRoaXM7XG59O1xuXG5lbWl0ID0gZnVuY3Rpb24gKHR5cGUpIHtcblx0dmFyIGksIGwsIGxpc3RlbmVyLCBsaXN0ZW5lcnMsIGFyZ3M7XG5cblx0aWYgKCFoYXNPd25Qcm9wZXJ0eS5jYWxsKHRoaXMsICdfX2VlX18nKSkgcmV0dXJuO1xuXHRsaXN0ZW5lcnMgPSB0aGlzLl9fZWVfX1t0eXBlXTtcblx0aWYgKCFsaXN0ZW5lcnMpIHJldHVybjtcblxuXHRpZiAodHlwZW9mIGxpc3RlbmVycyA9PT0gJ29iamVjdCcpIHtcblx0XHRsID0gYXJndW1lbnRzLmxlbmd0aDtcblx0XHRhcmdzID0gbmV3IEFycmF5KGwgLSAxKTtcblx0XHRmb3IgKGkgPSAxOyBpIDwgbDsgKytpKSBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcblxuXHRcdGxpc3RlbmVycyA9IGxpc3RlbmVycy5zbGljZSgpO1xuXHRcdGZvciAoaSA9IDA7IChsaXN0ZW5lciA9IGxpc3RlbmVyc1tpXSk7ICsraSkge1xuXHRcdFx0YXBwbHkuY2FsbChsaXN0ZW5lciwgdGhpcywgYXJncyk7XG5cdFx0fVxuXHR9IGVsc2Uge1xuXHRcdHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuXHRcdGNhc2UgMTpcblx0XHRcdGNhbGwuY2FsbChsaXN0ZW5lcnMsIHRoaXMpO1xuXHRcdFx0YnJlYWs7XG5cdFx0Y2FzZSAyOlxuXHRcdFx0Y2FsbC5jYWxsKGxpc3RlbmVycywgdGhpcywgYXJndW1lbnRzWzFdKTtcblx0XHRcdGJyZWFrO1xuXHRcdGNhc2UgMzpcblx0XHRcdGNhbGwuY2FsbChsaXN0ZW5lcnMsIHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcblx0XHRcdGJyZWFrO1xuXHRcdGRlZmF1bHQ6XG5cdFx0XHRsID0gYXJndW1lbnRzLmxlbmd0aDtcblx0XHRcdGFyZ3MgPSBuZXcgQXJyYXkobCAtIDEpO1xuXHRcdFx0Zm9yIChpID0gMTsgaSA8IGw7ICsraSkge1xuXHRcdFx0XHRhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcblx0XHRcdH1cblx0XHRcdGFwcGx5LmNhbGwobGlzdGVuZXJzLCB0aGlzLCBhcmdzKTtcblx0XHR9XG5cdH1cbn07XG5cbm1ldGhvZHMgPSB7XG5cdG9uOiBvbixcblx0b25jZTogb25jZSxcblx0b2ZmOiBvZmYsXG5cdGVtaXQ6IGVtaXRcbn07XG5cbmRlc2NyaXB0b3JzID0ge1xuXHRvbjogZChvbiksXG5cdG9uY2U6IGQob25jZSksXG5cdG9mZjogZChvZmYpLFxuXHRlbWl0OiBkKGVtaXQpXG59O1xuXG5iYXNlID0gZGVmaW5lUHJvcGVydGllcyh7fSwgZGVzY3JpcHRvcnMpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGV4cG9ydHMgPSBmdW5jdGlvbiAobykge1xuXHRyZXR1cm4gKG8gPT0gbnVsbCkgPyBjcmVhdGUoYmFzZSkgOiBkZWZpbmVQcm9wZXJ0aWVzKE9iamVjdChvKSwgZGVzY3JpcHRvcnMpO1xufTtcbmV4cG9ydHMubWV0aG9kcyA9IG1ldGhvZHM7XG4iLCJjb25zdCBndWlkID0gcmVxdWlyZSgnLi9ndWlkJyk7XG5jb25zdCBjb250YWluZXIgPSByZXF1aXJlKCcuL2NvbnRhaW5lcicpO1xuY29uc3QgZWUgPSByZXF1aXJlKCdldmVudC1lbWl0dGVyJyk7XG5cbmNvbnN0IGNsb25lID0gKG9iaikgPT4ge1xuXHRjb25zdCBjID0ge307XG5cdGZvciAobGV0IGtleSBpbiBvYmopIHtcblx0XHRjW2tleV0gPSBvYmpba2V5XTtcblx0fVxuXHRyZXR1cm4gYztcbn07XG5cbmNsYXNzIEFwcCB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHRoaXMubWFwID0ge307XG5cdFx0dGhpcy5fc3RhcnRNYXAgPSB7fTtcblx0XHR0aGlzLl9kZXN0cm95TWFwID0ge307XG5cblx0XHR0aGlzLnJlbmRlcmVyID0gY29udGFpbmVyLnJlbmRlcmVyO1xuXHRcdHRoaXMuYW5pbWF0ZSA9IHRoaXMuYW5pbWF0ZS5iaW5kKHRoaXMpO1xuXHRcdFxuXHRcdHRoaXMudGltZSA9IDA7XG5cdFx0dGhpcy5kZWx0YVRpbWUgPSAxMDAwIC8gNjA7XG5cblx0XHRjb250YWluZXIuYXBwID0gdGhpcztcblx0fVxuXG5cdGFkZCh0eXBlLCBwcm9wcykge1xuXHRcdGNvbnN0IGNvbXBvbmVudCA9IG5ldyB0eXBlKHByb3BzKTtcblx0XHRjb21wb25lbnQuX2lkID0gZ3VpZCgpO1xuXHRcdHRoaXMubWFwW2NvbXBvbmVudC5faWRdID0gY29tcG9uZW50O1xuXHRcdHRoaXMuX3N0YXJ0TWFwW2NvbXBvbmVudC5faWRdID0gY29tcG9uZW50O1xuXHRcdHRoaXMuZW1pdCgnYWRkJywgY29tcG9uZW50KTtcblx0XHRyZXR1cm4gY29tcG9uZW50O1xuXHR9XG5cblx0ZGVzdHJveShjb21wb25lbnQpIHtcblx0XHR0aGlzLl9kZXN0cm95TWFwW2NvbXBvbmVudC5faWRdID0gY29tcG9uZW50O1xuXHRcdHRoaXMuZW1pdCgnZGVzdHJveScsIGNvbXBvbmVudCk7XG5cdH1cblxuXHR0aWNrKGR0KSB7XG5cdFx0bGV0IGlkLCBjb21wb25lbnQ7XG5cblx0XHRjb25zdCBfc3RhcnRNYXAgPSBjbG9uZSh0aGlzLl9zdGFydE1hcCk7XG5cdFx0dGhpcy5fc3RhcnRNYXAgPSB7fTtcblxuXHRcdGZvciAoaWQgaW4gX3N0YXJ0TWFwKSB7XG5cdFx0XHRjb21wb25lbnQgPSBfc3RhcnRNYXBbaWRdO1xuXHRcdFx0aWYgKGNvbXBvbmVudC5zdGFydCAhPSBudWxsKSB7XG5cdFx0XHRcdGNvbXBvbmVudC5zdGFydCgpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGZvciAoaWQgaW4gdGhpcy5tYXApIHtcblx0XHRcdGNvbXBvbmVudCA9IHRoaXMubWFwW2lkXTtcblx0XHRcdGlmIChjb21wb25lbnQudGljayAhPSBudWxsKSB7XG5cdFx0XHRcdGNvbXBvbmVudC50aWNrKGR0KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBfZGVzdHJveU1hcCA9IGNsb25lKHRoaXMuX2Rlc3Ryb3lNYXApO1xuXHRcdHRoaXMuX2Rlc3Ryb3lNYXAgPSB7fTtcblx0XHRcblx0XHRmb3IgKGlkIGluIF9kZXN0cm95TWFwKSB7XG5cdFx0XHRjb21wb25lbnQgPSBfZGVzdHJveU1hcFtpZF07XG5cdFx0XHRpZiAoY29tcG9uZW50LmRlc3Ryb3kgIT0gbnVsbCkge1xuXHRcdFx0XHRjb21wb25lbnQuZGVzdHJveSgpO1xuXHRcdFx0fVxuXHRcdFx0ZGVsZXRlIHRoaXMubWFwW2NvbXBvbmVudC5faWRdO1xuXHRcdH1cblxuXHRcdHRoaXMucmVuZGVyZXIucmVuZGVyKCk7XG5cdH1cblxuXHRhbmltYXRlKCkge1xuXHRcdGNvbnN0IGZyYW1lUmF0ZSA9IDEgLyA2MDtcblx0XHRcblx0XHR0aGlzLnRpY2soZnJhbWVSYXRlKTtcblxuXHRcdHRoaXMudGltZSArPSBmcmFtZVJhdGU7XG5cdFx0dGhpcy5kZWx0YVRpbWUgPSBmcmFtZVJhdGU7XG5cblx0XHRyZXF1ZXN0QW5pbWF0aW9uRnJhbWUodGhpcy5hbmltYXRlKTtcblx0fVxuXG5cdHN0YXJ0KCkge1xuXHRcdHRoaXMuYW5pbWF0ZSgpO1xuXHR9XG59O1xuXG5lZShBcHAucHJvdG90eXBlKTtcblxubW9kdWxlLmV4cG9ydHMgPSBuZXcgQXBwKCk7IiwiY29uc3QgY29udGFpbmVyID0gcmVxdWlyZSgnLi4vY29udGFpbmVyJyk7XG5jb25zdCByYW5kb21RdWF0ZXJuaW9uID0gcmVxdWlyZSgnLi4vdXRpbHMvbWF0aCcpLnJhbmRvbVF1YXRlcm5pb247XG5cbmNsYXNzIEFzdGVyb2lkIHtcblx0Y29uc3RydWN0b3IocHJvcHMpIHtcblx0XHR0aGlzLnNjZW5lID0gY29udGFpbmVyLnNjZW5lO1xuXHRcdGNvbnN0IGdlb21ldHJ5ID0gbmV3IFRIUkVFLkJveEdlb21ldHJ5KDEwLCAxMCwgMTApO1xuXHRcdHRoaXMub2JqZWN0ID0gbmV3IFRIUkVFLk1lc2goZ2VvbWV0cnkpO1xuXHRcdHRoaXMub2JqZWN0LnF1YXRlcm5pb24uY29weShyYW5kb21RdWF0ZXJuaW9uKCkpO1xuXHR9XG5cblx0c3RhcnQoKSB7XG5cdFx0dGhpcy5zY2VuZS5hZGQodGhpcy5vYmplY3QpO1xuXHR9XG5cblx0dGljayhkdCkge1xuXG5cdH1cblxuXHRkZXN0cm95KCkge1xuXHRcdHRoaXMuc2NlbmUucmVtb3ZlKHRoaXMub2JqZWN0KTtcdFxuXHR9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gQXN0ZXJvaWQ7IiwiY29uc3QgY29udGFpbmVyID0gcmVxdWlyZSgnLi4vY29udGFpbmVyJyk7XG5jb25zdCBsaW5lYXJCaWxsYm9hcmQgPSByZXF1aXJlKCcuLi91dGlscy9tYXRoJykubGluZWFyQmlsbGJvYXJkO1xuXG5jbGFzcyBCZWFtIHtcblx0Y29uc3RydWN0b3IocHJvcHMpIHtcblx0XHR0aGlzLnRhcmdldCA9IHByb3BzLnRhcmdldDtcblx0XHR0aGlzLnR1cnJlbnQgPSBwcm9wcy50dXJyZW50O1xuXG5cdFx0dGhpcy5zY2VuZSA9IGNvbnRhaW5lci5zY2VuZTtcdFx0XG5cdFx0dGhpcy5jYW1lcmEgPSBjb250YWluZXIuY2FtZXJhO1xuXHRcdHRoaXMuYXBwID0gY29udGFpbmVyLmFwcDtcblxuXHRcdHRoaXMubGVuZ3RoID0gMDtcblx0XHRjb25zdCBoZWlnaHQgPSAwLjU7XG5cblx0XHR0aGlzLmRpciA9IHRoaXMudGFyZ2V0LnBvc2l0aW9uLmNsb25lKCkuc3ViKHRoaXMudHVycmVudC5wb3NpdGlvbikubm9ybWFsaXplKCk7XG5cdFx0dGhpcy5xdWF0ZXJuaW9uID0gbmV3IFRIUkVFLlF1YXRlcm5pb24oKS5zZXRGcm9tVW5pdFZlY3RvcnMobmV3IFRIUkVFLlZlY3RvcjMoMSwgMCwgMCksIHRoaXMuZGlyKTtcblxuXHRcdHRoaXMuZ2VvbWV0cnkgPSBuZXcgVEhSRUUuR2VvbWV0cnkoKTtcblx0XHR0aGlzLmdlb21ldHJ5LnZlcnRpY2VzLnB1c2goXG5cdFx0XHRuZXcgVEhSRUUuVmVjdG9yMygwLCAtaGVpZ2h0LCAwKSxcblx0XHRcdG5ldyBUSFJFRS5WZWN0b3IzKDAsIGhlaWdodCwgMCksXG5cdFx0XHRuZXcgVEhSRUUuVmVjdG9yMygxLCBoZWlnaHQsIDApLFxuXHRcdFx0bmV3IFRIUkVFLlZlY3RvcjMoMSwgLWhlaWdodCwgMClcblx0XHQpO1xuXG5cdFx0dGhpcy5nZW9tZXRyeS5mYWNlcy5wdXNoKFxuXHRcdFx0bmV3IFRIUkVFLkZhY2UzKDIsIDEsIDApLFxuXHRcdFx0bmV3IFRIUkVFLkZhY2UzKDIsIDAsIDMpXG5cdFx0KTtcblxuXHRcdHRoaXMubWF0ZXJpYWwgPSBuZXcgVEhSRUUuTWVzaEJhc2ljTWF0ZXJpYWwoe1xuXHRcdFx0Y29sb3I6IDB4ZmZmZmZmLFxuXHRcdFx0c2lkZTogVEhSRUUuRG91YmxlU2lkZVxuXHRcdH0pO1xuXG5cdFx0dGhpcy5tZXNoID0gbmV3IFRIUkVFLk1lc2godGhpcy5nZW9tZXRyeSwgdGhpcy5tYXRlcmlhbCk7XG5cdFx0XG5cdFx0dGhpcy5vYmplY3QgPSBuZXcgVEhSRUUuT2JqZWN0M0QoKTtcblx0XHR0aGlzLm9iamVjdC5hZGQodGhpcy5tZXNoKTtcblxuXHRcdHRoaXMuciA9IE1hdGgucmFuZG9tKCkgKiBNYXRoLlBJIC8gMjtcblxuXHRcdHRoaXMubGlmZSA9IDEuMDtcblx0XHR0aGlzLmNvdW50ZXIgPSAwO1xuXG5cdFx0dGhpcy5zcGVlZCA9IDUwO1xuXHR9XG5cblx0c3RhcnQoKSB7XG5cdFx0dGhpcy5zY2VuZS5hZGQodGhpcy5vYmplY3QpO1xuXHR9XG5cblx0dGljayhkdCkge1xuXHRcdHRoaXMuZGlyID0gdGhpcy50YXJnZXQucG9zaXRpb24uY2xvbmUoKS5zdWIodGhpcy50dXJyZW50LnBvc2l0aW9uKS5ub3JtYWxpemUoKTtcblx0XHR0aGlzLnF1YXRlcm5pb24gPSBuZXcgVEhSRUUuUXVhdGVybmlvbigpLnNldEZyb21Vbml0VmVjdG9ycyhuZXcgVEhSRUUuVmVjdG9yMygxLCAwLCAwKSwgdGhpcy5kaXIpO1xuXHRcdHRoaXMubGVuZ3RoICs9IHRoaXMuc3BlZWQ7XG5cblx0XHRsaW5lYXJCaWxsYm9hcmQodGhpcy5jYW1lcmEsIHRoaXMub2JqZWN0LCB0aGlzLmRpciwgdGhpcy5xdWF0ZXJuaW9uKTtcblxuXHRcdGNvbnN0IGRhdGUgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcblxuXHRcdGNvbnN0IHdpZHRoTm9pc2UgPVxuXHQgICAgTWF0aC5zaW4oZGF0ZSAvIDE3ICsgdGhpcy5yKSAqIDAuMyArXG4gIFx0ICBNYXRoLnNpbigoZGF0ZSArIDEyMyArIHRoaXMucikgLyAyNykgKiAwLjQgK1xuICAgIFx0TWF0aC5zaW4oKGRhdGUgKyAyMzQgKyB0aGlzLnIpIC8gMTMpICogMC40O1xuXG4gICAgY29uc3QgdCA9IHRoaXMuY291bnRlciAvIHRoaXMubGlmZTtcbiAgICBjb25zdCB3aWR0aCA9IDI7XG5cblx0XHR0aGlzLm1lc2guc2NhbGUueSA9IE1hdGguc2luKHQgKiBNYXRoLlBJKSAqIHdpZHRoICsgd2lkdGhOb2lzZTtcblx0XHR0aGlzLm1lc2guc2NhbGUueSAqPSAwLjc7XG5cdFx0dGhpcy5tZXNoLnNjYWxlLnggPSB0aGlzLmxlbmd0aDtcblxuXHRcdHRoaXMub2JqZWN0LnBvc2l0aW9uLmNvcHkodGhpcy50dXJyZW50LnBvc2l0aW9uKTtcblxuXHRcdHRoaXMuY291bnRlciArPSBkdDtcblx0XHRpZiAodGhpcy5jb3VudGVyID4gdGhpcy5saWZlKSB7XG5cdFx0XHR0aGlzLmFwcC5kZXN0cm95KHRoaXMpO1xuXHRcdH1cblx0fVxuXG5cdGRlc3Ryb3koKSB7XG5cdFx0dGhpcy5zY2VuZS5yZW1vdmUodGhpcy5vYmplY3QpO1x0XG5cdH1cbn1cdFxuXG5tb2R1bGUuZXhwb3J0cyA9IEJlYW07IiwiY29uc3QgY29udGFpbmVyID0gcmVxdWlyZSgnLi4vY29udGFpbmVyJyk7XG5cbmNsYXNzIERyYWdDYW1lcmEge1xuXHRjb25zdHJ1Y3Rvcihwcm9wcykge1xuXHRcdHRoaXMucm90YXRpb24gPSBuZXcgVEhSRUUuRXVsZXIoLU1hdGguUEkgLyA0LCBNYXRoLlBJIC8gNCwgMCwgJ1lYWicpO1xuXHRcdHRoaXMuZGlzdGFuY2UgPSA1MDtcblx0XHR0aGlzLnRhcmdldCA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5cdFx0dGhpcy5jYW1lcmEgPSBjb250YWluZXIuY2FtZXJhO1xuXHRcdHRoaXMudXAgPSBuZXcgVEhSRUUuVmVjdG9yMygwLCAxLCAwKTtcblx0XHR0aGlzLmlzRHJhZyA9IGZhbHNlO1xuXHRcdHRoaXMubGFzdFggPSAwO1xuXHRcdHRoaXMubGFzdFkgPSAwO1xuXHRcdHRoaXMueFNwZWVkID0gMC4wMTtcblx0XHR0aGlzLnlTcGVlZCA9IDAuMDE7XG5cblx0XHR0aGlzLm9uTW91c2VXaGVlbCA9IHRoaXMub25Nb3VzZVdoZWVsLmJpbmQodGhpcyk7XG5cdFx0dGhpcy5vbk1vdXNlRG93biA9IHRoaXMub25Nb3VzZURvd24uYmluZCh0aGlzKTtcblx0XHR0aGlzLm9uTW91c2VVcCA9IHRoaXMub25Nb3VzZVVwLmJpbmQodGhpcyk7XG5cdFx0dGhpcy5vbk1vdXNlTW92ZSA9IHRoaXMub25Nb3VzZU1vdmUuYmluZCh0aGlzKTtcblx0fVxuXG5cdHN0YXJ0KCkge1xuXHRcdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXdoZWVsJywgdGhpcy5vbk1vdXNlV2hlZWwpO1xuXHRcdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCB0aGlzLm9uTW91c2VEb3duKTtcblx0XHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHRoaXMub25Nb3VzZVVwKTtcblx0XHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcy5vbk1vdXNlTW92ZSk7XG5cdH1cblxuXHRvbk1vdXNlV2hlZWwoZSkge1xuXHRcdGNvbnN0IHNjYWxlID0gMSArIGUuZGVsdGFZIC8gMTAwMDtcblx0XHR0aGlzLmRpc3RhbmNlICo9IHNjYWxlO1xuXHR9XG5cblx0b25Nb3VzZURvd24oZSkge1xuXHRcdHRoaXMuaXNEcmFnID0gdHJ1ZTtcblx0fVxuXG5cdG9uTW91c2VVcChlKSB7XG5cdFx0dGhpcy5pc0RyYWcgPSBmYWxzZTtcblx0fVxuXG5cdG9uTW91c2VNb3ZlKGUpIHtcblx0XHRpZiAodGhpcy5pc0RyYWcpIHtcblx0XHRcdGNvbnN0IGRpZmZYID0gZS5jbGllbnRYIC0gdGhpcy5sYXN0WDtcblx0XHRcdGNvbnN0IGRpZmZZID0gZS5jbGllbnRZIC0gdGhpcy5sYXN0WTtcblxuXHRcdFx0dGhpcy5yb3RhdGlvbi54ICs9IGRpZmZZICogdGhpcy55U3BlZWQ7XG5cdFx0XHR0aGlzLnJvdGF0aW9uLnkgKz0gZGlmZlggKiB0aGlzLnhTcGVlZDtcblx0XHR9XG5cblx0XHR0aGlzLmxhc3RYID0gZS5jbGllbnRYO1xuXHRcdHRoaXMubGFzdFkgPSBlLmNsaWVudFk7XG5cdH1cblx0XG5cdHRpY2soKSB7XG5cdFx0Y29uc3QgcG9zaXRpb24gPSB0aGlzLnRhcmdldC5jbG9uZSgpXG5cdFx0XHQuYWRkKG5ldyBUSFJFRS5WZWN0b3IzKDAsIDAsIDEpXG5cdFx0XHRcdC5hcHBseUV1bGVyKHRoaXMucm90YXRpb24pXG5cdFx0XHRcdC5tdWx0aXBseVNjYWxhcih0aGlzLmRpc3RhbmNlKSk7XG5cdFx0dGhpcy5jYW1lcmEucG9zaXRpb24uY29weShwb3NpdGlvbik7XG5cdFx0dGhpcy5jYW1lcmEubG9va0F0KHRoaXMudGFyZ2V0LCB0aGlzLnVwKTtcblx0fVxuXG5cdGRlc3Ryb3koKSB7XG5cdFx0d2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNld2hlZWwnLCB0aGlzLm9uTW91c2VXaGVlbCk7XG5cdH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRHJhZ0NhbWVyYTsiLCJjb25zdCBjb250YWluZXIgPSByZXF1aXJlKCcuLi9jb250YWluZXInKTtcbmNvbnN0IFBhcnRpY2xlU3lzdGVtID0gcmVxdWlyZSgnLi9wYXJ0aWNsZXN5c3RlbScpO1xuXG5jbGFzcyBFbmdpbmUge1xuICBjb25zdHJ1Y3Rvcihwcm9wcykge1xuICAgIHRoaXMucHJvcHMgPSBwcm9wcztcbiAgICB0aGlzLm9iamVjdCA9IG5ldyBUSFJFRS5PYmplY3QzRCgpO1xuICAgIHRoaXMuc2NlbmUgPSBjb250YWluZXIuc2NlbmU7XG4gICAgdGhpcy5hcHAgPSBjb250YWluZXIuYXBwO1xuICAgIHRoaXMucGFydGljbGVWZWxvY2l0eSA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG4gICAgdGhpcy5hbW91bnQgPSAwO1xuXG4gICAgdGhpcy5wYXJ0aWNsZVN5c3RlbSA9IHRoaXMuYXBwLmFkZChQYXJ0aWNsZVN5c3RlbSwge1xuICAgICAgc2NhbGU6IFsgKChwKSA9PiB7XG4gICAgICBcdHJldHVybiBwLl9zaXplO1xuICAgICAgfSksIDBdLFxuICAgICAgbGlmZTogKChwKSA9PiB7XG4gICAgICAgIHJldHVybiBwLl9zaXplICogMTUwO1xuICAgICAgfSksXG4gICAgICBpbnRlcnZhbDogMzAsXG4gICAgICB2ZWxvY2l0eTogdGhpcy5wYXJ0aWNsZVZlbG9jaXR5LFxuICAgICAgYXV0b1BsYXk6IGZhbHNlLFxuICAgICAgb25QYXJ0aWNsZTogKHApID0+IHtcbiAgICAgICAgcC5fc2l6ZSA9IE1hdGgucmFuZG9tKCkgKyAxO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgc3RhcnQoKSB7XG4gICAgY29uc3Qgc2hpcCA9IHRoaXMucHJvcHMuc2hpcDtcbiAgICBjb25zdCBjb29yZCA9IHRoaXMucHJvcHMuY29vcmQ7XG4gICAgc2hpcC5pbm5lck9iamVjdC5hZGQodGhpcy5vYmplY3QpO1xuICAgIHRoaXMub2JqZWN0LnBvc2l0aW9uXG4gICAgICAuZnJvbUFycmF5KGNvb3JkKVxuICAgICAgLmFkZChuZXcgVEhSRUUuVmVjdG9yMygwLjUsIDAuNSwgMC41KSlcbiAgICAgIC5hZGQobmV3IFRIUkVFLlZlY3RvcjMoMCwgMCwgMSkpO1xuXG4gICAgdGhpcy51cGRhdGVQYXJ0aWNsZVN5c3RlbSgpO1xuICB9XG5cbiAgdGljayhkdCkge1xuICAgIHRoaXMudXBkYXRlUGFydGljbGVTeXN0ZW0oKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5hcHAuZGVzdHJveSh0aGlzLnBhcnRpY2xlU3lzdGVtKTtcbiAgfVxuXG4gIHVwZGF0ZVBhcnRpY2xlU3lzdGVtKCkge1xuICAgIGlmICh0aGlzLmFtb3VudCA9PT0gMCAmJiB0aGlzLnBhcnRpY2xlU3lzdGVtLnBsYXlpbmcpIHtcbiAgICAgIHRoaXMucGFydGljbGVTeXN0ZW0ucGF1c2UoKTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuYW1vdW50ID4gMCAmJiAhdGhpcy5wYXJ0aWNsZVN5c3RlbS5wbGF5aW5nKSB7XG4gICAgICB0aGlzLnBhcnRpY2xlU3lzdGVtLnBsYXkoKTtcbiAgICB9XG4gICAgdGhpcy5wYXJ0aWNsZVN5c3RlbS5wb3NpdGlvbi5jb3B5KHRoaXMub2JqZWN0LmdldFdvcmxkUG9zaXRpb24oKSk7XG4gICAgY29uc3Qgcm90YXRpb24gPSB0aGlzLm9iamVjdC5nZXRXb3JsZFJvdGF0aW9uKCk7XG4gICAgY29uc3QgZGlyZWN0aW9uID0gbmV3IFRIUkVFLlZlY3RvcjMoMCwgMCwgMSkuYXBwbHlFdWxlcihyb3RhdGlvbik7XG4gICAgdGhpcy5wYXJ0aWNsZVZlbG9jaXR5LmNvcHkoZGlyZWN0aW9uLm11bHRpcGx5U2NhbGFyKDEwKSk7XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRW5naW5lO1xuIiwiY29uc3QgY29udGFpbmVyID0gcmVxdWlyZSgnLi4vY29udGFpbmVyJyk7XG5cbmNsYXNzIEdyaWQge1xuICBjb25zdHJ1Y3Rvcihwcm9wcykge1xuICAgIHRoaXMuYXhpcyA9IFsgMSwgTWF0aC5zcXJ0KDMpIC8gMiwgTWF0aC5zcXJ0KDMpIC8gNCBdO1xuICAgIHRoaXMuc2NlbmUgPSBjb250YWluZXIuc2NlbmU7XG4gIH1cblxuICBoZXhUb1NjcmVlbihpLCBqKSB7XG4gIFx0cmV0dXJuIFsgdGhpcy5heGlzWzBdICogaSArICgoaiAlIDIgPT09IDApID8gdGhpcy5heGlzWzJdIDogMCksIHRoaXMuYXhpc1sxXSAqIGogXTtcbiAgfVxuXG4gIHN0YXJ0KCkge1xuICAgIC8vIGZvciAobGV0IGkgPSAwOyBpIDwgMTA7IGkrKykge1xuICAgIC8vICAgZm9yIChsZXQgaiA9IDA7IGogPCAxMDsgaisrKSB7XG5cbiAgICAvLyAgICAgY29uc3Qgc3ByaXRlID0gbmV3IFRIUkVFLlNwcml0ZSgpO1xuICAgIC8vICAgICBjb25zdCBzY3JlZW4gPSB0aGlzLmhleFRvU2NyZWVuKGksIGopO1xuICAgIC8vICAgICBzcHJpdGUucG9zaXRpb24ueCA9IHNjcmVlblswXSAqIDEwO1xuICAgIC8vICAgICBzcHJpdGUucG9zaXRpb24ueiA9IHNjcmVlblsxXSAqIDEwO1xuXG4gICAgLy8gICAgIHRoaXMuc2NlbmUuYWRkKHNwcml0ZSk7XG5cbiAgICAvLyAgIH1cbiAgICAvLyB9XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBHcmlkO1xuIiwiY29uc3QgY29udGFpbmVyID0gcmVxdWlyZSgnLi4vY29udGFpbmVyJyk7XG5cbmNsYXNzIExhc2VyIHtcbiAgY29uc3RydWN0b3IocHJvcHMpIHtcbiAgICB0aGlzLnRhcmdldCA9IHByb3BzLnRhcmdldDtcbiAgICB0aGlzLnR1cnJlbnQgPSBwcm9wcy50dXJyZW50O1xuXG4gICAgdGhpcy5zY2VuZSA9IGNvbnRhaW5lci5zY2VuZTtcbiAgICB0aGlzLmFwcCA9IGNvbnRhaW5lci5hcHA7XG5cbiAgICB0aGlzLm9iamVjdCA9IG5ldyBUSFJFRS5TcHJpdGUoKTtcblxuICAgIHRoaXMuc3BlZWQgPSA0MDtcblxuICAgIHRoaXMubGlmZSA9IDEwMDAwO1xuICB9XG5cbiAgc3RhcnQoKSB7XG4gIFx0dGhpcy5vYmplY3QucG9zaXRpb24uY29weSh0aGlzLnR1cnJlbnQucG9zaXRpb24pO1xuICBcdHRoaXMuc2NlbmUuYWRkKHRoaXMub2JqZWN0KTtcblxuICBcdHRoaXMudmVsb2NpdHkgPSB0aGlzLnRhcmdldC5wb3NpdGlvbi5jbG9uZSgpLnN1Yih0aGlzLnR1cnJlbnQucG9zaXRpb24pLm5vcm1hbGl6ZSgpLm11bHRpcGx5U2NhbGFyKHRoaXMuc3BlZWQpO1xuXG4gIFx0dGhpcy5kaWVUaW1lID0gbmV3IERhdGUoKS5nZXRUaW1lKCkgKyB0aGlzLmxpZmU7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICBcdHRoaXMuc2NlbmUucmVtb3ZlKHRoaXMub2JqZWN0KTtcbiAgfVxuXG4gIHRpY2soZHQpIHtcbiAgXHR0aGlzLm9iamVjdC5wb3NpdGlvbi5hZGQodGhpcy52ZWxvY2l0eS5jbG9uZSgpLm11bHRpcGx5U2NhbGFyKGR0KSk7XG5cbiAgXHRpZiAobmV3IERhdGUoKS5nZXRUaW1lKCkgPiB0aGlzLmRpZVRpbWUpIHtcbiAgXHRcdHRoaXMuYXBwLmRlc3Ryb3kodGhpcyk7XG4gIFx0fVxuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gTGFzZXI7XG4iLCJjb25zdCBjb250YWluZXIgPSByZXF1aXJlKCcuLi9jb250YWluZXInKTtcblxuY2xhc3MgVmFsdWUge1xuXHRjb25zdHJ1Y3Rvcih2YWx1ZSwgb2JqZWN0KSB7XG5cdFx0dGhpcy52YWx1ZSA9IHZhbHVlO1xuXHRcdHRoaXMub2JqZWN0ID0gb2JqZWN0O1xuXG5cdFx0dGhpcy5pc051bWJlciA9IHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcic7XG5cdFx0dGhpcy5pc0Z1bmMgPSB0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbic7XG5cdFx0Ly8gTGluZWFyIGludGVydmFsc1xuXHRcdHRoaXMuaW50ZXJ2YWxzID0gW107XG5cblx0XHRpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcblx0XHRcdGNvbnN0IHZhbHVlcyA9IHZhbHVlLm1hcCgodikgPT4ge1xuXHRcdFx0XHRpZiAodHlwZW9mIHYgPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdFx0XHRyZXR1cm4gdih0aGlzLm9iamVjdCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHY7XG5cdFx0XHR9KTtcblxuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB2YWx1ZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0Y29uc3QgaW50ZXJ2YWwgPSB7XG5cdFx0XHRcdFx0dDogaSAvIHZhbHVlcy5sZW5ndGgsXG5cdFx0XHRcdFx0djogdmFsdWVzW2ldXG5cdFx0XHRcdH07XG5cdFx0XHRcdGlmIChpIDwgdmFsdWVzLmxlbmd0aCAtIDEpIHtcblx0XHRcdFx0XHRpbnRlcnZhbC52ZCA9IHZhbHVlc1tpICsgMV0gLSB2YWx1ZXNbaV07XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5pbnRlcnZhbHMucHVzaChpbnRlcnZhbCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Z2V0KHQpIHtcblx0XHR0ID0gdCB8fCAwO1xuXHRcdGlmICh0aGlzLmlzTnVtYmVyKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy52YWx1ZTtcblx0XHR9IGVsc2UgaWYgKHRoaXMuaXNGdW5jKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy52YWx1ZSh0aGlzLm9iamVjdCk7XG5cdFx0fSBlbHNlIGlmICh0aGlzLmludGVydmFscy5sZW5ndGggPiAwKSB7XG5cdFx0XHRsZXQgaW50ZXJ2YWw7XG5cdFx0XHRpZiAodCA+IDEpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuaW50ZXJ2YWxzW3RoaXMuaW50ZXJ2YWxzLmxlbmd0aCAtIDFdLnY7XG5cdFx0XHR9XG5cblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5pbnRlcnZhbHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0aW50ZXJ2YWwgPSB0aGlzLmludGVydmFsc1tpXTtcblx0XHRcdFx0aWYgKHQgPCBpbnRlcnZhbC50KSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCB0ZCA9IHQgLSBpbnRlcnZhbC50O1xuXHRcdFx0XHRjb25zdCB2ZCA9IGludGVydmFsLnZkO1xuXHRcdFx0XHRyZXR1cm4gaW50ZXJ2YWwudiArIHRkICogdmQ7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG5cbmNsYXNzIFBhcnRpY2xlIHtcblx0Y29uc3RydWN0b3IocHJvcHMpIHtcblx0XHR0aGlzLnByb3BzID0gcHJvcHM7XG5cblx0XHR0aGlzLnBhcmVudCA9IHByb3BzLnBhcmVudDtcblx0XHR0aGlzLm9iamVjdCA9IG5ldyBUSFJFRS5TcHJpdGUocHJvcHMubWF0ZXJpYWwpO1xuXHRcdHRoaXMuYXBwID0gY29udGFpbmVyLmFwcDtcblx0fVxuXG5cdGluaXRQcm9wcygpIHtcblx0XHR0aGlzLmxpZmUgPSBuZXcgVmFsdWUodGhpcy5wcm9wcy5saWZlLCB0aGlzKTtcblx0XHR0aGlzLnZlbG9jaXR5ID0gdGhpcy5wcm9wcy52ZWxvY2l0eTtcblx0XHR0aGlzLnNjYWxlID0gbmV3IFZhbHVlKHRoaXMucHJvcHMuc2NhbGUsIHRoaXMpO1xuXHR9XG5cblx0c3RhcnQoKSB7XG5cdFx0dGhpcy5wYXJlbnQuYWRkKHRoaXMub2JqZWN0KTtcblx0XHR0aGlzLnN0YXJ0VGltZXIgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcblx0XHR0aGlzLnRpbWVyID0gbmV3IERhdGUoKS5nZXRUaW1lKCkgKyB0aGlzLmxpZmUuZ2V0KCk7XG5cdH1cblxuXHR0aWNrKGR0KSB7XG5cdFx0dGhpcy5vYmplY3QucG9zaXRpb24uYWRkKHRoaXMudmVsb2NpdHkuY2xvbmUoKS5tdWx0aXBseVNjYWxhcihkdCkpO1xuXHRcdGNvbnN0IHQgPSAobmV3IERhdGUoKS5nZXRUaW1lKCkgLSB0aGlzLnN0YXJ0VGltZXIpIC8gdGhpcy5saWZlLmdldCgpO1xuXHRcdGNvbnN0IHNjYWxlID0gdGhpcy5zY2FsZS5nZXQodCk7XG5cdFx0dGhpcy5vYmplY3Quc2NhbGUuc2V0KHNjYWxlLCBzY2FsZSwgc2NhbGUpO1xuXG5cdFx0aWYgKG5ldyBEYXRlKCkuZ2V0VGltZSgpID4gdGhpcy50aW1lcikge1xuXHRcdFx0dGhpcy5hcHAuZGVzdHJveSh0aGlzKTtcblx0XHR9XG5cdH1cblxuXHRkZXN0cm95KCkge1xuXHRcdHRoaXMub2JqZWN0LnBhcmVudC5yZW1vdmUodGhpcy5vYmplY3QpO1xuXHR9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gUGFydGljbGU7IiwiY29uc3QgY29udGFpbmVyID0gcmVxdWlyZSgnLi4vY29udGFpbmVyJyk7XG5jb25zdCBQYXJ0aWNsZSA9IHJlcXVpcmUoJy4vcGFydGljbGUnKTtcblxuY29uc3QgZGVmYXVsdE1hdGVyaWFsID0gbmV3IFRIUkVFLlNwcml0ZU1hdGVyaWFsKCk7XG5cbmNsYXNzIFBhcnRpY2xlU3lzdGVtIHtcblx0Y29uc3RydWN0b3IocHJvcHMpIHtcblx0XHRwcm9wcyA9IHByb3BzIHx8IHt9O1xuXG5cdFx0dGhpcy5tYXRlcmlhbCA9IHByb3BzLm1hdGVyaWFsIHx8IGRlZmF1bHRNYXRlcmlhbDtcblx0XHR0aGlzLm1hdGVyaWFscyA9IHRoaXMubWF0ZXJpYWwubGVuZ3RoID4gMCA/IHRoaXMubWF0ZXJpYWwgOiBbXTtcblx0XHR0aGlzLnBhcmVudCA9IHByb3BzLnBhcmVudCB8fCBjb250YWluZXIuc2NlbmU7XG5cdFx0dGhpcy5hdXRvUGxheSA9IHByb3BzLmF1dG9QbGF5ID09PSB1bmRlZmluZWQgPyB0cnVlIDogcHJvcHMuYXV0b1BsYXk7XG5cdFx0dGhpcy5vblBhcnRpY2xlID0gcHJvcHMub25QYXJ0aWNsZTtcblxuXHRcdHRoaXMucGFydGljbGVQcm9wcyA9IHByb3BzLnBhcnRpY2xlUHJvcHM7XG5cblx0XHRpZiAodGhpcy5wYXJ0aWNsZVByb3BzID09IG51bGwpIHtcblx0XHRcdHRoaXMubGlmZSA9IHByb3BzLmxpZmU7XG5cdFx0XHR0aGlzLmludGVydmFsID0gcHJvcHMuaW50ZXJ2YWw7XG5cdFx0XHR0aGlzLnZlbG9jaXR5ID0gcHJvcHMudmVsb2NpdHk7XG5cdFx0XHR0aGlzLnNjYWxlID0gcHJvcHMuc2NhbGU7XG5cdFx0XHR0aGlzLmRlZmF1bHRQYXJ0aWNsZVByb3BzKHRoaXMpO1xuXHRcdH1cblxuXHRcdHRoaXMuX3RpbWVvdXQgPSBudWxsO1xuXHRcdHRoaXMuZW1pdCA9IHRoaXMuZW1pdC5iaW5kKHRoaXMpO1xuXHRcdHRoaXMuYXBwID0gY29udGFpbmVyLmFwcDtcblx0XHR0aGlzLnBvc2l0aW9uID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcblxuXHRcdHRoaXMucGxheWluZyA9IGZhbHNlO1xuXHR9XG5cblx0ZGVmYXVsdFBhcnRpY2xlUHJvcHMob2JqKSB7XG5cdFx0b2JqLmxpZmUgPSBvYmoubGlmZSB8fCA1MDAwO1xuXHRcdG9iai5pbnRlcnZhbCA9IG9iai5pbnRlcnZhbCB8fCAxMDAwO1xuXHRcdG9iai52ZWxvY2l0eSA9IG9iai52ZWxvY2l0eSB8fCBuZXcgVEhSRUUuVmVjdG9yMygwLCAyLCAwKTtcblx0XHRvYmouc2NhbGUgPSBvYmouc2NhbGUgfHwgMTtcdFxuXHRcdG9iai5wYXJlbnQgPSBvYmoucGFyZW50IHx8IGNvbnRhaW5lci5zY2VuZTtcblx0XHRyZXR1cm4gb2JqO1xuXHR9XG5cblx0c3RhcnQoKSB7XG5cdFx0aWYgKHRoaXMuYXV0b1BsYXkpIHtcblx0XHRcdHRoaXMucGxheSgpO1x0XG5cdFx0fVxuXHR9XG5cblx0cGxheSgpIHtcblx0XHR0aGlzLmVtaXQoKTtcblx0XHR0aGlzLnBsYXlpbmcgPSB0cnVlO1xuXHR9XG5cblx0cGF1c2UoKSB7XG5cdFx0aWYgKHRoaXMuX3RpbWVvdXQgIT0gbnVsbCkge1xuXHRcdFx0Y2xlYXJUaW1lb3V0KHRoaXMuX3RpbWVvdXQpO1xuXHRcdH1cblx0XHR0aGlzLnBsYXlpbmcgPSBmYWxzZTtcblx0fVxuXG5cdGVtaXQoKSB7XG5cdFx0bGV0IHByb3BzO1xuXHRcdGNvbnN0IG1hdGVyaWFsID0gdGhpcy5tYXRlcmlhbHMubGVuZ3RoID4gMCA/IHRoaXMubWF0ZXJpYWxzW01hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIHRoaXMubWF0ZXJpYWxzLmxlbmd0aCldIDogdGhpcy5tYXRlcmlhbDtcblx0XHRpZiAodGhpcy5wYXJ0aWNsZVByb3BzID09IG51bGwpIHtcblx0XHRcdHByb3BzID0ge1xuXHRcdFx0XHRsaWZlOiB0aGlzLmxpZmUsXG5cdFx0XHRcdHZlbG9jaXR5OiB0aGlzLnZlbG9jaXR5LFxuXHRcdFx0XHRtYXRlcmlhbDogbWF0ZXJpYWwsXG5cdFx0XHRcdHBhcmVudDogdGhpcy5wYXJlbnQsXG5cdFx0XHRcdHNjYWxlOiB0aGlzLnNjYWxlXG5cdFx0XHR9O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRwcm9wcyA9IHRoaXMuZGVmYXVsdFBhcnRpY2xlUHJvcHModGhpcy5wYXJ0aWNsZVByb3BzKCkpO1xuXHRcdH1cblx0XHRjb25zdCBwYXJ0aWNsZSA9IHRoaXMuYXBwLmFkZChQYXJ0aWNsZSwgcHJvcHMpO1xuXHRcdGlmICh0aGlzLm9uUGFydGljbGUgIT0gbnVsbCkge1xuXHRcdFx0dGhpcy5vblBhcnRpY2xlKHBhcnRpY2xlKTtcblx0XHR9XG5cdFx0cGFydGljbGUuaW5pdFByb3BzKCk7XG5cdFx0cGFydGljbGUub2JqZWN0LnBvc2l0aW9uLmNvcHkodGhpcy5wb3NpdGlvbik7XG5cdFx0dGhpcy5fdGltZW91dCA9IHNldFRpbWVvdXQodGhpcy5lbWl0LCB0aGlzLmludGVydmFsKTtcblx0fVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFBhcnRpY2xlU3lzdGVtOyIsImNvbnN0IGNvbnRhaW5lciA9IHJlcXVpcmUoJy4uLy4uL2NvbnRhaW5lcicpO1xuXG5jbGFzcyBBSSB7XG5cdGNvbnN0cnVjdG9yKHByb3BzKSB7XG5cdFx0dGhpcy5zaGlwcyA9IGNvbnRhaW5lci5zaGlwcztcblxuXHRcdHRoaXMuc2hpcCA9IHByb3BzLnNoaXA7XG5cdFx0dGhpcy50aGlua0Nvb2xkb3duID0gMC4xO1xuXHRcdHRoaXMubmV4dFRoaW5rID0gMDtcblx0XHR0aGlzLnRhcmdldCA9IG51bGw7XG5cdH1cblxuXHR0aGluaygpIHtcblx0XHRpZiAodGhpcy50YXJnZXQgPT0gbnVsbCkge1xuXHRcdFx0Y29uc3Qgc2hpcHMgPSB0aGlzLnNoaXBzLmdldFRhcmdldHModGhpcy5zaGlwKTtcblxuXHRcdFx0aWYgKHNoaXBzLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0c2hpcHMuc29ydCgoYSwgYikgPT4ge1xuXHRcdFx0XHRcdHJldHVybiBhLnBvc2l0aW9uLmRpc3RhbmNlVG8odGhpcy5zaGlwLnBvc2l0aW9uKSAtIFxuXHRcdFx0XHRcdFx0Yi5wb3NpdGlvbi5kaXN0YW5jZVRvKHRoaXMuc2hpcC5wb3NpdGlvbik7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHR0aGlzLnRhcmdldCA9IHNoaXBzWzBdO1xuXHRcdFx0fSBcblx0XHR9XG5cblx0XHRpZiAodGhpcy50YXJnZXQgPT0gbnVsbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIHRoaXMuc2hpcC5vcmJpdCh0aGlzLnRhcmdldC5wb3NpdGlvbiwgNTApO1xuXG5cdFx0Ly8gZGVtb1xuXHRcdC8vIHRoaXMuYXNjZW5kKDEwKTtcblx0XHRcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuc2hpcC50dXJyZW50cy5sZW5ndGg7IGkgKyspIHtcblx0XHRcdGNvbnN0IHR1cnJlbnQgPSB0aGlzLnNoaXAudHVycmVudHNbaV07XG5cdFx0XHR0dXJyZW50LmZpcmUoe1xuXHRcdFx0XHRwb3NpdGlvbjogdGhpcy50YXJnZXQucG9zaXRpb24sXG5cdFx0XHRcdHZlbG9jaXR5OiB0aGlzLnRhcmdldC52ZWxvY2l0eVxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0c3RhcnQoKSB7XG5cdFx0dGhpcy5uZXh0VGhpbmsgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKSArIHRoaXMudGhpbmtDb29sZG93bjtcblx0fVxuXG5cdHRpY2soZHQpIHtcblx0XHRpZiAobmV3IERhdGUoKS5nZXRUaW1lKCkgPiB0aGlzLm5leHRUaGluaykge1xuXHRcdFx0dGhpcy50aGluaygpO1xuXHRcdFx0dGhpcy5uZXh0VGhpbmsgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKSArIHRoaXMudGhpbmtDb29sZG93bjtcblx0XHR9XG5cdH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQUk7IiwiY29uc3QgY29udGFpbmVyID0gcmVxdWlyZSgnLi4vLi4vY29udGFpbmVyJyk7XG5jb25zdCBUSFJFRSA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93WydUSFJFRSddIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbFsnVEhSRUUnXSA6IG51bGwpO1xuY29uc3QgQ2h1bmtzID0gcmVxdWlyZSgnLi4vLi4vdm94ZWwvY2h1bmtzJyk7XG5jb25zdCBtZXNoZXIgPSByZXF1aXJlKCcuLi8uLi92b3hlbC9tZXNoZXInKTtcbmNvbnN0IHJlYWRlciA9IHJlcXVpcmUoJy4vcmVhZGVyJyk7XG5jb25zdCBub3JtYWxpemVBbmdsZSA9IHJlcXVpcmUoJy4uLy4uL3V0aWxzL21hdGgnKS5ub3JtYWxpemVBbmdsZTtcbmNvbnN0IGNsYW1wID0gcmVxdWlyZSgnLi4vLi4vdXRpbHMvbWF0aCcpLmNsYW1wO1xuY29uc3QgQUkgPSByZXF1aXJlKCcuL2FpJyk7XG5cbmNsYXNzIFNoaXAge1xuXHRjb25zdHJ1Y3Rvcihwcm9wcykge1xuXHRcdHRoaXMuX19pc1NoaXAgPSB0cnVlO1xuXG5cdFx0dGhpcy5wcm9wcyA9IHByb3BzO1xuXHRcdHRoaXMuc2NlbmUgPSBjb250YWluZXIuc2NlbmU7XG5cdFx0dGhpcy5vYmplY3QgPSBuZXcgVEhSRUUuT2JqZWN0M0QoKTtcblx0XHR0aGlzLm9iamVjdC5yb3RhdGlvbi5vcmRlciA9ICdZWFonO1xuXG5cdFx0aWYgKHByb3BzLnJvdGF0aW9uICE9IG51bGwpIHtcblx0XHRcdHRoaXMub2JqZWN0LnJvdGF0aW9uLmNvcHkocHJvcHMucm90YXRpb24pO1xuXHRcdH1cblxuXHRcdHRoaXMuaW5uZXJPYmplY3QgPSBuZXcgVEhSRUUuT2JqZWN0M0QoKTtcblx0XHR0aGlzLmlubmVyT2JqZWN0LnJvdGF0aW9uLm9yZGVyID0gJ1lYWic7XG5cdFx0dGhpcy5vYmplY3QuYWRkKHRoaXMuaW5uZXJPYmplY3QpO1xuXHRcdHRoaXMuY2h1bmtzID0gbmV3IENodW5rcygpO1xuXG5cdFx0dGhpcy5lbmdpbmVzID0gW107XG5cdFx0dGhpcy50dXJyZW50cyA9IFtdO1xuXG5cdFx0dGhpcy50dXJuU3BlZWQgPSAwO1xuXG5cdFx0dGhpcy50dXJuQW1vdW50ID0gMDtcblx0XHR0aGlzLmZvcndhcmRBbW91bnQgPSAwO1xuXHRcdHRoaXMubWF4VHVyblNwZWVkID0gMC4wMztcblx0XHR0aGlzLnBvd2VyID0gMC40O1xuXG5cdFx0dGhpcy52ZWxvY2l0eSA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5cblx0XHR0aGlzLmh1bGwgPSBbXTtcblxuXHRcdHRoaXMuYWkgPSBuZXcgQUkoe1xuXHRcdFx0c2hpcDogdGhpc1xuXHRcdH0pO1xuXG5cdFx0dGhpcy5zaWRlID0gcHJvcHMuc2lkZSB8fCAwO1xuXG5cdFx0dGhpcy5odWxsID0gW107XG5cdFx0dGhpcy5jZW50ZXIgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuXHR9XG5cblx0Z2V0IHBvc2l0aW9uKCkge1xuXHRcdHJldHVybiB0aGlzLm9iamVjdC5wb3NpdGlvbjtcblx0fVxuXG5cdGdldCByb3RhdGlvbigpIHtcblx0XHRyZXR1cm4gdGhpcy5vYmplY3Qucm90YXRpb247XG5cdH1cblxuXHRzdGFydCgpIHtcblx0XHR0aGlzLm1hdGVyaWFsID0gWyBudWxsLCBuZXcgVEhSRUUuTWVzaEJhc2ljTWF0ZXJpYWwoe1xuXHRcdFx0Y29sb3I6IDB4ZmZmZmZmXG5cdFx0fSkgXTtcblxuXHRcdHRoaXMuc2NlbmUuYWRkKHRoaXMub2JqZWN0KTtcblx0XG5cdFx0Y29uc3QgcmVzdWx0ID0gcmVhZGVyKHRoaXMucHJvcHMuZGF0YSwgdGhpcyk7XG5cblx0XHR0aGlzLmFpLnN0YXJ0KCk7XG5cdH1cblxuXHR0aWNrKGR0KSB7XG5cdFx0dGhpcy5haS50aWNrKGR0KTtcblx0XHRtZXNoZXIodGhpcy5jaHVua3MsIHRoaXMuaW5uZXJPYmplY3QsIHRoaXMubWF0ZXJpYWwpO1xuXG5cdFx0Ly8gU3RlcCB0dXJyZW50c1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy50dXJyZW50cy5sZW5ndGg7IGkgKyspIHtcblx0XHRcdGNvbnN0IHR1cnJlbnQgPSB0aGlzLnR1cnJlbnRzW2ldO1xuXHRcdFx0dHVycmVudC50aWNrKGR0KTtcblx0XHR9XG5cblx0XHQvLyBTdGVwIHlhd1xuXHRcdGNvbnN0IHR1cm5BY2NlbGVyYXRpb24gPSAwLjE7XG5cdFx0Y29uc3QgZGVzaXJlZFR1cm5TcGVlZCA9IHRoaXMudHVybkFtb3VudCAqIHRoaXMubWF4VHVyblNwZWVkO1xuXG5cdFx0aWYgKHRoaXMudHVyblNwZWVkIDwgZGVzaXJlZFR1cm5TcGVlZCkge1xuXHRcdFx0dGhpcy50dXJuU3BlZWQgKz0gdHVybkFjY2VsZXJhdGlvbiAqIGR0O1xuXHRcdH0gZWxzZSBpZiAodGhpcy50dXJuU3BlZWQgPiBkZXNpcmVkVHVyblNwZWVkKSB7XG5cdFx0XHR0aGlzLnR1cm5TcGVlZCAtPSB0dXJuQWNjZWxlcmF0aW9uICogZHQ7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMudHVyblNwZWVkIDwgLXRoaXMubWF4VHVyblNwZWVkKSB7XG5cdFx0XHR0aGlzLnR1cm5TcGVlZCA9IC10aGlzLm1heFR1cm5TcGVlZDtcblx0XHR9IGVsc2UgaWYgKHRoaXMudHVyblNwZWVkID4gdGhpcy5tYXhUdXJuU3BlZWQpIHtcblx0XHRcdHRoaXMudHVyblNwZWVkID0gdGhpcy5tYXhUdXJuU3BlZWQ7XG5cdFx0fVxuXG5cdFx0Ly8gU3RlcCByb2xsXG5cdFx0dGhpcy5vYmplY3Qucm90YXRpb24ueSArPSB0aGlzLnR1cm5TcGVlZDtcblxuXHRcdGNvbnN0IHJhdGlvID0gdGhpcy50dXJuU3BlZWQgLyB0aGlzLm1heFR1cm5TcGVlZDtcblxuXHRcdGNvbnN0IG1heFJvbGxBbW91bnQgPSBNYXRoLlBJIC8gNDtcblx0XHRjb25zdCBhbmdsZSA9IHJhdGlvICogbWF4Um9sbEFtb3VudDtcblxuXHRcdHRoaXMub2JqZWN0LnJvdGF0aW9uLnogKz0gKGFuZ2xlIC0gdGhpcy5vYmplY3Qucm90YXRpb24ueikgKiAwLjAxO1xuXG5cdFx0Ly8gdGhpcy50dXJuQW1vdW50ID0gMDtcblxuXHRcdC8vIFN0ZXAgZm9yd2FyZFxuXHRcdGNvbnN0IGFjYyA9IG5ldyBUSFJFRS5WZWN0b3IzKDAsIDAsIC0xKVxuXHRcdFx0LmFwcGx5RXVsZXIodGhpcy5vYmplY3Qucm90YXRpb24pXG5cdFx0XHQubXVsdGlwbHlTY2FsYXIodGhpcy5mb3J3YXJkQW1vdW50ICogdGhpcy5wb3dlciAqIGR0KTtcblxuXHRcdHRoaXMudmVsb2NpdHkuYWRkKGFjYyk7XG5cdFx0dGhpcy5vYmplY3QucG9zaXRpb24uYWRkKHRoaXMudmVsb2NpdHkpO1xuXG5cdFx0dGhpcy52ZWxvY2l0eS5tdWx0aXBseVNjYWxhcigwLjk3KTtcblxuXHRcdHRoaXMuZW5naW5lcy5mb3JFYWNoKChlbmdpbmUpID0+IHtcblx0XHRcdGVuZ2luZS5hbW91bnQgPSB0aGlzLmZvcndhcmRBbW91bnQ7XG5cdFx0fSk7XG5cdH1cblxuXHRhc2NlbmQoeSkge1xuXHRcdGNvbnN0IHlEaWZmID0geSAtIHRoaXMub2JqZWN0LnBvc2l0aW9uLnk7XG5cdFx0Y29uc3QgZGVzaXJlZFlTcGVlZCA9IHlEaWZmICogMC4xO1xuXHRcdGNvbnN0IHlTcGVlZERpZmYgPSBkZXNpcmVkWVNwZWVkIC0gdGhpcy52ZWxvY2l0eS55O1xuXHRcdGNvbnN0IGRlc2lyZWRZQWNjID0geVNwZWVkRGlmZiAqIDAuMTtcblxuXHRcdGxldCByYXRpbyA9IGRlc2lyZWRZQWNjIC8gdGhpcy5wb3dlcjtcblx0XHRpZiAocmF0aW8gPiAxLjApIHtcblx0XHRcdHJhdGlvID0gMS4wO1xuXHRcdH0gZWxzZSBpZiAocmF0aW8gPCAtMS4wKSB7XG5cdFx0XHRyYXRpbyA9IC0xLjA7XG5cdFx0fVxuXG5cdFx0bGV0IGRlc2lyZWRQaXRjaCA9IE1hdGguYXNpbihyYXRpbyk7XG5cblx0XHRjb25zdCBtYXhQaXRjaCA9IDAuM1xuXG5cdFx0aWYgKGRlc2lyZWRQaXRjaCA+IG1heFBpdGNoKSB7XG5cdFx0XHRkZXNpcmVkUGl0Y2ggPSBtYXhQaXRjaDtcblx0XHR9IGVsc2UgaWYgKGRlc2lyZWRQaXRjaCA8IC1tYXhQaXRjaCkge1xuXHRcdFx0ZGVzaXJlZFBpdGNoID0gLW1heFBpdGNoO1xuXHRcdH1cblxuXHRcdGNvbnN0IHBpdGNoRGlmZiA9IGRlc2lyZWRQaXRjaCAtIHRoaXMucm90YXRpb24ueDtcblxuXHRcdGNvbnN0IGRlc2lyZWRQaXRjaFNwZWVkID0gcGl0Y2hEaWZmO1xuXG5cdFx0Y29uc3QgbWF4UGl0Y2hTcGVlZCA9IDAuMDM7XG5cblxuXHRcdHRoaXMucm90YXRpb24ueCArPSBjbGFtcChkZXNpcmVkUGl0Y2hTcGVlZCwgLW1heFBpdGNoU3BlZWQsIG1heFBpdGNoU3BlZWQpO1xuXHR9XG5cblx0dHVybihhbW91bnQpIHtcblx0XHR0aGlzLnR1cm5BbW91bnQgPSBhbW91bnQ7XG5cdH1cblxuXHRmb3J3YXJkKGFtb3VudCkge1xuXHRcdHRoaXMuZm9yd2FyZEFtb3VudCA9IGFtb3VudDtcblx0fVxuXG5cdGFsaWduKHBvaW50KSB7XG5cdFx0Y29uc3QgYW5nbGVEaWZmID0gdGhpcy5nZXRBbmdsZURpZmYocG9pbnQpO1xuXHRcdGNvbnN0IGRlc2lyZWRUdXJuU3BlZWQgPSBhbmdsZURpZmY7XG5cblx0XHRsZXQgZGVzaXJlZFR1cm5BbW91bnQgPSBkZXNpcmVkVHVyblNwZWVkIC8gdGhpcy5tYXhUdXJuU3BlZWQ7XG5cdFx0aWYgKGRlc2lyZWRUdXJuQW1vdW50ID4gMSkge1xuXHRcdFx0ZGVzaXJlZFR1cm5BbW91bnQgPSAxO1xuXHRcdH0gZWxzZSBpZiAoZGVzaXJlZFR1cm5BbW91bnQgPCAtMSkge1xuXHRcdFx0ZGVzaXJlZFR1cm5BbW91bnQgPSAtMTtcblx0XHR9XG5cblx0XHR0aGlzLnR1cm4oZGVzaXJlZFR1cm5BbW91bnQpO1xuXHR9XG5cblx0b3JiaXQocG9pbnQsIGRpc3RhbmNlKSB7XG5cdFx0bGV0IGRpcyA9IHRoaXMub2JqZWN0LnBvc2l0aW9uLmNsb25lKCkuc3ViKHBvaW50KTtcblx0XHRkaXMueSA9IDA7XG5cdFx0ZGlzID0gZGlzLm5vcm1hbGl6ZSgpLm11bHRpcGx5U2NhbGFyKGRpc3RhbmNlKTtcblx0XHRjb25zdCBhID0gcG9pbnQuY2xvbmUoKS5hZGQoXG5cdFx0XHRkaXMuY2xvbmUoKS5hcHBseUV1bGVyKG5ldyBUSFJFRS5FdWxlcigwLCBNYXRoLlBJIC8gMywgMCkpKTtcblx0XHRjb25zdCBiID0gcG9pbnQuY2xvbmUoKS5hZGQoXG5cdFx0XHRkaXMuY2xvbmUoKS5hcHBseUV1bGVyKG5ldyBUSFJFRS5FdWxlcigwLCAtTWF0aC5QSSAvIDMsIDApKSk7XG5cblx0XHRjb25zdCBkaWZmQSA9IHRoaXMuZ2V0QW5nbGVEaWZmKGEpO1xuXHRcdGNvbnN0IGRpZmZCID0gdGhpcy5nZXRBbmdsZURpZmYoYik7XG5cblx0XHRpZiAoTWF0aC5hYnMoZGlmZkEpIDwgTWF0aC5hYnMoZGlmZkIpKSB7XG5cdFx0XHR0aGlzLmFsaWduKGEpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmFsaWduKGIpO1xuXHRcdH1cblxuXHRcdHRoaXMuZm9yd2FyZCgxLjApO1xuXHR9XG5cblx0Z2V0QW5nbGVEaWZmKHBvaW50KSB7XG5cdFx0Y29uc3QgYW5nbGUgPSBNYXRoLmF0YW4yKHBvaW50LnggLSB0aGlzLm9iamVjdC5wb3NpdGlvbi54LCBwb2ludC56IC0gdGhpcy5vYmplY3QucG9zaXRpb24ueikgLSBNYXRoLlBJO1xuXHRcdGNvbnN0IGFuZ2xlRGlmZiA9IGFuZ2xlIC0gdGhpcy5vYmplY3Qucm90YXRpb24ueTtcblx0XHRyZXR1cm4gbm9ybWFsaXplQW5nbGUoYW5nbGVEaWZmKTtcblx0fVxuXG5cdGRlc3Ryb3koKSB7XG5cblx0fVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFNoaXA7IiwiY29uc3QgY29udGFpbmVyID0gcmVxdWlyZSgnLi4vLi4vY29udGFpbmVyJyk7XG5jb25zdCBFbmdpbmUgPSByZXF1aXJlKCcuLi9lbmdpbmUnKTtcbmNvbnN0IFR1cnJlbnQgPSByZXF1aXJlKCcuL3R1cnJlbnQnKTtcbmNvbnN0IEJlYW0gPSByZXF1aXJlKCcuLi9iZWFtJyk7XG5jb25zdCBMYXNlciA9IHJlcXVpcmUoJy4uL2xhc2VyJyk7XG5cbmNvbnN0IHJlYWRlciA9IChkYXRhLCBzaGlwKSA9PiB7XG5cdGNvbnN0IGxpbmVzID0gZGF0YS5zcGxpdCgnXFxuJyk7XG5cdGNvbnN0IGNodW5rcyA9IHNoaXAuY2h1bmtzO1xuXHRjb25zdCBlbmdpbmVzID0gc2hpcC5lbmdpbmVzO1xuXG5cdGxldCBsaW5lO1xuXHRsZXQgY3VycmVudDtcblx0bGV0IHogPSAwO1xuXHRsZXQgY2hhcjtcblxuXHRjb25zdCByZXN1bHQgPSB7XG5cdFx0bW9kdWxlczogW11cblx0fTtcblxuXHRjb25zdCBhcHAgPSBjb250YWluZXIuYXBwO1xuXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgbGluZXMubGVuZ3RoOyBpKyspIHtcblx0XHRsaW5lID0gbGluZXNbaV07XG5cblx0XHRpZiAobGluZSA9PT0gJ0hVTEwnKSB7XG5cdFx0XHRjdXJyZW50ID0gJ0hVTEwnO1xuXHRcdFx0eiA9IDA7XG5cdFx0fSBlbHNlIGlmIChsaW5lID09PSAnTU9EVUxFUycpIHtcblx0XHRcdGN1cnJlbnQgPSAnTU9EVUxFUyc7XG5cdFx0XHR6ID0gMDtcblx0XHR9IGVsc2UgaWYgKGN1cnJlbnQgPT09ICdIVUxMJykge1xuXHRcdFx0Zm9yIChsZXQgeCA9IDA7IHggPCBsaW5lLmxlbmd0aDsgeCsrKSB7XG5cdFx0XHRcdGNoYXIgPSBsaW5lW3hdO1xuXG5cdFx0XHRcdGlmIChjaGFyID09PSAnMCcpIHtcblx0XHRcdFx0XHRjaHVua3Muc2V0KHgsIDAsIHosIDEpO1xuXHRcdFx0XHRcdHNoaXAuaHVsbC5wdXNoKFt4LCAwLCB6LCAxXSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHorKztcblx0XHR9IGVsc2UgaWYgKGN1cnJlbnQgPT09ICdNT0RVTEVTJykge1xuXHRcdFx0Zm9yIChsZXQgeCA9IDA7IHggPCBsaW5lLmxlbmd0aDsgeCsrKSB7XG5cdFx0XHRcdGNoYXIgPSBsaW5lW3hdO1xuXHRcdFx0XHRpZiAoY2hhciA9PT0gJ0UnKSB7XG5cdFx0XHRcdFx0Y29uc3QgZW5naW5lID0gYXBwLmFkZChFbmdpbmUsIHtcblx0XHRcdFx0XHRcdHNoaXA6IHNoaXAsXG5cdFx0XHRcdFx0XHRjb29yZDogW3gsIDAsIHpdXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0ZW5naW5lcy5wdXNoKGVuZ2luZSk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoY2hhciA9PT0gJ0wnIHx8IGNoYXIgPT09ICdsJykge1xuXHRcdFx0XHRcdGNvbnN0IHR5cGUgPSBMYXNlcjtcblx0XHRcdFx0XHRjb25zdCBjb29sZG93biA9IDAuMTtcblx0XHRcdFx0XHRjb25zdCByZWxvYWRUaW1lID0gMS4wO1xuXHRcdFx0XHRcdGNvbnN0IGNsaXAgPSA1O1xuXG5cdFx0XHRcdFx0c2hpcC50dXJyZW50cy5wdXNoKG5ldyBUdXJyZW50KHtcblx0XHRcdFx0XHRcdGNvb3JkOiBbeCwgMCwgel0sXG5cdFx0XHRcdFx0XHRzaGlwOiBzaGlwLFxuXHRcdFx0XHRcdFx0dHlwZSwgY29vbGRvd24sIHJlbG9hZFRpbWUsIGNsaXBcblx0XHRcdFx0XHR9KSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHorKztcblx0XHR9XG5cdH1cblxuXHRjb25zdCBjZW50ZXIgPSBbIDAsIDAsIDAgXTtcblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBzaGlwLmh1bGwubGVuZ3RoOyBpKyspIHtcblx0XHRjb25zdCB2ID0gc2hpcC5odWxsW2ldO1xuXHRcdGNlbnRlclswXSArPSB2WzBdO1xuXHRcdGNlbnRlclsxXSArPSB2WzFdO1xuXHRcdGNlbnRlclsyXSArPSB2WzJdO1xuXHR9XG5cdGNlbnRlclswXSAvPSBzaGlwLmh1bGwubGVuZ3RoO1xuXHRjZW50ZXJbMV0gLz0gc2hpcC5odWxsLmxlbmd0aDtcblx0Y2VudGVyWzJdIC89IHNoaXAuaHVsbC5sZW5ndGg7XG5cdFxuXHRjZW50ZXJbMF0gKz0gMC41O1xuXHRjZW50ZXJbMV0gKz0gMC41O1xuXHRjZW50ZXJbMl0gKz0gMC41O1xuXG5cdHNoaXAuY2VudGVyLmZyb21BcnJheShjZW50ZXIpO1xuXG5cdHNoaXAuaW5uZXJPYmplY3QucG9zaXRpb24uZnJvbUFycmF5KGNlbnRlcikubXVsdGlwbHlTY2FsYXIoLTEpO1xuXG5cdHJldHVybiByZXN1bHQ7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHJlYWRlcjsiLCJjb25zdCBjb250YWluZXIgPSByZXF1aXJlKCcuLi8uLi9jb250YWluZXInKTtcblxuY2xhc3MgU2hpcHMge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLmFwcCA9IGNvbnRhaW5lci5hcHA7XG4gICAgY29udGFpbmVyLnNoaXBzID0gdGhpcztcbiAgICB0aGlzLm9uQWRkID0gdGhpcy5vbkFkZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25EZXN0cm95ID0gdGhpcy5vbkRlc3Ryb3kuYmluZCh0aGlzKTtcblxuICAgIHRoaXMuc2lkZXMgPSB7fTtcbiAgfVxuXG4gIGdldFRhcmdldHMoc2hpcCkge1xuICBcdGNvbnN0IHRhcmdldHMgPSBbXTtcbiAgXHRmb3IgKGxldCBzaWRlIGluIHRoaXMuc2lkZXMpIHtcbiAgICAgIGlmIChzaWRlID09PSBzaGlwLnNpZGUpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gIFx0XHRmb3IgKGxldCBpZCBpbiB0aGlzLnNpZGVzW3NpZGVdKSB7XG4gIFx0XHRcdHRhcmdldHMucHVzaCh0aGlzLnNpZGVzW3NpZGVdW2lkXSk7XG4gIFx0XHR9XG4gIFx0fVxuXG4gIFx0cmV0dXJuIHRhcmdldHM7XG4gIH1cblxuICBvbkFkZChjb21wb25lbnQpIHtcbiAgICBpZiAoIWNvbXBvbmVudC5fX2lzU2hpcCkge1xuXHRcdFx0cmV0dXJuO1xuICAgIH1cblxuICAgIGlmICh0aGlzLnNpZGVzW2NvbXBvbmVudC5zaWRlXSA9PSBudWxsKSB7XG4gICAgXHR0aGlzLnNpZGVzW2NvbXBvbmVudC5zaWRlXSA9IHt9O1xuICAgIH1cblxuICAgIHRoaXMuc2lkZXNbY29tcG9uZW50LnNpZGVdW2NvbXBvbmVudC5faWRdID0gY29tcG9uZW50O1xuICB9XG5cbiAgb25EZXN0cm95KGNvbXBvbmVudCkge1xuICAgIGlmICghY29tcG9uZW50Ll9faXNTaGlwKSB7XG5cdFx0XHRyZXR1cm47XG4gICAgfVxuXG4gICAgZGVsZXRlIHRoaXMuc2lkZXNbY29tcG9uZW50LnNpZGVdW2NvbXBvbmVudC5faWRdO1xuICB9XG5cbiAgc3RhcnQoKSB7XG4gICAgZm9yIChsZXQgaWQgaW4gdGhpcy5hcHAubWFwKSB7XG4gICAgICB0aGlzLm9uQWRkKHRoaXMuYXBwLm1hcFtpZF0pO1xuICAgIH1cbiAgICB0aGlzLmFwcC5vbignYWRkJywgdGhpcy5vbkFkZCk7XG4gICAgdGhpcy5hcHAub24oJ2Rlc3RvcnknLCB0aGlzLm9uRGVzdHJveSk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICBcdHRoaXMuYXBwLm9mZignYWRkJywgdGhpcy5vbkFkZCk7XG4gIFx0dGhpcy5hcHAub2ZmKCdkZXN0b3J5JywgdGhpcy5vbkRlc3Ryb3kpO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gU2hpcHM7XG4iLCJjb25zdCBjb250YWluZXIgPSByZXF1aXJlKCcuLi8uLi9jb250YWluZXInKTtcblxuY2xhc3MgVHVycmVudCB7XG5cdGNvbnN0cnVjdG9yKHByb3BzKSB7XG5cdFx0dGhpcy5hcHAgPSBjb250YWluZXIuYXBwO1xuXG5cdFx0dGhpcy5sb2NhbFBvc2l0aW9uID0gXG5cdFx0XHRuZXcgVEhSRUUuVmVjdG9yMygpXG5cdFx0XHRcdC5mcm9tQXJyYXkocHJvcHMuY29vcmQpXG5cdFx0XHRcdC5hZGQobmV3IFRIUkVFLlZlY3RvcjMoMC41LCAwLjUsIDAuNSkpO1xuXHRcdHRoaXMuc2hpcCA9IHByb3BzLnNoaXA7XG5cblx0XHR0aGlzLnR5cGUgPSBwcm9wcy50eXBlO1xuXG5cdFx0dGhpcy5jb29sZG93biA9IHByb3BzLmNvb2xkb3duIHx8IDA7XG5cdFx0dGhpcy5jbGlwID0gcHJvcHMuY2xpcCB8fCAwO1xuXHRcdHRoaXMucmVsb2FkVGltZSA9IHByb3BzLnJlbG9hZFRpbWUgfHwgMTtcblxuXHRcdHRoaXMuYW1tbyA9IHRoaXMuY2xpcDtcblxuXHRcdHRoaXMuX2NvdW50ZXIgPSAwO1xuXHRcdHRoaXMuX3JlbG9hZFRpbWVyID0gMDtcblx0fVxuXG5cdHRpY2soZHQpIHtcblx0XHRpZiAodGhpcy5jb29sZG93biA9PSAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICh0aGlzLl9jb3VudGVyID4gdGhpcy5jb29sZG93bikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl9jb3VudGVyICs9IGR0O1xuXHR9XG5cblx0ZmlyZSh0YXJnZXQpIHtcblx0XHRpZiAodGhpcy5hbW1vIDw9IDApIHtcblx0XHRcdGlmICh0aGlzLl9yZWxvYWRUaW1lciA9PT0gMCkge1xuXHRcdFx0XHQvLyBTZXQgcmVsb2FkIHRpbWVyXG5cdFx0XHRcdHRoaXMuX3JlbG9hZFRpbWVyID0gdGhpcy5hcHAudGltZSArIHRoaXMucmVsb2FkVGltZTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fSBlbHNlIGlmICh0aGlzLmFwcC50aW1lID4gdGhpcy5fcmVsb2FkVGltZXIpIHtcblx0XHRcdFx0Ly8gUmVsb2FkIGRvbmVcblx0XHRcdFx0dGhpcy5fcmVsb2FkVGltZXIgPSAwO1xuXHRcdFx0XHR0aGlzLmFtbW8gPSB0aGlzLmNsaXA7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyBSZWxvYWRpbmcuLi5cblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNvb2xkb3duID09IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5fY291bnRlciA+IHRoaXMuY29vbGRvd24pIHtcblx0XHRcdHRoaXMuX2ZpcmUodGFyZ2V0KTtcblx0XHRcdHRoaXMuYW1tby0tO1xuXHRcdFx0dGhpcy5fY291bnRlciAtPSB0aGlzLmNvb2xkb3duO1xuXHRcdH1cblx0fVxuXG5cdGdldCBwb3NpdGlvbigpIHtcblx0XHRyZXR1cm4gdGhpcy5zaGlwLmlubmVyT2JqZWN0LmxvY2FsVG9Xb3JsZCh0aGlzLmxvY2FsUG9zaXRpb24uY2xvbmUoKSk7XG5cdH1cblxuXHQvLyB0YXJnZXQgeyBwb3NpdGlvbiB9XG5cdF9maXJlKHRhcmdldCkge1xuXHRcdGNvbnN0IHZlY3RvciA9IHRhcmdldC5wb3NpdGlvbi5jbG9uZSgpLnN1Yih0aGlzLnBvc2l0aW9uKTtcblxuXHRcdHRoaXMuYXBwLmFkZCh0aGlzLnR5cGUsIHtcblx0XHRcdHRhcmdldDogdGFyZ2V0LFxuXHRcdFx0dHVycmVudDogdGhpc1xuXHRcdH0pO1xuXHR9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gVHVycmVudDsiLCJjb25zdCBCb3R0bGUgPSByZXF1aXJlKCdib3R0bGVqcycpO1xuY29uc3QgcmVuZGVyZXIgPSByZXF1aXJlKCcuL3JlbmRlcmVyJyk7XG5cbmNvbnN0IGJvdHRsZSA9IG5ldyBCb3R0bGUoKTtcbmNvbnN0IGNvbnRhaW5lciA9IGJvdHRsZS5jb250YWluZXI7XG5cbmNvbnRhaW5lci5yZW5kZXJlciA9IHJlbmRlcmVyO1xuY29udGFpbmVyLnNjZW5lID0gcmVuZGVyZXIuc2NlbmU7XG5jb250YWluZXIuY2FtZXJhID0gcmVuZGVyZXIuY2FtZXJhO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGNvbnRhaW5lcjsiLCJmdW5jdGlvbiBndWlkKCkge1xuICBmdW5jdGlvbiBzNCgpIHtcbiAgICByZXR1cm4gTWF0aC5mbG9vcigoMSArIE1hdGgucmFuZG9tKCkpICogMHgxMDAwMClcbiAgICAgIC50b1N0cmluZygxNilcbiAgICAgIC5zdWJzdHJpbmcoMSk7XG4gIH1cbiAgcmV0dXJuIHM0KCkgKyBzNCgpICsgJy0nICsgczQoKSArICctJyArIHM0KCkgKyAnLScgK1xuICAgIHM0KCkgKyAnLScgKyBzNCgpICsgczQoKSArIHM0KCk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZ3VpZDsiLCJjb25zdCBhcHAgPSByZXF1aXJlKCcuL2FwcCcpO1xuY29uc3QgU2hpcCA9IHJlcXVpcmUoJy4vY29tcG9uZW50cy9zaGlwJyk7XG5jb25zdCBEcmFnQ2FtZXJhID0gcmVxdWlyZSgnLi9jb21wb25lbnRzL2RyYWdjYW1lcmEnKTtcbmNvbnN0IEFzdGVyb2lkID0gcmVxdWlyZSgnLi9jb21wb25lbnRzL2FzdGVyb2lkJyk7XG5jb25zdCBHcmlkID0gcmVxdWlyZSgnLi9jb21wb25lbnRzL2dyaWQnKTtcbmNvbnN0IFNoaXBzID0gcmVxdWlyZSgnLi9jb21wb25lbnRzL3NoaXAvc2hpcHMnKTtcblxuYXBwLnN0YXJ0KCk7XG5cbmNvbnN0IGZyaWdhdGUgPSByZXF1aXJlKCcuL3NoaXBzL2ZyaWdhdGUnKTtcblxuYXBwLmFkZChTaGlwcyk7XG5cbmNvbnN0IHNoaXAgPSBhcHAuYWRkKFNoaXAsIHsgXG5cdGRhdGE6IGZyaWdhdGUsIFxuXHRzaWRlOiAnMCcsXG5cdHJvdGF0aW9uOiBuZXcgVEhSRUUuRXVsZXIoMCwgTWF0aC5yYW5kb20oKSAqIE1hdGguUEkgKiAyKSB9KTtcbnNoaXAucG9zaXRpb24ueCA9IChNYXRoLnJhbmRvbSgpIC0gMC41KSAqIDEwMDtcbnNoaXAucG9zaXRpb24ueiA9IChNYXRoLnJhbmRvbSgpIC0gMC41KSAqIDEwMDtcblxuY29uc3Qgc2hpcDIgPSBhcHAuYWRkKFNoaXAsIHsgXG5cdGRhdGE6IGZyaWdhdGUsIFxuXHRzaWRlOiAnMScsXG5cdHJvdGF0aW9uOiBuZXcgVEhSRUUuRXVsZXIoMCwgTWF0aC5yYW5kb20oKSAqIE1hdGguUEkgKiAyKSB9KTtcbnNoaXAyLnBvc2l0aW9uLnggPSAoTWF0aC5yYW5kb20oKSAtIDAuNSkgKiAxMDA7XG5zaGlwMi5wb3NpdGlvbi56ID0gKE1hdGgucmFuZG9tKCkgLSAwLjUpICogMTAwO1xuXG4vLyBhcHAuYWRkKEFzdGVyb2lkKTtcbmNvbnN0IGRyYWdDYW1lcmEgPSBhcHAuYWRkKERyYWdDYW1lcmEpO1xuZHJhZ0NhbWVyYS5kaXN0YW5jZSA9IDIwMDtcblxuYXBwLmFkZChHcmlkKTsiLCJjb25zdCBUSFJFRSA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93WydUSFJFRSddIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbFsnVEhSRUUnXSA6IG51bGwpO1xuXG5jb25zdCByZW5kZXJlciA9IG5ldyBUSFJFRS5XZWJHTFJlbmRlcmVyKCk7XG5yZW5kZXJlci5zZXRTaXplKHdpbmRvdy5pbm5lcldpZHRoLCB3aW5kb3cuaW5uZXJIZWlnaHQpO1xuZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChyZW5kZXJlci5kb21FbGVtZW50KTtcbmNvbnN0IHNjZW5lID0gbmV3IFRIUkVFLlNjZW5lKCk7XG5jb25zdCBjYW1lcmEgPSBuZXcgVEhSRUUuUGVyc3BlY3RpdmVDYW1lcmEoNjAsIHdpbmRvdy5pbm5lcldpZHRoIC8gd2luZG93LmlubmVySGVpZ2h0LCAwLjEsIDUwMDApO1xuY2FtZXJhLnBvc2l0aW9uLnogPSA1O1xuXG5jb25zdCByZW5kZXIgPSAoKSA9PiB7XG5cdHJlbmRlcmVyLnJlbmRlcihzY2VuZSwgY2FtZXJhKTtcbn07XG5cbmNvbnN0IGFuaW1hdGUgPSAoKSA9PiB7XG5cdHJlbmRlcigpO1xuXHRyZXF1ZXN0QW5pbWF0aW9uRnJhbWUoYW5pbWF0ZSk7XG59O1xuXG5jb25zdCBvblJlc2l6ZSA9ICgpID0+IHtcblx0cmVuZGVyZXIuc2V0U2l6ZSh3aW5kb3cuaW5uZXJXaWR0aCwgd2luZG93LmlubmVySGVpZ2h0KTtcblx0Y2FtZXJhLmFzcGVjdCA9IHdpbmRvdy5pbm5lcldpZHRoIC8gd2luZG93LmlubmVySGVpZ2h0O1xuXHRjYW1lcmEudXBkYXRlUHJvamVjdGlvbk1hdHJpeCgpO1xufTtcblxud2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3Jlc2l6ZScsIG9uUmVzaXplKTtcblxuYW5pbWF0ZSgpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcblx0cmVuZGVyLFxuXHRzY2VuZSxcblx0Y2FtZXJhXG59OyIsIm1vZHVsZS5leHBvcnRzID0gYFxuSFVMTFxuIDAgICAgICAgICAwXG4gMCAgIDAgMCAgIDBcbjAwMDAwMDAwMDAwMDBcbjAwMDAwMDAwMDAwMDBcbiAwICAgMCAwICAgMFxuICAgICAgICAgIFxuXG5NT0RVTEVTXG4gMCAgICAgICAgIDBcbiAwICAgMGwwICAgMFxuMDAwMDAwMDAwMDAwMFxuMDAwMDAwQzAwMDAwMFxuIEUgICAwIDAgICBFXG4gICAgICAgICAgXG5gIiwiY29uc3QgcmFuZG9tVW5pdFZlY3RvciA9ICgpID0+IHtcbiAgY29uc3QgdGhldGEgPSBNYXRoLnJhbmRvbSgpICogMi4wICogTWF0aC5QSTtcblxuICBjb25zdCByYXdYID0gTWF0aC5zaW4odGhldGEpO1xuXG4gIGNvbnN0IHJhd1kgPSBNYXRoLmNvcyh0aGV0YSk7XG5cbiAgY29uc3QgeiA9IE1hdGgucmFuZG9tKCkgKiAyLjAgLSAxLjA7XG5cbiAgY29uc3QgcGhpID0gTWF0aC5hc2luKHopO1xuXG4gIGNvbnN0IHNjYWxhciA9IE1hdGguY29zKHBoaSk7XG5cbiAgY29uc3QgeCA9IHJhd1ggKiBzY2FsYXI7XG5cbiAgY29uc3QgeSA9IHJhd1kgKiBzY2FsYXI7XG5cbiAgcmV0dXJuIG5ldyBUSFJFRS5WZWN0b3IzKHgsIHksIHopOyAgXG59XG5cbmNvbnN0IHJhbmRvbVF1YXRlcm5pb24gPSAoKSA9PiB7XG5cdGNvbnN0IHZlY3RvciA9IHJhbmRvbVVuaXRWZWN0b3IoKTtcblx0cmV0dXJuIG5ldyBUSFJFRS5RdWF0ZXJuaW9uKCkuc2V0RnJvbVVuaXRWZWN0b3JzKG5ldyBUSFJFRS5WZWN0b3IzKDAsIDAsIDEpLCB2ZWN0b3IpO1xufTtcblxuY29uc3Qgbm9ybWFsaXplQW5nbGUgPSAoYW5nbGUpID0+IHtcblx0YW5nbGUgJT0gKE1hdGguUEkgKiAyKTtcblx0aWYgKGFuZ2xlID4gTWF0aC5QSSkge1xuXHRcdGFuZ2xlIC09IE1hdGguUEkgKiAyO1xuXHR9IGVsc2UgaWYgKGFuZ2xlIDwgLU1hdGguUEkpIHtcblx0XHRhbmdsZSArPSBNYXRoLlBJICogMjtcblx0fVxuXG5cdHJldHVybiBhbmdsZTtcbn07XG5cbmNvbnN0IGNsYW1wID0gKHYsIG1pbiwgbWF4KSA9PiB7XG5cdGlmICh2IDwgbWluKSB7XG5cdFx0cmV0dXJuIG1pbjtcblx0fSBlbHNlIGlmICh2ID4gbWF4KSB7XG5cdFx0cmV0dXJuIG1heDtcblx0fVxuXHRyZXR1cm4gdjtcbn07XG5cbmNvbnN0IGxpbmVhckJpbGxib2FyZCA9IChjYW1lcmEsIG9iamVjdCwgZGlyLCBxdWF0ZXJuaW9uKSA9PiB7XG5cdGNvbnN0IGEgPSBvYmplY3QucG9zaXRpb24uY2xvbmUoKS5zdWIoY2FtZXJhLnBvc2l0aW9uKS5ub3JtYWxpemUoKTtcblx0Y29uc3QgYiA9IGEuY2xvbmUoKS5wcm9qZWN0T25QbGFuZShkaXIpLm5vcm1hbGl6ZSgpO1xuXHRjb25zdCBjID0gbmV3IFRIUkVFLlZlY3RvcjMoMCwgMCwgMSkuYXBwbHlRdWF0ZXJuaW9uKHF1YXRlcm5pb24pO1xuXG5cdGNvbnN0IHF1YXQyID0gbmV3IFRIUkVFLlF1YXRlcm5pb24oKS5zZXRGcm9tVW5pdFZlY3RvcnMoYywgYik7XG5cblx0b2JqZWN0LnF1YXRlcm5pb24uY29weShuZXcgVEhSRUUuUXVhdGVybmlvbigpKTtcblx0b2JqZWN0LnF1YXRlcm5pb24ubXVsdGlwbHkocXVhdDIpO1xuXHRvYmplY3QucXVhdGVybmlvbi5tdWx0aXBseShxdWF0ZXJuaW9uKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7IHJhbmRvbVVuaXRWZWN0b3IsIHJhbmRvbVF1YXRlcm5pb24sIG5vcm1hbGl6ZUFuZ2xlLCBjbGFtcCwgbGluZWFyQmlsbGJvYXJkIH07XG4iLCJjbGFzcyBDaHVuayB7XG5cdGNvbnN0cnVjdG9yKHNpemUpIHtcblx0XHR0aGlzLnNpemUgPSBzaXplO1xuXHRcdHRoaXMueXogPSBzaXplICogc2l6ZTtcblx0XHR0aGlzLmRhdGEgPSBbXTtcblx0fVxuXG5cdGdldChpLCBqLCBrKSB7XG5cdFx0Y29uc3QgaW5kZXggPSBpICogdGhpcy55eiArIGogKiB0aGlzLnNpemUgKyBrO1xuXHRcdHJldHVybiB0aGlzLmRhdGFbaW5kZXhdO1xuXHR9XG5cblx0c2V0KGksIGosIGssIHYpIHtcblx0XHRjb25zdCBpbmRleCA9IGkgKiB0aGlzLnl6ICsgaiAqIHRoaXMuc2l6ZSArIGs7XG5cdFx0dGhpcy5kYXRhW2luZGV4XSA9IHY7XG5cdH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBDaHVuazsiLCJjb25zdCBDaHVuayA9IHJlcXVpcmUoJy4vY2h1bmsnKTtcblxuY2xhc3MgQ2h1bmtzIHtcblx0Y29uc3RydWN0b3Ioc2l6ZSkge1xuXHRcdHRoaXMuc2l6ZSA9IHNpemUgfHwgMTY7XG5cdFx0dGhpcy5tYXAgPSB7fTtcblx0fVxuXG5cdGdldChpLCBqLCBrKSB7XG5cdFx0Y29uc3Qgb3JpZ2luID0gdGhpcy5nZXRPcmlnaW4oaSwgaiwgayk7XG5cdFx0Y29uc3QgaWQgPSBvcmlnaW4uam9pbignLCcpO1xuXG5cdFx0Y29uc3QgcmVnaW9uID0gdGhpcy5tYXBbaWRdO1xuXHRcdGlmIChyZWdpb24gPT0gbnVsbCkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fSBcblxuXHRcdHJldHVybiByZWdpb24uY2h1bmsuZ2V0KGkgLSBvcmlnaW5bMF0sIGogLSBvcmlnaW5bMV0sIGsgLSBvcmlnaW5bMl0pO1xuXHR9XG5cblx0c2V0KGksIGosIGssIHYpIHtcblx0XHRjb25zdCBvcmlnaW4gPSB0aGlzLmdldE9yaWdpbihpLCBqLCBrKTtcblx0XHRjb25zdCBpZCA9IG9yaWdpbi5qb2luKCcsJyk7XG5cblx0XHRsZXQgcmVnaW9uID0gdGhpcy5tYXBbaWRdO1xuXHRcdGlmIChyZWdpb24gPT0gbnVsbCkge1xuXHRcdFx0cmVnaW9uID0gdGhpcy5tYXBbaWRdID0ge1xuXHRcdFx0XHRjaHVuazogbmV3IENodW5rKHRoaXMuc2l6ZSksXG5cdFx0XHRcdG9yaWdpbjogb3JpZ2luXG5cdFx0XHR9O1xuXHRcdH1cblx0XHRyZWdpb24uZGlydHkgPSB0cnVlO1xuXG5cdFx0cmVnaW9uLmNodW5rLnNldChpIC0gb3JpZ2luWzBdLCBqIC0gb3JpZ2luWzFdLCBrIC0gb3JpZ2luWzJdLCB2KTtcblx0fVxuXG5cdGdldE9yaWdpbihpLCBqLCBrKSB7XG5cdFx0cmV0dXJuIFsgXG5cdFx0XHRNYXRoLmZsb29yKGkgLyB0aGlzLnNpemUpICogdGhpcy5zaXplLFxuXHRcdFx0TWF0aC5mbG9vcihqIC8gdGhpcy5zaXplKSAqIHRoaXMuc2l6ZSxcblx0XHRcdE1hdGguZmxvb3IoayAvIHRoaXMuc2l6ZSkgKiB0aGlzLnNpemVcblx0XHRdXG5cdH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQ2h1bmtzOyIsImNvbnN0IG1lc2hlciA9IHJlcXVpcmUoJy4vbW9ub3RvbmUnKS5tZXNoZXI7XG5cbmNvbnN0IG1lc2hSZWdpb24gPSAocmVnaW9uLCBvYmplY3QsIG1hdGVyaWFsKSA9PiB7XG5cdGlmIChyZWdpb24ubWVzaCAhPSBudWxsKSB7XG5cdFx0b2JqZWN0LnJlbW92ZShyZWdpb24ubWVzaCk7XG5cdFx0cmVnaW9uLm1lc2guZ2VvbWV0cnkuZGlzcG9zZSgpO1xuXHR9XG5cblx0Y29uc3QgZ2VvbWV0cnkgPSBuZXcgVEhSRUUuR2VvbWV0cnkoKTtcblx0Y29uc3QgbWVzaCA9IG5ldyBUSFJFRS5NZXNoKGdlb21ldHJ5LCBtYXRlcmlhbCk7XG5cblx0Y29uc3QgY2h1bmsgPSByZWdpb24uY2h1bms7XG5cblx0Y29uc3QgZiA9IGNodW5rLmdldC5iaW5kKGNodW5rKTtcblx0Y29uc3QgZGltcyA9IFsgY2h1bmsuc2l6ZSwgY2h1bmsuc2l6ZSwgY2h1bmsuc2l6ZSBdO1xuXG5cdGNvbnN0IHJlc3VsdCA9IG1lc2hlcihmLCBkaW1zKTtcblxuXHRyZXN1bHQudmVydGljZXMuZm9yRWFjaCgodikgPT4ge1xuXHRcdGdlb21ldHJ5LnZlcnRpY2VzLnB1c2gobmV3IFRIUkVFLlZlY3RvcjModlswXSwgdlsxXSwgdlsyXSkpO1xuXHR9KTtcblxuXHRyZXN1bHQuZmFjZXMuZm9yRWFjaCgoZikgPT4ge1xuXHRcdGNvbnN0IGZhY2UgPSBuZXcgVEhSRUUuRmFjZTMoZlswXSwgZlsxXSwgZlsyXSk7XG5cdFx0ZmFjZS5tYXRlcmlhbEluZGV4ID0gZlszXTtcblx0XHRnZW9tZXRyeS5mYWNlcy5wdXNoKGZhY2UpO1xuXHR9KTtcblxuXHRvYmplY3QuYWRkKG1lc2gpO1xuXHRyZWdpb24ubWVzaCA9IG1lc2g7XG59O1xuXG5jb25zdCBtZXNoQ2h1bmtzID0gKGNodW5rcywgb2JqZWN0LCBtYXRlcmlhbCkgPT4ge1xuXHRsZXQgaWQsIHJlZ2lvbjtcblx0Zm9yIChpZCBpbiBjaHVua3MubWFwKSB7XG5cdFx0cmVnaW9uID0gY2h1bmtzLm1hcFtpZF07XG5cdFx0aWYgKHJlZ2lvbi5kaXJ0eSkge1xuXHRcdFx0bWVzaFJlZ2lvbihyZWdpb24sIG9iamVjdCwgbWF0ZXJpYWwpO1xuXHRcdFx0cmVnaW9uLmRpcnR5ID0gZmFsc2U7XG5cdFx0fVxuXHR9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IG1lc2hDaHVua3M7IiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbnZhciBNb25vdG9uZU1lc2ggPSAoZnVuY3Rpb24oKXtcblxuZnVuY3Rpb24gTW9ub3RvbmVQb2x5Z29uKGMsIHYsIHVsLCB1cikge1xuICB0aGlzLmNvbG9yICA9IGM7XG4gIHRoaXMubGVmdCAgID0gW1t1bCwgdl1dO1xuICB0aGlzLnJpZ2h0ICA9IFtbdXIsIHZdXTtcbn07XG5cbk1vbm90b25lUG9seWdvbi5wcm90b3R5cGUuY2xvc2Vfb2ZmID0gZnVuY3Rpb24odikge1xuICB0aGlzLmxlZnQucHVzaChbIHRoaXMubGVmdFt0aGlzLmxlZnQubGVuZ3RoLTFdWzBdLCB2IF0pO1xuICB0aGlzLnJpZ2h0LnB1c2goWyB0aGlzLnJpZ2h0W3RoaXMucmlnaHQubGVuZ3RoLTFdWzBdLCB2IF0pO1xufTtcblxuTW9ub3RvbmVQb2x5Z29uLnByb3RvdHlwZS5tZXJnZV9ydW4gPSBmdW5jdGlvbih2LCB1X2wsIHVfcikge1xuICB2YXIgbCA9IHRoaXMubGVmdFt0aGlzLmxlZnQubGVuZ3RoLTFdWzBdXG4gICAgLCByID0gdGhpcy5yaWdodFt0aGlzLnJpZ2h0Lmxlbmd0aC0xXVswXTsgXG4gIGlmKGwgIT09IHVfbCkge1xuICAgIHRoaXMubGVmdC5wdXNoKFsgbCwgdiBdKTtcbiAgICB0aGlzLmxlZnQucHVzaChbIHVfbCwgdiBdKTtcbiAgfVxuICBpZihyICE9PSB1X3IpIHtcbiAgICB0aGlzLnJpZ2h0LnB1c2goWyByLCB2IF0pO1xuICAgIHRoaXMucmlnaHQucHVzaChbIHVfciwgdiBdKTtcbiAgfVxufTtcblxuXG5yZXR1cm4gZnVuY3Rpb24oZiwgZGltcykge1xuICAvL1N3ZWVwIG92ZXIgMy1heGVzXG4gIHZhciB2ZXJ0aWNlcyA9IFtdLCBmYWNlcyA9IFtdO1xuICBmb3IodmFyIGQ9MDsgZDwzOyArK2QpIHtcbiAgICB2YXIgaSwgaiwga1xuICAgICAgLCB1ID0gKGQrMSklMyAgIC8vdSBhbmQgdiBhcmUgb3J0aG9nb25hbCBkaXJlY3Rpb25zIHRvIGRcbiAgICAgICwgdiA9IChkKzIpJTNcbiAgICAgICwgeCA9IG5ldyBJbnQzMkFycmF5KDMpXG4gICAgICAsIHEgPSBuZXcgSW50MzJBcnJheSgzKVxuICAgICAgLCBydW5zID0gbmV3IEludDMyQXJyYXkoMiAqIChkaW1zW3VdKzEpKVxuICAgICAgLCBmcm9udGllciA9IG5ldyBJbnQzMkFycmF5KGRpbXNbdV0pICAvL0Zyb250aWVyIGlzIGxpc3Qgb2YgcG9pbnRlcnMgdG8gcG9seWdvbnNcbiAgICAgICwgbmV4dF9mcm9udGllciA9IG5ldyBJbnQzMkFycmF5KGRpbXNbdV0pXG4gICAgICAsIGxlZnRfaW5kZXggPSBuZXcgSW50MzJBcnJheSgyICogZGltc1t2XSlcbiAgICAgICwgcmlnaHRfaW5kZXggPSBuZXcgSW50MzJBcnJheSgyICogZGltc1t2XSlcbiAgICAgICwgc3RhY2sgPSBuZXcgSW50MzJBcnJheSgyNCAqIGRpbXNbdl0pXG4gICAgICAsIGRlbHRhID0gW1swLDBdLCBbMCwwXV07XG4gICAgLy9xIHBvaW50cyBhbG9uZyBkLWRpcmVjdGlvblxuICAgIHFbZF0gPSAxO1xuICAgIC8vSW5pdGlhbGl6ZSBzZW50aW5lbFxuICAgIGZvcih4W2RdPS0xOyB4W2RdPGRpbXNbZF07ICkge1xuICAgICAgLy8gLS0tIFBlcmZvcm0gbW9ub3RvbmUgcG9seWdvbiBzdWJkaXZpc2lvbiAtLS1cbiAgICAgIHZhciBuID0gMFxuICAgICAgICAsIHBvbHlnb25zID0gW11cbiAgICAgICAgLCBuZiA9IDA7XG4gICAgICBmb3IoeFt2XT0wOyB4W3ZdPGRpbXNbdl07ICsreFt2XSkge1xuICAgICAgICAvL01ha2Ugb25lIHBhc3Mgb3ZlciB0aGUgdS1zY2FuIGxpbmUgb2YgdGhlIHZvbHVtZSB0byBydW4tbGVuZ3RoIGVuY29kZSBwb2x5Z29uXG4gICAgICAgIHZhciBuciA9IDAsIHAgPSAwLCBjID0gMDtcbiAgICAgICAgZm9yKHhbdV09MDsgeFt1XTxkaW1zW3VdOyArK3hbdV0sIHAgPSBjKSB7XG4gICAgICAgICAgLy9Db21wdXRlIHRoZSB0eXBlIGZvciB0aGlzIGZhY2VcbiAgICAgICAgICB2YXIgYSA9ICgwICAgIDw9IHhbZF0gICAgICA/IGYoeFswXSwgICAgICB4WzFdLCAgICAgIHhbMl0pICAgICAgOiAwKVxuICAgICAgICAgICAgLCBiID0gKHhbZF0gPCAgZGltc1tkXS0xID8gZih4WzBdK3FbMF0sIHhbMV0rcVsxXSwgeFsyXStxWzJdKSA6IDApO1xuICAgICAgICAgIGMgPSBhO1xuICAgICAgICAgIGlmKCghYSkgPT09ICghYikpIHtcbiAgICAgICAgICAgIGMgPSAwO1xuICAgICAgICAgIH0gZWxzZSBpZighYSkge1xuICAgICAgICAgICAgYyA9IC1iO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvL0lmIGNlbGwgdHlwZSBkb2Vzbid0IG1hdGNoLCBzdGFydCBhIG5ldyBydW5cbiAgICAgICAgICBpZihwICE9PSBjKSB7XG4gICAgICAgICAgICBydW5zW25yKytdID0geFt1XTtcbiAgICAgICAgICAgIHJ1bnNbbnIrK10gPSBjO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvL0FkZCBzZW50aW5lbCBydW5cbiAgICAgICAgcnVuc1tucisrXSA9IGRpbXNbdV07XG4gICAgICAgIHJ1bnNbbnIrK10gPSAwO1xuICAgICAgICAvL1VwZGF0ZSBmcm9udGllciBieSBtZXJnaW5nIHJ1bnNcbiAgICAgICAgdmFyIGZwID0gMDtcbiAgICAgICAgZm9yKHZhciBpPTAsIGo9MDsgaTxuZiAmJiBqPG5yLTI7ICkge1xuICAgICAgICAgIHZhciBwICAgID0gcG9seWdvbnNbZnJvbnRpZXJbaV1dXG4gICAgICAgICAgICAsIHBfbCAgPSBwLmxlZnRbcC5sZWZ0Lmxlbmd0aC0xXVswXVxuICAgICAgICAgICAgLCBwX3IgID0gcC5yaWdodFtwLnJpZ2h0Lmxlbmd0aC0xXVswXVxuICAgICAgICAgICAgLCBwX2MgID0gcC5jb2xvclxuICAgICAgICAgICAgLCByX2wgID0gcnVuc1tqXSAgICAvL1N0YXJ0IG9mIHJ1blxuICAgICAgICAgICAgLCByX3IgID0gcnVuc1tqKzJdICAvL0VuZCBvZiBydW5cbiAgICAgICAgICAgICwgcl9jICA9IHJ1bnNbaisxXTsgLy9Db2xvciBvZiBydW5cbiAgICAgICAgICAvL0NoZWNrIGlmIHdlIGNhbiBtZXJnZSBydW4gd2l0aCBwb2x5Z29uXG4gICAgICAgICAgaWYocl9yID4gcF9sICYmIHBfciA+IHJfbCAmJiByX2MgPT09IHBfYykge1xuICAgICAgICAgICAgLy9NZXJnZSBydW5cbiAgICAgICAgICAgIHAubWVyZ2VfcnVuKHhbdl0sIHJfbCwgcl9yKTtcbiAgICAgICAgICAgIC8vSW5zZXJ0IHBvbHlnb24gaW50byBmcm9udGllclxuICAgICAgICAgICAgbmV4dF9mcm9udGllcltmcCsrXSA9IGZyb250aWVyW2ldO1xuICAgICAgICAgICAgKytpO1xuICAgICAgICAgICAgaiArPSAyO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvL0NoZWNrIGlmIHdlIG5lZWQgdG8gYWR2YW5jZSB0aGUgcnVuIHBvaW50ZXJcbiAgICAgICAgICAgIGlmKHJfciA8PSBwX3IpIHtcbiAgICAgICAgICAgICAgaWYoISFyX2MpIHtcbiAgICAgICAgICAgICAgICB2YXIgbl9wb2x5ID0gbmV3IE1vbm90b25lUG9seWdvbihyX2MsIHhbdl0sIHJfbCwgcl9yKTtcbiAgICAgICAgICAgICAgICBuZXh0X2Zyb250aWVyW2ZwKytdID0gcG9seWdvbnMubGVuZ3RoO1xuICAgICAgICAgICAgICAgIHBvbHlnb25zLnB1c2gobl9wb2x5KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBqICs9IDI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvL0NoZWNrIGlmIHdlIG5lZWQgdG8gYWR2YW5jZSB0aGUgZnJvbnRpZXIgcG9pbnRlclxuICAgICAgICAgICAgaWYocF9yIDw9IHJfcikge1xuICAgICAgICAgICAgICBwLmNsb3NlX29mZih4W3ZdKTtcbiAgICAgICAgICAgICAgKytpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvL0Nsb3NlIG9mZiBhbnkgcmVzaWR1YWwgcG9seWdvbnNcbiAgICAgICAgZm9yKDsgaTxuZjsgKytpKSB7XG4gICAgICAgICAgcG9seWdvbnNbZnJvbnRpZXJbaV1dLmNsb3NlX29mZih4W3ZdKTtcbiAgICAgICAgfVxuICAgICAgICAvL0FkZCBhbnkgZXh0cmEgcnVucyB0byBmcm9udGllclxuICAgICAgICBmb3IoOyBqPG5yLTI7IGorPTIpIHtcbiAgICAgICAgICB2YXIgcl9sICA9IHJ1bnNbal1cbiAgICAgICAgICAgICwgcl9yICA9IHJ1bnNbaisyXVxuICAgICAgICAgICAgLCByX2MgID0gcnVuc1tqKzFdO1xuICAgICAgICAgIGlmKCEhcl9jKSB7XG4gICAgICAgICAgICB2YXIgbl9wb2x5ID0gbmV3IE1vbm90b25lUG9seWdvbihyX2MsIHhbdl0sIHJfbCwgcl9yKTtcbiAgICAgICAgICAgIG5leHRfZnJvbnRpZXJbZnArK10gPSBwb2x5Z29ucy5sZW5ndGg7XG4gICAgICAgICAgICBwb2x5Z29ucy5wdXNoKG5fcG9seSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vU3dhcCBmcm9udGllcnNcbiAgICAgICAgdmFyIHRtcCA9IG5leHRfZnJvbnRpZXI7XG4gICAgICAgIG5leHRfZnJvbnRpZXIgPSBmcm9udGllcjtcbiAgICAgICAgZnJvbnRpZXIgPSB0bXA7XG4gICAgICAgIG5mID0gZnA7XG4gICAgICB9XG4gICAgICAvL0Nsb3NlIG9mZiBmcm9udGllclxuICAgICAgZm9yKHZhciBpPTA7IGk8bmY7ICsraSkge1xuICAgICAgICB2YXIgcCA9IHBvbHlnb25zW2Zyb250aWVyW2ldXTtcbiAgICAgICAgcC5jbG9zZV9vZmYoZGltc1t2XSk7XG4gICAgICB9XG4gICAgICAvLyAtLS0gTW9ub3RvbmUgc3ViZGl2aXNpb24gb2YgcG9seWdvbiBpcyBjb21wbGV0ZSBhdCB0aGlzIHBvaW50IC0tLVxuICAgICAgXG4gICAgICB4W2RdKys7XG4gICAgICBcbiAgICAgIC8vTm93IHdlIGp1c3QgbmVlZCB0byB0cmlhbmd1bGF0ZSBlYWNoIG1vbm90b25lIHBvbHlnb25cbiAgICAgIGZvcih2YXIgaT0wOyBpPHBvbHlnb25zLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIHZhciBwID0gcG9seWdvbnNbaV1cbiAgICAgICAgICAsIGMgPSBwLmNvbG9yXG4gICAgICAgICAgLCBmbGlwcGVkID0gZmFsc2U7XG4gICAgICAgIGlmKGMgPCAwKSB7XG4gICAgICAgICAgZmxpcHBlZCA9IHRydWU7XG4gICAgICAgICAgYyA9IC1jO1xuICAgICAgICB9XG4gICAgICAgIGZvcih2YXIgaj0wOyBqPHAubGVmdC5sZW5ndGg7ICsraikge1xuICAgICAgICAgIGxlZnRfaW5kZXhbal0gPSB2ZXJ0aWNlcy5sZW5ndGg7XG4gICAgICAgICAgdmFyIHkgPSBbMC4wLDAuMCwwLjBdXG4gICAgICAgICAgICAsIHogPSBwLmxlZnRbal07XG4gICAgICAgICAgeVtkXSA9IHhbZF07XG4gICAgICAgICAgeVt1XSA9IHpbMF07XG4gICAgICAgICAgeVt2XSA9IHpbMV07XG4gICAgICAgICAgdmVydGljZXMucHVzaCh5KTtcbiAgICAgICAgfVxuICAgICAgICBmb3IodmFyIGo9MDsgajxwLnJpZ2h0Lmxlbmd0aDsgKytqKSB7XG4gICAgICAgICAgcmlnaHRfaW5kZXhbal0gPSB2ZXJ0aWNlcy5sZW5ndGg7XG4gICAgICAgICAgdmFyIHkgPSBbMC4wLDAuMCwwLjBdXG4gICAgICAgICAgICAsIHogPSBwLnJpZ2h0W2pdO1xuICAgICAgICAgIHlbZF0gPSB4W2RdO1xuICAgICAgICAgIHlbdV0gPSB6WzBdO1xuICAgICAgICAgIHlbdl0gPSB6WzFdO1xuICAgICAgICAgIHZlcnRpY2VzLnB1c2goeSk7XG4gICAgICAgIH1cbiAgICAgICAgLy9Ucmlhbmd1bGF0ZSB0aGUgbW9ub3RvbmUgcG9seWdvblxuICAgICAgICB2YXIgYm90dG9tID0gMFxuICAgICAgICAgICwgdG9wID0gMFxuICAgICAgICAgICwgbF9pID0gMVxuICAgICAgICAgICwgcl9pID0gMVxuICAgICAgICAgICwgc2lkZSA9IHRydWU7ICAvL3RydWUgPSByaWdodCwgZmFsc2UgPSBsZWZ0XG4gICAgICAgIFxuICAgICAgICBzdGFja1t0b3ArK10gPSBsZWZ0X2luZGV4WzBdO1xuICAgICAgICBzdGFja1t0b3ArK10gPSBwLmxlZnRbMF1bMF07XG4gICAgICAgIHN0YWNrW3RvcCsrXSA9IHAubGVmdFswXVsxXTtcbiAgICAgICAgXG4gICAgICAgIHN0YWNrW3RvcCsrXSA9IHJpZ2h0X2luZGV4WzBdO1xuICAgICAgICBzdGFja1t0b3ArK10gPSBwLnJpZ2h0WzBdWzBdO1xuICAgICAgICBzdGFja1t0b3ArK10gPSBwLnJpZ2h0WzBdWzFdO1xuICAgICAgICBcbiAgICAgICAgd2hpbGUobF9pIDwgcC5sZWZ0Lmxlbmd0aCB8fCByX2kgPCBwLnJpZ2h0Lmxlbmd0aCkge1xuICAgICAgICAgIC8vQ29tcHV0ZSBuZXh0IHNpZGVcbiAgICAgICAgICB2YXIgbl9zaWRlID0gZmFsc2U7XG4gICAgICAgICAgaWYobF9pID09PSBwLmxlZnQubGVuZ3RoKSB7XG4gICAgICAgICAgICBuX3NpZGUgPSB0cnVlO1xuICAgICAgICAgIH0gZWxzZSBpZihyX2kgIT09IHAucmlnaHQubGVuZ3RoKSB7XG4gICAgICAgICAgICB2YXIgbCA9IHAubGVmdFtsX2ldXG4gICAgICAgICAgICAgICwgciA9IHAucmlnaHRbcl9pXTtcbiAgICAgICAgICAgIG5fc2lkZSA9IGxbMV0gPiByWzFdO1xuICAgICAgICAgIH1cbiAgICAgICAgICB2YXIgaWR4ID0gbl9zaWRlID8gcmlnaHRfaW5kZXhbcl9pXSA6IGxlZnRfaW5kZXhbbF9pXVxuICAgICAgICAgICAgLCB2ZXJ0ID0gbl9zaWRlID8gcC5yaWdodFtyX2ldIDogcC5sZWZ0W2xfaV07XG4gICAgICAgICAgaWYobl9zaWRlICE9PSBzaWRlKSB7XG4gICAgICAgICAgICAvL09wcG9zaXRlIHNpZGVcbiAgICAgICAgICAgIHdoaWxlKGJvdHRvbSszIDwgdG9wKSB7XG4gICAgICAgICAgICAgIGlmKGZsaXBwZWQgPT09IG5fc2lkZSkge1xuICAgICAgICAgICAgICAgIGZhY2VzLnB1c2goWyBzdGFja1tib3R0b21dLCBzdGFja1tib3R0b20rM10sIGlkeCwgY10pO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGZhY2VzLnB1c2goWyBzdGFja1tib3R0b20rM10sIHN0YWNrW2JvdHRvbV0sIGlkeCwgY10pOyAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgYm90dG9tICs9IDM7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vU2FtZSBzaWRlXG4gICAgICAgICAgICB3aGlsZShib3R0b20rMyA8IHRvcCkge1xuICAgICAgICAgICAgICAvL0NvbXB1dGUgY29udmV4aXR5XG4gICAgICAgICAgICAgIGZvcih2YXIgaj0wOyBqPDI7ICsrailcbiAgICAgICAgICAgICAgZm9yKHZhciBrPTA7IGs8MjsgKytrKSB7XG4gICAgICAgICAgICAgICAgZGVsdGFbal1ba10gPSBzdGFja1t0b3AtMyooaisxKStrKzFdIC0gdmVydFtrXTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB2YXIgZGV0ID0gZGVsdGFbMF1bMF0gKiBkZWx0YVsxXVsxXSAtIGRlbHRhWzFdWzBdICogZGVsdGFbMF1bMV07XG4gICAgICAgICAgICAgIGlmKG5fc2lkZSA9PT0gKGRldCA+IDApKSB7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYoZGV0ICE9PSAwKSB7XG4gICAgICAgICAgICAgICAgaWYoZmxpcHBlZCA9PT0gbl9zaWRlKSB7XG4gICAgICAgICAgICAgICAgICBmYWNlcy5wdXNoKFsgc3RhY2tbdG9wLTNdLCBzdGFja1t0b3AtNl0sIGlkeCwgYyBdKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgZmFjZXMucHVzaChbIHN0YWNrW3RvcC02XSwgc3RhY2tbdG9wLTNdLCBpZHgsIGMgXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHRvcCAtPSAzO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICAvL1B1c2ggdmVydGV4XG4gICAgICAgICAgc3RhY2tbdG9wKytdID0gaWR4O1xuICAgICAgICAgIHN0YWNrW3RvcCsrXSA9IHZlcnRbMF07XG4gICAgICAgICAgc3RhY2tbdG9wKytdID0gdmVydFsxXTtcbiAgICAgICAgICAvL1VwZGF0ZSBsb29wIGluZGV4XG4gICAgICAgICAgaWYobl9zaWRlKSB7XG4gICAgICAgICAgICArK3JfaTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgKytsX2k7XG4gICAgICAgICAgfVxuICAgICAgICAgIHNpZGUgPSBuX3NpZGU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIHsgdmVydGljZXM6dmVydGljZXMsIGZhY2VzOmZhY2VzIH07XG59XG59KSgpO1xuXG5pZihleHBvcnRzKSB7XG4gIGV4cG9ydHMubWVzaGVyID0gTW9ub3RvbmVNZXNoO1xufVxuIl19
