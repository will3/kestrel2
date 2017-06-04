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
(function (global){
/*jshint -W054 */
(function (exports) {
  'use strict';

  // http://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
  function shuffle(array) {
    var currentIndex = array.length
      , temporaryValue
      , randomIndex
      ;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {

      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex -= 1;

      // And swap it with the current element.
      temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;
    }

    return array;
  }

  exports.knuthShuffle = shuffle;
}('undefined' !== typeof exports && exports || 'undefined' !== typeof window && window || global));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],18:[function(require,module,exports){
/*
 * A speed-improved perlin and simplex noise algorithms for 2D.
 *
 * Based on example code by Stefan Gustavson (stegu@itn.liu.se).
 * Optimisations by Peter Eastman (peastman@drizzle.stanford.edu).
 * Better rank ordering method by Stefan Gustavson in 2012.
 * Converted to Javascript by Joseph Gentle.
 *
 * Version 2012-03-09
 *
 * This code was placed in the public domain by its original author,
 * Stefan Gustavson. You may use it as you see fit, but
 * attribution is appreciated.
 *
 */

(function(global){
  var module = global.noise = {};

  function Grad(x, y, z) {
    this.x = x; this.y = y; this.z = z;
  }
  
  Grad.prototype.dot2 = function(x, y) {
    return this.x*x + this.y*y;
  };

  Grad.prototype.dot3 = function(x, y, z) {
    return this.x*x + this.y*y + this.z*z;
  };

  var grad3 = [new Grad(1,1,0),new Grad(-1,1,0),new Grad(1,-1,0),new Grad(-1,-1,0),
               new Grad(1,0,1),new Grad(-1,0,1),new Grad(1,0,-1),new Grad(-1,0,-1),
               new Grad(0,1,1),new Grad(0,-1,1),new Grad(0,1,-1),new Grad(0,-1,-1)];

  var p = [151,160,137,91,90,15,
  131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,
  190, 6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,
  88,237,149,56,87,174,20,125,136,171,168, 68,175,74,165,71,134,139,48,27,166,
  77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,
  102,143,54, 65,25,63,161, 1,216,80,73,209,76,132,187,208, 89,18,169,200,196,
  135,130,116,188,159,86,164,100,109,198,173,186, 3,64,52,217,226,250,124,123,
  5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,
  223,183,170,213,119,248,152, 2,44,154,163, 70,221,153,101,155,167, 43,172,9,
  129,22,39,253, 19,98,108,110,79,113,224,232,178,185, 112,104,218,246,97,228,
  251,34,242,193,238,210,144,12,191,179,162,241, 81,51,145,235,249,14,239,107,
  49,192,214, 31,181,199,106,157,184, 84,204,176,115,121,50,45,127, 4,150,254,
  138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
  // To remove the need for index wrapping, double the permutation table length
  var perm = new Array(512);
  var gradP = new Array(512);

  // This isn't a very good seeding function, but it works ok. It supports 2^16
  // different seed values. Write something better if you need more seeds.
  module.seed = function(seed) {
    if(seed > 0 && seed < 1) {
      // Scale the seed out
      seed *= 65536;
    }

    seed = Math.floor(seed);
    if(seed < 256) {
      seed |= seed << 8;
    }

    for(var i = 0; i < 256; i++) {
      var v;
      if (i & 1) {
        v = p[i] ^ (seed & 255);
      } else {
        v = p[i] ^ ((seed>>8) & 255);
      }

      perm[i] = perm[i + 256] = v;
      gradP[i] = gradP[i + 256] = grad3[v % 12];
    }
  };

  module.seed(0);

  /*
  for(var i=0; i<256; i++) {
    perm[i] = perm[i + 256] = p[i];
    gradP[i] = gradP[i + 256] = grad3[perm[i] % 12];
  }*/

  // Skewing and unskewing factors for 2, 3, and 4 dimensions
  var F2 = 0.5*(Math.sqrt(3)-1);
  var G2 = (3-Math.sqrt(3))/6;

  var F3 = 1/3;
  var G3 = 1/6;

  // 2D simplex noise
  module.simplex2 = function(xin, yin) {
    var n0, n1, n2; // Noise contributions from the three corners
    // Skew the input space to determine which simplex cell we're in
    var s = (xin+yin)*F2; // Hairy factor for 2D
    var i = Math.floor(xin+s);
    var j = Math.floor(yin+s);
    var t = (i+j)*G2;
    var x0 = xin-i+t; // The x,y distances from the cell origin, unskewed.
    var y0 = yin-j+t;
    // For the 2D case, the simplex shape is an equilateral triangle.
    // Determine which simplex we are in.
    var i1, j1; // Offsets for second (middle) corner of simplex in (i,j) coords
    if(x0>y0) { // lower triangle, XY order: (0,0)->(1,0)->(1,1)
      i1=1; j1=0;
    } else {    // upper triangle, YX order: (0,0)->(0,1)->(1,1)
      i1=0; j1=1;
    }
    // A step of (1,0) in (i,j) means a step of (1-c,-c) in (x,y), and
    // a step of (0,1) in (i,j) means a step of (-c,1-c) in (x,y), where
    // c = (3-sqrt(3))/6
    var x1 = x0 - i1 + G2; // Offsets for middle corner in (x,y) unskewed coords
    var y1 = y0 - j1 + G2;
    var x2 = x0 - 1 + 2 * G2; // Offsets for last corner in (x,y) unskewed coords
    var y2 = y0 - 1 + 2 * G2;
    // Work out the hashed gradient indices of the three simplex corners
    i &= 255;
    j &= 255;
    var gi0 = gradP[i+perm[j]];
    var gi1 = gradP[i+i1+perm[j+j1]];
    var gi2 = gradP[i+1+perm[j+1]];
    // Calculate the contribution from the three corners
    var t0 = 0.5 - x0*x0-y0*y0;
    if(t0<0) {
      n0 = 0;
    } else {
      t0 *= t0;
      n0 = t0 * t0 * gi0.dot2(x0, y0);  // (x,y) of grad3 used for 2D gradient
    }
    var t1 = 0.5 - x1*x1-y1*y1;
    if(t1<0) {
      n1 = 0;
    } else {
      t1 *= t1;
      n1 = t1 * t1 * gi1.dot2(x1, y1);
    }
    var t2 = 0.5 - x2*x2-y2*y2;
    if(t2<0) {
      n2 = 0;
    } else {
      t2 *= t2;
      n2 = t2 * t2 * gi2.dot2(x2, y2);
    }
    // Add contributions from each corner to get the final noise value.
    // The result is scaled to return values in the interval [-1,1].
    return 70 * (n0 + n1 + n2);
  };

  // 3D simplex noise
  module.simplex3 = function(xin, yin, zin) {
    var n0, n1, n2, n3; // Noise contributions from the four corners

    // Skew the input space to determine which simplex cell we're in
    var s = (xin+yin+zin)*F3; // Hairy factor for 2D
    var i = Math.floor(xin+s);
    var j = Math.floor(yin+s);
    var k = Math.floor(zin+s);

    var t = (i+j+k)*G3;
    var x0 = xin-i+t; // The x,y distances from the cell origin, unskewed.
    var y0 = yin-j+t;
    var z0 = zin-k+t;

    // For the 3D case, the simplex shape is a slightly irregular tetrahedron.
    // Determine which simplex we are in.
    var i1, j1, k1; // Offsets for second corner of simplex in (i,j,k) coords
    var i2, j2, k2; // Offsets for third corner of simplex in (i,j,k) coords
    if(x0 >= y0) {
      if(y0 >= z0)      { i1=1; j1=0; k1=0; i2=1; j2=1; k2=0; }
      else if(x0 >= z0) { i1=1; j1=0; k1=0; i2=1; j2=0; k2=1; }
      else              { i1=0; j1=0; k1=1; i2=1; j2=0; k2=1; }
    } else {
      if(y0 < z0)      { i1=0; j1=0; k1=1; i2=0; j2=1; k2=1; }
      else if(x0 < z0) { i1=0; j1=1; k1=0; i2=0; j2=1; k2=1; }
      else             { i1=0; j1=1; k1=0; i2=1; j2=1; k2=0; }
    }
    // A step of (1,0,0) in (i,j,k) means a step of (1-c,-c,-c) in (x,y,z),
    // a step of (0,1,0) in (i,j,k) means a step of (-c,1-c,-c) in (x,y,z), and
    // a step of (0,0,1) in (i,j,k) means a step of (-c,-c,1-c) in (x,y,z), where
    // c = 1/6.
    var x1 = x0 - i1 + G3; // Offsets for second corner
    var y1 = y0 - j1 + G3;
    var z1 = z0 - k1 + G3;

    var x2 = x0 - i2 + 2 * G3; // Offsets for third corner
    var y2 = y0 - j2 + 2 * G3;
    var z2 = z0 - k2 + 2 * G3;

    var x3 = x0 - 1 + 3 * G3; // Offsets for fourth corner
    var y3 = y0 - 1 + 3 * G3;
    var z3 = z0 - 1 + 3 * G3;

    // Work out the hashed gradient indices of the four simplex corners
    i &= 255;
    j &= 255;
    k &= 255;
    var gi0 = gradP[i+   perm[j+   perm[k   ]]];
    var gi1 = gradP[i+i1+perm[j+j1+perm[k+k1]]];
    var gi2 = gradP[i+i2+perm[j+j2+perm[k+k2]]];
    var gi3 = gradP[i+ 1+perm[j+ 1+perm[k+ 1]]];

    // Calculate the contribution from the four corners
    var t0 = 0.5 - x0*x0-y0*y0-z0*z0;
    if(t0<0) {
      n0 = 0;
    } else {
      t0 *= t0;
      n0 = t0 * t0 * gi0.dot3(x0, y0, z0);  // (x,y) of grad3 used for 2D gradient
    }
    var t1 = 0.5 - x1*x1-y1*y1-z1*z1;
    if(t1<0) {
      n1 = 0;
    } else {
      t1 *= t1;
      n1 = t1 * t1 * gi1.dot3(x1, y1, z1);
    }
    var t2 = 0.5 - x2*x2-y2*y2-z2*z2;
    if(t2<0) {
      n2 = 0;
    } else {
      t2 *= t2;
      n2 = t2 * t2 * gi2.dot3(x2, y2, z2);
    }
    var t3 = 0.5 - x3*x3-y3*y3-z3*z3;
    if(t3<0) {
      n3 = 0;
    } else {
      t3 *= t3;
      n3 = t3 * t3 * gi3.dot3(x3, y3, z3);
    }
    // Add contributions from each corner to get the final noise value.
    // The result is scaled to return values in the interval [-1,1].
    return 32 * (n0 + n1 + n2 + n3);

  };

  // ##### Perlin noise stuff

  function fade(t) {
    return t*t*t*(t*(t*6-15)+10);
  }

  function lerp(a, b, t) {
    return (1-t)*a + t*b;
  }

  // 2D Perlin Noise
  module.perlin2 = function(x, y) {
    // Find unit grid cell containing point
    var X = Math.floor(x), Y = Math.floor(y);
    // Get relative xy coordinates of point within that cell
    x = x - X; y = y - Y;
    // Wrap the integer cells at 255 (smaller integer period can be introduced here)
    X = X & 255; Y = Y & 255;

    // Calculate noise contributions from each of the four corners
    var n00 = gradP[X+perm[Y]].dot2(x, y);
    var n01 = gradP[X+perm[Y+1]].dot2(x, y-1);
    var n10 = gradP[X+1+perm[Y]].dot2(x-1, y);
    var n11 = gradP[X+1+perm[Y+1]].dot2(x-1, y-1);

    // Compute the fade curve value for x
    var u = fade(x);

    // Interpolate the four results
    return lerp(
        lerp(n00, n10, u),
        lerp(n01, n11, u),
       fade(y));
  };

  // 3D Perlin Noise
  module.perlin3 = function(x, y, z) {
    // Find unit grid cell containing point
    var X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
    // Get relative xyz coordinates of point within that cell
    x = x - X; y = y - Y; z = z - Z;
    // Wrap the integer cells at 255 (smaller integer period can be introduced here)
    X = X & 255; Y = Y & 255; Z = Z & 255;

    // Calculate noise contributions from each of the eight corners
    var n000 = gradP[X+  perm[Y+  perm[Z  ]]].dot3(x,   y,     z);
    var n001 = gradP[X+  perm[Y+  perm[Z+1]]].dot3(x,   y,   z-1);
    var n010 = gradP[X+  perm[Y+1+perm[Z  ]]].dot3(x,   y-1,   z);
    var n011 = gradP[X+  perm[Y+1+perm[Z+1]]].dot3(x,   y-1, z-1);
    var n100 = gradP[X+1+perm[Y+  perm[Z  ]]].dot3(x-1,   y,   z);
    var n101 = gradP[X+1+perm[Y+  perm[Z+1]]].dot3(x-1,   y, z-1);
    var n110 = gradP[X+1+perm[Y+1+perm[Z  ]]].dot3(x-1, y-1,   z);
    var n111 = gradP[X+1+perm[Y+1+perm[Z+1]]].dot3(x-1, y-1, z-1);

    // Compute the fade curve value for x, y, z
    var u = fade(x);
    var v = fade(y);
    var w = fade(z);

    // Interpolate
    return lerp(
        lerp(
          lerp(n000, n100, u),
          lerp(n001, n101, u), w),
        lerp(
          lerp(n010, n110, u),
          lerp(n011, n111, u), w),
       v);
  };

})(typeof module === "undefined" ? this : module.exports);
},{}],19:[function(require,module,exports){
const container = require('../container');
const randomQuaternion = require('../utils/math').randomQuaternion;

class Asteroid {
	constructor(props) {
		props = props || {};
		this.size = props.size || 1;
		this.scene = container.scene;
		const geometry = new THREE.IcosahedronGeometry(3.5 * this.size);
		// geometry.computeFlatVertexNormals();
		const material = new THREE.MeshBasicMaterial({
			color: 0xCCCCCC
		});
		this.object = new THREE.Mesh(geometry, material);
		this.object.quaternion.copy(randomQuaternion());
		if (props.position != null) {
			this.object.position.copy(props.position);
		}
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
},{"../container":32,"../utils/math":40}],20:[function(require,module,exports){
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
},{"../container":32,"../utils/math":40}],21:[function(require,module,exports){
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
},{"../container":32}],22:[function(require,module,exports){
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

},{"../container":32,"./particlesystem":26}],23:[function(require,module,exports){
const container = require('../container');

class Grid {
  constructor(props) {
    props = props || {};
    this.axis = [1, Math.sqrt(3) / 2];
    this.scene = container.scene;
    this.width = props.width || 100;
    this.height = props.height || 100;
    this.size = props.size || 12;
  }

  hexToCoord(i, j) {
    i -= this.width / 2;
    j -= this.height / 2;
    return [
      (this.axis[0] * i + ((j % 2 === 0) ? this.axis[1] / 2 : 0)) * this.size,
      this.axis[1] * j * this.size
    ];
  }

  getSurroundingCoords(coord) {
    const i = coord[0];
    const j = coord[1];

    if (j % 2 === 0) {
      return [
        [i - 1, j - 1],
        [i, j - 1],
        [i - 1, j],
        [i + 1, j],
        [i, j + 1],
        [i - 1, j + 1],
      ];
    } else {
      return [
        [i + 1, j - 1],
        [i, j - 1],
        [i - 1, j],
        [i + 1, j],
        [i, j + 1],
        [i + 1, j + 1],
      ];
    }
  }

  start() {
    for (let i = 0; i < this.width; i++) {
      for (let j = 0; j < this.height; j++) {

        const sprite = new THREE.Sprite();
        const screen = this.hexToCoord(i, j);
        sprite.position.x = screen[0];
        sprite.position.z = screen[1];

        // this.scene.add(sprite);
      }
    }
  }

  place(ships, side) {

  }
}

module.exports = Grid;

},{"../container":32}],24:[function(require,module,exports){
const container = require('../container');

class Laser {
  constructor(props) {
    this.target = props.target;
    this.turrent = props.turrent;

    this.scene = container.scene;
    this.app = container.app;
    this.collisions = container.collisions;

    this.object = new THREE.Sprite();
    this.object.scale.set(2, 2, 2);

    this.speed = 200;

    this.life = 10000;

    this.onCollision = this.onCollision.bind(this);

    this.body = {
      type: 'ray',
      raycaster: new THREE.Raycaster(),
      onCollision: this.onCollision
    };
  }

  onCollision(collision) {
    const entity = collision.body.entity;
    if (entity === this.turrent.ship) {
      return;
    }

    // Explosion
    this.app.destroy(this);
  }

  start() {
  	this.object.position.copy(this.turrent.position);
  	this.scene.add(this.object);

    const dis = this.turrent.position.distanceTo(this.target.position);
    const time = dis / this.speed;
    const leading = this.target.velocity.clone().multiplyScalar(time);
  	this.velocity = this.target.position.clone()
      .add(leading)
      .sub(this.turrent.position)
      .normalize()
      .multiplyScalar(this.speed);

  	this.dieTime = new Date().getTime() + this.life;

    this.collisions.add(this.body);
  }

  destroy() {
  	this.scene.remove(this.object);
    this.collisions.remove(this.body);
  }

  tick(dt) {
    const velocity = this.velocity.clone().multiplyScalar(dt);
  	this.object.position.add(velocity);

  	if (new Date().getTime() > this.dieTime) {
  		this.app.destroy(this);
  	}

    this.body.raycaster = new THREE.Raycaster(
      this.object.position, 
      velocity.clone().normalize(),
      0,
      velocity.length());
  }
}

module.exports = Laser;

},{"../container":32}],25:[function(require,module,exports){
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
},{"../container":32}],26:[function(require,module,exports){
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
},{"../container":32,"./particle":25}],27:[function(require,module,exports){
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

		this.ship.orbit(this.target.position, 100);

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
},{"../../container":32}],28:[function(require,module,exports){
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
		this.app = container.app;
		this.collisions = container.collisions;

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
		this.power = 6;

		this.velocity = new THREE.Vector3();

		this.friction = 0.5;

		this.hull = [];

		this.ai = new AI({
			ship: this
		});

		this.side = props.side || 0;

		this.hull = [];
		this.center = new THREE.Vector3();

		this.onCollision = this.onCollision.bind(this);
		this.body = {
			type: 'mesh',
			onCollision: this.onCollision,
			mesh: this.innerObject,
			entity: this
		}
	}

	onCollision(collision) {

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

		this.collisions.add(this.body);
	}

	destroy() {
		this.scene.remove(this.object);
		this.collisions.remove(this.body);
	}

	tick() {
		const dt = this.app.delta;
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
		this.object.position.add(this.velocity.clone().multiplyScalar(dt));

		this.velocity.multiplyScalar(Math.pow(this.friction, dt));

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
}

module.exports = Ship;
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../../container":32,"../../utils/math":40,"../../voxel/chunks":42,"../../voxel/mesher":43,"./ai":27,"./reader":29}],29:[function(require,module,exports){
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
					const clip = 3;

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
},{"../../container":32,"../beam":20,"../engine":22,"../laser":24,"./turrent":31}],30:[function(require,module,exports){
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

},{"../../container":32}],31:[function(require,module,exports){
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
},{"../../container":32}],32:[function(require,module,exports){
const Bottle = require('bottlejs');
const app = require('./core/app');

const bottle = new Bottle();
const container = bottle.container;

container.app = app;
container.renderer = app.renderer;
container.collisions = app.collisions;
container.scene = app.renderer.scene;
container.camera = app.renderer.camera;

module.exports = container;
},{"./core/app":33,"bottlejs":1}],33:[function(require,module,exports){
const guid = require('./guid');
const ee = require('event-emitter');
const renderer = require('./renderer');
const Collisions = require('./collisions');

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

		this.renderer = renderer;
		this.collisions = new Collisions({ app: this });

		this.animate = this.animate.bind(this);
		
		this.time = 0;
		this.delta = 1000 / 60;
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
		this.collisions.tick();
		
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
		this.delta = frameRate;

		requestAnimationFrame(this.animate);
	}

	start() {
		this.animate();
	}
};

ee(App.prototype);

module.exports = new App();
},{"./collisions":34,"./guid":35,"./renderer":36,"event-emitter":16}],34:[function(require,module,exports){
const guid = require('./guid');

class Collisions {
	constructor(props) {
		this.map = {};
		this.app = props.app;
	}

	add(body) {
		if (body._id == null) {
			body._id = guid();
		}

		this.map[body._id] = body;
	}

	remove(body) {
		delete this.map[body._id];
	}

	tick() {
		const keys = Object.keys(this.map);

		for (let i = 0; i < keys.length; i++) {
			for (let j = i + 1; j < keys.length; j++) {
				const a = this.map[keys[i]];
				const b = this.map[keys[j]];

				// Resolve a, b				
				if (a.type === 'ray' && b.type === 'mesh') {
					this.hitTestRayMesh(a, b);
				} else if (a.type === 'mesh' && b.type === 'ray') {
					this.hitTestRayMesh(b, a);
				}
			}
		}
	}

	hitTestRayMesh(ray, mesh) {
		const delta = this.app.delta;

		const raycaster = ray.raycaster;
		const results = raycaster.intersectObject(mesh.mesh, true);

		if (results.length === 0) {
			return;
		}

		if (ray.onCollision != null) {
			ray.onCollision({
				results: results,
				body: mesh
			});
		}

		if (mesh.onCollision != null) {
			mesh.onCollision({
				results: results,
				body: ray
			});
		}
	}
};

module.exports = Collisions;
},{"./guid":35}],35:[function(require,module,exports){
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
},{}],36:[function(require,module,exports){
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

},{}],37:[function(require,module,exports){
class Fleet {
	constructor(props) {
		this.ships = props.ships;
	}
}

module.exports = Fleet;
},{}],38:[function(require,module,exports){
const app = require('./core/app');
const container = require('./container');
const Ship = require('./components/ship');
const DragCamera = require('./components/dragcamera');
const Asteroid = require('./components/asteroid');
const Grid = require('./components/grid');
const Ships = require('./components/ship/ships');
const Fleet = require('./fleet');

app.start();
app.add(Ships);

const frigate = require('./ships/frigate');
const ship = app.add(Ship, { 
	data: frigate, 
	side: '0' });

const fleet = new Fleet({
	ships: [ship]
});
container.fleet = fleet;

const grid = app.add(Grid);

grid.place(fleet.ships);

const dragCamera = app.add(DragCamera);
dragCamera.distance = 200;

const noise = require('perlin').noise;
noise.seed(Math.random());

const asteroids = {};

for (let i = 0; i < grid.width; i++) {
	for (let j = 0; j < grid.height; j++) {
		const coord = grid.hexToCoord(i, j);
		const dis = Math.sqrt(coord[0] * coord[0] + coord[1] * coord[1]);

		let ratio = Math.pow((-dis + 500) / 500, 0.5);
		if (ratio > 1) {
			ratio = 1;
		} else if (ratio < 0) {
			ratio = 0;
		}

		const n1 = noise.simplex2(coord[0] * 0.005, coord[1] * 0.005);
		const n2 = noise.simplex2(coord[0] * 0.1, coord[1] * 0.1) * 0.7;
		const n = (n1 + n2) * ratio;

		if (n > 0.7) {
			const size = n > 0.95 ? 4 : n > 0.9 ? 3 : n > 0.8 ? 2 : 1;

			const id = [i, j].join(',');
			asteroids[id] = {
				size: size,
				position: new THREE.Vector3(coord[0], 0, coord[1]),
				coord: [i, j]
			};
		}
	}
}

const shuffle = require('knuth-shuffle').knuthShuffle;
const ids = shuffle(Object.keys(asteroids));
for (let i = 0; i < ids.length; i++) {
	const asteroid = asteroids[ids[i]];
	if (asteroid.removed) {
		continue;
	}
	if (asteroid.size >= 3) {
		// Remove asteroid around
		const coords = grid.getSurroundingCoords(asteroid.coord);

		for (let j = 0; j < coords.length; j++) {
			const coord = coords[j];
			const id = coord.join(',');
			if (asteroids[id] == null) {
				continue;
			}
			asteroids[id].removed = true;
		}
	}
}

for (let id in asteroids) {
	const asteroid = asteroids[id];
	if (asteroid.removed) {
		continue;
	}
	app.add(Asteroid, {
		position: asteroid.position,
		size: asteroid.size
	});
}

// const ambientLight = new THREE.AmbientLight(0xAAAAAA);
// const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
// directionalLight.position.set(0.5, 1.0, 0.3);

// const scene = app.renderer.scene;

// scene.add(ambientLight);
// scene.add(directionalLight);
},{"./components/asteroid":19,"./components/dragcamera":21,"./components/grid":23,"./components/ship":28,"./components/ship/ships":30,"./container":32,"./core/app":33,"./fleet":37,"./ships/frigate":39,"knuth-shuffle":17,"perlin":18}],39:[function(require,module,exports){
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
},{}],40:[function(require,module,exports){
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

},{}],41:[function(require,module,exports){
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
},{}],42:[function(require,module,exports){
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
},{"./chunk":41}],43:[function(require,module,exports){
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
},{"./monotone":44}],44:[function(require,module,exports){
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

},{}]},{},[38])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYm90dGxlanMvZGlzdC9ib3R0bGUuanMiLCJub2RlX21vZHVsZXMvZC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9lczUtZXh0L29iamVjdC9hc3NpZ24vaW5kZXguanMiLCJub2RlX21vZHVsZXMvZXM1LWV4dC9vYmplY3QvYXNzaWduL2lzLWltcGxlbWVudGVkLmpzIiwibm9kZV9tb2R1bGVzL2VzNS1leHQvb2JqZWN0L2Fzc2lnbi9zaGltLmpzIiwibm9kZV9tb2R1bGVzL2VzNS1leHQvb2JqZWN0L2lzLWNhbGxhYmxlLmpzIiwibm9kZV9tb2R1bGVzL2VzNS1leHQvb2JqZWN0L2tleXMvaW5kZXguanMiLCJub2RlX21vZHVsZXMvZXM1LWV4dC9vYmplY3Qva2V5cy9pcy1pbXBsZW1lbnRlZC5qcyIsIm5vZGVfbW9kdWxlcy9lczUtZXh0L29iamVjdC9rZXlzL3NoaW0uanMiLCJub2RlX21vZHVsZXMvZXM1LWV4dC9vYmplY3Qvbm9ybWFsaXplLW9wdGlvbnMuanMiLCJub2RlX21vZHVsZXMvZXM1LWV4dC9vYmplY3QvdmFsaWQtY2FsbGFibGUuanMiLCJub2RlX21vZHVsZXMvZXM1LWV4dC9vYmplY3QvdmFsaWQtdmFsdWUuanMiLCJub2RlX21vZHVsZXMvZXM1LWV4dC9zdHJpbmcvIy9jb250YWlucy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9lczUtZXh0L3N0cmluZy8jL2NvbnRhaW5zL2lzLWltcGxlbWVudGVkLmpzIiwibm9kZV9tb2R1bGVzL2VzNS1leHQvc3RyaW5nLyMvY29udGFpbnMvc2hpbS5qcyIsIm5vZGVfbW9kdWxlcy9ldmVudC1lbWl0dGVyL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2tudXRoLXNodWZmbGUvaW5kZXguanMiLCJub2RlX21vZHVsZXMvcGVybGluL2luZGV4LmpzIiwic3JjL2NvbXBvbmVudHMvYXN0ZXJvaWQuanMiLCJzcmMvY29tcG9uZW50cy9iZWFtLmpzIiwic3JjL2NvbXBvbmVudHMvZHJhZ2NhbWVyYS5qcyIsInNyYy9jb21wb25lbnRzL2VuZ2luZS5qcyIsInNyYy9jb21wb25lbnRzL2dyaWQuanMiLCJzcmMvY29tcG9uZW50cy9sYXNlci5qcyIsInNyYy9jb21wb25lbnRzL3BhcnRpY2xlLmpzIiwic3JjL2NvbXBvbmVudHMvcGFydGljbGVzeXN0ZW0uanMiLCJzcmMvY29tcG9uZW50cy9zaGlwL2FpLmpzIiwic3JjL2NvbXBvbmVudHMvc2hpcC9pbmRleC5qcyIsInNyYy9jb21wb25lbnRzL3NoaXAvcmVhZGVyLmpzIiwic3JjL2NvbXBvbmVudHMvc2hpcC9zaGlwcy5qcyIsInNyYy9jb21wb25lbnRzL3NoaXAvdHVycmVudC5qcyIsInNyYy9jb250YWluZXIuanMiLCJzcmMvY29yZS9hcHAuanMiLCJzcmMvY29yZS9jb2xsaXNpb25zLmpzIiwic3JjL2NvcmUvZ3VpZC5qcyIsInNyYy9jb3JlL3JlbmRlcmVyLmpzIiwic3JjL2ZsZWV0LmpzIiwic3JjL2luZGV4LmpzIiwic3JjL3NoaXBzL2ZyaWdhdGUuanMiLCJzcmMvdXRpbHMvbWF0aC5qcyIsInNyYy92b3hlbC9jaHVuay5qcyIsInNyYy92b3hlbC9jaHVua3MuanMiLCJzcmMvdm94ZWwvbWVzaGVyLmpzIiwic3JjL3ZveGVsL21vbm90b25lLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNscEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9EQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDcElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzdCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUN2REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ3hPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNoQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiOyhmdW5jdGlvbih1bmRlZmluZWQpIHtcbiAgICAndXNlIHN0cmljdCc7XG4gICAgLyoqXG4gICAgICogQm90dGxlSlMgdjEuNi4xIC0gMjAxNy0wNS0xN1xuICAgICAqIEEgcG93ZXJmdWwgZGVwZW5kZW5jeSBpbmplY3Rpb24gbWljcm8gY29udGFpbmVyXG4gICAgICpcbiAgICAgKiBDb3B5cmlnaHQgKGMpIDIwMTcgU3RlcGhlbiBZb3VuZ1xuICAgICAqIExpY2Vuc2VkIE1JVFxuICAgICAqL1xuICAgIFxuICAgIC8qKlxuICAgICAqIFVuaXF1ZSBpZCBjb3VudGVyO1xuICAgICAqXG4gICAgICogQHR5cGUgTnVtYmVyXG4gICAgICovXG4gICAgdmFyIGlkID0gMDtcbiAgICBcbiAgICAvKipcbiAgICAgKiBMb2NhbCBzbGljZSBhbGlhc1xuICAgICAqXG4gICAgICogQHR5cGUgRnVuY3Rpb25zXG4gICAgICovXG4gICAgdmFyIHNsaWNlID0gQXJyYXkucHJvdG90eXBlLnNsaWNlO1xuICAgIFxuICAgIC8qKlxuICAgICAqIEl0ZXJhdG9yIHVzZWQgdG8gd2FsayBkb3duIGEgbmVzdGVkIG9iamVjdC5cbiAgICAgKlxuICAgICAqIElmIEJvdHRsZS5jb25maWcuc3RyaWN0IGlzIHRydWUsIHRoaXMgbWV0aG9kIHdpbGwgdGhyb3cgYW4gZXhjZXB0aW9uIGlmIGl0IGVuY291bnRlcnMgYW5cbiAgICAgKiB1bmRlZmluZWQgcGF0aFxuICAgICAqXG4gICAgICogQHBhcmFtIE9iamVjdCBvYmpcbiAgICAgKiBAcGFyYW0gU3RyaW5nIHByb3BcbiAgICAgKiBAcmV0dXJuIG1peGVkXG4gICAgICogQHRocm93cyBFcnJvciBpZiBCb3R0bGUgaXMgdW5hYmxlIHRvIHJlc29sdmUgdGhlIHJlcXVlc3RlZCBzZXJ2aWNlLlxuICAgICAqL1xuICAgIHZhciBnZXROZXN0ZWQgPSBmdW5jdGlvbiBnZXROZXN0ZWQob2JqLCBwcm9wKSB7XG4gICAgICAgIHZhciBzZXJ2aWNlID0gb2JqW3Byb3BdO1xuICAgICAgICBpZiAoc2VydmljZSA9PT0gdW5kZWZpbmVkICYmIGdsb2JhbENvbmZpZy5zdHJpY3QpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQm90dGxlIHdhcyB1bmFibGUgdG8gcmVzb2x2ZSBhIHNlcnZpY2UuICBgJyArIHByb3AgKyAnYCBpcyB1bmRlZmluZWQuJyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHNlcnZpY2U7XG4gICAgfTtcbiAgICBcbiAgICAvKipcbiAgICAgKiBHZXQgYSBuZXN0ZWQgYm90dGxlLiBXaWxsIHNldCBhbmQgcmV0dXJuIGlmIG5vdCBzZXQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gU3RyaW5nIG5hbWVcbiAgICAgKiBAcmV0dXJuIEJvdHRsZVxuICAgICAqL1xuICAgIHZhciBnZXROZXN0ZWRCb3R0bGUgPSBmdW5jdGlvbiBnZXROZXN0ZWRCb3R0bGUobmFtZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5uZXN0ZWRbbmFtZV0gfHwgKHRoaXMubmVzdGVkW25hbWVdID0gQm90dGxlLnBvcCgpKTtcbiAgICB9O1xuICAgIFxuICAgIC8qKlxuICAgICAqIEdldCBhIHNlcnZpY2Ugc3RvcmVkIHVuZGVyIGEgbmVzdGVkIGtleVxuICAgICAqXG4gICAgICogQHBhcmFtIFN0cmluZyBmdWxsbmFtZVxuICAgICAqIEByZXR1cm4gU2VydmljZVxuICAgICAqL1xuICAgIHZhciBnZXROZXN0ZWRTZXJ2aWNlID0gZnVuY3Rpb24gZ2V0TmVzdGVkU2VydmljZShmdWxsbmFtZSkge1xuICAgICAgICByZXR1cm4gZnVsbG5hbWUuc3BsaXQoJy4nKS5yZWR1Y2UoZ2V0TmVzdGVkLCB0aGlzKTtcbiAgICB9O1xuICAgIFxuICAgIC8qKlxuICAgICAqIFJlZ2lzdGVyIGEgY29uc3RhbnRcbiAgICAgKlxuICAgICAqIEBwYXJhbSBTdHJpbmcgbmFtZVxuICAgICAqIEBwYXJhbSBtaXhlZCB2YWx1ZVxuICAgICAqIEByZXR1cm4gQm90dGxlXG4gICAgICovXG4gICAgdmFyIGNvbnN0YW50ID0gZnVuY3Rpb24gY29uc3RhbnQobmFtZSwgdmFsdWUpIHtcbiAgICAgICAgdmFyIHBhcnRzID0gbmFtZS5zcGxpdCgnLicpO1xuICAgICAgICBuYW1lID0gcGFydHMucG9wKCk7XG4gICAgICAgIGRlZmluZUNvbnN0YW50LmNhbGwocGFydHMucmVkdWNlKHNldFZhbHVlT2JqZWN0LCB0aGlzLmNvbnRhaW5lciksIG5hbWUsIHZhbHVlKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfTtcbiAgICBcbiAgICB2YXIgZGVmaW5lQ29uc3RhbnQgPSBmdW5jdGlvbiBkZWZpbmVDb25zdGFudChuYW1lLCB2YWx1ZSkge1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgbmFtZSwge1xuICAgICAgICAgICAgY29uZmlndXJhYmxlIDogZmFsc2UsXG4gICAgICAgICAgICBlbnVtZXJhYmxlIDogdHJ1ZSxcbiAgICAgICAgICAgIHZhbHVlIDogdmFsdWUsXG4gICAgICAgICAgICB3cml0YWJsZSA6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgIH07XG4gICAgXG4gICAgLyoqXG4gICAgICogUmVnaXN0ZXIgZGVjb3JhdG9yLlxuICAgICAqXG4gICAgICogQHBhcmFtIFN0cmluZyBmdWxsbmFtZVxuICAgICAqIEBwYXJhbSBGdW5jdGlvbiBmdW5jXG4gICAgICogQHJldHVybiBCb3R0bGVcbiAgICAgKi9cbiAgICB2YXIgZGVjb3JhdG9yID0gZnVuY3Rpb24gZGVjb3JhdG9yKGZ1bGxuYW1lLCBmdW5jKSB7XG4gICAgICAgIHZhciBwYXJ0cywgbmFtZTtcbiAgICAgICAgaWYgKHR5cGVvZiBmdWxsbmFtZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgZnVuYyA9IGZ1bGxuYW1lO1xuICAgICAgICAgICAgZnVsbG5hbWUgPSAnX19nbG9iYWxfXyc7XG4gICAgICAgIH1cbiAgICBcbiAgICAgICAgcGFydHMgPSBmdWxsbmFtZS5zcGxpdCgnLicpO1xuICAgICAgICBuYW1lID0gcGFydHMuc2hpZnQoKTtcbiAgICAgICAgaWYgKHBhcnRzLmxlbmd0aCkge1xuICAgICAgICAgICAgZ2V0TmVzdGVkQm90dGxlLmNhbGwodGhpcywgbmFtZSkuZGVjb3JhdG9yKHBhcnRzLmpvaW4oJy4nKSwgZnVuYyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuZGVjb3JhdG9yc1tuYW1lXSkge1xuICAgICAgICAgICAgICAgIHRoaXMuZGVjb3JhdG9yc1tuYW1lXSA9IFtdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5kZWNvcmF0b3JzW25hbWVdLnB1c2goZnVuYyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfTtcbiAgICBcbiAgICAvKipcbiAgICAgKiBSZWdpc3RlciBhIGZ1bmN0aW9uIHRoYXQgd2lsbCBiZSBleGVjdXRlZCB3aGVuIEJvdHRsZSNyZXNvbHZlIGlzIGNhbGxlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBGdW5jdGlvbiBmdW5jXG4gICAgICogQHJldHVybiBCb3R0bGVcbiAgICAgKi9cbiAgICB2YXIgZGVmZXIgPSBmdW5jdGlvbiBkZWZlcihmdW5jKSB7XG4gICAgICAgIHRoaXMuZGVmZXJyZWQucHVzaChmdW5jKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfTtcbiAgICBcbiAgICBcbiAgICAvKipcbiAgICAgKiBJbW1lZGlhdGVseSBpbnN0YW50aWF0ZXMgdGhlIHByb3ZpZGVkIGxpc3Qgb2Ygc2VydmljZXMgYW5kIHJldHVybnMgdGhlbS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBBcnJheSBzZXJ2aWNlc1xuICAgICAqIEByZXR1cm4gQXJyYXkgQXJyYXkgb2YgaW5zdGFuY2VzIChpbiB0aGUgb3JkZXIgdGhleSB3ZXJlIHByb3ZpZGVkKVxuICAgICAqL1xuICAgIHZhciBkaWdlc3QgPSBmdW5jdGlvbiBkaWdlc3Qoc2VydmljZXMpIHtcbiAgICAgICAgcmV0dXJuIChzZXJ2aWNlcyB8fCBbXSkubWFwKGdldE5lc3RlZFNlcnZpY2UsIHRoaXMuY29udGFpbmVyKTtcbiAgICB9O1xuICAgIFxuICAgIC8qKlxuICAgICAqIFJlZ2lzdGVyIGEgZmFjdG9yeSBpbnNpZGUgYSBnZW5lcmljIHByb3ZpZGVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIFN0cmluZyBuYW1lXG4gICAgICogQHBhcmFtIEZ1bmN0aW9uIEZhY3RvcnlcbiAgICAgKiBAcmV0dXJuIEJvdHRsZVxuICAgICAqL1xuICAgIHZhciBmYWN0b3J5ID0gZnVuY3Rpb24gZmFjdG9yeShuYW1lLCBGYWN0b3J5KSB7XG4gICAgICAgIHJldHVybiBwcm92aWRlci5jYWxsKHRoaXMsIG5hbWUsIGZ1bmN0aW9uIEdlbmVyaWNQcm92aWRlcigpIHtcbiAgICAgICAgICAgIHRoaXMuJGdldCA9IEZhY3Rvcnk7XG4gICAgICAgIH0pO1xuICAgIH07XG4gICAgXG4gICAgLyoqXG4gICAgICogUmVnaXN0ZXIgYW4gaW5zdGFuY2UgZmFjdG9yeSBpbnNpZGUgYSBnZW5lcmljIGZhY3RvcnkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBzZXJ2aWNlXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gRmFjdG9yeSAtIFRoZSBmYWN0b3J5IGZ1bmN0aW9uLCBtYXRjaGVzIHRoZSBzaWduYXR1cmUgcmVxdWlyZWQgZm9yIHRoZVxuICAgICAqIGBmYWN0b3J5YCBtZXRob2RcbiAgICAgKiBAcmV0dXJuIEJvdHRsZVxuICAgICAqL1xuICAgIHZhciBpbnN0YW5jZUZhY3RvcnkgPSBmdW5jdGlvbiBpbnN0YW5jZUZhY3RvcnkobmFtZSwgRmFjdG9yeSkge1xuICAgICAgICByZXR1cm4gZmFjdG9yeS5jYWxsKHRoaXMsIG5hbWUsIGZ1bmN0aW9uIEdlbmVyaWNJbnN0YW5jZUZhY3RvcnkoY29udGFpbmVyKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIGluc3RhbmNlIDogRmFjdG9yeS5iaW5kKEZhY3RvcnksIGNvbnRhaW5lcilcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0pO1xuICAgIH07XG4gICAgXG4gICAgLyoqXG4gICAgICogQSBmaWx0ZXIgZnVuY3Rpb24gZm9yIHJlbW92aW5nIGJvdHRsZSBjb250YWluZXIgbWV0aG9kcyBhbmQgcHJvdmlkZXJzIGZyb20gYSBsaXN0IG9mIGtleXNcbiAgICAgKi9cbiAgICB2YXIgYnlNZXRob2QgPSBmdW5jdGlvbiBieU1ldGhvZChuYW1lKSB7XG4gICAgICAgIHJldHVybiAhL15cXCQoPzpkZWNvcmF0b3J8cmVnaXN0ZXJ8bGlzdCkkfFByb3ZpZGVyJC8udGVzdChuYW1lKTtcbiAgICB9O1xuICAgIFxuICAgIC8qKlxuICAgICAqIExpc3QgdGhlIHNlcnZpY2VzIHJlZ2lzdGVyZWQgb24gdGhlIGNvbnRhaW5lci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBPYmplY3QgY29udGFpbmVyXG4gICAgICogQHJldHVybiBBcnJheVxuICAgICAqL1xuICAgIHZhciBsaXN0ID0gZnVuY3Rpb24gbGlzdChjb250YWluZXIpIHtcbiAgICAgICAgcmV0dXJuIE9iamVjdC5rZXlzKGNvbnRhaW5lciB8fCB0aGlzLmNvbnRhaW5lciB8fCB7fSkuZmlsdGVyKGJ5TWV0aG9kKTtcbiAgICB9O1xuICAgIFxuICAgIC8qKlxuICAgICAqIEZ1bmN0aW9uIHVzZWQgYnkgcHJvdmlkZXIgdG8gc2V0IHVwIG1pZGRsZXdhcmUgZm9yIGVhY2ggcmVxdWVzdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBOdW1iZXIgaWRcbiAgICAgKiBAcGFyYW0gU3RyaW5nIG5hbWVcbiAgICAgKiBAcGFyYW0gT2JqZWN0IGluc3RhbmNlXG4gICAgICogQHBhcmFtIE9iamVjdCBjb250YWluZXJcbiAgICAgKiBAcmV0dXJuIHZvaWRcbiAgICAgKi9cbiAgICB2YXIgYXBwbHlNaWRkbGV3YXJlID0gZnVuY3Rpb24gYXBwbHlNaWRkbGV3YXJlKG1pZGRsZXdhcmUsIG5hbWUsIGluc3RhbmNlLCBjb250YWluZXIpIHtcbiAgICAgICAgdmFyIGRlc2NyaXB0b3IgPSB7XG4gICAgICAgICAgICBjb25maWd1cmFibGUgOiB0cnVlLFxuICAgICAgICAgICAgZW51bWVyYWJsZSA6IHRydWVcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKG1pZGRsZXdhcmUubGVuZ3RoKSB7XG4gICAgICAgICAgICBkZXNjcmlwdG9yLmdldCA9IGZ1bmN0aW9uIGdldFdpdGhNaWRkbGV3ZWFyKCkge1xuICAgICAgICAgICAgICAgIHZhciBpbmRleCA9IDA7XG4gICAgICAgICAgICAgICAgdmFyIG5leHQgPSBmdW5jdGlvbiBuZXh0TWlkZGxld2FyZShlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChtaWRkbGV3YXJlW2luZGV4XSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWlkZGxld2FyZVtpbmRleCsrXShpbnN0YW5jZSwgbmV4dCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIG5leHQoKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gaW5zdGFuY2U7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZGVzY3JpcHRvci52YWx1ZSA9IGluc3RhbmNlO1xuICAgICAgICAgICAgZGVzY3JpcHRvci53cml0YWJsZSA9IHRydWU7XG4gICAgICAgIH1cbiAgICBcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGNvbnRhaW5lciwgbmFtZSwgZGVzY3JpcHRvcik7XG4gICAgXG4gICAgICAgIHJldHVybiBjb250YWluZXJbbmFtZV07XG4gICAgfTtcbiAgICBcbiAgICAvKipcbiAgICAgKiBSZWdpc3RlciBtaWRkbGV3YXJlLlxuICAgICAqXG4gICAgICogQHBhcmFtIFN0cmluZyBuYW1lXG4gICAgICogQHBhcmFtIEZ1bmN0aW9uIGZ1bmNcbiAgICAgKiBAcmV0dXJuIEJvdHRsZVxuICAgICAqL1xuICAgIHZhciBtaWRkbGV3YXJlID0gZnVuY3Rpb24gbWlkZGxld2FyZShmdWxsbmFtZSwgZnVuYykge1xuICAgICAgICB2YXIgcGFydHMsIG5hbWU7XG4gICAgICAgIGlmICh0eXBlb2YgZnVsbG5hbWUgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGZ1bmMgPSBmdWxsbmFtZTtcbiAgICAgICAgICAgIGZ1bGxuYW1lID0gJ19fZ2xvYmFsX18nO1xuICAgICAgICB9XG4gICAgXG4gICAgICAgIHBhcnRzID0gZnVsbG5hbWUuc3BsaXQoJy4nKTtcbiAgICAgICAgbmFtZSA9IHBhcnRzLnNoaWZ0KCk7XG4gICAgICAgIGlmIChwYXJ0cy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGdldE5lc3RlZEJvdHRsZS5jYWxsKHRoaXMsIG5hbWUpLm1pZGRsZXdhcmUocGFydHMuam9pbignLicpLCBmdW5jKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5taWRkbGV3YXJlc1tuYW1lXSkge1xuICAgICAgICAgICAgICAgIHRoaXMubWlkZGxld2FyZXNbbmFtZV0gPSBbXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMubWlkZGxld2FyZXNbbmFtZV0ucHVzaChmdW5jKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9O1xuICAgIFxuICAgIC8qKlxuICAgICAqIE5hbWVkIGJvdHRsZSBpbnN0YW5jZXNcbiAgICAgKlxuICAgICAqIEB0eXBlIE9iamVjdFxuICAgICAqL1xuICAgIHZhciBib3R0bGVzID0ge307XG4gICAgXG4gICAgLyoqXG4gICAgICogR2V0IGFuIGluc3RhbmNlIG9mIGJvdHRsZS5cbiAgICAgKlxuICAgICAqIElmIGEgbmFtZSBpcyBwcm92aWRlZCB0aGUgaW5zdGFuY2Ugd2lsbCBiZSBzdG9yZWQgaW4gYSBsb2NhbCBoYXNoLiAgQ2FsbGluZyBCb3R0bGUucG9wIG11bHRpcGxlXG4gICAgICogdGltZXMgd2l0aCB0aGUgc2FtZSBuYW1lIHdpbGwgcmV0dXJuIHRoZSBzYW1lIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIFN0cmluZyBuYW1lXG4gICAgICogQHJldHVybiBCb3R0bGVcbiAgICAgKi9cbiAgICB2YXIgcG9wID0gZnVuY3Rpb24gcG9wKG5hbWUpIHtcbiAgICAgICAgdmFyIGluc3RhbmNlO1xuICAgICAgICBpZiAodHlwZW9mIG5hbWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBpbnN0YW5jZSA9IGJvdHRsZXNbbmFtZV07XG4gICAgICAgICAgICBpZiAoIWluc3RhbmNlKSB7XG4gICAgICAgICAgICAgICAgYm90dGxlc1tuYW1lXSA9IGluc3RhbmNlID0gbmV3IEJvdHRsZSgpO1xuICAgICAgICAgICAgICAgIGluc3RhbmNlLmNvbnN0YW50KCdCT1RUTEVfTkFNRScsIG5hbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGluc3RhbmNlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXcgQm90dGxlKCk7XG4gICAgfTtcbiAgICBcbiAgICAvKipcbiAgICAgKiBDbGVhciBhbGwgbmFtZWQgYm90dGxlcy5cbiAgICAgKi9cbiAgICB2YXIgY2xlYXIgPSBmdW5jdGlvbiBjbGVhcihuYW1lKSB7XG4gICAgICAgIGlmICh0eXBlb2YgbmFtZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIGRlbGV0ZSBib3R0bGVzW25hbWVdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYm90dGxlcyA9IHt9O1xuICAgICAgICB9XG4gICAgfTtcbiAgICBcbiAgICAvKipcbiAgICAgKiBVc2VkIHRvIHByb2Nlc3MgZGVjb3JhdG9ycyBpbiB0aGUgcHJvdmlkZXJcbiAgICAgKlxuICAgICAqIEBwYXJhbSBPYmplY3QgaW5zdGFuY2VcbiAgICAgKiBAcGFyYW0gRnVuY3Rpb24gZnVuY1xuICAgICAqIEByZXR1cm4gTWl4ZWRcbiAgICAgKi9cbiAgICB2YXIgcmVkdWNlciA9IGZ1bmN0aW9uIHJlZHVjZXIoaW5zdGFuY2UsIGZ1bmMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmMoaW5zdGFuY2UpO1xuICAgIH07XG4gICAgXG4gICAgLyoqXG4gICAgICogUmVnaXN0ZXIgYSBwcm92aWRlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBTdHJpbmcgZnVsbG5hbWVcbiAgICAgKiBAcGFyYW0gRnVuY3Rpb24gUHJvdmlkZXJcbiAgICAgKiBAcmV0dXJuIEJvdHRsZVxuICAgICAqL1xuICAgIHZhciBwcm92aWRlciA9IGZ1bmN0aW9uIHByb3ZpZGVyKGZ1bGxuYW1lLCBQcm92aWRlcikge1xuICAgICAgICB2YXIgcGFydHMsIG5hbWU7XG4gICAgICAgIHBhcnRzID0gZnVsbG5hbWUuc3BsaXQoJy4nKTtcbiAgICAgICAgaWYgKHRoaXMucHJvdmlkZXJNYXBbZnVsbG5hbWVdICYmIHBhcnRzLmxlbmd0aCA9PT0gMSAmJiAhdGhpcy5jb250YWluZXJbZnVsbG5hbWUgKyAnUHJvdmlkZXInXSkge1xuICAgICAgICAgICAgcmV0dXJuIGNvbnNvbGUuZXJyb3IoZnVsbG5hbWUgKyAnIHByb3ZpZGVyIGFscmVhZHkgaW5zdGFudGlhdGVkLicpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMub3JpZ2luYWxQcm92aWRlcnNbZnVsbG5hbWVdID0gUHJvdmlkZXI7XG4gICAgICAgIHRoaXMucHJvdmlkZXJNYXBbZnVsbG5hbWVdID0gdHJ1ZTtcbiAgICBcbiAgICAgICAgbmFtZSA9IHBhcnRzLnNoaWZ0KCk7XG4gICAgXG4gICAgICAgIGlmIChwYXJ0cy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGNyZWF0ZVN1YlByb3ZpZGVyLmNhbGwodGhpcywgbmFtZSwgUHJvdmlkZXIsIHBhcnRzKTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjcmVhdGVQcm92aWRlci5jYWxsKHRoaXMsIG5hbWUsIFByb3ZpZGVyKTtcbiAgICB9O1xuICAgIFxuICAgIC8qKlxuICAgICAqIEdldCBkZWNvcmF0b3JzIGFuZCBtaWRkbGV3YXJlIGluY2x1ZGluZyBnbG9iYWxzXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIGFycmF5XG4gICAgICovXG4gICAgdmFyIGdldFdpdGhHbG9iYWwgPSBmdW5jdGlvbiBnZXRXaXRoR2xvYmFsKGNvbGxlY3Rpb24sIG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIChjb2xsZWN0aW9uW25hbWVdIHx8IFtdKS5jb25jYXQoY29sbGVjdGlvbi5fX2dsb2JhbF9fIHx8IFtdKTtcbiAgICB9O1xuICAgIFxuICAgIC8qKlxuICAgICAqIENyZWF0ZSB0aGUgcHJvdmlkZXIgcHJvcGVydGllcyBvbiB0aGUgY29udGFpbmVyXG4gICAgICpcbiAgICAgKiBAcGFyYW0gU3RyaW5nIG5hbWVcbiAgICAgKiBAcGFyYW0gRnVuY3Rpb24gUHJvdmlkZXJcbiAgICAgKiBAcmV0dXJuIEJvdHRsZVxuICAgICAqL1xuICAgIHZhciBjcmVhdGVQcm92aWRlciA9IGZ1bmN0aW9uIGNyZWF0ZVByb3ZpZGVyKG5hbWUsIFByb3ZpZGVyKSB7XG4gICAgICAgIHZhciBwcm92aWRlck5hbWUsIHByb3BlcnRpZXMsIGNvbnRhaW5lciwgaWQsIGRlY29yYXRvcnMsIG1pZGRsZXdhcmVzO1xuICAgIFxuICAgICAgICBpZCA9IHRoaXMuaWQ7XG4gICAgICAgIGNvbnRhaW5lciA9IHRoaXMuY29udGFpbmVyO1xuICAgICAgICBkZWNvcmF0b3JzID0gdGhpcy5kZWNvcmF0b3JzO1xuICAgICAgICBtaWRkbGV3YXJlcyA9IHRoaXMubWlkZGxld2FyZXM7XG4gICAgICAgIHByb3ZpZGVyTmFtZSA9IG5hbWUgKyAnUHJvdmlkZXInO1xuICAgIFxuICAgICAgICBwcm9wZXJ0aWVzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICAgICAgcHJvcGVydGllc1twcm92aWRlck5hbWVdID0ge1xuICAgICAgICAgICAgY29uZmlndXJhYmxlIDogdHJ1ZSxcbiAgICAgICAgICAgIGVudW1lcmFibGUgOiB0cnVlLFxuICAgICAgICAgICAgZ2V0IDogZnVuY3Rpb24gZ2V0UHJvdmlkZXIoKSB7XG4gICAgICAgICAgICAgICAgdmFyIGluc3RhbmNlID0gbmV3IFByb3ZpZGVyKCk7XG4gICAgICAgICAgICAgICAgZGVsZXRlIGNvbnRhaW5lcltwcm92aWRlck5hbWVdO1xuICAgICAgICAgICAgICAgIGNvbnRhaW5lcltwcm92aWRlck5hbWVdID0gaW5zdGFuY2U7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGluc3RhbmNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIFxuICAgICAgICBwcm9wZXJ0aWVzW25hbWVdID0ge1xuICAgICAgICAgICAgY29uZmlndXJhYmxlIDogdHJ1ZSxcbiAgICAgICAgICAgIGVudW1lcmFibGUgOiB0cnVlLFxuICAgICAgICAgICAgZ2V0IDogZnVuY3Rpb24gZ2V0U2VydmljZSgpIHtcbiAgICAgICAgICAgICAgICB2YXIgcHJvdmlkZXIgPSBjb250YWluZXJbcHJvdmlkZXJOYW1lXTtcbiAgICAgICAgICAgICAgICB2YXIgaW5zdGFuY2U7XG4gICAgICAgICAgICAgICAgaWYgKHByb3ZpZGVyKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGZpbHRlciB0aHJvdWdoIGRlY29yYXRvcnNcbiAgICAgICAgICAgICAgICAgICAgaW5zdGFuY2UgPSBnZXRXaXRoR2xvYmFsKGRlY29yYXRvcnMsIG5hbWUpLnJlZHVjZShyZWR1Y2VyLCBwcm92aWRlci4kZ2V0KGNvbnRhaW5lcikpO1xuICAgIFxuICAgICAgICAgICAgICAgICAgICBkZWxldGUgY29udGFpbmVyW3Byb3ZpZGVyTmFtZV07XG4gICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBjb250YWluZXJbbmFtZV07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBpbnN0YW5jZSA9PT0gdW5kZWZpbmVkID8gaW5zdGFuY2UgOiBhcHBseU1pZGRsZXdhcmUoZ2V0V2l0aEdsb2JhbChtaWRkbGV3YXJlcywgbmFtZSksXG4gICAgICAgICAgICAgICAgICAgIG5hbWUsIGluc3RhbmNlLCBjb250YWluZXIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIFxuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyhjb250YWluZXIsIHByb3BlcnRpZXMpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9O1xuICAgIFxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBib3R0bGUgY29udGFpbmVyIG9uIHRoZSBjdXJyZW50IGJvdHRsZSBjb250YWluZXIsIGFuZCByZWdpc3RlcnNcbiAgICAgKiB0aGUgcHJvdmlkZXIgdW5kZXIgdGhlIHN1YiBjb250YWluZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gU3RyaW5nIG5hbWVcbiAgICAgKiBAcGFyYW0gRnVuY3Rpb24gUHJvdmlkZXJcbiAgICAgKiBAcGFyYW0gQXJyYXkgcGFydHNcbiAgICAgKiBAcmV0dXJuIEJvdHRsZVxuICAgICAqL1xuICAgIHZhciBjcmVhdGVTdWJQcm92aWRlciA9IGZ1bmN0aW9uIGNyZWF0ZVN1YlByb3ZpZGVyKG5hbWUsIFByb3ZpZGVyLCBwYXJ0cykge1xuICAgICAgICB2YXIgYm90dGxlO1xuICAgICAgICBib3R0bGUgPSBnZXROZXN0ZWRCb3R0bGUuY2FsbCh0aGlzLCBuYW1lKTtcbiAgICAgICAgdGhpcy5mYWN0b3J5KG5hbWUsIGZ1bmN0aW9uIFN1YlByb3ZpZGVyRmFjdG9yeSgpIHtcbiAgICAgICAgICAgIHJldHVybiBib3R0bGUuY29udGFpbmVyO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGJvdHRsZS5wcm92aWRlcihwYXJ0cy5qb2luKCcuJyksIFByb3ZpZGVyKTtcbiAgICB9O1xuICAgIFxuICAgIC8qKlxuICAgICAqIFJlZ2lzdGVyIGEgc2VydmljZSwgZmFjdG9yeSwgcHJvdmlkZXIsIG9yIHZhbHVlIGJhc2VkIG9uIHByb3BlcnRpZXMgb24gdGhlIG9iamVjdC5cbiAgICAgKlxuICAgICAqIHByb3BlcnRpZXM6XG4gICAgICogICogT2JqLiRuYW1lICAgU3RyaW5nIHJlcXVpcmVkIGV4OiBgJ1RoaW5nJ2BcbiAgICAgKiAgKiBPYmouJHR5cGUgICBTdHJpbmcgb3B0aW9uYWwgJ3NlcnZpY2UnLCAnZmFjdG9yeScsICdwcm92aWRlcicsICd2YWx1ZScuICBEZWZhdWx0OiAnc2VydmljZSdcbiAgICAgKiAgKiBPYmouJGluamVjdCBNaXhlZCAgb3B0aW9uYWwgb25seSB1c2VmdWwgd2l0aCAkdHlwZSAnc2VydmljZScgbmFtZSBvciBhcnJheSBvZiBuYW1lc1xuICAgICAqICAqIE9iai4kdmFsdWUgIE1peGVkICBvcHRpb25hbCBOb3JtYWxseSBPYmogaXMgcmVnaXN0ZXJlZCBvbiB0aGUgY29udGFpbmVyLiAgSG93ZXZlciwgaWYgdGhpc1xuICAgICAqICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eSBpcyBpbmNsdWRlZCwgaXQncyB2YWx1ZSB3aWxsIGJlIHJlZ2lzdGVyZWQgb24gdGhlIGNvbnRhaW5lclxuICAgICAqICAgICAgICAgICAgICAgICAgICAgICBpbnN0ZWFkIG9mIHRoZSBvYmplY3QgaXRzc2VsZi4gIFVzZWZ1bCBmb3IgcmVnaXN0ZXJpbmcgb2JqZWN0cyBvbiB0aGVcbiAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgYm90dGxlIGNvbnRhaW5lciB3aXRob3V0IG1vZGlmeWluZyB0aG9zZSBvYmplY3RzIHdpdGggYm90dGxlIHNwZWNpZmljIGtleXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gRnVuY3Rpb24gT2JqXG4gICAgICogQHJldHVybiBCb3R0bGVcbiAgICAgKi9cbiAgICB2YXIgcmVnaXN0ZXIgPSBmdW5jdGlvbiByZWdpc3RlcihPYmopIHtcbiAgICAgICAgdmFyIHZhbHVlID0gT2JqLiR2YWx1ZSA9PT0gdW5kZWZpbmVkID8gT2JqIDogT2JqLiR2YWx1ZTtcbiAgICAgICAgcmV0dXJuIHRoaXNbT2JqLiR0eXBlIHx8ICdzZXJ2aWNlJ10uYXBwbHkodGhpcywgW09iai4kbmFtZSwgdmFsdWVdLmNvbmNhdChPYmouJGluamVjdCB8fCBbXSkpO1xuICAgIH07XG4gICAgXG4gICAgLyoqXG4gICAgICogRGVsZXRlcyBwcm92aWRlcnMgZnJvbSB0aGUgbWFwIGFuZCBjb250YWluZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gU3RyaW5nIG5hbWVcbiAgICAgKiBAcmV0dXJuIHZvaWRcbiAgICAgKi9cbiAgICB2YXIgcmVtb3ZlUHJvdmlkZXJNYXAgPSBmdW5jdGlvbiByZXNldFByb3ZpZGVyKG5hbWUpIHtcbiAgICAgICAgZGVsZXRlIHRoaXMucHJvdmlkZXJNYXBbbmFtZV07XG4gICAgICAgIGRlbGV0ZSB0aGlzLmNvbnRhaW5lcltuYW1lXTtcbiAgICAgICAgZGVsZXRlIHRoaXMuY29udGFpbmVyW25hbWUgKyAnUHJvdmlkZXInXTtcbiAgICB9O1xuICAgIFxuICAgIC8qKlxuICAgICAqIFJlc2V0cyBhbGwgcHJvdmlkZXJzIG9uIGEgYm90dGxlIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHJldHVybiB2b2lkXG4gICAgICovXG4gICAgdmFyIHJlc2V0UHJvdmlkZXJzID0gZnVuY3Rpb24gcmVzZXRQcm92aWRlcnMoKSB7XG4gICAgICAgIHZhciBwcm92aWRlcnMgPSB0aGlzLm9yaWdpbmFsUHJvdmlkZXJzO1xuICAgICAgICBPYmplY3Qua2V5cyh0aGlzLm9yaWdpbmFsUHJvdmlkZXJzKS5mb3JFYWNoKGZ1bmN0aW9uIHJlc2V0UHJ2aWRlcihwcm92aWRlcikge1xuICAgICAgICAgICAgdmFyIHBhcnRzID0gcHJvdmlkZXIuc3BsaXQoJy4nKTtcbiAgICAgICAgICAgIGlmIChwYXJ0cy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICAgICAgcmVtb3ZlUHJvdmlkZXJNYXAuY2FsbCh0aGlzLCBwYXJ0c1swXSk7XG4gICAgICAgICAgICAgICAgcGFydHMuZm9yRWFjaChyZW1vdmVQcm92aWRlck1hcCwgZ2V0TmVzdGVkQm90dGxlLmNhbGwodGhpcywgcGFydHNbMF0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlbW92ZVByb3ZpZGVyTWFwLmNhbGwodGhpcywgcHJvdmlkZXIpO1xuICAgICAgICAgICAgdGhpcy5wcm92aWRlcihwcm92aWRlciwgcHJvdmlkZXJzW3Byb3ZpZGVyXSk7XG4gICAgICAgIH0sIHRoaXMpO1xuICAgIH07XG4gICAgXG4gICAgXG4gICAgLyoqXG4gICAgICogRXhlY3V0ZSBhbnkgZGVmZXJyZWQgZnVuY3Rpb25zXG4gICAgICpcbiAgICAgKiBAcGFyYW0gTWl4ZWQgZGF0YVxuICAgICAqIEByZXR1cm4gQm90dGxlXG4gICAgICovXG4gICAgdmFyIHJlc29sdmUgPSBmdW5jdGlvbiByZXNvbHZlKGRhdGEpIHtcbiAgICAgICAgdGhpcy5kZWZlcnJlZC5mb3JFYWNoKGZ1bmN0aW9uIGRlZmVycmVkSXRlcmF0b3IoZnVuYykge1xuICAgICAgICAgICAgZnVuYyhkYXRhKTtcbiAgICAgICAgfSk7XG4gICAgXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG4gICAgXG4gICAgLyoqXG4gICAgICogUmVnaXN0ZXIgYSBzZXJ2aWNlIGluc2lkZSBhIGdlbmVyaWMgZmFjdG9yeS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBTdHJpbmcgbmFtZVxuICAgICAqIEBwYXJhbSBGdW5jdGlvbiBTZXJ2aWNlXG4gICAgICogQHJldHVybiBCb3R0bGVcbiAgICAgKi9cbiAgICB2YXIgc2VydmljZSA9IGZ1bmN0aW9uIHNlcnZpY2UobmFtZSwgU2VydmljZSkge1xuICAgICAgICB2YXIgZGVwcyA9IGFyZ3VtZW50cy5sZW5ndGggPiAyID8gc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpIDogbnVsbDtcbiAgICAgICAgdmFyIGJvdHRsZSA9IHRoaXM7XG4gICAgICAgIHJldHVybiBmYWN0b3J5LmNhbGwodGhpcywgbmFtZSwgZnVuY3Rpb24gR2VuZXJpY0ZhY3RvcnkoKSB7XG4gICAgICAgICAgICB2YXIgU2VydmljZUNvcHkgPSBTZXJ2aWNlO1xuICAgICAgICAgICAgaWYgKGRlcHMpIHtcbiAgICAgICAgICAgICAgICB2YXIgYXJncyA9IGRlcHMubWFwKGdldE5lc3RlZFNlcnZpY2UsIGJvdHRsZS5jb250YWluZXIpO1xuICAgICAgICAgICAgICAgIGFyZ3MudW5zaGlmdChTZXJ2aWNlKTtcbiAgICAgICAgICAgICAgICBTZXJ2aWNlQ29weSA9IFNlcnZpY2UuYmluZC5hcHBseShTZXJ2aWNlLCBhcmdzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBuZXcgU2VydmljZUNvcHkoKTtcbiAgICAgICAgfSk7XG4gICAgfTtcbiAgICBcbiAgICAvKipcbiAgICAgKiBSZWdpc3RlciBhIHZhbHVlXG4gICAgICpcbiAgICAgKiBAcGFyYW0gU3RyaW5nIG5hbWVcbiAgICAgKiBAcGFyYW0gbWl4ZWQgdmFsXG4gICAgICogQHJldHVybiBCb3R0bGVcbiAgICAgKi9cbiAgICB2YXIgdmFsdWUgPSBmdW5jdGlvbiB2YWx1ZShuYW1lLCB2YWwpIHtcbiAgICAgICAgdmFyIHBhcnRzO1xuICAgICAgICBwYXJ0cyA9IG5hbWUuc3BsaXQoJy4nKTtcbiAgICAgICAgbmFtZSA9IHBhcnRzLnBvcCgpO1xuICAgICAgICBkZWZpbmVWYWx1ZS5jYWxsKHBhcnRzLnJlZHVjZShzZXRWYWx1ZU9iamVjdCwgdGhpcy5jb250YWluZXIpLCBuYW1lLCB2YWwpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9O1xuICAgIFxuICAgIC8qKlxuICAgICAqIEl0ZXJhdG9yIGZvciBzZXR0aW5nIGEgcGxhaW4gb2JqZWN0IGxpdGVyYWwgdmlhIGRlZmluZVZhbHVlXG4gICAgICpcbiAgICAgKiBAcGFyYW0gT2JqZWN0IGNvbnRhaW5lclxuICAgICAqIEBwYXJhbSBzdHJpbmcgbmFtZVxuICAgICAqL1xuICAgIHZhciBzZXRWYWx1ZU9iamVjdCA9IGZ1bmN0aW9uIHNldFZhbHVlT2JqZWN0KGNvbnRhaW5lciwgbmFtZSkge1xuICAgICAgICB2YXIgbmVzdGVkQ29udGFpbmVyID0gY29udGFpbmVyW25hbWVdO1xuICAgICAgICBpZiAoIW5lc3RlZENvbnRhaW5lcikge1xuICAgICAgICAgICAgbmVzdGVkQ29udGFpbmVyID0ge307XG4gICAgICAgICAgICBkZWZpbmVWYWx1ZS5jYWxsKGNvbnRhaW5lciwgbmFtZSwgbmVzdGVkQ29udGFpbmVyKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbmVzdGVkQ29udGFpbmVyO1xuICAgIH07XG4gICAgXG4gICAgLyoqXG4gICAgICogRGVmaW5lIGEgbXV0YWJsZSBwcm9wZXJ0eSBvbiB0aGUgY29udGFpbmVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIFN0cmluZyBuYW1lXG4gICAgICogQHBhcmFtIG1peGVkIHZhbFxuICAgICAqIEByZXR1cm4gdm9pZFxuICAgICAqIEBzY29wZSBjb250YWluZXJcbiAgICAgKi9cbiAgICB2YXIgZGVmaW5lVmFsdWUgPSBmdW5jdGlvbiBkZWZpbmVWYWx1ZShuYW1lLCB2YWwpIHtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIG5hbWUsIHtcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZSA6IHRydWUsXG4gICAgICAgICAgICBlbnVtZXJhYmxlIDogdHJ1ZSxcbiAgICAgICAgICAgIHZhbHVlIDogdmFsLFxuICAgICAgICAgICAgd3JpdGFibGUgOiB0cnVlXG4gICAgICAgIH0pO1xuICAgIH07XG4gICAgXG4gICAgXG4gICAgLyoqXG4gICAgICogQm90dGxlIGNvbnN0cnVjdG9yXG4gICAgICpcbiAgICAgKiBAcGFyYW0gU3RyaW5nIG5hbWUgT3B0aW9uYWwgbmFtZSBmb3IgZnVuY3Rpb25hbCBjb25zdHJ1Y3Rpb25cbiAgICAgKi9cbiAgICB2YXIgQm90dGxlID0gZnVuY3Rpb24gQm90dGxlKG5hbWUpIHtcbiAgICAgICAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIEJvdHRsZSkpIHtcbiAgICAgICAgICAgIHJldHVybiBCb3R0bGUucG9wKG5hbWUpO1xuICAgICAgICB9XG4gICAgXG4gICAgICAgIHRoaXMuaWQgPSBpZCsrO1xuICAgIFxuICAgICAgICB0aGlzLmRlY29yYXRvcnMgPSB7fTtcbiAgICAgICAgdGhpcy5taWRkbGV3YXJlcyA9IHt9O1xuICAgICAgICB0aGlzLm5lc3RlZCA9IHt9O1xuICAgICAgICB0aGlzLnByb3ZpZGVyTWFwID0ge307XG4gICAgICAgIHRoaXMub3JpZ2luYWxQcm92aWRlcnMgPSB7fTtcbiAgICAgICAgdGhpcy5kZWZlcnJlZCA9IFtdO1xuICAgICAgICB0aGlzLmNvbnRhaW5lciA9IHtcbiAgICAgICAgICAgICRkZWNvcmF0b3IgOiBkZWNvcmF0b3IuYmluZCh0aGlzKSxcbiAgICAgICAgICAgICRyZWdpc3RlciA6IHJlZ2lzdGVyLmJpbmQodGhpcyksXG4gICAgICAgICAgICAkbGlzdCA6IGxpc3QuYmluZCh0aGlzKVxuICAgICAgICB9O1xuICAgIH07XG4gICAgXG4gICAgLyoqXG4gICAgICogQm90dGxlIHByb3RvdHlwZVxuICAgICAqL1xuICAgIEJvdHRsZS5wcm90b3R5cGUgPSB7XG4gICAgICAgIGNvbnN0YW50IDogY29uc3RhbnQsXG4gICAgICAgIGRlY29yYXRvciA6IGRlY29yYXRvcixcbiAgICAgICAgZGVmZXIgOiBkZWZlcixcbiAgICAgICAgZGlnZXN0IDogZGlnZXN0LFxuICAgICAgICBmYWN0b3J5IDogZmFjdG9yeSxcbiAgICAgICAgaW5zdGFuY2VGYWN0b3J5OiBpbnN0YW5jZUZhY3RvcnksXG4gICAgICAgIGxpc3QgOiBsaXN0LFxuICAgICAgICBtaWRkbGV3YXJlIDogbWlkZGxld2FyZSxcbiAgICAgICAgcHJvdmlkZXIgOiBwcm92aWRlcixcbiAgICAgICAgcmVzZXRQcm92aWRlcnMgOiByZXNldFByb3ZpZGVycyxcbiAgICAgICAgcmVnaXN0ZXIgOiByZWdpc3RlcixcbiAgICAgICAgcmVzb2x2ZSA6IHJlc29sdmUsXG4gICAgICAgIHNlcnZpY2UgOiBzZXJ2aWNlLFxuICAgICAgICB2YWx1ZSA6IHZhbHVlXG4gICAgfTtcbiAgICBcbiAgICAvKipcbiAgICAgKiBCb3R0bGUgc3RhdGljXG4gICAgICovXG4gICAgQm90dGxlLnBvcCA9IHBvcDtcbiAgICBCb3R0bGUuY2xlYXIgPSBjbGVhcjtcbiAgICBCb3R0bGUubGlzdCA9IGxpc3Q7XG4gICAgXG4gICAgLyoqXG4gICAgICogR2xvYmFsIGNvbmZpZ1xuICAgICAqL1xuICAgIHZhciBnbG9iYWxDb25maWcgPSBCb3R0bGUuY29uZmlnID0ge1xuICAgICAgICBzdHJpY3QgOiBmYWxzZVxuICAgIH07XG4gICAgXG4gICAgLyoqXG4gICAgICogRXhwb3J0cyBzY3JpcHQgYWRhcHRlZCBmcm9tIGxvZGFzaCB2Mi40LjEgTW9kZXJuIEJ1aWxkXG4gICAgICpcbiAgICAgKiBAc2VlIGh0dHA6Ly9sb2Rhc2guY29tL1xuICAgICAqL1xuICAgIFxuICAgIC8qKlxuICAgICAqIFZhbGlkIG9iamVjdCB0eXBlIG1hcFxuICAgICAqXG4gICAgICogQHR5cGUgT2JqZWN0XG4gICAgICovXG4gICAgdmFyIG9iamVjdFR5cGVzID0ge1xuICAgICAgICAnZnVuY3Rpb24nIDogdHJ1ZSxcbiAgICAgICAgJ29iamVjdCcgOiB0cnVlXG4gICAgfTtcbiAgICBcbiAgICAoZnVuY3Rpb24gZXhwb3J0Qm90dGxlKHJvb3QpIHtcbiAgICBcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEZyZWUgdmFyaWFibGUgZXhwb3J0c1xuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSBGdW5jdGlvblxuICAgICAgICAgKi9cbiAgICAgICAgdmFyIGZyZWVFeHBvcnRzID0gb2JqZWN0VHlwZXNbdHlwZW9mIGV4cG9ydHNdICYmIGV4cG9ydHMgJiYgIWV4cG9ydHMubm9kZVR5cGUgJiYgZXhwb3J0cztcbiAgICBcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEZyZWUgdmFyaWFibGUgbW9kdWxlXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIE9iamVjdFxuICAgICAgICAgKi9cbiAgICAgICAgdmFyIGZyZWVNb2R1bGUgPSBvYmplY3RUeXBlc1t0eXBlb2YgbW9kdWxlXSAmJiBtb2R1bGUgJiYgIW1vZHVsZS5ub2RlVHlwZSAmJiBtb2R1bGU7XG4gICAgXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDb21tb25KUyBtb2R1bGUuZXhwb3J0c1xuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSBGdW5jdGlvblxuICAgICAgICAgKi9cbiAgICAgICAgdmFyIG1vZHVsZUV4cG9ydHMgPSBmcmVlTW9kdWxlICYmIGZyZWVNb2R1bGUuZXhwb3J0cyA9PT0gZnJlZUV4cG9ydHMgJiYgZnJlZUV4cG9ydHM7XG4gICAgXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBGcmVlIHZhcmlhYmxlIGBnbG9iYWxgXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIE9iamVjdFxuICAgICAgICAgKi9cbiAgICAgICAgdmFyIGZyZWVHbG9iYWwgPSBvYmplY3RUeXBlc1t0eXBlb2YgZ2xvYmFsXSAmJiBnbG9iYWw7XG4gICAgICAgIGlmIChmcmVlR2xvYmFsICYmIChmcmVlR2xvYmFsLmdsb2JhbCA9PT0gZnJlZUdsb2JhbCB8fCBmcmVlR2xvYmFsLndpbmRvdyA9PT0gZnJlZUdsb2JhbCkpIHtcbiAgICAgICAgICAgIHJvb3QgPSBmcmVlR2xvYmFsO1xuICAgICAgICB9XG4gICAgXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBFeHBvcnRcbiAgICAgICAgICovXG4gICAgICAgIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIHR5cGVvZiBkZWZpbmUuYW1kID09PSAnb2JqZWN0JyAmJiBkZWZpbmUuYW1kKSB7XG4gICAgICAgICAgICByb290LkJvdHRsZSA9IEJvdHRsZTtcbiAgICAgICAgICAgIGRlZmluZShmdW5jdGlvbigpIHsgcmV0dXJuIEJvdHRsZTsgfSk7XG4gICAgICAgIH0gZWxzZSBpZiAoZnJlZUV4cG9ydHMgJiYgZnJlZU1vZHVsZSkge1xuICAgICAgICAgICAgaWYgKG1vZHVsZUV4cG9ydHMpIHtcbiAgICAgICAgICAgICAgICAoZnJlZU1vZHVsZS5leHBvcnRzID0gQm90dGxlKS5Cb3R0bGUgPSBCb3R0bGU7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGZyZWVFeHBvcnRzLkJvdHRsZSA9IEJvdHRsZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJvb3QuQm90dGxlID0gQm90dGxlO1xuICAgICAgICB9XG4gICAgfSgob2JqZWN0VHlwZXNbdHlwZW9mIHdpbmRvd10gJiYgd2luZG93KSB8fCB0aGlzKSk7XG4gICAgXG59LmNhbGwodGhpcykpOyIsIid1c2Ugc3RyaWN0JztcblxudmFyIGFzc2lnbiAgICAgICAgPSByZXF1aXJlKCdlczUtZXh0L29iamVjdC9hc3NpZ24nKVxuICAsIG5vcm1hbGl6ZU9wdHMgPSByZXF1aXJlKCdlczUtZXh0L29iamVjdC9ub3JtYWxpemUtb3B0aW9ucycpXG4gICwgaXNDYWxsYWJsZSAgICA9IHJlcXVpcmUoJ2VzNS1leHQvb2JqZWN0L2lzLWNhbGxhYmxlJylcbiAgLCBjb250YWlucyAgICAgID0gcmVxdWlyZSgnZXM1LWV4dC9zdHJpbmcvIy9jb250YWlucycpXG5cbiAgLCBkO1xuXG5kID0gbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoZHNjciwgdmFsdWUvKiwgb3B0aW9ucyovKSB7XG5cdHZhciBjLCBlLCB3LCBvcHRpb25zLCBkZXNjO1xuXHRpZiAoKGFyZ3VtZW50cy5sZW5ndGggPCAyKSB8fCAodHlwZW9mIGRzY3IgIT09ICdzdHJpbmcnKSkge1xuXHRcdG9wdGlvbnMgPSB2YWx1ZTtcblx0XHR2YWx1ZSA9IGRzY3I7XG5cdFx0ZHNjciA9IG51bGw7XG5cdH0gZWxzZSB7XG5cdFx0b3B0aW9ucyA9IGFyZ3VtZW50c1syXTtcblx0fVxuXHRpZiAoZHNjciA9PSBudWxsKSB7XG5cdFx0YyA9IHcgPSB0cnVlO1xuXHRcdGUgPSBmYWxzZTtcblx0fSBlbHNlIHtcblx0XHRjID0gY29udGFpbnMuY2FsbChkc2NyLCAnYycpO1xuXHRcdGUgPSBjb250YWlucy5jYWxsKGRzY3IsICdlJyk7XG5cdFx0dyA9IGNvbnRhaW5zLmNhbGwoZHNjciwgJ3cnKTtcblx0fVxuXG5cdGRlc2MgPSB7IHZhbHVlOiB2YWx1ZSwgY29uZmlndXJhYmxlOiBjLCBlbnVtZXJhYmxlOiBlLCB3cml0YWJsZTogdyB9O1xuXHRyZXR1cm4gIW9wdGlvbnMgPyBkZXNjIDogYXNzaWduKG5vcm1hbGl6ZU9wdHMob3B0aW9ucyksIGRlc2MpO1xufTtcblxuZC5ncyA9IGZ1bmN0aW9uIChkc2NyLCBnZXQsIHNldC8qLCBvcHRpb25zKi8pIHtcblx0dmFyIGMsIGUsIG9wdGlvbnMsIGRlc2M7XG5cdGlmICh0eXBlb2YgZHNjciAhPT0gJ3N0cmluZycpIHtcblx0XHRvcHRpb25zID0gc2V0O1xuXHRcdHNldCA9IGdldDtcblx0XHRnZXQgPSBkc2NyO1xuXHRcdGRzY3IgPSBudWxsO1xuXHR9IGVsc2Uge1xuXHRcdG9wdGlvbnMgPSBhcmd1bWVudHNbM107XG5cdH1cblx0aWYgKGdldCA9PSBudWxsKSB7XG5cdFx0Z2V0ID0gdW5kZWZpbmVkO1xuXHR9IGVsc2UgaWYgKCFpc0NhbGxhYmxlKGdldCkpIHtcblx0XHRvcHRpb25zID0gZ2V0O1xuXHRcdGdldCA9IHNldCA9IHVuZGVmaW5lZDtcblx0fSBlbHNlIGlmIChzZXQgPT0gbnVsbCkge1xuXHRcdHNldCA9IHVuZGVmaW5lZDtcblx0fSBlbHNlIGlmICghaXNDYWxsYWJsZShzZXQpKSB7XG5cdFx0b3B0aW9ucyA9IHNldDtcblx0XHRzZXQgPSB1bmRlZmluZWQ7XG5cdH1cblx0aWYgKGRzY3IgPT0gbnVsbCkge1xuXHRcdGMgPSB0cnVlO1xuXHRcdGUgPSBmYWxzZTtcblx0fSBlbHNlIHtcblx0XHRjID0gY29udGFpbnMuY2FsbChkc2NyLCAnYycpO1xuXHRcdGUgPSBjb250YWlucy5jYWxsKGRzY3IsICdlJyk7XG5cdH1cblxuXHRkZXNjID0geyBnZXQ6IGdldCwgc2V0OiBzZXQsIGNvbmZpZ3VyYWJsZTogYywgZW51bWVyYWJsZTogZSB9O1xuXHRyZXR1cm4gIW9wdGlvbnMgPyBkZXNjIDogYXNzaWduKG5vcm1hbGl6ZU9wdHMob3B0aW9ucyksIGRlc2MpO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2lzLWltcGxlbWVudGVkJykoKVxuXHQ/IE9iamVjdC5hc3NpZ25cblx0OiByZXF1aXJlKCcuL3NoaW0nKTtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoKSB7XG5cdHZhciBhc3NpZ24gPSBPYmplY3QuYXNzaWduLCBvYmo7XG5cdGlmICh0eXBlb2YgYXNzaWduICE9PSAnZnVuY3Rpb24nKSByZXR1cm4gZmFsc2U7XG5cdG9iaiA9IHsgZm9vOiAncmF6JyB9O1xuXHRhc3NpZ24ob2JqLCB7IGJhcjogJ2R3YScgfSwgeyB0cnp5OiAndHJ6eScgfSk7XG5cdHJldHVybiAob2JqLmZvbyArIG9iai5iYXIgKyBvYmoudHJ6eSkgPT09ICdyYXpkd2F0cnp5Jztcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBrZXlzICA9IHJlcXVpcmUoJy4uL2tleXMnKVxuICAsIHZhbHVlID0gcmVxdWlyZSgnLi4vdmFsaWQtdmFsdWUnKVxuXG4gICwgbWF4ID0gTWF0aC5tYXg7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGRlc3QsIHNyYy8qLCDigKZzcmNuKi8pIHtcblx0dmFyIGVycm9yLCBpLCBsID0gbWF4KGFyZ3VtZW50cy5sZW5ndGgsIDIpLCBhc3NpZ247XG5cdGRlc3QgPSBPYmplY3QodmFsdWUoZGVzdCkpO1xuXHRhc3NpZ24gPSBmdW5jdGlvbiAoa2V5KSB7XG5cdFx0dHJ5IHsgZGVzdFtrZXldID0gc3JjW2tleV07IH0gY2F0Y2ggKGUpIHtcblx0XHRcdGlmICghZXJyb3IpIGVycm9yID0gZTtcblx0XHR9XG5cdH07XG5cdGZvciAoaSA9IDE7IGkgPCBsOyArK2kpIHtcblx0XHRzcmMgPSBhcmd1bWVudHNbaV07XG5cdFx0a2V5cyhzcmMpLmZvckVhY2goYXNzaWduKTtcblx0fVxuXHRpZiAoZXJyb3IgIT09IHVuZGVmaW5lZCkgdGhyb3cgZXJyb3I7XG5cdHJldHVybiBkZXN0O1xufTtcbiIsIi8vIERlcHJlY2F0ZWRcblxuJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChvYmopIHsgcmV0dXJuIHR5cGVvZiBvYmogPT09ICdmdW5jdGlvbic7IH07XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9pcy1pbXBsZW1lbnRlZCcpKClcblx0PyBPYmplY3Qua2V5c1xuXHQ6IHJlcXVpcmUoJy4vc2hpbScpO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uICgpIHtcblx0dHJ5IHtcblx0XHRPYmplY3Qua2V5cygncHJpbWl0aXZlJyk7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH0gY2F0Y2ggKGUpIHsgcmV0dXJuIGZhbHNlOyB9XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIga2V5cyA9IE9iamVjdC5rZXlzO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChvYmplY3QpIHtcblx0cmV0dXJuIGtleXMob2JqZWN0ID09IG51bGwgPyBvYmplY3QgOiBPYmplY3Qob2JqZWN0KSk7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgZm9yRWFjaCA9IEFycmF5LnByb3RvdHlwZS5mb3JFYWNoLCBjcmVhdGUgPSBPYmplY3QuY3JlYXRlO1xuXG52YXIgcHJvY2VzcyA9IGZ1bmN0aW9uIChzcmMsIG9iaikge1xuXHR2YXIga2V5O1xuXHRmb3IgKGtleSBpbiBzcmMpIG9ialtrZXldID0gc3JjW2tleV07XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChvcHRpb25zLyosIOKApm9wdGlvbnMqLykge1xuXHR2YXIgcmVzdWx0ID0gY3JlYXRlKG51bGwpO1xuXHRmb3JFYWNoLmNhbGwoYXJndW1lbnRzLCBmdW5jdGlvbiAob3B0aW9ucykge1xuXHRcdGlmIChvcHRpb25zID09IG51bGwpIHJldHVybjtcblx0XHRwcm9jZXNzKE9iamVjdChvcHRpb25zKSwgcmVzdWx0KTtcblx0fSk7XG5cdHJldHVybiByZXN1bHQ7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChmbikge1xuXHRpZiAodHlwZW9mIGZuICE9PSAnZnVuY3Rpb24nKSB0aHJvdyBuZXcgVHlwZUVycm9yKGZuICsgXCIgaXMgbm90IGEgZnVuY3Rpb25cIik7XG5cdHJldHVybiBmbjtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKHZhbHVlKSB7XG5cdGlmICh2YWx1ZSA9PSBudWxsKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IHVzZSBudWxsIG9yIHVuZGVmaW5lZFwiKTtcblx0cmV0dXJuIHZhbHVlO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2lzLWltcGxlbWVudGVkJykoKVxuXHQ/IFN0cmluZy5wcm90b3R5cGUuY29udGFpbnNcblx0OiByZXF1aXJlKCcuL3NoaW0nKTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHN0ciA9ICdyYXpkd2F0cnp5JztcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoKSB7XG5cdGlmICh0eXBlb2Ygc3RyLmNvbnRhaW5zICE9PSAnZnVuY3Rpb24nKSByZXR1cm4gZmFsc2U7XG5cdHJldHVybiAoKHN0ci5jb250YWlucygnZHdhJykgPT09IHRydWUpICYmIChzdHIuY29udGFpbnMoJ2ZvbycpID09PSBmYWxzZSkpO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGluZGV4T2YgPSBTdHJpbmcucHJvdG90eXBlLmluZGV4T2Y7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKHNlYXJjaFN0cmluZy8qLCBwb3NpdGlvbiovKSB7XG5cdHJldHVybiBpbmRleE9mLmNhbGwodGhpcywgc2VhcmNoU3RyaW5nLCBhcmd1bWVudHNbMV0pID4gLTE7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgZCAgICAgICAgPSByZXF1aXJlKCdkJylcbiAgLCBjYWxsYWJsZSA9IHJlcXVpcmUoJ2VzNS1leHQvb2JqZWN0L3ZhbGlkLWNhbGxhYmxlJylcblxuICAsIGFwcGx5ID0gRnVuY3Rpb24ucHJvdG90eXBlLmFwcGx5LCBjYWxsID0gRnVuY3Rpb24ucHJvdG90eXBlLmNhbGxcbiAgLCBjcmVhdGUgPSBPYmplY3QuY3JlYXRlLCBkZWZpbmVQcm9wZXJ0eSA9IE9iamVjdC5kZWZpbmVQcm9wZXJ0eVxuICAsIGRlZmluZVByb3BlcnRpZXMgPSBPYmplY3QuZGVmaW5lUHJvcGVydGllc1xuICAsIGhhc093blByb3BlcnR5ID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eVxuICAsIGRlc2NyaXB0b3IgPSB7IGNvbmZpZ3VyYWJsZTogdHJ1ZSwgZW51bWVyYWJsZTogZmFsc2UsIHdyaXRhYmxlOiB0cnVlIH1cblxuICAsIG9uLCBvbmNlLCBvZmYsIGVtaXQsIG1ldGhvZHMsIGRlc2NyaXB0b3JzLCBiYXNlO1xuXG5vbiA9IGZ1bmN0aW9uICh0eXBlLCBsaXN0ZW5lcikge1xuXHR2YXIgZGF0YTtcblxuXHRjYWxsYWJsZShsaXN0ZW5lcik7XG5cblx0aWYgKCFoYXNPd25Qcm9wZXJ0eS5jYWxsKHRoaXMsICdfX2VlX18nKSkge1xuXHRcdGRhdGEgPSBkZXNjcmlwdG9yLnZhbHVlID0gY3JlYXRlKG51bGwpO1xuXHRcdGRlZmluZVByb3BlcnR5KHRoaXMsICdfX2VlX18nLCBkZXNjcmlwdG9yKTtcblx0XHRkZXNjcmlwdG9yLnZhbHVlID0gbnVsbDtcblx0fSBlbHNlIHtcblx0XHRkYXRhID0gdGhpcy5fX2VlX187XG5cdH1cblx0aWYgKCFkYXRhW3R5cGVdKSBkYXRhW3R5cGVdID0gbGlzdGVuZXI7XG5cdGVsc2UgaWYgKHR5cGVvZiBkYXRhW3R5cGVdID09PSAnb2JqZWN0JykgZGF0YVt0eXBlXS5wdXNoKGxpc3RlbmVyKTtcblx0ZWxzZSBkYXRhW3R5cGVdID0gW2RhdGFbdHlwZV0sIGxpc3RlbmVyXTtcblxuXHRyZXR1cm4gdGhpcztcbn07XG5cbm9uY2UgPSBmdW5jdGlvbiAodHlwZSwgbGlzdGVuZXIpIHtcblx0dmFyIG9uY2UsIHNlbGY7XG5cblx0Y2FsbGFibGUobGlzdGVuZXIpO1xuXHRzZWxmID0gdGhpcztcblx0b24uY2FsbCh0aGlzLCB0eXBlLCBvbmNlID0gZnVuY3Rpb24gKCkge1xuXHRcdG9mZi5jYWxsKHNlbGYsIHR5cGUsIG9uY2UpO1xuXHRcdGFwcGx5LmNhbGwobGlzdGVuZXIsIHRoaXMsIGFyZ3VtZW50cyk7XG5cdH0pO1xuXG5cdG9uY2UuX19lZU9uY2VMaXN0ZW5lcl9fID0gbGlzdGVuZXI7XG5cdHJldHVybiB0aGlzO1xufTtcblxub2ZmID0gZnVuY3Rpb24gKHR5cGUsIGxpc3RlbmVyKSB7XG5cdHZhciBkYXRhLCBsaXN0ZW5lcnMsIGNhbmRpZGF0ZSwgaTtcblxuXHRjYWxsYWJsZShsaXN0ZW5lcik7XG5cblx0aWYgKCFoYXNPd25Qcm9wZXJ0eS5jYWxsKHRoaXMsICdfX2VlX18nKSkgcmV0dXJuIHRoaXM7XG5cdGRhdGEgPSB0aGlzLl9fZWVfXztcblx0aWYgKCFkYXRhW3R5cGVdKSByZXR1cm4gdGhpcztcblx0bGlzdGVuZXJzID0gZGF0YVt0eXBlXTtcblxuXHRpZiAodHlwZW9mIGxpc3RlbmVycyA9PT0gJ29iamVjdCcpIHtcblx0XHRmb3IgKGkgPSAwOyAoY2FuZGlkYXRlID0gbGlzdGVuZXJzW2ldKTsgKytpKSB7XG5cdFx0XHRpZiAoKGNhbmRpZGF0ZSA9PT0gbGlzdGVuZXIpIHx8XG5cdFx0XHRcdFx0KGNhbmRpZGF0ZS5fX2VlT25jZUxpc3RlbmVyX18gPT09IGxpc3RlbmVyKSkge1xuXHRcdFx0XHRpZiAobGlzdGVuZXJzLmxlbmd0aCA9PT0gMikgZGF0YVt0eXBlXSA9IGxpc3RlbmVyc1tpID8gMCA6IDFdO1xuXHRcdFx0XHRlbHNlIGxpc3RlbmVycy5zcGxpY2UoaSwgMSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9IGVsc2Uge1xuXHRcdGlmICgobGlzdGVuZXJzID09PSBsaXN0ZW5lcikgfHxcblx0XHRcdFx0KGxpc3RlbmVycy5fX2VlT25jZUxpc3RlbmVyX18gPT09IGxpc3RlbmVyKSkge1xuXHRcdFx0ZGVsZXRlIGRhdGFbdHlwZV07XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIHRoaXM7XG59O1xuXG5lbWl0ID0gZnVuY3Rpb24gKHR5cGUpIHtcblx0dmFyIGksIGwsIGxpc3RlbmVyLCBsaXN0ZW5lcnMsIGFyZ3M7XG5cblx0aWYgKCFoYXNPd25Qcm9wZXJ0eS5jYWxsKHRoaXMsICdfX2VlX18nKSkgcmV0dXJuO1xuXHRsaXN0ZW5lcnMgPSB0aGlzLl9fZWVfX1t0eXBlXTtcblx0aWYgKCFsaXN0ZW5lcnMpIHJldHVybjtcblxuXHRpZiAodHlwZW9mIGxpc3RlbmVycyA9PT0gJ29iamVjdCcpIHtcblx0XHRsID0gYXJndW1lbnRzLmxlbmd0aDtcblx0XHRhcmdzID0gbmV3IEFycmF5KGwgLSAxKTtcblx0XHRmb3IgKGkgPSAxOyBpIDwgbDsgKytpKSBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcblxuXHRcdGxpc3RlbmVycyA9IGxpc3RlbmVycy5zbGljZSgpO1xuXHRcdGZvciAoaSA9IDA7IChsaXN0ZW5lciA9IGxpc3RlbmVyc1tpXSk7ICsraSkge1xuXHRcdFx0YXBwbHkuY2FsbChsaXN0ZW5lciwgdGhpcywgYXJncyk7XG5cdFx0fVxuXHR9IGVsc2Uge1xuXHRcdHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuXHRcdGNhc2UgMTpcblx0XHRcdGNhbGwuY2FsbChsaXN0ZW5lcnMsIHRoaXMpO1xuXHRcdFx0YnJlYWs7XG5cdFx0Y2FzZSAyOlxuXHRcdFx0Y2FsbC5jYWxsKGxpc3RlbmVycywgdGhpcywgYXJndW1lbnRzWzFdKTtcblx0XHRcdGJyZWFrO1xuXHRcdGNhc2UgMzpcblx0XHRcdGNhbGwuY2FsbChsaXN0ZW5lcnMsIHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcblx0XHRcdGJyZWFrO1xuXHRcdGRlZmF1bHQ6XG5cdFx0XHRsID0gYXJndW1lbnRzLmxlbmd0aDtcblx0XHRcdGFyZ3MgPSBuZXcgQXJyYXkobCAtIDEpO1xuXHRcdFx0Zm9yIChpID0gMTsgaSA8IGw7ICsraSkge1xuXHRcdFx0XHRhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcblx0XHRcdH1cblx0XHRcdGFwcGx5LmNhbGwobGlzdGVuZXJzLCB0aGlzLCBhcmdzKTtcblx0XHR9XG5cdH1cbn07XG5cbm1ldGhvZHMgPSB7XG5cdG9uOiBvbixcblx0b25jZTogb25jZSxcblx0b2ZmOiBvZmYsXG5cdGVtaXQ6IGVtaXRcbn07XG5cbmRlc2NyaXB0b3JzID0ge1xuXHRvbjogZChvbiksXG5cdG9uY2U6IGQob25jZSksXG5cdG9mZjogZChvZmYpLFxuXHRlbWl0OiBkKGVtaXQpXG59O1xuXG5iYXNlID0gZGVmaW5lUHJvcGVydGllcyh7fSwgZGVzY3JpcHRvcnMpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGV4cG9ydHMgPSBmdW5jdGlvbiAobykge1xuXHRyZXR1cm4gKG8gPT0gbnVsbCkgPyBjcmVhdGUoYmFzZSkgOiBkZWZpbmVQcm9wZXJ0aWVzKE9iamVjdChvKSwgZGVzY3JpcHRvcnMpO1xufTtcbmV4cG9ydHMubWV0aG9kcyA9IG1ldGhvZHM7XG4iLCIvKmpzaGludCAtVzA1NCAqL1xuKGZ1bmN0aW9uIChleHBvcnRzKSB7XG4gICd1c2Ugc3RyaWN0JztcblxuICAvLyBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzI0NTA5NTQvaG93LXRvLXJhbmRvbWl6ZS1zaHVmZmxlLWEtamF2YXNjcmlwdC1hcnJheVxuICBmdW5jdGlvbiBzaHVmZmxlKGFycmF5KSB7XG4gICAgdmFyIGN1cnJlbnRJbmRleCA9IGFycmF5Lmxlbmd0aFxuICAgICAgLCB0ZW1wb3JhcnlWYWx1ZVxuICAgICAgLCByYW5kb21JbmRleFxuICAgICAgO1xuXG4gICAgLy8gV2hpbGUgdGhlcmUgcmVtYWluIGVsZW1lbnRzIHRvIHNodWZmbGUuLi5cbiAgICB3aGlsZSAoMCAhPT0gY3VycmVudEluZGV4KSB7XG5cbiAgICAgIC8vIFBpY2sgYSByZW1haW5pbmcgZWxlbWVudC4uLlxuICAgICAgcmFuZG9tSW5kZXggPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBjdXJyZW50SW5kZXgpO1xuICAgICAgY3VycmVudEluZGV4IC09IDE7XG5cbiAgICAgIC8vIEFuZCBzd2FwIGl0IHdpdGggdGhlIGN1cnJlbnQgZWxlbWVudC5cbiAgICAgIHRlbXBvcmFyeVZhbHVlID0gYXJyYXlbY3VycmVudEluZGV4XTtcbiAgICAgIGFycmF5W2N1cnJlbnRJbmRleF0gPSBhcnJheVtyYW5kb21JbmRleF07XG4gICAgICBhcnJheVtyYW5kb21JbmRleF0gPSB0ZW1wb3JhcnlWYWx1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gYXJyYXk7XG4gIH1cblxuICBleHBvcnRzLmtudXRoU2h1ZmZsZSA9IHNodWZmbGU7XG59KCd1bmRlZmluZWQnICE9PSB0eXBlb2YgZXhwb3J0cyAmJiBleHBvcnRzIHx8ICd1bmRlZmluZWQnICE9PSB0eXBlb2Ygd2luZG93ICYmIHdpbmRvdyB8fCBnbG9iYWwpKTtcbiIsIi8qXG4gKiBBIHNwZWVkLWltcHJvdmVkIHBlcmxpbiBhbmQgc2ltcGxleCBub2lzZSBhbGdvcml0aG1zIGZvciAyRC5cbiAqXG4gKiBCYXNlZCBvbiBleGFtcGxlIGNvZGUgYnkgU3RlZmFuIEd1c3RhdnNvbiAoc3RlZ3VAaXRuLmxpdS5zZSkuXG4gKiBPcHRpbWlzYXRpb25zIGJ5IFBldGVyIEVhc3RtYW4gKHBlYXN0bWFuQGRyaXp6bGUuc3RhbmZvcmQuZWR1KS5cbiAqIEJldHRlciByYW5rIG9yZGVyaW5nIG1ldGhvZCBieSBTdGVmYW4gR3VzdGF2c29uIGluIDIwMTIuXG4gKiBDb252ZXJ0ZWQgdG8gSmF2YXNjcmlwdCBieSBKb3NlcGggR2VudGxlLlxuICpcbiAqIFZlcnNpb24gMjAxMi0wMy0wOVxuICpcbiAqIFRoaXMgY29kZSB3YXMgcGxhY2VkIGluIHRoZSBwdWJsaWMgZG9tYWluIGJ5IGl0cyBvcmlnaW5hbCBhdXRob3IsXG4gKiBTdGVmYW4gR3VzdGF2c29uLiBZb3UgbWF5IHVzZSBpdCBhcyB5b3Ugc2VlIGZpdCwgYnV0XG4gKiBhdHRyaWJ1dGlvbiBpcyBhcHByZWNpYXRlZC5cbiAqXG4gKi9cblxuKGZ1bmN0aW9uKGdsb2JhbCl7XG4gIHZhciBtb2R1bGUgPSBnbG9iYWwubm9pc2UgPSB7fTtcblxuICBmdW5jdGlvbiBHcmFkKHgsIHksIHopIHtcbiAgICB0aGlzLnggPSB4OyB0aGlzLnkgPSB5OyB0aGlzLnogPSB6O1xuICB9XG4gIFxuICBHcmFkLnByb3RvdHlwZS5kb3QyID0gZnVuY3Rpb24oeCwgeSkge1xuICAgIHJldHVybiB0aGlzLngqeCArIHRoaXMueSp5O1xuICB9O1xuXG4gIEdyYWQucHJvdG90eXBlLmRvdDMgPSBmdW5jdGlvbih4LCB5LCB6KSB7XG4gICAgcmV0dXJuIHRoaXMueCp4ICsgdGhpcy55KnkgKyB0aGlzLnoqejtcbiAgfTtcblxuICB2YXIgZ3JhZDMgPSBbbmV3IEdyYWQoMSwxLDApLG5ldyBHcmFkKC0xLDEsMCksbmV3IEdyYWQoMSwtMSwwKSxuZXcgR3JhZCgtMSwtMSwwKSxcbiAgICAgICAgICAgICAgIG5ldyBHcmFkKDEsMCwxKSxuZXcgR3JhZCgtMSwwLDEpLG5ldyBHcmFkKDEsMCwtMSksbmV3IEdyYWQoLTEsMCwtMSksXG4gICAgICAgICAgICAgICBuZXcgR3JhZCgwLDEsMSksbmV3IEdyYWQoMCwtMSwxKSxuZXcgR3JhZCgwLDEsLTEpLG5ldyBHcmFkKDAsLTEsLTEpXTtcblxuICB2YXIgcCA9IFsxNTEsMTYwLDEzNyw5MSw5MCwxNSxcbiAgMTMxLDEzLDIwMSw5NSw5Niw1MywxOTQsMjMzLDcsMjI1LDE0MCwzNiwxMDMsMzAsNjksMTQyLDgsOTksMzcsMjQwLDIxLDEwLDIzLFxuICAxOTAsIDYsMTQ4LDI0NywxMjAsMjM0LDc1LDAsMjYsMTk3LDYyLDk0LDI1MiwyMTksMjAzLDExNywzNSwxMSwzMiw1NywxNzcsMzMsXG4gIDg4LDIzNywxNDksNTYsODcsMTc0LDIwLDEyNSwxMzYsMTcxLDE2OCwgNjgsMTc1LDc0LDE2NSw3MSwxMzQsMTM5LDQ4LDI3LDE2NixcbiAgNzcsMTQ2LDE1OCwyMzEsODMsMTExLDIyOSwxMjIsNjAsMjExLDEzMywyMzAsMjIwLDEwNSw5Miw0MSw1NSw0NiwyNDUsNDAsMjQ0LFxuICAxMDIsMTQzLDU0LCA2NSwyNSw2MywxNjEsIDEsMjE2LDgwLDczLDIwOSw3NiwxMzIsMTg3LDIwOCwgODksMTgsMTY5LDIwMCwxOTYsXG4gIDEzNSwxMzAsMTE2LDE4OCwxNTksODYsMTY0LDEwMCwxMDksMTk4LDE3MywxODYsIDMsNjQsNTIsMjE3LDIyNiwyNTAsMTI0LDEyMyxcbiAgNSwyMDIsMzgsMTQ3LDExOCwxMjYsMjU1LDgyLDg1LDIxMiwyMDcsMjA2LDU5LDIyNyw0NywxNiw1OCwxNywxODIsMTg5LDI4LDQyLFxuICAyMjMsMTgzLDE3MCwyMTMsMTE5LDI0OCwxNTIsIDIsNDQsMTU0LDE2MywgNzAsMjIxLDE1MywxMDEsMTU1LDE2NywgNDMsMTcyLDksXG4gIDEyOSwyMiwzOSwyNTMsIDE5LDk4LDEwOCwxMTAsNzksMTEzLDIyNCwyMzIsMTc4LDE4NSwgMTEyLDEwNCwyMTgsMjQ2LDk3LDIyOCxcbiAgMjUxLDM0LDI0MiwxOTMsMjM4LDIxMCwxNDQsMTIsMTkxLDE3OSwxNjIsMjQxLCA4MSw1MSwxNDUsMjM1LDI0OSwxNCwyMzksMTA3LFxuICA0OSwxOTIsMjE0LCAzMSwxODEsMTk5LDEwNiwxNTcsMTg0LCA4NCwyMDQsMTc2LDExNSwxMjEsNTAsNDUsMTI3LCA0LDE1MCwyNTQsXG4gIDEzOCwyMzYsMjA1LDkzLDIyMiwxMTQsNjcsMjksMjQsNzIsMjQzLDE0MSwxMjgsMTk1LDc4LDY2LDIxNSw2MSwxNTYsMTgwXTtcbiAgLy8gVG8gcmVtb3ZlIHRoZSBuZWVkIGZvciBpbmRleCB3cmFwcGluZywgZG91YmxlIHRoZSBwZXJtdXRhdGlvbiB0YWJsZSBsZW5ndGhcbiAgdmFyIHBlcm0gPSBuZXcgQXJyYXkoNTEyKTtcbiAgdmFyIGdyYWRQID0gbmV3IEFycmF5KDUxMik7XG5cbiAgLy8gVGhpcyBpc24ndCBhIHZlcnkgZ29vZCBzZWVkaW5nIGZ1bmN0aW9uLCBidXQgaXQgd29ya3Mgb2suIEl0IHN1cHBvcnRzIDJeMTZcbiAgLy8gZGlmZmVyZW50IHNlZWQgdmFsdWVzLiBXcml0ZSBzb21ldGhpbmcgYmV0dGVyIGlmIHlvdSBuZWVkIG1vcmUgc2VlZHMuXG4gIG1vZHVsZS5zZWVkID0gZnVuY3Rpb24oc2VlZCkge1xuICAgIGlmKHNlZWQgPiAwICYmIHNlZWQgPCAxKSB7XG4gICAgICAvLyBTY2FsZSB0aGUgc2VlZCBvdXRcbiAgICAgIHNlZWQgKj0gNjU1MzY7XG4gICAgfVxuXG4gICAgc2VlZCA9IE1hdGguZmxvb3Ioc2VlZCk7XG4gICAgaWYoc2VlZCA8IDI1Nikge1xuICAgICAgc2VlZCB8PSBzZWVkIDw8IDg7XG4gICAgfVxuXG4gICAgZm9yKHZhciBpID0gMDsgaSA8IDI1NjsgaSsrKSB7XG4gICAgICB2YXIgdjtcbiAgICAgIGlmIChpICYgMSkge1xuICAgICAgICB2ID0gcFtpXSBeIChzZWVkICYgMjU1KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHYgPSBwW2ldIF4gKChzZWVkPj44KSAmIDI1NSk7XG4gICAgICB9XG5cbiAgICAgIHBlcm1baV0gPSBwZXJtW2kgKyAyNTZdID0gdjtcbiAgICAgIGdyYWRQW2ldID0gZ3JhZFBbaSArIDI1Nl0gPSBncmFkM1t2ICUgMTJdO1xuICAgIH1cbiAgfTtcblxuICBtb2R1bGUuc2VlZCgwKTtcblxuICAvKlxuICBmb3IodmFyIGk9MDsgaTwyNTY7IGkrKykge1xuICAgIHBlcm1baV0gPSBwZXJtW2kgKyAyNTZdID0gcFtpXTtcbiAgICBncmFkUFtpXSA9IGdyYWRQW2kgKyAyNTZdID0gZ3JhZDNbcGVybVtpXSAlIDEyXTtcbiAgfSovXG5cbiAgLy8gU2tld2luZyBhbmQgdW5za2V3aW5nIGZhY3RvcnMgZm9yIDIsIDMsIGFuZCA0IGRpbWVuc2lvbnNcbiAgdmFyIEYyID0gMC41KihNYXRoLnNxcnQoMyktMSk7XG4gIHZhciBHMiA9ICgzLU1hdGguc3FydCgzKSkvNjtcblxuICB2YXIgRjMgPSAxLzM7XG4gIHZhciBHMyA9IDEvNjtcblxuICAvLyAyRCBzaW1wbGV4IG5vaXNlXG4gIG1vZHVsZS5zaW1wbGV4MiA9IGZ1bmN0aW9uKHhpbiwgeWluKSB7XG4gICAgdmFyIG4wLCBuMSwgbjI7IC8vIE5vaXNlIGNvbnRyaWJ1dGlvbnMgZnJvbSB0aGUgdGhyZWUgY29ybmVyc1xuICAgIC8vIFNrZXcgdGhlIGlucHV0IHNwYWNlIHRvIGRldGVybWluZSB3aGljaCBzaW1wbGV4IGNlbGwgd2UncmUgaW5cbiAgICB2YXIgcyA9ICh4aW4reWluKSpGMjsgLy8gSGFpcnkgZmFjdG9yIGZvciAyRFxuICAgIHZhciBpID0gTWF0aC5mbG9vcih4aW4rcyk7XG4gICAgdmFyIGogPSBNYXRoLmZsb29yKHlpbitzKTtcbiAgICB2YXIgdCA9IChpK2opKkcyO1xuICAgIHZhciB4MCA9IHhpbi1pK3Q7IC8vIFRoZSB4LHkgZGlzdGFuY2VzIGZyb20gdGhlIGNlbGwgb3JpZ2luLCB1bnNrZXdlZC5cbiAgICB2YXIgeTAgPSB5aW4tait0O1xuICAgIC8vIEZvciB0aGUgMkQgY2FzZSwgdGhlIHNpbXBsZXggc2hhcGUgaXMgYW4gZXF1aWxhdGVyYWwgdHJpYW5nbGUuXG4gICAgLy8gRGV0ZXJtaW5lIHdoaWNoIHNpbXBsZXggd2UgYXJlIGluLlxuICAgIHZhciBpMSwgajE7IC8vIE9mZnNldHMgZm9yIHNlY29uZCAobWlkZGxlKSBjb3JuZXIgb2Ygc2ltcGxleCBpbiAoaSxqKSBjb29yZHNcbiAgICBpZih4MD55MCkgeyAvLyBsb3dlciB0cmlhbmdsZSwgWFkgb3JkZXI6ICgwLDApLT4oMSwwKS0+KDEsMSlcbiAgICAgIGkxPTE7IGoxPTA7XG4gICAgfSBlbHNlIHsgICAgLy8gdXBwZXIgdHJpYW5nbGUsIFlYIG9yZGVyOiAoMCwwKS0+KDAsMSktPigxLDEpXG4gICAgICBpMT0wOyBqMT0xO1xuICAgIH1cbiAgICAvLyBBIHN0ZXAgb2YgKDEsMCkgaW4gKGksaikgbWVhbnMgYSBzdGVwIG9mICgxLWMsLWMpIGluICh4LHkpLCBhbmRcbiAgICAvLyBhIHN0ZXAgb2YgKDAsMSkgaW4gKGksaikgbWVhbnMgYSBzdGVwIG9mICgtYywxLWMpIGluICh4LHkpLCB3aGVyZVxuICAgIC8vIGMgPSAoMy1zcXJ0KDMpKS82XG4gICAgdmFyIHgxID0geDAgLSBpMSArIEcyOyAvLyBPZmZzZXRzIGZvciBtaWRkbGUgY29ybmVyIGluICh4LHkpIHVuc2tld2VkIGNvb3Jkc1xuICAgIHZhciB5MSA9IHkwIC0gajEgKyBHMjtcbiAgICB2YXIgeDIgPSB4MCAtIDEgKyAyICogRzI7IC8vIE9mZnNldHMgZm9yIGxhc3QgY29ybmVyIGluICh4LHkpIHVuc2tld2VkIGNvb3Jkc1xuICAgIHZhciB5MiA9IHkwIC0gMSArIDIgKiBHMjtcbiAgICAvLyBXb3JrIG91dCB0aGUgaGFzaGVkIGdyYWRpZW50IGluZGljZXMgb2YgdGhlIHRocmVlIHNpbXBsZXggY29ybmVyc1xuICAgIGkgJj0gMjU1O1xuICAgIGogJj0gMjU1O1xuICAgIHZhciBnaTAgPSBncmFkUFtpK3Blcm1bal1dO1xuICAgIHZhciBnaTEgPSBncmFkUFtpK2kxK3Blcm1baitqMV1dO1xuICAgIHZhciBnaTIgPSBncmFkUFtpKzErcGVybVtqKzFdXTtcbiAgICAvLyBDYWxjdWxhdGUgdGhlIGNvbnRyaWJ1dGlvbiBmcm9tIHRoZSB0aHJlZSBjb3JuZXJzXG4gICAgdmFyIHQwID0gMC41IC0geDAqeDAteTAqeTA7XG4gICAgaWYodDA8MCkge1xuICAgICAgbjAgPSAwO1xuICAgIH0gZWxzZSB7XG4gICAgICB0MCAqPSB0MDtcbiAgICAgIG4wID0gdDAgKiB0MCAqIGdpMC5kb3QyKHgwLCB5MCk7ICAvLyAoeCx5KSBvZiBncmFkMyB1c2VkIGZvciAyRCBncmFkaWVudFxuICAgIH1cbiAgICB2YXIgdDEgPSAwLjUgLSB4MSp4MS15MSp5MTtcbiAgICBpZih0MTwwKSB7XG4gICAgICBuMSA9IDA7XG4gICAgfSBlbHNlIHtcbiAgICAgIHQxICo9IHQxO1xuICAgICAgbjEgPSB0MSAqIHQxICogZ2kxLmRvdDIoeDEsIHkxKTtcbiAgICB9XG4gICAgdmFyIHQyID0gMC41IC0geDIqeDIteTIqeTI7XG4gICAgaWYodDI8MCkge1xuICAgICAgbjIgPSAwO1xuICAgIH0gZWxzZSB7XG4gICAgICB0MiAqPSB0MjtcbiAgICAgIG4yID0gdDIgKiB0MiAqIGdpMi5kb3QyKHgyLCB5Mik7XG4gICAgfVxuICAgIC8vIEFkZCBjb250cmlidXRpb25zIGZyb20gZWFjaCBjb3JuZXIgdG8gZ2V0IHRoZSBmaW5hbCBub2lzZSB2YWx1ZS5cbiAgICAvLyBUaGUgcmVzdWx0IGlzIHNjYWxlZCB0byByZXR1cm4gdmFsdWVzIGluIHRoZSBpbnRlcnZhbCBbLTEsMV0uXG4gICAgcmV0dXJuIDcwICogKG4wICsgbjEgKyBuMik7XG4gIH07XG5cbiAgLy8gM0Qgc2ltcGxleCBub2lzZVxuICBtb2R1bGUuc2ltcGxleDMgPSBmdW5jdGlvbih4aW4sIHlpbiwgemluKSB7XG4gICAgdmFyIG4wLCBuMSwgbjIsIG4zOyAvLyBOb2lzZSBjb250cmlidXRpb25zIGZyb20gdGhlIGZvdXIgY29ybmVyc1xuXG4gICAgLy8gU2tldyB0aGUgaW5wdXQgc3BhY2UgdG8gZGV0ZXJtaW5lIHdoaWNoIHNpbXBsZXggY2VsbCB3ZSdyZSBpblxuICAgIHZhciBzID0gKHhpbit5aW4remluKSpGMzsgLy8gSGFpcnkgZmFjdG9yIGZvciAyRFxuICAgIHZhciBpID0gTWF0aC5mbG9vcih4aW4rcyk7XG4gICAgdmFyIGogPSBNYXRoLmZsb29yKHlpbitzKTtcbiAgICB2YXIgayA9IE1hdGguZmxvb3IoemluK3MpO1xuXG4gICAgdmFyIHQgPSAoaStqK2spKkczO1xuICAgIHZhciB4MCA9IHhpbi1pK3Q7IC8vIFRoZSB4LHkgZGlzdGFuY2VzIGZyb20gdGhlIGNlbGwgb3JpZ2luLCB1bnNrZXdlZC5cbiAgICB2YXIgeTAgPSB5aW4tait0O1xuICAgIHZhciB6MCA9IHppbi1rK3Q7XG5cbiAgICAvLyBGb3IgdGhlIDNEIGNhc2UsIHRoZSBzaW1wbGV4IHNoYXBlIGlzIGEgc2xpZ2h0bHkgaXJyZWd1bGFyIHRldHJhaGVkcm9uLlxuICAgIC8vIERldGVybWluZSB3aGljaCBzaW1wbGV4IHdlIGFyZSBpbi5cbiAgICB2YXIgaTEsIGoxLCBrMTsgLy8gT2Zmc2V0cyBmb3Igc2Vjb25kIGNvcm5lciBvZiBzaW1wbGV4IGluIChpLGosaykgY29vcmRzXG4gICAgdmFyIGkyLCBqMiwgazI7IC8vIE9mZnNldHMgZm9yIHRoaXJkIGNvcm5lciBvZiBzaW1wbGV4IGluIChpLGosaykgY29vcmRzXG4gICAgaWYoeDAgPj0geTApIHtcbiAgICAgIGlmKHkwID49IHowKSAgICAgIHsgaTE9MTsgajE9MDsgazE9MDsgaTI9MTsgajI9MTsgazI9MDsgfVxuICAgICAgZWxzZSBpZih4MCA+PSB6MCkgeyBpMT0xOyBqMT0wOyBrMT0wOyBpMj0xOyBqMj0wOyBrMj0xOyB9XG4gICAgICBlbHNlICAgICAgICAgICAgICB7IGkxPTA7IGoxPTA7IGsxPTE7IGkyPTE7IGoyPTA7IGsyPTE7IH1cbiAgICB9IGVsc2Uge1xuICAgICAgaWYoeTAgPCB6MCkgICAgICB7IGkxPTA7IGoxPTA7IGsxPTE7IGkyPTA7IGoyPTE7IGsyPTE7IH1cbiAgICAgIGVsc2UgaWYoeDAgPCB6MCkgeyBpMT0wOyBqMT0xOyBrMT0wOyBpMj0wOyBqMj0xOyBrMj0xOyB9XG4gICAgICBlbHNlICAgICAgICAgICAgIHsgaTE9MDsgajE9MTsgazE9MDsgaTI9MTsgajI9MTsgazI9MDsgfVxuICAgIH1cbiAgICAvLyBBIHN0ZXAgb2YgKDEsMCwwKSBpbiAoaSxqLGspIG1lYW5zIGEgc3RlcCBvZiAoMS1jLC1jLC1jKSBpbiAoeCx5LHopLFxuICAgIC8vIGEgc3RlcCBvZiAoMCwxLDApIGluIChpLGosaykgbWVhbnMgYSBzdGVwIG9mICgtYywxLWMsLWMpIGluICh4LHkseiksIGFuZFxuICAgIC8vIGEgc3RlcCBvZiAoMCwwLDEpIGluIChpLGosaykgbWVhbnMgYSBzdGVwIG9mICgtYywtYywxLWMpIGluICh4LHkseiksIHdoZXJlXG4gICAgLy8gYyA9IDEvNi5cbiAgICB2YXIgeDEgPSB4MCAtIGkxICsgRzM7IC8vIE9mZnNldHMgZm9yIHNlY29uZCBjb3JuZXJcbiAgICB2YXIgeTEgPSB5MCAtIGoxICsgRzM7XG4gICAgdmFyIHoxID0gejAgLSBrMSArIEczO1xuXG4gICAgdmFyIHgyID0geDAgLSBpMiArIDIgKiBHMzsgLy8gT2Zmc2V0cyBmb3IgdGhpcmQgY29ybmVyXG4gICAgdmFyIHkyID0geTAgLSBqMiArIDIgKiBHMztcbiAgICB2YXIgejIgPSB6MCAtIGsyICsgMiAqIEczO1xuXG4gICAgdmFyIHgzID0geDAgLSAxICsgMyAqIEczOyAvLyBPZmZzZXRzIGZvciBmb3VydGggY29ybmVyXG4gICAgdmFyIHkzID0geTAgLSAxICsgMyAqIEczO1xuICAgIHZhciB6MyA9IHowIC0gMSArIDMgKiBHMztcblxuICAgIC8vIFdvcmsgb3V0IHRoZSBoYXNoZWQgZ3JhZGllbnQgaW5kaWNlcyBvZiB0aGUgZm91ciBzaW1wbGV4IGNvcm5lcnNcbiAgICBpICY9IDI1NTtcbiAgICBqICY9IDI1NTtcbiAgICBrICY9IDI1NTtcbiAgICB2YXIgZ2kwID0gZ3JhZFBbaSsgICBwZXJtW2orICAgcGVybVtrICAgXV1dO1xuICAgIHZhciBnaTEgPSBncmFkUFtpK2kxK3Blcm1baitqMStwZXJtW2srazFdXV07XG4gICAgdmFyIGdpMiA9IGdyYWRQW2kraTIrcGVybVtqK2oyK3Blcm1baytrMl1dXTtcbiAgICB2YXIgZ2kzID0gZ3JhZFBbaSsgMStwZXJtW2orIDErcGVybVtrKyAxXV1dO1xuXG4gICAgLy8gQ2FsY3VsYXRlIHRoZSBjb250cmlidXRpb24gZnJvbSB0aGUgZm91ciBjb3JuZXJzXG4gICAgdmFyIHQwID0gMC41IC0geDAqeDAteTAqeTAtejAqejA7XG4gICAgaWYodDA8MCkge1xuICAgICAgbjAgPSAwO1xuICAgIH0gZWxzZSB7XG4gICAgICB0MCAqPSB0MDtcbiAgICAgIG4wID0gdDAgKiB0MCAqIGdpMC5kb3QzKHgwLCB5MCwgejApOyAgLy8gKHgseSkgb2YgZ3JhZDMgdXNlZCBmb3IgMkQgZ3JhZGllbnRcbiAgICB9XG4gICAgdmFyIHQxID0gMC41IC0geDEqeDEteTEqeTEtejEqejE7XG4gICAgaWYodDE8MCkge1xuICAgICAgbjEgPSAwO1xuICAgIH0gZWxzZSB7XG4gICAgICB0MSAqPSB0MTtcbiAgICAgIG4xID0gdDEgKiB0MSAqIGdpMS5kb3QzKHgxLCB5MSwgejEpO1xuICAgIH1cbiAgICB2YXIgdDIgPSAwLjUgLSB4Mip4Mi15Mip5Mi16Mip6MjtcbiAgICBpZih0MjwwKSB7XG4gICAgICBuMiA9IDA7XG4gICAgfSBlbHNlIHtcbiAgICAgIHQyICo9IHQyO1xuICAgICAgbjIgPSB0MiAqIHQyICogZ2kyLmRvdDMoeDIsIHkyLCB6Mik7XG4gICAgfVxuICAgIHZhciB0MyA9IDAuNSAtIHgzKngzLXkzKnkzLXozKnozO1xuICAgIGlmKHQzPDApIHtcbiAgICAgIG4zID0gMDtcbiAgICB9IGVsc2Uge1xuICAgICAgdDMgKj0gdDM7XG4gICAgICBuMyA9IHQzICogdDMgKiBnaTMuZG90Myh4MywgeTMsIHozKTtcbiAgICB9XG4gICAgLy8gQWRkIGNvbnRyaWJ1dGlvbnMgZnJvbSBlYWNoIGNvcm5lciB0byBnZXQgdGhlIGZpbmFsIG5vaXNlIHZhbHVlLlxuICAgIC8vIFRoZSByZXN1bHQgaXMgc2NhbGVkIHRvIHJldHVybiB2YWx1ZXMgaW4gdGhlIGludGVydmFsIFstMSwxXS5cbiAgICByZXR1cm4gMzIgKiAobjAgKyBuMSArIG4yICsgbjMpO1xuXG4gIH07XG5cbiAgLy8gIyMjIyMgUGVybGluIG5vaXNlIHN0dWZmXG5cbiAgZnVuY3Rpb24gZmFkZSh0KSB7XG4gICAgcmV0dXJuIHQqdCp0Kih0Kih0KjYtMTUpKzEwKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGxlcnAoYSwgYiwgdCkge1xuICAgIHJldHVybiAoMS10KSphICsgdCpiO1xuICB9XG5cbiAgLy8gMkQgUGVybGluIE5vaXNlXG4gIG1vZHVsZS5wZXJsaW4yID0gZnVuY3Rpb24oeCwgeSkge1xuICAgIC8vIEZpbmQgdW5pdCBncmlkIGNlbGwgY29udGFpbmluZyBwb2ludFxuICAgIHZhciBYID0gTWF0aC5mbG9vcih4KSwgWSA9IE1hdGguZmxvb3IoeSk7XG4gICAgLy8gR2V0IHJlbGF0aXZlIHh5IGNvb3JkaW5hdGVzIG9mIHBvaW50IHdpdGhpbiB0aGF0IGNlbGxcbiAgICB4ID0geCAtIFg7IHkgPSB5IC0gWTtcbiAgICAvLyBXcmFwIHRoZSBpbnRlZ2VyIGNlbGxzIGF0IDI1NSAoc21hbGxlciBpbnRlZ2VyIHBlcmlvZCBjYW4gYmUgaW50cm9kdWNlZCBoZXJlKVxuICAgIFggPSBYICYgMjU1OyBZID0gWSAmIDI1NTtcblxuICAgIC8vIENhbGN1bGF0ZSBub2lzZSBjb250cmlidXRpb25zIGZyb20gZWFjaCBvZiB0aGUgZm91ciBjb3JuZXJzXG4gICAgdmFyIG4wMCA9IGdyYWRQW1grcGVybVtZXV0uZG90Mih4LCB5KTtcbiAgICB2YXIgbjAxID0gZ3JhZFBbWCtwZXJtW1krMV1dLmRvdDIoeCwgeS0xKTtcbiAgICB2YXIgbjEwID0gZ3JhZFBbWCsxK3Blcm1bWV1dLmRvdDIoeC0xLCB5KTtcbiAgICB2YXIgbjExID0gZ3JhZFBbWCsxK3Blcm1bWSsxXV0uZG90Mih4LTEsIHktMSk7XG5cbiAgICAvLyBDb21wdXRlIHRoZSBmYWRlIGN1cnZlIHZhbHVlIGZvciB4XG4gICAgdmFyIHUgPSBmYWRlKHgpO1xuXG4gICAgLy8gSW50ZXJwb2xhdGUgdGhlIGZvdXIgcmVzdWx0c1xuICAgIHJldHVybiBsZXJwKFxuICAgICAgICBsZXJwKG4wMCwgbjEwLCB1KSxcbiAgICAgICAgbGVycChuMDEsIG4xMSwgdSksXG4gICAgICAgZmFkZSh5KSk7XG4gIH07XG5cbiAgLy8gM0QgUGVybGluIE5vaXNlXG4gIG1vZHVsZS5wZXJsaW4zID0gZnVuY3Rpb24oeCwgeSwgeikge1xuICAgIC8vIEZpbmQgdW5pdCBncmlkIGNlbGwgY29udGFpbmluZyBwb2ludFxuICAgIHZhciBYID0gTWF0aC5mbG9vcih4KSwgWSA9IE1hdGguZmxvb3IoeSksIFogPSBNYXRoLmZsb29yKHopO1xuICAgIC8vIEdldCByZWxhdGl2ZSB4eXogY29vcmRpbmF0ZXMgb2YgcG9pbnQgd2l0aGluIHRoYXQgY2VsbFxuICAgIHggPSB4IC0gWDsgeSA9IHkgLSBZOyB6ID0geiAtIFo7XG4gICAgLy8gV3JhcCB0aGUgaW50ZWdlciBjZWxscyBhdCAyNTUgKHNtYWxsZXIgaW50ZWdlciBwZXJpb2QgY2FuIGJlIGludHJvZHVjZWQgaGVyZSlcbiAgICBYID0gWCAmIDI1NTsgWSA9IFkgJiAyNTU7IFogPSBaICYgMjU1O1xuXG4gICAgLy8gQ2FsY3VsYXRlIG5vaXNlIGNvbnRyaWJ1dGlvbnMgZnJvbSBlYWNoIG9mIHRoZSBlaWdodCBjb3JuZXJzXG4gICAgdmFyIG4wMDAgPSBncmFkUFtYKyAgcGVybVtZKyAgcGVybVtaICBdXV0uZG90Myh4LCAgIHksICAgICB6KTtcbiAgICB2YXIgbjAwMSA9IGdyYWRQW1grICBwZXJtW1krICBwZXJtW1orMV1dXS5kb3QzKHgsICAgeSwgICB6LTEpO1xuICAgIHZhciBuMDEwID0gZ3JhZFBbWCsgIHBlcm1bWSsxK3Blcm1bWiAgXV1dLmRvdDMoeCwgICB5LTEsICAgeik7XG4gICAgdmFyIG4wMTEgPSBncmFkUFtYKyAgcGVybVtZKzErcGVybVtaKzFdXV0uZG90Myh4LCAgIHktMSwgei0xKTtcbiAgICB2YXIgbjEwMCA9IGdyYWRQW1grMStwZXJtW1krICBwZXJtW1ogIF1dXS5kb3QzKHgtMSwgICB5LCAgIHopO1xuICAgIHZhciBuMTAxID0gZ3JhZFBbWCsxK3Blcm1bWSsgIHBlcm1bWisxXV1dLmRvdDMoeC0xLCAgIHksIHotMSk7XG4gICAgdmFyIG4xMTAgPSBncmFkUFtYKzErcGVybVtZKzErcGVybVtaICBdXV0uZG90Myh4LTEsIHktMSwgICB6KTtcbiAgICB2YXIgbjExMSA9IGdyYWRQW1grMStwZXJtW1krMStwZXJtW1orMV1dXS5kb3QzKHgtMSwgeS0xLCB6LTEpO1xuXG4gICAgLy8gQ29tcHV0ZSB0aGUgZmFkZSBjdXJ2ZSB2YWx1ZSBmb3IgeCwgeSwgelxuICAgIHZhciB1ID0gZmFkZSh4KTtcbiAgICB2YXIgdiA9IGZhZGUoeSk7XG4gICAgdmFyIHcgPSBmYWRlKHopO1xuXG4gICAgLy8gSW50ZXJwb2xhdGVcbiAgICByZXR1cm4gbGVycChcbiAgICAgICAgbGVycChcbiAgICAgICAgICBsZXJwKG4wMDAsIG4xMDAsIHUpLFxuICAgICAgICAgIGxlcnAobjAwMSwgbjEwMSwgdSksIHcpLFxuICAgICAgICBsZXJwKFxuICAgICAgICAgIGxlcnAobjAxMCwgbjExMCwgdSksXG4gICAgICAgICAgbGVycChuMDExLCBuMTExLCB1KSwgdyksXG4gICAgICAgdik7XG4gIH07XG5cbn0pKHR5cGVvZiBtb2R1bGUgPT09IFwidW5kZWZpbmVkXCIgPyB0aGlzIDogbW9kdWxlLmV4cG9ydHMpOyIsImNvbnN0IGNvbnRhaW5lciA9IHJlcXVpcmUoJy4uL2NvbnRhaW5lcicpO1xuY29uc3QgcmFuZG9tUXVhdGVybmlvbiA9IHJlcXVpcmUoJy4uL3V0aWxzL21hdGgnKS5yYW5kb21RdWF0ZXJuaW9uO1xuXG5jbGFzcyBBc3Rlcm9pZCB7XG5cdGNvbnN0cnVjdG9yKHByb3BzKSB7XG5cdFx0cHJvcHMgPSBwcm9wcyB8fCB7fTtcblx0XHR0aGlzLnNpemUgPSBwcm9wcy5zaXplIHx8IDE7XG5cdFx0dGhpcy5zY2VuZSA9IGNvbnRhaW5lci5zY2VuZTtcblx0XHRjb25zdCBnZW9tZXRyeSA9IG5ldyBUSFJFRS5JY29zYWhlZHJvbkdlb21ldHJ5KDMuNSAqIHRoaXMuc2l6ZSk7XG5cdFx0Ly8gZ2VvbWV0cnkuY29tcHV0ZUZsYXRWZXJ0ZXhOb3JtYWxzKCk7XG5cdFx0Y29uc3QgbWF0ZXJpYWwgPSBuZXcgVEhSRUUuTWVzaEJhc2ljTWF0ZXJpYWwoe1xuXHRcdFx0Y29sb3I6IDB4Q0NDQ0NDXG5cdFx0fSk7XG5cdFx0dGhpcy5vYmplY3QgPSBuZXcgVEhSRUUuTWVzaChnZW9tZXRyeSwgbWF0ZXJpYWwpO1xuXHRcdHRoaXMub2JqZWN0LnF1YXRlcm5pb24uY29weShyYW5kb21RdWF0ZXJuaW9uKCkpO1xuXHRcdGlmIChwcm9wcy5wb3NpdGlvbiAhPSBudWxsKSB7XG5cdFx0XHR0aGlzLm9iamVjdC5wb3NpdGlvbi5jb3B5KHByb3BzLnBvc2l0aW9uKTtcblx0XHR9XG5cdH1cblxuXHRzdGFydCgpIHtcblx0XHR0aGlzLnNjZW5lLmFkZCh0aGlzLm9iamVjdCk7XG5cdH1cblxuXHR0aWNrKGR0KSB7XG5cblx0fVxuXG5cdGRlc3Ryb3koKSB7XG5cdFx0dGhpcy5zY2VuZS5yZW1vdmUodGhpcy5vYmplY3QpO1x0XG5cdH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBBc3Rlcm9pZDsiLCJjb25zdCBjb250YWluZXIgPSByZXF1aXJlKCcuLi9jb250YWluZXInKTtcbmNvbnN0IGxpbmVhckJpbGxib2FyZCA9IHJlcXVpcmUoJy4uL3V0aWxzL21hdGgnKS5saW5lYXJCaWxsYm9hcmQ7XG5cbmNsYXNzIEJlYW0ge1xuXHRjb25zdHJ1Y3Rvcihwcm9wcykge1xuXHRcdHRoaXMudGFyZ2V0ID0gcHJvcHMudGFyZ2V0O1xuXHRcdHRoaXMudHVycmVudCA9IHByb3BzLnR1cnJlbnQ7XG5cblx0XHR0aGlzLnNjZW5lID0gY29udGFpbmVyLnNjZW5lO1x0XHRcblx0XHR0aGlzLmNhbWVyYSA9IGNvbnRhaW5lci5jYW1lcmE7XG5cdFx0dGhpcy5hcHAgPSBjb250YWluZXIuYXBwO1xuXG5cdFx0dGhpcy5sZW5ndGggPSAwO1xuXHRcdGNvbnN0IGhlaWdodCA9IDAuNTtcblxuXHRcdHRoaXMuZGlyID0gdGhpcy50YXJnZXQucG9zaXRpb24uY2xvbmUoKS5zdWIodGhpcy50dXJyZW50LnBvc2l0aW9uKS5ub3JtYWxpemUoKTtcblx0XHR0aGlzLnF1YXRlcm5pb24gPSBuZXcgVEhSRUUuUXVhdGVybmlvbigpLnNldEZyb21Vbml0VmVjdG9ycyhuZXcgVEhSRUUuVmVjdG9yMygxLCAwLCAwKSwgdGhpcy5kaXIpO1xuXG5cdFx0dGhpcy5nZW9tZXRyeSA9IG5ldyBUSFJFRS5HZW9tZXRyeSgpO1xuXHRcdHRoaXMuZ2VvbWV0cnkudmVydGljZXMucHVzaChcblx0XHRcdG5ldyBUSFJFRS5WZWN0b3IzKDAsIC1oZWlnaHQsIDApLFxuXHRcdFx0bmV3IFRIUkVFLlZlY3RvcjMoMCwgaGVpZ2h0LCAwKSxcblx0XHRcdG5ldyBUSFJFRS5WZWN0b3IzKDEsIGhlaWdodCwgMCksXG5cdFx0XHRuZXcgVEhSRUUuVmVjdG9yMygxLCAtaGVpZ2h0LCAwKVxuXHRcdCk7XG5cblx0XHR0aGlzLmdlb21ldHJ5LmZhY2VzLnB1c2goXG5cdFx0XHRuZXcgVEhSRUUuRmFjZTMoMiwgMSwgMCksXG5cdFx0XHRuZXcgVEhSRUUuRmFjZTMoMiwgMCwgMylcblx0XHQpO1xuXG5cdFx0dGhpcy5tYXRlcmlhbCA9IG5ldyBUSFJFRS5NZXNoQmFzaWNNYXRlcmlhbCh7XG5cdFx0XHRjb2xvcjogMHhmZmZmZmYsXG5cdFx0XHRzaWRlOiBUSFJFRS5Eb3VibGVTaWRlXG5cdFx0fSk7XG5cblx0XHR0aGlzLm1lc2ggPSBuZXcgVEhSRUUuTWVzaCh0aGlzLmdlb21ldHJ5LCB0aGlzLm1hdGVyaWFsKTtcblx0XHRcblx0XHR0aGlzLm9iamVjdCA9IG5ldyBUSFJFRS5PYmplY3QzRCgpO1xuXHRcdHRoaXMub2JqZWN0LmFkZCh0aGlzLm1lc2gpO1xuXG5cdFx0dGhpcy5yID0gTWF0aC5yYW5kb20oKSAqIE1hdGguUEkgLyAyO1xuXG5cdFx0dGhpcy5saWZlID0gMS4wO1xuXHRcdHRoaXMuY291bnRlciA9IDA7XG5cblx0XHR0aGlzLnNwZWVkID0gNTA7XG5cdH1cblxuXHRzdGFydCgpIHtcblx0XHR0aGlzLnNjZW5lLmFkZCh0aGlzLm9iamVjdCk7XG5cdH1cblxuXHR0aWNrKGR0KSB7XG5cdFx0dGhpcy5kaXIgPSB0aGlzLnRhcmdldC5wb3NpdGlvbi5jbG9uZSgpLnN1Yih0aGlzLnR1cnJlbnQucG9zaXRpb24pLm5vcm1hbGl6ZSgpO1xuXHRcdHRoaXMucXVhdGVybmlvbiA9IG5ldyBUSFJFRS5RdWF0ZXJuaW9uKCkuc2V0RnJvbVVuaXRWZWN0b3JzKG5ldyBUSFJFRS5WZWN0b3IzKDEsIDAsIDApLCB0aGlzLmRpcik7XG5cdFx0dGhpcy5sZW5ndGggKz0gdGhpcy5zcGVlZDtcblxuXHRcdGxpbmVhckJpbGxib2FyZCh0aGlzLmNhbWVyYSwgdGhpcy5vYmplY3QsIHRoaXMuZGlyLCB0aGlzLnF1YXRlcm5pb24pO1xuXG5cdFx0Y29uc3QgZGF0ZSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xuXG5cdFx0Y29uc3Qgd2lkdGhOb2lzZSA9XG5cdCAgICBNYXRoLnNpbihkYXRlIC8gMTcgKyB0aGlzLnIpICogMC4zICtcbiAgXHQgIE1hdGguc2luKChkYXRlICsgMTIzICsgdGhpcy5yKSAvIDI3KSAqIDAuNCArXG4gICAgXHRNYXRoLnNpbigoZGF0ZSArIDIzNCArIHRoaXMucikgLyAxMykgKiAwLjQ7XG5cbiAgICBjb25zdCB0ID0gdGhpcy5jb3VudGVyIC8gdGhpcy5saWZlO1xuICAgIGNvbnN0IHdpZHRoID0gMjtcblxuXHRcdHRoaXMubWVzaC5zY2FsZS55ID0gTWF0aC5zaW4odCAqIE1hdGguUEkpICogd2lkdGggKyB3aWR0aE5vaXNlO1xuXHRcdHRoaXMubWVzaC5zY2FsZS55ICo9IDAuNztcblx0XHR0aGlzLm1lc2guc2NhbGUueCA9IHRoaXMubGVuZ3RoO1xuXG5cdFx0dGhpcy5vYmplY3QucG9zaXRpb24uY29weSh0aGlzLnR1cnJlbnQucG9zaXRpb24pO1xuXG5cdFx0dGhpcy5jb3VudGVyICs9IGR0O1xuXHRcdGlmICh0aGlzLmNvdW50ZXIgPiB0aGlzLmxpZmUpIHtcblx0XHRcdHRoaXMuYXBwLmRlc3Ryb3kodGhpcyk7XG5cdFx0fVxuXHR9XG5cblx0ZGVzdHJveSgpIHtcblx0XHR0aGlzLnNjZW5lLnJlbW92ZSh0aGlzLm9iamVjdCk7XHRcblx0fVxufVx0XG5cbm1vZHVsZS5leHBvcnRzID0gQmVhbTsiLCJjb25zdCBjb250YWluZXIgPSByZXF1aXJlKCcuLi9jb250YWluZXInKTtcblxuY2xhc3MgRHJhZ0NhbWVyYSB7XG5cdGNvbnN0cnVjdG9yKHByb3BzKSB7XG5cdFx0dGhpcy5yb3RhdGlvbiA9IG5ldyBUSFJFRS5FdWxlcigtTWF0aC5QSSAvIDQsIE1hdGguUEkgLyA0LCAwLCAnWVhaJyk7XG5cdFx0dGhpcy5kaXN0YW5jZSA9IDUwO1xuXHRcdHRoaXMudGFyZ2V0ID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcblx0XHR0aGlzLmNhbWVyYSA9IGNvbnRhaW5lci5jYW1lcmE7XG5cdFx0dGhpcy51cCA9IG5ldyBUSFJFRS5WZWN0b3IzKDAsIDEsIDApO1xuXHRcdHRoaXMuaXNEcmFnID0gZmFsc2U7XG5cdFx0dGhpcy5sYXN0WCA9IDA7XG5cdFx0dGhpcy5sYXN0WSA9IDA7XG5cdFx0dGhpcy54U3BlZWQgPSAwLjAxO1xuXHRcdHRoaXMueVNwZWVkID0gMC4wMTtcblxuXHRcdHRoaXMub25Nb3VzZVdoZWVsID0gdGhpcy5vbk1vdXNlV2hlZWwuYmluZCh0aGlzKTtcblx0XHR0aGlzLm9uTW91c2VEb3duID0gdGhpcy5vbk1vdXNlRG93bi5iaW5kKHRoaXMpO1xuXHRcdHRoaXMub25Nb3VzZVVwID0gdGhpcy5vbk1vdXNlVXAuYmluZCh0aGlzKTtcblx0XHR0aGlzLm9uTW91c2VNb3ZlID0gdGhpcy5vbk1vdXNlTW92ZS5iaW5kKHRoaXMpO1xuXHR9XG5cblx0c3RhcnQoKSB7XG5cdFx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNld2hlZWwnLCB0aGlzLm9uTW91c2VXaGVlbCk7XG5cdFx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIHRoaXMub25Nb3VzZURvd24pO1xuXHRcdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgdGhpcy5vbk1vdXNlVXApO1xuXHRcdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLm9uTW91c2VNb3ZlKTtcblx0fVxuXG5cdG9uTW91c2VXaGVlbChlKSB7XG5cdFx0Y29uc3Qgc2NhbGUgPSAxICsgZS5kZWx0YVkgLyAxMDAwO1xuXHRcdHRoaXMuZGlzdGFuY2UgKj0gc2NhbGU7XG5cdH1cblxuXHRvbk1vdXNlRG93bihlKSB7XG5cdFx0dGhpcy5pc0RyYWcgPSB0cnVlO1xuXHR9XG5cblx0b25Nb3VzZVVwKGUpIHtcblx0XHR0aGlzLmlzRHJhZyA9IGZhbHNlO1xuXHR9XG5cblx0b25Nb3VzZU1vdmUoZSkge1xuXHRcdGlmICh0aGlzLmlzRHJhZykge1xuXHRcdFx0Y29uc3QgZGlmZlggPSBlLmNsaWVudFggLSB0aGlzLmxhc3RYO1xuXHRcdFx0Y29uc3QgZGlmZlkgPSBlLmNsaWVudFkgLSB0aGlzLmxhc3RZO1xuXG5cdFx0XHR0aGlzLnJvdGF0aW9uLnggKz0gZGlmZlkgKiB0aGlzLnlTcGVlZDtcblx0XHRcdHRoaXMucm90YXRpb24ueSArPSBkaWZmWCAqIHRoaXMueFNwZWVkO1xuXHRcdH1cblxuXHRcdHRoaXMubGFzdFggPSBlLmNsaWVudFg7XG5cdFx0dGhpcy5sYXN0WSA9IGUuY2xpZW50WTtcblx0fVxuXHRcblx0dGljaygpIHtcblx0XHRjb25zdCBwb3NpdGlvbiA9IHRoaXMudGFyZ2V0LmNsb25lKClcblx0XHRcdC5hZGQobmV3IFRIUkVFLlZlY3RvcjMoMCwgMCwgMSlcblx0XHRcdFx0LmFwcGx5RXVsZXIodGhpcy5yb3RhdGlvbilcblx0XHRcdFx0Lm11bHRpcGx5U2NhbGFyKHRoaXMuZGlzdGFuY2UpKTtcblx0XHR0aGlzLmNhbWVyYS5wb3NpdGlvbi5jb3B5KHBvc2l0aW9uKTtcblx0XHR0aGlzLmNhbWVyYS5sb29rQXQodGhpcy50YXJnZXQsIHRoaXMudXApO1xuXHR9XG5cblx0ZGVzdHJveSgpIHtcblx0XHR3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2V3aGVlbCcsIHRoaXMub25Nb3VzZVdoZWVsKTtcblx0fVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBEcmFnQ2FtZXJhOyIsImNvbnN0IGNvbnRhaW5lciA9IHJlcXVpcmUoJy4uL2NvbnRhaW5lcicpO1xuY29uc3QgUGFydGljbGVTeXN0ZW0gPSByZXF1aXJlKCcuL3BhcnRpY2xlc3lzdGVtJyk7XG5cbmNsYXNzIEVuZ2luZSB7XG4gIGNvbnN0cnVjdG9yKHByb3BzKSB7XG4gICAgdGhpcy5wcm9wcyA9IHByb3BzO1xuICAgIHRoaXMub2JqZWN0ID0gbmV3IFRIUkVFLk9iamVjdDNEKCk7XG4gICAgdGhpcy5zY2VuZSA9IGNvbnRhaW5lci5zY2VuZTtcbiAgICB0aGlzLmFwcCA9IGNvbnRhaW5lci5hcHA7XG4gICAgdGhpcy5wYXJ0aWNsZVZlbG9jaXR5ID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcbiAgICB0aGlzLmFtb3VudCA9IDA7XG5cbiAgICB0aGlzLnBhcnRpY2xlU3lzdGVtID0gdGhpcy5hcHAuYWRkKFBhcnRpY2xlU3lzdGVtLCB7XG4gICAgICBzY2FsZTogWyAoKHApID0+IHtcbiAgICAgIFx0cmV0dXJuIHAuX3NpemU7XG4gICAgICB9KSwgMF0sXG4gICAgICBsaWZlOiAoKHApID0+IHtcbiAgICAgICAgcmV0dXJuIHAuX3NpemUgKiAxNTA7XG4gICAgICB9KSxcbiAgICAgIGludGVydmFsOiAzMCxcbiAgICAgIHZlbG9jaXR5OiB0aGlzLnBhcnRpY2xlVmVsb2NpdHksXG4gICAgICBhdXRvUGxheTogZmFsc2UsXG4gICAgICBvblBhcnRpY2xlOiAocCkgPT4ge1xuICAgICAgICBwLl9zaXplID0gTWF0aC5yYW5kb20oKSArIDE7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBzdGFydCgpIHtcbiAgICBjb25zdCBzaGlwID0gdGhpcy5wcm9wcy5zaGlwO1xuICAgIGNvbnN0IGNvb3JkID0gdGhpcy5wcm9wcy5jb29yZDtcbiAgICBzaGlwLmlubmVyT2JqZWN0LmFkZCh0aGlzLm9iamVjdCk7XG4gICAgdGhpcy5vYmplY3QucG9zaXRpb25cbiAgICAgIC5mcm9tQXJyYXkoY29vcmQpXG4gICAgICAuYWRkKG5ldyBUSFJFRS5WZWN0b3IzKDAuNSwgMC41LCAwLjUpKVxuICAgICAgLmFkZChuZXcgVEhSRUUuVmVjdG9yMygwLCAwLCAxKSk7XG5cbiAgICB0aGlzLnVwZGF0ZVBhcnRpY2xlU3lzdGVtKCk7XG4gIH1cblxuICB0aWNrKGR0KSB7XG4gICAgdGhpcy51cGRhdGVQYXJ0aWNsZVN5c3RlbSgpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLmFwcC5kZXN0cm95KHRoaXMucGFydGljbGVTeXN0ZW0pO1xuICB9XG5cbiAgdXBkYXRlUGFydGljbGVTeXN0ZW0oKSB7XG4gICAgaWYgKHRoaXMuYW1vdW50ID09PSAwICYmIHRoaXMucGFydGljbGVTeXN0ZW0ucGxheWluZykge1xuICAgICAgdGhpcy5wYXJ0aWNsZVN5c3RlbS5wYXVzZSgpO1xuICAgIH0gZWxzZSBpZiAodGhpcy5hbW91bnQgPiAwICYmICF0aGlzLnBhcnRpY2xlU3lzdGVtLnBsYXlpbmcpIHtcbiAgICAgIHRoaXMucGFydGljbGVTeXN0ZW0ucGxheSgpO1xuICAgIH1cbiAgICB0aGlzLnBhcnRpY2xlU3lzdGVtLnBvc2l0aW9uLmNvcHkodGhpcy5vYmplY3QuZ2V0V29ybGRQb3NpdGlvbigpKTtcbiAgICBjb25zdCByb3RhdGlvbiA9IHRoaXMub2JqZWN0LmdldFdvcmxkUm90YXRpb24oKTtcbiAgICBjb25zdCBkaXJlY3Rpb24gPSBuZXcgVEhSRUUuVmVjdG9yMygwLCAwLCAxKS5hcHBseUV1bGVyKHJvdGF0aW9uKTtcbiAgICB0aGlzLnBhcnRpY2xlVmVsb2NpdHkuY29weShkaXJlY3Rpb24ubXVsdGlwbHlTY2FsYXIoMTApKTtcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBFbmdpbmU7XG4iLCJjb25zdCBjb250YWluZXIgPSByZXF1aXJlKCcuLi9jb250YWluZXInKTtcblxuY2xhc3MgR3JpZCB7XG4gIGNvbnN0cnVjdG9yKHByb3BzKSB7XG4gICAgcHJvcHMgPSBwcm9wcyB8fCB7fTtcbiAgICB0aGlzLmF4aXMgPSBbMSwgTWF0aC5zcXJ0KDMpIC8gMl07XG4gICAgdGhpcy5zY2VuZSA9IGNvbnRhaW5lci5zY2VuZTtcbiAgICB0aGlzLndpZHRoID0gcHJvcHMud2lkdGggfHwgMTAwO1xuICAgIHRoaXMuaGVpZ2h0ID0gcHJvcHMuaGVpZ2h0IHx8IDEwMDtcbiAgICB0aGlzLnNpemUgPSBwcm9wcy5zaXplIHx8IDEyO1xuICB9XG5cbiAgaGV4VG9Db29yZChpLCBqKSB7XG4gICAgaSAtPSB0aGlzLndpZHRoIC8gMjtcbiAgICBqIC09IHRoaXMuaGVpZ2h0IC8gMjtcbiAgICByZXR1cm4gW1xuICAgICAgKHRoaXMuYXhpc1swXSAqIGkgKyAoKGogJSAyID09PSAwKSA/IHRoaXMuYXhpc1sxXSAvIDIgOiAwKSkgKiB0aGlzLnNpemUsXG4gICAgICB0aGlzLmF4aXNbMV0gKiBqICogdGhpcy5zaXplXG4gICAgXTtcbiAgfVxuXG4gIGdldFN1cnJvdW5kaW5nQ29vcmRzKGNvb3JkKSB7XG4gICAgY29uc3QgaSA9IGNvb3JkWzBdO1xuICAgIGNvbnN0IGogPSBjb29yZFsxXTtcblxuICAgIGlmIChqICUgMiA9PT0gMCkge1xuICAgICAgcmV0dXJuIFtcbiAgICAgICAgW2kgLSAxLCBqIC0gMV0sXG4gICAgICAgIFtpLCBqIC0gMV0sXG4gICAgICAgIFtpIC0gMSwgal0sXG4gICAgICAgIFtpICsgMSwgal0sXG4gICAgICAgIFtpLCBqICsgMV0sXG4gICAgICAgIFtpIC0gMSwgaiArIDFdLFxuICAgICAgXTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIFtcbiAgICAgICAgW2kgKyAxLCBqIC0gMV0sXG4gICAgICAgIFtpLCBqIC0gMV0sXG4gICAgICAgIFtpIC0gMSwgal0sXG4gICAgICAgIFtpICsgMSwgal0sXG4gICAgICAgIFtpLCBqICsgMV0sXG4gICAgICAgIFtpICsgMSwgaiArIDFdLFxuICAgICAgXTtcbiAgICB9XG4gIH1cblxuICBzdGFydCgpIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMud2lkdGg7IGkrKykge1xuICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCB0aGlzLmhlaWdodDsgaisrKSB7XG5cbiAgICAgICAgY29uc3Qgc3ByaXRlID0gbmV3IFRIUkVFLlNwcml0ZSgpO1xuICAgICAgICBjb25zdCBzY3JlZW4gPSB0aGlzLmhleFRvQ29vcmQoaSwgaik7XG4gICAgICAgIHNwcml0ZS5wb3NpdGlvbi54ID0gc2NyZWVuWzBdO1xuICAgICAgICBzcHJpdGUucG9zaXRpb24ueiA9IHNjcmVlblsxXTtcblxuICAgICAgICAvLyB0aGlzLnNjZW5lLmFkZChzcHJpdGUpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHBsYWNlKHNoaXBzLCBzaWRlKSB7XG5cbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IEdyaWQ7XG4iLCJjb25zdCBjb250YWluZXIgPSByZXF1aXJlKCcuLi9jb250YWluZXInKTtcblxuY2xhc3MgTGFzZXIge1xuICBjb25zdHJ1Y3Rvcihwcm9wcykge1xuICAgIHRoaXMudGFyZ2V0ID0gcHJvcHMudGFyZ2V0O1xuICAgIHRoaXMudHVycmVudCA9IHByb3BzLnR1cnJlbnQ7XG5cbiAgICB0aGlzLnNjZW5lID0gY29udGFpbmVyLnNjZW5lO1xuICAgIHRoaXMuYXBwID0gY29udGFpbmVyLmFwcDtcbiAgICB0aGlzLmNvbGxpc2lvbnMgPSBjb250YWluZXIuY29sbGlzaW9ucztcblxuICAgIHRoaXMub2JqZWN0ID0gbmV3IFRIUkVFLlNwcml0ZSgpO1xuICAgIHRoaXMub2JqZWN0LnNjYWxlLnNldCgyLCAyLCAyKTtcblxuICAgIHRoaXMuc3BlZWQgPSAyMDA7XG5cbiAgICB0aGlzLmxpZmUgPSAxMDAwMDtcblxuICAgIHRoaXMub25Db2xsaXNpb24gPSB0aGlzLm9uQ29sbGlzaW9uLmJpbmQodGhpcyk7XG5cbiAgICB0aGlzLmJvZHkgPSB7XG4gICAgICB0eXBlOiAncmF5JyxcbiAgICAgIHJheWNhc3RlcjogbmV3IFRIUkVFLlJheWNhc3RlcigpLFxuICAgICAgb25Db2xsaXNpb246IHRoaXMub25Db2xsaXNpb25cbiAgICB9O1xuICB9XG5cbiAgb25Db2xsaXNpb24oY29sbGlzaW9uKSB7XG4gICAgY29uc3QgZW50aXR5ID0gY29sbGlzaW9uLmJvZHkuZW50aXR5O1xuICAgIGlmIChlbnRpdHkgPT09IHRoaXMudHVycmVudC5zaGlwKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gRXhwbG9zaW9uXG4gICAgdGhpcy5hcHAuZGVzdHJveSh0aGlzKTtcbiAgfVxuXG4gIHN0YXJ0KCkge1xuICBcdHRoaXMub2JqZWN0LnBvc2l0aW9uLmNvcHkodGhpcy50dXJyZW50LnBvc2l0aW9uKTtcbiAgXHR0aGlzLnNjZW5lLmFkZCh0aGlzLm9iamVjdCk7XG5cbiAgICBjb25zdCBkaXMgPSB0aGlzLnR1cnJlbnQucG9zaXRpb24uZGlzdGFuY2VUbyh0aGlzLnRhcmdldC5wb3NpdGlvbik7XG4gICAgY29uc3QgdGltZSA9IGRpcyAvIHRoaXMuc3BlZWQ7XG4gICAgY29uc3QgbGVhZGluZyA9IHRoaXMudGFyZ2V0LnZlbG9jaXR5LmNsb25lKCkubXVsdGlwbHlTY2FsYXIodGltZSk7XG4gIFx0dGhpcy52ZWxvY2l0eSA9IHRoaXMudGFyZ2V0LnBvc2l0aW9uLmNsb25lKClcbiAgICAgIC5hZGQobGVhZGluZylcbiAgICAgIC5zdWIodGhpcy50dXJyZW50LnBvc2l0aW9uKVxuICAgICAgLm5vcm1hbGl6ZSgpXG4gICAgICAubXVsdGlwbHlTY2FsYXIodGhpcy5zcGVlZCk7XG5cbiAgXHR0aGlzLmRpZVRpbWUgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKSArIHRoaXMubGlmZTtcblxuICAgIHRoaXMuY29sbGlzaW9ucy5hZGQodGhpcy5ib2R5KTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gIFx0dGhpcy5zY2VuZS5yZW1vdmUodGhpcy5vYmplY3QpO1xuICAgIHRoaXMuY29sbGlzaW9ucy5yZW1vdmUodGhpcy5ib2R5KTtcbiAgfVxuXG4gIHRpY2soZHQpIHtcbiAgICBjb25zdCB2ZWxvY2l0eSA9IHRoaXMudmVsb2NpdHkuY2xvbmUoKS5tdWx0aXBseVNjYWxhcihkdCk7XG4gIFx0dGhpcy5vYmplY3QucG9zaXRpb24uYWRkKHZlbG9jaXR5KTtcblxuICBcdGlmIChuZXcgRGF0ZSgpLmdldFRpbWUoKSA+IHRoaXMuZGllVGltZSkge1xuICBcdFx0dGhpcy5hcHAuZGVzdHJveSh0aGlzKTtcbiAgXHR9XG5cbiAgICB0aGlzLmJvZHkucmF5Y2FzdGVyID0gbmV3IFRIUkVFLlJheWNhc3RlcihcbiAgICAgIHRoaXMub2JqZWN0LnBvc2l0aW9uLCBcbiAgICAgIHZlbG9jaXR5LmNsb25lKCkubm9ybWFsaXplKCksXG4gICAgICAwLFxuICAgICAgdmVsb2NpdHkubGVuZ3RoKCkpO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gTGFzZXI7XG4iLCJjb25zdCBjb250YWluZXIgPSByZXF1aXJlKCcuLi9jb250YWluZXInKTtcblxuY2xhc3MgVmFsdWUge1xuXHRjb25zdHJ1Y3Rvcih2YWx1ZSwgb2JqZWN0KSB7XG5cdFx0dGhpcy52YWx1ZSA9IHZhbHVlO1xuXHRcdHRoaXMub2JqZWN0ID0gb2JqZWN0O1xuXG5cdFx0dGhpcy5pc051bWJlciA9IHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcic7XG5cdFx0dGhpcy5pc0Z1bmMgPSB0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbic7XG5cdFx0Ly8gTGluZWFyIGludGVydmFsc1xuXHRcdHRoaXMuaW50ZXJ2YWxzID0gW107XG5cblx0XHRpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcblx0XHRcdGNvbnN0IHZhbHVlcyA9IHZhbHVlLm1hcCgodikgPT4ge1xuXHRcdFx0XHRpZiAodHlwZW9mIHYgPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdFx0XHRyZXR1cm4gdih0aGlzLm9iamVjdCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHY7XG5cdFx0XHR9KTtcblxuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB2YWx1ZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0Y29uc3QgaW50ZXJ2YWwgPSB7XG5cdFx0XHRcdFx0dDogaSAvIHZhbHVlcy5sZW5ndGgsXG5cdFx0XHRcdFx0djogdmFsdWVzW2ldXG5cdFx0XHRcdH07XG5cdFx0XHRcdGlmIChpIDwgdmFsdWVzLmxlbmd0aCAtIDEpIHtcblx0XHRcdFx0XHRpbnRlcnZhbC52ZCA9IHZhbHVlc1tpICsgMV0gLSB2YWx1ZXNbaV07XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5pbnRlcnZhbHMucHVzaChpbnRlcnZhbCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Z2V0KHQpIHtcblx0XHR0ID0gdCB8fCAwO1xuXHRcdGlmICh0aGlzLmlzTnVtYmVyKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy52YWx1ZTtcblx0XHR9IGVsc2UgaWYgKHRoaXMuaXNGdW5jKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy52YWx1ZSh0aGlzLm9iamVjdCk7XG5cdFx0fSBlbHNlIGlmICh0aGlzLmludGVydmFscy5sZW5ndGggPiAwKSB7XG5cdFx0XHRsZXQgaW50ZXJ2YWw7XG5cdFx0XHRpZiAodCA+IDEpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuaW50ZXJ2YWxzW3RoaXMuaW50ZXJ2YWxzLmxlbmd0aCAtIDFdLnY7XG5cdFx0XHR9XG5cblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5pbnRlcnZhbHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0aW50ZXJ2YWwgPSB0aGlzLmludGVydmFsc1tpXTtcblx0XHRcdFx0aWYgKHQgPCBpbnRlcnZhbC50KSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCB0ZCA9IHQgLSBpbnRlcnZhbC50O1xuXHRcdFx0XHRjb25zdCB2ZCA9IGludGVydmFsLnZkO1xuXHRcdFx0XHRyZXR1cm4gaW50ZXJ2YWwudiArIHRkICogdmQ7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG5cbmNsYXNzIFBhcnRpY2xlIHtcblx0Y29uc3RydWN0b3IocHJvcHMpIHtcblx0XHR0aGlzLnByb3BzID0gcHJvcHM7XG5cblx0XHR0aGlzLnBhcmVudCA9IHByb3BzLnBhcmVudDtcblx0XHR0aGlzLm9iamVjdCA9IG5ldyBUSFJFRS5TcHJpdGUocHJvcHMubWF0ZXJpYWwpO1xuXHRcdHRoaXMuYXBwID0gY29udGFpbmVyLmFwcDtcblx0fVxuXG5cdGluaXRQcm9wcygpIHtcblx0XHR0aGlzLmxpZmUgPSBuZXcgVmFsdWUodGhpcy5wcm9wcy5saWZlLCB0aGlzKTtcblx0XHR0aGlzLnZlbG9jaXR5ID0gdGhpcy5wcm9wcy52ZWxvY2l0eTtcblx0XHR0aGlzLnNjYWxlID0gbmV3IFZhbHVlKHRoaXMucHJvcHMuc2NhbGUsIHRoaXMpO1xuXHR9XG5cblx0c3RhcnQoKSB7XG5cdFx0dGhpcy5wYXJlbnQuYWRkKHRoaXMub2JqZWN0KTtcblx0XHR0aGlzLnN0YXJ0VGltZXIgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcblx0XHR0aGlzLnRpbWVyID0gbmV3IERhdGUoKS5nZXRUaW1lKCkgKyB0aGlzLmxpZmUuZ2V0KCk7XG5cdH1cblxuXHR0aWNrKGR0KSB7XG5cdFx0dGhpcy5vYmplY3QucG9zaXRpb24uYWRkKHRoaXMudmVsb2NpdHkuY2xvbmUoKS5tdWx0aXBseVNjYWxhcihkdCkpO1xuXHRcdGNvbnN0IHQgPSAobmV3IERhdGUoKS5nZXRUaW1lKCkgLSB0aGlzLnN0YXJ0VGltZXIpIC8gdGhpcy5saWZlLmdldCgpO1xuXHRcdGNvbnN0IHNjYWxlID0gdGhpcy5zY2FsZS5nZXQodCk7XG5cdFx0dGhpcy5vYmplY3Quc2NhbGUuc2V0KHNjYWxlLCBzY2FsZSwgc2NhbGUpO1xuXG5cdFx0aWYgKG5ldyBEYXRlKCkuZ2V0VGltZSgpID4gdGhpcy50aW1lcikge1xuXHRcdFx0dGhpcy5hcHAuZGVzdHJveSh0aGlzKTtcblx0XHR9XG5cdH1cblxuXHRkZXN0cm95KCkge1xuXHRcdHRoaXMub2JqZWN0LnBhcmVudC5yZW1vdmUodGhpcy5vYmplY3QpO1xuXHR9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gUGFydGljbGU7IiwiY29uc3QgY29udGFpbmVyID0gcmVxdWlyZSgnLi4vY29udGFpbmVyJyk7XG5jb25zdCBQYXJ0aWNsZSA9IHJlcXVpcmUoJy4vcGFydGljbGUnKTtcblxuY29uc3QgZGVmYXVsdE1hdGVyaWFsID0gbmV3IFRIUkVFLlNwcml0ZU1hdGVyaWFsKCk7XG5cbmNsYXNzIFBhcnRpY2xlU3lzdGVtIHtcblx0Y29uc3RydWN0b3IocHJvcHMpIHtcblx0XHRwcm9wcyA9IHByb3BzIHx8IHt9O1xuXG5cdFx0dGhpcy5tYXRlcmlhbCA9IHByb3BzLm1hdGVyaWFsIHx8IGRlZmF1bHRNYXRlcmlhbDtcblx0XHR0aGlzLm1hdGVyaWFscyA9IHRoaXMubWF0ZXJpYWwubGVuZ3RoID4gMCA/IHRoaXMubWF0ZXJpYWwgOiBbXTtcblx0XHR0aGlzLnBhcmVudCA9IHByb3BzLnBhcmVudCB8fCBjb250YWluZXIuc2NlbmU7XG5cdFx0dGhpcy5hdXRvUGxheSA9IHByb3BzLmF1dG9QbGF5ID09PSB1bmRlZmluZWQgPyB0cnVlIDogcHJvcHMuYXV0b1BsYXk7XG5cdFx0dGhpcy5vblBhcnRpY2xlID0gcHJvcHMub25QYXJ0aWNsZTtcblxuXHRcdHRoaXMucGFydGljbGVQcm9wcyA9IHByb3BzLnBhcnRpY2xlUHJvcHM7XG5cblx0XHRpZiAodGhpcy5wYXJ0aWNsZVByb3BzID09IG51bGwpIHtcblx0XHRcdHRoaXMubGlmZSA9IHByb3BzLmxpZmU7XG5cdFx0XHR0aGlzLmludGVydmFsID0gcHJvcHMuaW50ZXJ2YWw7XG5cdFx0XHR0aGlzLnZlbG9jaXR5ID0gcHJvcHMudmVsb2NpdHk7XG5cdFx0XHR0aGlzLnNjYWxlID0gcHJvcHMuc2NhbGU7XG5cdFx0XHR0aGlzLmRlZmF1bHRQYXJ0aWNsZVByb3BzKHRoaXMpO1xuXHRcdH1cblxuXHRcdHRoaXMuX3RpbWVvdXQgPSBudWxsO1xuXHRcdHRoaXMuZW1pdCA9IHRoaXMuZW1pdC5iaW5kKHRoaXMpO1xuXHRcdHRoaXMuYXBwID0gY29udGFpbmVyLmFwcDtcblx0XHR0aGlzLnBvc2l0aW9uID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcblxuXHRcdHRoaXMucGxheWluZyA9IGZhbHNlO1xuXHR9XG5cblx0ZGVmYXVsdFBhcnRpY2xlUHJvcHMob2JqKSB7XG5cdFx0b2JqLmxpZmUgPSBvYmoubGlmZSB8fCA1MDAwO1xuXHRcdG9iai5pbnRlcnZhbCA9IG9iai5pbnRlcnZhbCB8fCAxMDAwO1xuXHRcdG9iai52ZWxvY2l0eSA9IG9iai52ZWxvY2l0eSB8fCBuZXcgVEhSRUUuVmVjdG9yMygwLCAyLCAwKTtcblx0XHRvYmouc2NhbGUgPSBvYmouc2NhbGUgfHwgMTtcdFxuXHRcdG9iai5wYXJlbnQgPSBvYmoucGFyZW50IHx8IGNvbnRhaW5lci5zY2VuZTtcblx0XHRyZXR1cm4gb2JqO1xuXHR9XG5cblx0c3RhcnQoKSB7XG5cdFx0aWYgKHRoaXMuYXV0b1BsYXkpIHtcblx0XHRcdHRoaXMucGxheSgpO1x0XG5cdFx0fVxuXHR9XG5cblx0cGxheSgpIHtcblx0XHR0aGlzLmVtaXQoKTtcblx0XHR0aGlzLnBsYXlpbmcgPSB0cnVlO1xuXHR9XG5cblx0cGF1c2UoKSB7XG5cdFx0aWYgKHRoaXMuX3RpbWVvdXQgIT0gbnVsbCkge1xuXHRcdFx0Y2xlYXJUaW1lb3V0KHRoaXMuX3RpbWVvdXQpO1xuXHRcdH1cblx0XHR0aGlzLnBsYXlpbmcgPSBmYWxzZTtcblx0fVxuXG5cdGVtaXQoKSB7XG5cdFx0bGV0IHByb3BzO1xuXHRcdGNvbnN0IG1hdGVyaWFsID0gdGhpcy5tYXRlcmlhbHMubGVuZ3RoID4gMCA/IHRoaXMubWF0ZXJpYWxzW01hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIHRoaXMubWF0ZXJpYWxzLmxlbmd0aCldIDogdGhpcy5tYXRlcmlhbDtcblx0XHRpZiAodGhpcy5wYXJ0aWNsZVByb3BzID09IG51bGwpIHtcblx0XHRcdHByb3BzID0ge1xuXHRcdFx0XHRsaWZlOiB0aGlzLmxpZmUsXG5cdFx0XHRcdHZlbG9jaXR5OiB0aGlzLnZlbG9jaXR5LFxuXHRcdFx0XHRtYXRlcmlhbDogbWF0ZXJpYWwsXG5cdFx0XHRcdHBhcmVudDogdGhpcy5wYXJlbnQsXG5cdFx0XHRcdHNjYWxlOiB0aGlzLnNjYWxlXG5cdFx0XHR9O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRwcm9wcyA9IHRoaXMuZGVmYXVsdFBhcnRpY2xlUHJvcHModGhpcy5wYXJ0aWNsZVByb3BzKCkpO1xuXHRcdH1cblx0XHRjb25zdCBwYXJ0aWNsZSA9IHRoaXMuYXBwLmFkZChQYXJ0aWNsZSwgcHJvcHMpO1xuXHRcdGlmICh0aGlzLm9uUGFydGljbGUgIT0gbnVsbCkge1xuXHRcdFx0dGhpcy5vblBhcnRpY2xlKHBhcnRpY2xlKTtcblx0XHR9XG5cdFx0cGFydGljbGUuaW5pdFByb3BzKCk7XG5cdFx0cGFydGljbGUub2JqZWN0LnBvc2l0aW9uLmNvcHkodGhpcy5wb3NpdGlvbik7XG5cdFx0dGhpcy5fdGltZW91dCA9IHNldFRpbWVvdXQodGhpcy5lbWl0LCB0aGlzLmludGVydmFsKTtcblx0fVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFBhcnRpY2xlU3lzdGVtOyIsImNvbnN0IGNvbnRhaW5lciA9IHJlcXVpcmUoJy4uLy4uL2NvbnRhaW5lcicpO1xuXG5jbGFzcyBBSSB7XG5cdGNvbnN0cnVjdG9yKHByb3BzKSB7XG5cdFx0dGhpcy5zaGlwcyA9IGNvbnRhaW5lci5zaGlwcztcblxuXHRcdHRoaXMuc2hpcCA9IHByb3BzLnNoaXA7XG5cdFx0dGhpcy50aGlua0Nvb2xkb3duID0gMC4xO1xuXHRcdHRoaXMubmV4dFRoaW5rID0gMDtcblx0XHR0aGlzLnRhcmdldCA9IG51bGw7XG5cdH1cblxuXHR0aGluaygpIHtcblx0XHRpZiAodGhpcy50YXJnZXQgPT0gbnVsbCkge1xuXHRcdFx0Y29uc3Qgc2hpcHMgPSB0aGlzLnNoaXBzLmdldFRhcmdldHModGhpcy5zaGlwKTtcblxuXHRcdFx0aWYgKHNoaXBzLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0c2hpcHMuc29ydCgoYSwgYikgPT4ge1xuXHRcdFx0XHRcdHJldHVybiBhLnBvc2l0aW9uLmRpc3RhbmNlVG8odGhpcy5zaGlwLnBvc2l0aW9uKSAtIFxuXHRcdFx0XHRcdFx0Yi5wb3NpdGlvbi5kaXN0YW5jZVRvKHRoaXMuc2hpcC5wb3NpdGlvbik7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHR0aGlzLnRhcmdldCA9IHNoaXBzWzBdO1xuXHRcdFx0fSBcblx0XHR9XG5cblx0XHRpZiAodGhpcy50YXJnZXQgPT0gbnVsbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuc2hpcC5vcmJpdCh0aGlzLnRhcmdldC5wb3NpdGlvbiwgMTAwKTtcblxuXHRcdC8vIGRlbW9cblx0XHQvLyB0aGlzLmFzY2VuZCgxMCk7XG5cdFx0XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnNoaXAudHVycmVudHMubGVuZ3RoOyBpICsrKSB7XG5cdFx0XHRjb25zdCB0dXJyZW50ID0gdGhpcy5zaGlwLnR1cnJlbnRzW2ldO1xuXHRcdFx0dHVycmVudC5maXJlKHtcblx0XHRcdFx0cG9zaXRpb246IHRoaXMudGFyZ2V0LnBvc2l0aW9uLFxuXHRcdFx0XHR2ZWxvY2l0eTogdGhpcy50YXJnZXQudmVsb2NpdHlcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXG5cdHN0YXJ0KCkge1xuXHRcdHRoaXMubmV4dFRoaW5rID0gbmV3IERhdGUoKS5nZXRUaW1lKCkgKyB0aGlzLnRoaW5rQ29vbGRvd247XG5cdH1cblxuXHR0aWNrKGR0KSB7XG5cdFx0aWYgKG5ldyBEYXRlKCkuZ2V0VGltZSgpID4gdGhpcy5uZXh0VGhpbmspIHtcblx0XHRcdHRoaXMudGhpbmsoKTtcblx0XHRcdHRoaXMubmV4dFRoaW5rID0gbmV3IERhdGUoKS5nZXRUaW1lKCkgKyB0aGlzLnRoaW5rQ29vbGRvd247XG5cdFx0fVxuXHR9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEFJOyIsImNvbnN0IGNvbnRhaW5lciA9IHJlcXVpcmUoJy4uLy4uL2NvbnRhaW5lcicpO1xuY29uc3QgVEhSRUUgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvd1snVEhSRUUnXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJ1RIUkVFJ10gOiBudWxsKTtcbmNvbnN0IENodW5rcyA9IHJlcXVpcmUoJy4uLy4uL3ZveGVsL2NodW5rcycpO1xuY29uc3QgbWVzaGVyID0gcmVxdWlyZSgnLi4vLi4vdm94ZWwvbWVzaGVyJyk7XG5jb25zdCByZWFkZXIgPSByZXF1aXJlKCcuL3JlYWRlcicpO1xuY29uc3Qgbm9ybWFsaXplQW5nbGUgPSByZXF1aXJlKCcuLi8uLi91dGlscy9tYXRoJykubm9ybWFsaXplQW5nbGU7XG5jb25zdCBjbGFtcCA9IHJlcXVpcmUoJy4uLy4uL3V0aWxzL21hdGgnKS5jbGFtcDtcbmNvbnN0IEFJID0gcmVxdWlyZSgnLi9haScpO1xuXG5jbGFzcyBTaGlwIHtcblx0Y29uc3RydWN0b3IocHJvcHMpIHtcblx0XHR0aGlzLl9faXNTaGlwID0gdHJ1ZTtcblxuXHRcdHRoaXMucHJvcHMgPSBwcm9wcztcblx0XHR0aGlzLnNjZW5lID0gY29udGFpbmVyLnNjZW5lO1xuXHRcdHRoaXMuYXBwID0gY29udGFpbmVyLmFwcDtcblx0XHR0aGlzLmNvbGxpc2lvbnMgPSBjb250YWluZXIuY29sbGlzaW9ucztcblxuXHRcdHRoaXMub2JqZWN0ID0gbmV3IFRIUkVFLk9iamVjdDNEKCk7XG5cdFx0dGhpcy5vYmplY3Qucm90YXRpb24ub3JkZXIgPSAnWVhaJztcblxuXHRcdGlmIChwcm9wcy5yb3RhdGlvbiAhPSBudWxsKSB7XG5cdFx0XHR0aGlzLm9iamVjdC5yb3RhdGlvbi5jb3B5KHByb3BzLnJvdGF0aW9uKTtcblx0XHR9XG5cblx0XHR0aGlzLmlubmVyT2JqZWN0ID0gbmV3IFRIUkVFLk9iamVjdDNEKCk7XG5cdFx0dGhpcy5pbm5lck9iamVjdC5yb3RhdGlvbi5vcmRlciA9ICdZWFonO1xuXHRcdHRoaXMub2JqZWN0LmFkZCh0aGlzLmlubmVyT2JqZWN0KTtcblx0XHR0aGlzLmNodW5rcyA9IG5ldyBDaHVua3MoKTtcblxuXHRcdHRoaXMuZW5naW5lcyA9IFtdO1xuXHRcdHRoaXMudHVycmVudHMgPSBbXTtcblxuXHRcdHRoaXMudHVyblNwZWVkID0gMDtcblxuXHRcdHRoaXMudHVybkFtb3VudCA9IDA7XG5cdFx0dGhpcy5mb3J3YXJkQW1vdW50ID0gMDtcblx0XHR0aGlzLm1heFR1cm5TcGVlZCA9IDAuMDM7XG5cdFx0dGhpcy5wb3dlciA9IDY7XG5cblx0XHR0aGlzLnZlbG9jaXR5ID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcblxuXHRcdHRoaXMuZnJpY3Rpb24gPSAwLjU7XG5cblx0XHR0aGlzLmh1bGwgPSBbXTtcblxuXHRcdHRoaXMuYWkgPSBuZXcgQUkoe1xuXHRcdFx0c2hpcDogdGhpc1xuXHRcdH0pO1xuXG5cdFx0dGhpcy5zaWRlID0gcHJvcHMuc2lkZSB8fCAwO1xuXG5cdFx0dGhpcy5odWxsID0gW107XG5cdFx0dGhpcy5jZW50ZXIgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuXG5cdFx0dGhpcy5vbkNvbGxpc2lvbiA9IHRoaXMub25Db2xsaXNpb24uYmluZCh0aGlzKTtcblx0XHR0aGlzLmJvZHkgPSB7XG5cdFx0XHR0eXBlOiAnbWVzaCcsXG5cdFx0XHRvbkNvbGxpc2lvbjogdGhpcy5vbkNvbGxpc2lvbixcblx0XHRcdG1lc2g6IHRoaXMuaW5uZXJPYmplY3QsXG5cdFx0XHRlbnRpdHk6IHRoaXNcblx0XHR9XG5cdH1cblxuXHRvbkNvbGxpc2lvbihjb2xsaXNpb24pIHtcblxuXHR9XG5cblx0Z2V0IHBvc2l0aW9uKCkge1xuXHRcdHJldHVybiB0aGlzLm9iamVjdC5wb3NpdGlvbjtcblx0fVxuXG5cdGdldCByb3RhdGlvbigpIHtcblx0XHRyZXR1cm4gdGhpcy5vYmplY3Qucm90YXRpb247XG5cdH1cblxuXHRzdGFydCgpIHtcblx0XHR0aGlzLm1hdGVyaWFsID0gWyBudWxsLCBuZXcgVEhSRUUuTWVzaEJhc2ljTWF0ZXJpYWwoe1xuXHRcdFx0Y29sb3I6IDB4ZmZmZmZmXG5cdFx0fSkgXTtcblxuXHRcdHRoaXMuc2NlbmUuYWRkKHRoaXMub2JqZWN0KTtcblx0XG5cdFx0Y29uc3QgcmVzdWx0ID0gcmVhZGVyKHRoaXMucHJvcHMuZGF0YSwgdGhpcyk7XG5cblx0XHR0aGlzLmFpLnN0YXJ0KCk7XG5cblx0XHR0aGlzLmNvbGxpc2lvbnMuYWRkKHRoaXMuYm9keSk7XG5cdH1cblxuXHRkZXN0cm95KCkge1xuXHRcdHRoaXMuc2NlbmUucmVtb3ZlKHRoaXMub2JqZWN0KTtcblx0XHR0aGlzLmNvbGxpc2lvbnMucmVtb3ZlKHRoaXMuYm9keSk7XG5cdH1cblxuXHR0aWNrKCkge1xuXHRcdGNvbnN0IGR0ID0gdGhpcy5hcHAuZGVsdGE7XG5cdFx0dGhpcy5haS50aWNrKGR0KTtcblx0XHRtZXNoZXIodGhpcy5jaHVua3MsIHRoaXMuaW5uZXJPYmplY3QsIHRoaXMubWF0ZXJpYWwpO1xuXG5cdFx0Ly8gU3RlcCB0dXJyZW50c1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy50dXJyZW50cy5sZW5ndGg7IGkgKyspIHtcblx0XHRcdGNvbnN0IHR1cnJlbnQgPSB0aGlzLnR1cnJlbnRzW2ldO1xuXHRcdFx0dHVycmVudC50aWNrKGR0KTtcblx0XHR9XG5cblx0XHQvLyBTdGVwIHlhd1xuXHRcdGNvbnN0IHR1cm5BY2NlbGVyYXRpb24gPSAwLjE7XG5cdFx0Y29uc3QgZGVzaXJlZFR1cm5TcGVlZCA9IHRoaXMudHVybkFtb3VudCAqIHRoaXMubWF4VHVyblNwZWVkO1xuXG5cdFx0aWYgKHRoaXMudHVyblNwZWVkIDwgZGVzaXJlZFR1cm5TcGVlZCkge1xuXHRcdFx0dGhpcy50dXJuU3BlZWQgKz0gdHVybkFjY2VsZXJhdGlvbiAqIGR0O1xuXHRcdH0gZWxzZSBpZiAodGhpcy50dXJuU3BlZWQgPiBkZXNpcmVkVHVyblNwZWVkKSB7XG5cdFx0XHR0aGlzLnR1cm5TcGVlZCAtPSB0dXJuQWNjZWxlcmF0aW9uICogZHQ7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMudHVyblNwZWVkIDwgLXRoaXMubWF4VHVyblNwZWVkKSB7XG5cdFx0XHR0aGlzLnR1cm5TcGVlZCA9IC10aGlzLm1heFR1cm5TcGVlZDtcblx0XHR9IGVsc2UgaWYgKHRoaXMudHVyblNwZWVkID4gdGhpcy5tYXhUdXJuU3BlZWQpIHtcblx0XHRcdHRoaXMudHVyblNwZWVkID0gdGhpcy5tYXhUdXJuU3BlZWQ7XG5cdFx0fVxuXG5cdFx0Ly8gU3RlcCByb2xsXG5cdFx0dGhpcy5vYmplY3Qucm90YXRpb24ueSArPSB0aGlzLnR1cm5TcGVlZDtcblxuXHRcdGNvbnN0IHJhdGlvID0gdGhpcy50dXJuU3BlZWQgLyB0aGlzLm1heFR1cm5TcGVlZDtcblxuXHRcdGNvbnN0IG1heFJvbGxBbW91bnQgPSBNYXRoLlBJIC8gNDtcblx0XHRjb25zdCBhbmdsZSA9IHJhdGlvICogbWF4Um9sbEFtb3VudDtcblxuXHRcdHRoaXMub2JqZWN0LnJvdGF0aW9uLnogKz0gKGFuZ2xlIC0gdGhpcy5vYmplY3Qucm90YXRpb24ueikgKiAwLjAxO1xuXG5cdFx0Ly8gdGhpcy50dXJuQW1vdW50ID0gMDtcblxuXHRcdC8vIFN0ZXAgZm9yd2FyZFxuXHRcdGNvbnN0IGFjYyA9IG5ldyBUSFJFRS5WZWN0b3IzKDAsIDAsIC0xKVxuXHRcdFx0LmFwcGx5RXVsZXIodGhpcy5vYmplY3Qucm90YXRpb24pXG5cdFx0XHQubXVsdGlwbHlTY2FsYXIodGhpcy5mb3J3YXJkQW1vdW50ICogdGhpcy5wb3dlciAqIGR0KTtcblxuXHRcdHRoaXMudmVsb2NpdHkuYWRkKGFjYyk7XG5cdFx0dGhpcy5vYmplY3QucG9zaXRpb24uYWRkKHRoaXMudmVsb2NpdHkuY2xvbmUoKS5tdWx0aXBseVNjYWxhcihkdCkpO1xuXG5cdFx0dGhpcy52ZWxvY2l0eS5tdWx0aXBseVNjYWxhcihNYXRoLnBvdyh0aGlzLmZyaWN0aW9uLCBkdCkpO1xuXG5cdFx0dGhpcy5lbmdpbmVzLmZvckVhY2goKGVuZ2luZSkgPT4ge1xuXHRcdFx0ZW5naW5lLmFtb3VudCA9IHRoaXMuZm9yd2FyZEFtb3VudDtcblx0XHR9KTtcblx0fVxuXG5cdGFzY2VuZCh5KSB7XG5cdFx0Y29uc3QgeURpZmYgPSB5IC0gdGhpcy5vYmplY3QucG9zaXRpb24ueTtcblx0XHRjb25zdCBkZXNpcmVkWVNwZWVkID0geURpZmYgKiAwLjE7XG5cdFx0Y29uc3QgeVNwZWVkRGlmZiA9IGRlc2lyZWRZU3BlZWQgLSB0aGlzLnZlbG9jaXR5Lnk7XG5cdFx0Y29uc3QgZGVzaXJlZFlBY2MgPSB5U3BlZWREaWZmICogMC4xO1xuXG5cdFx0bGV0IHJhdGlvID0gZGVzaXJlZFlBY2MgLyB0aGlzLnBvd2VyO1xuXHRcdGlmIChyYXRpbyA+IDEuMCkge1xuXHRcdFx0cmF0aW8gPSAxLjA7XG5cdFx0fSBlbHNlIGlmIChyYXRpbyA8IC0xLjApIHtcblx0XHRcdHJhdGlvID0gLTEuMDtcblx0XHR9XG5cblx0XHRsZXQgZGVzaXJlZFBpdGNoID0gTWF0aC5hc2luKHJhdGlvKTtcblxuXHRcdGNvbnN0IG1heFBpdGNoID0gMC4zXG5cblx0XHRpZiAoZGVzaXJlZFBpdGNoID4gbWF4UGl0Y2gpIHtcblx0XHRcdGRlc2lyZWRQaXRjaCA9IG1heFBpdGNoO1xuXHRcdH0gZWxzZSBpZiAoZGVzaXJlZFBpdGNoIDwgLW1heFBpdGNoKSB7XG5cdFx0XHRkZXNpcmVkUGl0Y2ggPSAtbWF4UGl0Y2g7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcGl0Y2hEaWZmID0gZGVzaXJlZFBpdGNoIC0gdGhpcy5yb3RhdGlvbi54O1xuXG5cdFx0Y29uc3QgZGVzaXJlZFBpdGNoU3BlZWQgPSBwaXRjaERpZmY7XG5cblx0XHRjb25zdCBtYXhQaXRjaFNwZWVkID0gMC4wMztcblxuXG5cdFx0dGhpcy5yb3RhdGlvbi54ICs9IGNsYW1wKGRlc2lyZWRQaXRjaFNwZWVkLCAtbWF4UGl0Y2hTcGVlZCwgbWF4UGl0Y2hTcGVlZCk7XG5cdH1cblxuXHR0dXJuKGFtb3VudCkge1xuXHRcdHRoaXMudHVybkFtb3VudCA9IGFtb3VudDtcblx0fVxuXG5cdGZvcndhcmQoYW1vdW50KSB7XG5cdFx0dGhpcy5mb3J3YXJkQW1vdW50ID0gYW1vdW50O1xuXHR9XG5cblx0YWxpZ24ocG9pbnQpIHtcblx0XHRjb25zdCBhbmdsZURpZmYgPSB0aGlzLmdldEFuZ2xlRGlmZihwb2ludCk7XG5cdFx0Y29uc3QgZGVzaXJlZFR1cm5TcGVlZCA9IGFuZ2xlRGlmZjtcblxuXHRcdGxldCBkZXNpcmVkVHVybkFtb3VudCA9IGRlc2lyZWRUdXJuU3BlZWQgLyB0aGlzLm1heFR1cm5TcGVlZDtcblx0XHRpZiAoZGVzaXJlZFR1cm5BbW91bnQgPiAxKSB7XG5cdFx0XHRkZXNpcmVkVHVybkFtb3VudCA9IDE7XG5cdFx0fSBlbHNlIGlmIChkZXNpcmVkVHVybkFtb3VudCA8IC0xKSB7XG5cdFx0XHRkZXNpcmVkVHVybkFtb3VudCA9IC0xO1xuXHRcdH1cblxuXHRcdHRoaXMudHVybihkZXNpcmVkVHVybkFtb3VudCk7XG5cdH1cblxuXHRvcmJpdChwb2ludCwgZGlzdGFuY2UpIHtcblx0XHRsZXQgZGlzID0gdGhpcy5vYmplY3QucG9zaXRpb24uY2xvbmUoKS5zdWIocG9pbnQpO1xuXHRcdGRpcy55ID0gMDtcblx0XHRkaXMgPSBkaXMubm9ybWFsaXplKCkubXVsdGlwbHlTY2FsYXIoZGlzdGFuY2UpO1xuXHRcdGNvbnN0IGEgPSBwb2ludC5jbG9uZSgpLmFkZChcblx0XHRcdGRpcy5jbG9uZSgpLmFwcGx5RXVsZXIobmV3IFRIUkVFLkV1bGVyKDAsIE1hdGguUEkgLyAzLCAwKSkpO1xuXHRcdGNvbnN0IGIgPSBwb2ludC5jbG9uZSgpLmFkZChcblx0XHRcdGRpcy5jbG9uZSgpLmFwcGx5RXVsZXIobmV3IFRIUkVFLkV1bGVyKDAsIC1NYXRoLlBJIC8gMywgMCkpKTtcblxuXHRcdGNvbnN0IGRpZmZBID0gdGhpcy5nZXRBbmdsZURpZmYoYSk7XG5cdFx0Y29uc3QgZGlmZkIgPSB0aGlzLmdldEFuZ2xlRGlmZihiKTtcblxuXHRcdGlmIChNYXRoLmFicyhkaWZmQSkgPCBNYXRoLmFicyhkaWZmQikpIHtcblx0XHRcdHRoaXMuYWxpZ24oYSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuYWxpZ24oYik7XG5cdFx0fVxuXG5cdFx0dGhpcy5mb3J3YXJkKDEuMCk7XG5cdH1cblxuXHRnZXRBbmdsZURpZmYocG9pbnQpIHtcblx0XHRjb25zdCBhbmdsZSA9IE1hdGguYXRhbjIocG9pbnQueCAtIHRoaXMub2JqZWN0LnBvc2l0aW9uLngsIHBvaW50LnogLSB0aGlzLm9iamVjdC5wb3NpdGlvbi56KSAtIE1hdGguUEk7XG5cdFx0Y29uc3QgYW5nbGVEaWZmID0gYW5nbGUgLSB0aGlzLm9iamVjdC5yb3RhdGlvbi55O1xuXHRcdHJldHVybiBub3JtYWxpemVBbmdsZShhbmdsZURpZmYpO1xuXHR9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gU2hpcDsiLCJjb25zdCBjb250YWluZXIgPSByZXF1aXJlKCcuLi8uLi9jb250YWluZXInKTtcbmNvbnN0IEVuZ2luZSA9IHJlcXVpcmUoJy4uL2VuZ2luZScpO1xuY29uc3QgVHVycmVudCA9IHJlcXVpcmUoJy4vdHVycmVudCcpO1xuY29uc3QgQmVhbSA9IHJlcXVpcmUoJy4uL2JlYW0nKTtcbmNvbnN0IExhc2VyID0gcmVxdWlyZSgnLi4vbGFzZXInKTtcblxuY29uc3QgcmVhZGVyID0gKGRhdGEsIHNoaXApID0+IHtcblx0Y29uc3QgbGluZXMgPSBkYXRhLnNwbGl0KCdcXG4nKTtcblx0Y29uc3QgY2h1bmtzID0gc2hpcC5jaHVua3M7XG5cdGNvbnN0IGVuZ2luZXMgPSBzaGlwLmVuZ2luZXM7XG5cblx0bGV0IGxpbmU7XG5cdGxldCBjdXJyZW50O1xuXHRsZXQgeiA9IDA7XG5cdGxldCBjaGFyO1xuXG5cdGNvbnN0IHJlc3VsdCA9IHtcblx0XHRtb2R1bGVzOiBbXVxuXHR9O1xuXG5cdGNvbnN0IGFwcCA9IGNvbnRhaW5lci5hcHA7XG5cblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBsaW5lcy5sZW5ndGg7IGkrKykge1xuXHRcdGxpbmUgPSBsaW5lc1tpXTtcblxuXHRcdGlmIChsaW5lID09PSAnSFVMTCcpIHtcblx0XHRcdGN1cnJlbnQgPSAnSFVMTCc7XG5cdFx0XHR6ID0gMDtcblx0XHR9IGVsc2UgaWYgKGxpbmUgPT09ICdNT0RVTEVTJykge1xuXHRcdFx0Y3VycmVudCA9ICdNT0RVTEVTJztcblx0XHRcdHogPSAwO1xuXHRcdH0gZWxzZSBpZiAoY3VycmVudCA9PT0gJ0hVTEwnKSB7XG5cdFx0XHRmb3IgKGxldCB4ID0gMDsgeCA8IGxpbmUubGVuZ3RoOyB4KyspIHtcblx0XHRcdFx0Y2hhciA9IGxpbmVbeF07XG5cblx0XHRcdFx0aWYgKGNoYXIgPT09ICcwJykge1xuXHRcdFx0XHRcdGNodW5rcy5zZXQoeCwgMCwgeiwgMSk7XG5cdFx0XHRcdFx0c2hpcC5odWxsLnB1c2goW3gsIDAsIHosIDFdKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0eisrO1xuXHRcdH0gZWxzZSBpZiAoY3VycmVudCA9PT0gJ01PRFVMRVMnKSB7XG5cdFx0XHRmb3IgKGxldCB4ID0gMDsgeCA8IGxpbmUubGVuZ3RoOyB4KyspIHtcblx0XHRcdFx0Y2hhciA9IGxpbmVbeF07XG5cdFx0XHRcdGlmIChjaGFyID09PSAnRScpIHtcblx0XHRcdFx0XHRjb25zdCBlbmdpbmUgPSBhcHAuYWRkKEVuZ2luZSwge1xuXHRcdFx0XHRcdFx0c2hpcDogc2hpcCxcblx0XHRcdFx0XHRcdGNvb3JkOiBbeCwgMCwgel1cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRlbmdpbmVzLnB1c2goZW5naW5lKTtcblx0XHRcdFx0fSBlbHNlIGlmIChjaGFyID09PSAnTCcgfHwgY2hhciA9PT0gJ2wnKSB7XG5cdFx0XHRcdFx0Y29uc3QgdHlwZSA9IExhc2VyO1xuXHRcdFx0XHRcdGNvbnN0IGNvb2xkb3duID0gMC4xO1xuXHRcdFx0XHRcdGNvbnN0IHJlbG9hZFRpbWUgPSAxLjA7XG5cdFx0XHRcdFx0Y29uc3QgY2xpcCA9IDM7XG5cblx0XHRcdFx0XHRzaGlwLnR1cnJlbnRzLnB1c2gobmV3IFR1cnJlbnQoe1xuXHRcdFx0XHRcdFx0Y29vcmQ6IFt4LCAwLCB6XSxcblx0XHRcdFx0XHRcdHNoaXA6IHNoaXAsXG5cdFx0XHRcdFx0XHR0eXBlLCBjb29sZG93biwgcmVsb2FkVGltZSwgY2xpcFxuXHRcdFx0XHRcdH0pKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0eisrO1xuXHRcdH1cblx0fVxuXG5cdGNvbnN0IGNlbnRlciA9IFsgMCwgMCwgMCBdO1xuXHRmb3IgKGxldCBpID0gMDsgaSA8IHNoaXAuaHVsbC5sZW5ndGg7IGkrKykge1xuXHRcdGNvbnN0IHYgPSBzaGlwLmh1bGxbaV07XG5cdFx0Y2VudGVyWzBdICs9IHZbMF07XG5cdFx0Y2VudGVyWzFdICs9IHZbMV07XG5cdFx0Y2VudGVyWzJdICs9IHZbMl07XG5cdH1cblx0Y2VudGVyWzBdIC89IHNoaXAuaHVsbC5sZW5ndGg7XG5cdGNlbnRlclsxXSAvPSBzaGlwLmh1bGwubGVuZ3RoO1xuXHRjZW50ZXJbMl0gLz0gc2hpcC5odWxsLmxlbmd0aDtcblx0XG5cdGNlbnRlclswXSArPSAwLjU7XG5cdGNlbnRlclsxXSArPSAwLjU7XG5cdGNlbnRlclsyXSArPSAwLjU7XG5cblx0c2hpcC5jZW50ZXIuZnJvbUFycmF5KGNlbnRlcik7XG5cblx0c2hpcC5pbm5lck9iamVjdC5wb3NpdGlvbi5mcm9tQXJyYXkoY2VudGVyKS5tdWx0aXBseVNjYWxhcigtMSk7XG5cblx0cmV0dXJuIHJlc3VsdDtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gcmVhZGVyOyIsImNvbnN0IGNvbnRhaW5lciA9IHJlcXVpcmUoJy4uLy4uL2NvbnRhaW5lcicpO1xuXG5jbGFzcyBTaGlwcyB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMuYXBwID0gY29udGFpbmVyLmFwcDtcbiAgICBjb250YWluZXIuc2hpcHMgPSB0aGlzO1xuICAgIHRoaXMub25BZGQgPSB0aGlzLm9uQWRkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbkRlc3Ryb3kgPSB0aGlzLm9uRGVzdHJveS5iaW5kKHRoaXMpO1xuXG4gICAgdGhpcy5zaWRlcyA9IHt9O1xuICB9XG5cbiAgZ2V0VGFyZ2V0cyhzaGlwKSB7XG4gIFx0Y29uc3QgdGFyZ2V0cyA9IFtdO1xuICBcdGZvciAobGV0IHNpZGUgaW4gdGhpcy5zaWRlcykge1xuICAgICAgaWYgKHNpZGUgPT09IHNoaXAuc2lkZSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgXHRcdGZvciAobGV0IGlkIGluIHRoaXMuc2lkZXNbc2lkZV0pIHtcbiAgXHRcdFx0dGFyZ2V0cy5wdXNoKHRoaXMuc2lkZXNbc2lkZV1baWRdKTtcbiAgXHRcdH1cbiAgXHR9XG5cbiAgXHRyZXR1cm4gdGFyZ2V0cztcbiAgfVxuXG4gIG9uQWRkKGNvbXBvbmVudCkge1xuICAgIGlmICghY29tcG9uZW50Ll9faXNTaGlwKSB7XG5cdFx0XHRyZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuc2lkZXNbY29tcG9uZW50LnNpZGVdID09IG51bGwpIHtcbiAgICBcdHRoaXMuc2lkZXNbY29tcG9uZW50LnNpZGVdID0ge307XG4gICAgfVxuXG4gICAgdGhpcy5zaWRlc1tjb21wb25lbnQuc2lkZV1bY29tcG9uZW50Ll9pZF0gPSBjb21wb25lbnQ7XG4gIH1cblxuICBvbkRlc3Ryb3koY29tcG9uZW50KSB7XG4gICAgaWYgKCFjb21wb25lbnQuX19pc1NoaXApIHtcblx0XHRcdHJldHVybjtcbiAgICB9XG5cbiAgICBkZWxldGUgdGhpcy5zaWRlc1tjb21wb25lbnQuc2lkZV1bY29tcG9uZW50Ll9pZF07XG4gIH1cblxuICBzdGFydCgpIHtcbiAgICBmb3IgKGxldCBpZCBpbiB0aGlzLmFwcC5tYXApIHtcbiAgICAgIHRoaXMub25BZGQodGhpcy5hcHAubWFwW2lkXSk7XG4gICAgfVxuICAgIHRoaXMuYXBwLm9uKCdhZGQnLCB0aGlzLm9uQWRkKTtcbiAgICB0aGlzLmFwcC5vbignZGVzdG9yeScsIHRoaXMub25EZXN0cm95KTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gIFx0dGhpcy5hcHAub2ZmKCdhZGQnLCB0aGlzLm9uQWRkKTtcbiAgXHR0aGlzLmFwcC5vZmYoJ2Rlc3RvcnknLCB0aGlzLm9uRGVzdHJveSk7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBTaGlwcztcbiIsImNvbnN0IGNvbnRhaW5lciA9IHJlcXVpcmUoJy4uLy4uL2NvbnRhaW5lcicpO1xuXG5jbGFzcyBUdXJyZW50IHtcblx0Y29uc3RydWN0b3IocHJvcHMpIHtcblx0XHR0aGlzLmFwcCA9IGNvbnRhaW5lci5hcHA7XG5cblx0XHR0aGlzLmxvY2FsUG9zaXRpb24gPSBcblx0XHRcdG5ldyBUSFJFRS5WZWN0b3IzKClcblx0XHRcdFx0LmZyb21BcnJheShwcm9wcy5jb29yZClcblx0XHRcdFx0LmFkZChuZXcgVEhSRUUuVmVjdG9yMygwLjUsIDAuNSwgMC41KSk7XG5cdFx0dGhpcy5zaGlwID0gcHJvcHMuc2hpcDtcblxuXHRcdHRoaXMudHlwZSA9IHByb3BzLnR5cGU7XG5cblx0XHR0aGlzLmNvb2xkb3duID0gcHJvcHMuY29vbGRvd24gfHwgMDtcblx0XHR0aGlzLmNsaXAgPSBwcm9wcy5jbGlwIHx8IDA7XG5cdFx0dGhpcy5yZWxvYWRUaW1lID0gcHJvcHMucmVsb2FkVGltZSB8fCAxO1xuXG5cdFx0dGhpcy5hbW1vID0gdGhpcy5jbGlwO1xuXG5cdFx0dGhpcy5fY291bnRlciA9IDA7XG5cdFx0dGhpcy5fcmVsb2FkVGltZXIgPSAwO1xuXHR9XG5cblx0dGljayhkdCkge1xuXHRcdGlmICh0aGlzLmNvb2xkb3duID09IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKHRoaXMuX2NvdW50ZXIgPiB0aGlzLmNvb2xkb3duKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX2NvdW50ZXIgKz0gZHQ7XG5cdH1cblxuXHRmaXJlKHRhcmdldCkge1xuXHRcdGlmICh0aGlzLmFtbW8gPD0gMCkge1xuXHRcdFx0aWYgKHRoaXMuX3JlbG9hZFRpbWVyID09PSAwKSB7XG5cdFx0XHRcdC8vIFNldCByZWxvYWQgdGltZXJcblx0XHRcdFx0dGhpcy5fcmVsb2FkVGltZXIgPSB0aGlzLmFwcC50aW1lICsgdGhpcy5yZWxvYWRUaW1lO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9IGVsc2UgaWYgKHRoaXMuYXBwLnRpbWUgPiB0aGlzLl9yZWxvYWRUaW1lcikge1xuXHRcdFx0XHQvLyBSZWxvYWQgZG9uZVxuXHRcdFx0XHR0aGlzLl9yZWxvYWRUaW1lciA9IDA7XG5cdFx0XHRcdHRoaXMuYW1tbyA9IHRoaXMuY2xpcDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIFJlbG9hZGluZy4uLlxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY29vbGRvd24gPT0gMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9jb3VudGVyID4gdGhpcy5jb29sZG93bikge1xuXHRcdFx0dGhpcy5fZmlyZSh0YXJnZXQpO1xuXHRcdFx0dGhpcy5hbW1vLS07XG5cdFx0XHR0aGlzLl9jb3VudGVyIC09IHRoaXMuY29vbGRvd247XG5cdFx0fVxuXHR9XG5cblx0Z2V0IHBvc2l0aW9uKCkge1xuXHRcdHJldHVybiB0aGlzLnNoaXAuaW5uZXJPYmplY3QubG9jYWxUb1dvcmxkKHRoaXMubG9jYWxQb3NpdGlvbi5jbG9uZSgpKTtcblx0fVxuXG5cdC8vIHRhcmdldCB7IHBvc2l0aW9uIH1cblx0X2ZpcmUodGFyZ2V0KSB7XG5cdFx0Y29uc3QgdmVjdG9yID0gdGFyZ2V0LnBvc2l0aW9uLmNsb25lKCkuc3ViKHRoaXMucG9zaXRpb24pO1xuXG5cdFx0dGhpcy5hcHAuYWRkKHRoaXMudHlwZSwge1xuXHRcdFx0dGFyZ2V0OiB0YXJnZXQsXG5cdFx0XHR0dXJyZW50OiB0aGlzXG5cdFx0fSk7XG5cdH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBUdXJyZW50OyIsImNvbnN0IEJvdHRsZSA9IHJlcXVpcmUoJ2JvdHRsZWpzJyk7XG5jb25zdCBhcHAgPSByZXF1aXJlKCcuL2NvcmUvYXBwJyk7XG5cbmNvbnN0IGJvdHRsZSA9IG5ldyBCb3R0bGUoKTtcbmNvbnN0IGNvbnRhaW5lciA9IGJvdHRsZS5jb250YWluZXI7XG5cbmNvbnRhaW5lci5hcHAgPSBhcHA7XG5jb250YWluZXIucmVuZGVyZXIgPSBhcHAucmVuZGVyZXI7XG5jb250YWluZXIuY29sbGlzaW9ucyA9IGFwcC5jb2xsaXNpb25zO1xuY29udGFpbmVyLnNjZW5lID0gYXBwLnJlbmRlcmVyLnNjZW5lO1xuY29udGFpbmVyLmNhbWVyYSA9IGFwcC5yZW5kZXJlci5jYW1lcmE7XG5cbm1vZHVsZS5leHBvcnRzID0gY29udGFpbmVyOyIsImNvbnN0IGd1aWQgPSByZXF1aXJlKCcuL2d1aWQnKTtcbmNvbnN0IGVlID0gcmVxdWlyZSgnZXZlbnQtZW1pdHRlcicpO1xuY29uc3QgcmVuZGVyZXIgPSByZXF1aXJlKCcuL3JlbmRlcmVyJyk7XG5jb25zdCBDb2xsaXNpb25zID0gcmVxdWlyZSgnLi9jb2xsaXNpb25zJyk7XG5cbmNvbnN0IGNsb25lID0gKG9iaikgPT4ge1xuXHRjb25zdCBjID0ge307XG5cdGZvciAobGV0IGtleSBpbiBvYmopIHtcblx0XHRjW2tleV0gPSBvYmpba2V5XTtcblx0fVxuXHRyZXR1cm4gYztcbn07XG5cbmNsYXNzIEFwcCB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHRoaXMubWFwID0ge307XG5cdFx0dGhpcy5fc3RhcnRNYXAgPSB7fTtcblx0XHR0aGlzLl9kZXN0cm95TWFwID0ge307XG5cblx0XHR0aGlzLnJlbmRlcmVyID0gcmVuZGVyZXI7XG5cdFx0dGhpcy5jb2xsaXNpb25zID0gbmV3IENvbGxpc2lvbnMoeyBhcHA6IHRoaXMgfSk7XG5cblx0XHR0aGlzLmFuaW1hdGUgPSB0aGlzLmFuaW1hdGUuYmluZCh0aGlzKTtcblx0XHRcblx0XHR0aGlzLnRpbWUgPSAwO1xuXHRcdHRoaXMuZGVsdGEgPSAxMDAwIC8gNjA7XG5cdH1cblxuXHRhZGQodHlwZSwgcHJvcHMpIHtcblx0XHRjb25zdCBjb21wb25lbnQgPSBuZXcgdHlwZShwcm9wcyk7XG5cdFx0Y29tcG9uZW50Ll9pZCA9IGd1aWQoKTtcblx0XHR0aGlzLm1hcFtjb21wb25lbnQuX2lkXSA9IGNvbXBvbmVudDtcblx0XHR0aGlzLl9zdGFydE1hcFtjb21wb25lbnQuX2lkXSA9IGNvbXBvbmVudDtcblx0XHR0aGlzLmVtaXQoJ2FkZCcsIGNvbXBvbmVudCk7XG5cdFx0cmV0dXJuIGNvbXBvbmVudDtcblx0fVxuXG5cdGRlc3Ryb3koY29tcG9uZW50KSB7XG5cdFx0dGhpcy5fZGVzdHJveU1hcFtjb21wb25lbnQuX2lkXSA9IGNvbXBvbmVudDtcblx0XHR0aGlzLmVtaXQoJ2Rlc3Ryb3knLCBjb21wb25lbnQpO1xuXHR9XG5cblx0dGljayhkdCkge1xuXHRcdHRoaXMuY29sbGlzaW9ucy50aWNrKCk7XG5cdFx0XG5cdFx0bGV0IGlkLCBjb21wb25lbnQ7XG5cblx0XHRjb25zdCBfc3RhcnRNYXAgPSBjbG9uZSh0aGlzLl9zdGFydE1hcCk7XG5cdFx0dGhpcy5fc3RhcnRNYXAgPSB7fTtcblxuXHRcdGZvciAoaWQgaW4gX3N0YXJ0TWFwKSB7XG5cdFx0XHRjb21wb25lbnQgPSBfc3RhcnRNYXBbaWRdO1xuXHRcdFx0aWYgKGNvbXBvbmVudC5zdGFydCAhPSBudWxsKSB7XG5cdFx0XHRcdGNvbXBvbmVudC5zdGFydCgpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGZvciAoaWQgaW4gdGhpcy5tYXApIHtcblx0XHRcdGNvbXBvbmVudCA9IHRoaXMubWFwW2lkXTtcblx0XHRcdGlmIChjb21wb25lbnQudGljayAhPSBudWxsKSB7XG5cdFx0XHRcdGNvbXBvbmVudC50aWNrKGR0KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBfZGVzdHJveU1hcCA9IGNsb25lKHRoaXMuX2Rlc3Ryb3lNYXApO1xuXHRcdHRoaXMuX2Rlc3Ryb3lNYXAgPSB7fTtcblx0XHRcblx0XHRmb3IgKGlkIGluIF9kZXN0cm95TWFwKSB7XG5cdFx0XHRjb21wb25lbnQgPSBfZGVzdHJveU1hcFtpZF07XG5cdFx0XHRpZiAoY29tcG9uZW50LmRlc3Ryb3kgIT0gbnVsbCkge1xuXHRcdFx0XHRjb21wb25lbnQuZGVzdHJveSgpO1xuXHRcdFx0fVxuXHRcdFx0ZGVsZXRlIHRoaXMubWFwW2NvbXBvbmVudC5faWRdO1xuXHRcdH1cblxuXHRcdHRoaXMucmVuZGVyZXIucmVuZGVyKCk7XG5cdH1cblxuXHRhbmltYXRlKCkge1xuXHRcdGNvbnN0IGZyYW1lUmF0ZSA9IDEgLyA2MDtcblx0XHRcblx0XHR0aGlzLnRpY2soZnJhbWVSYXRlKTtcblxuXHRcdHRoaXMudGltZSArPSBmcmFtZVJhdGU7XG5cdFx0dGhpcy5kZWx0YSA9IGZyYW1lUmF0ZTtcblxuXHRcdHJlcXVlc3RBbmltYXRpb25GcmFtZSh0aGlzLmFuaW1hdGUpO1xuXHR9XG5cblx0c3RhcnQoKSB7XG5cdFx0dGhpcy5hbmltYXRlKCk7XG5cdH1cbn07XG5cbmVlKEFwcC5wcm90b3R5cGUpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IG5ldyBBcHAoKTsiLCJjb25zdCBndWlkID0gcmVxdWlyZSgnLi9ndWlkJyk7XG5cbmNsYXNzIENvbGxpc2lvbnMge1xuXHRjb25zdHJ1Y3Rvcihwcm9wcykge1xuXHRcdHRoaXMubWFwID0ge307XG5cdFx0dGhpcy5hcHAgPSBwcm9wcy5hcHA7XG5cdH1cblxuXHRhZGQoYm9keSkge1xuXHRcdGlmIChib2R5Ll9pZCA9PSBudWxsKSB7XG5cdFx0XHRib2R5Ll9pZCA9IGd1aWQoKTtcblx0XHR9XG5cblx0XHR0aGlzLm1hcFtib2R5Ll9pZF0gPSBib2R5O1xuXHR9XG5cblx0cmVtb3ZlKGJvZHkpIHtcblx0XHRkZWxldGUgdGhpcy5tYXBbYm9keS5faWRdO1xuXHR9XG5cblx0dGljaygpIHtcblx0XHRjb25zdCBrZXlzID0gT2JqZWN0LmtleXModGhpcy5tYXApO1xuXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRmb3IgKGxldCBqID0gaSArIDE7IGogPCBrZXlzLmxlbmd0aDsgaisrKSB7XG5cdFx0XHRcdGNvbnN0IGEgPSB0aGlzLm1hcFtrZXlzW2ldXTtcblx0XHRcdFx0Y29uc3QgYiA9IHRoaXMubWFwW2tleXNbal1dO1xuXG5cdFx0XHRcdC8vIFJlc29sdmUgYSwgYlx0XHRcdFx0XG5cdFx0XHRcdGlmIChhLnR5cGUgPT09ICdyYXknICYmIGIudHlwZSA9PT0gJ21lc2gnKSB7XG5cdFx0XHRcdFx0dGhpcy5oaXRUZXN0UmF5TWVzaChhLCBiKTtcblx0XHRcdFx0fSBlbHNlIGlmIChhLnR5cGUgPT09ICdtZXNoJyAmJiBiLnR5cGUgPT09ICdyYXknKSB7XG5cdFx0XHRcdFx0dGhpcy5oaXRUZXN0UmF5TWVzaChiLCBhKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGhpdFRlc3RSYXlNZXNoKHJheSwgbWVzaCkge1xuXHRcdGNvbnN0IGRlbHRhID0gdGhpcy5hcHAuZGVsdGE7XG5cblx0XHRjb25zdCByYXljYXN0ZXIgPSByYXkucmF5Y2FzdGVyO1xuXHRcdGNvbnN0IHJlc3VsdHMgPSByYXljYXN0ZXIuaW50ZXJzZWN0T2JqZWN0KG1lc2gubWVzaCwgdHJ1ZSk7XG5cblx0XHRpZiAocmVzdWx0cy5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAocmF5Lm9uQ29sbGlzaW9uICE9IG51bGwpIHtcblx0XHRcdHJheS5vbkNvbGxpc2lvbih7XG5cdFx0XHRcdHJlc3VsdHM6IHJlc3VsdHMsXG5cdFx0XHRcdGJvZHk6IG1lc2hcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGlmIChtZXNoLm9uQ29sbGlzaW9uICE9IG51bGwpIHtcblx0XHRcdG1lc2gub25Db2xsaXNpb24oe1xuXHRcdFx0XHRyZXN1bHRzOiByZXN1bHRzLFxuXHRcdFx0XHRib2R5OiByYXlcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBDb2xsaXNpb25zOyIsImZ1bmN0aW9uIGd1aWQoKSB7XG4gIGZ1bmN0aW9uIHM0KCkge1xuICAgIHJldHVybiBNYXRoLmZsb29yKCgxICsgTWF0aC5yYW5kb20oKSkgKiAweDEwMDAwKVxuICAgICAgLnRvU3RyaW5nKDE2KVxuICAgICAgLnN1YnN0cmluZygxKTtcbiAgfVxuICByZXR1cm4gczQoKSArIHM0KCkgKyAnLScgKyBzNCgpICsgJy0nICsgczQoKSArICctJyArXG4gICAgczQoKSArICctJyArIHM0KCkgKyBzNCgpICsgczQoKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBndWlkOyIsImNvbnN0IFRIUkVFID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJ1RIUkVFJ10gOiB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsWydUSFJFRSddIDogbnVsbCk7XG5cbmNvbnN0IHJlbmRlcmVyID0gbmV3IFRIUkVFLldlYkdMUmVuZGVyZXIoKTtcbnJlbmRlcmVyLnNldFNpemUod2luZG93LmlubmVyV2lkdGgsIHdpbmRvdy5pbm5lckhlaWdodCk7XG5kb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHJlbmRlcmVyLmRvbUVsZW1lbnQpO1xuY29uc3Qgc2NlbmUgPSBuZXcgVEhSRUUuU2NlbmUoKTtcbmNvbnN0IGNhbWVyYSA9IG5ldyBUSFJFRS5QZXJzcGVjdGl2ZUNhbWVyYSg2MCwgd2luZG93LmlubmVyV2lkdGggLyB3aW5kb3cuaW5uZXJIZWlnaHQsIDAuMSwgNTAwMCk7XG5jYW1lcmEucG9zaXRpb24ueiA9IDU7XG5cbmNvbnN0IHJlbmRlciA9ICgpID0+IHtcblx0cmVuZGVyZXIucmVuZGVyKHNjZW5lLCBjYW1lcmEpO1xufTtcblxuY29uc3QgYW5pbWF0ZSA9ICgpID0+IHtcblx0cmVuZGVyKCk7XG5cdHJlcXVlc3RBbmltYXRpb25GcmFtZShhbmltYXRlKTtcbn07XG5cbmNvbnN0IG9uUmVzaXplID0gKCkgPT4ge1xuXHRyZW5kZXJlci5zZXRTaXplKHdpbmRvdy5pbm5lcldpZHRoLCB3aW5kb3cuaW5uZXJIZWlnaHQpO1xuXHRjYW1lcmEuYXNwZWN0ID0gd2luZG93LmlubmVyV2lkdGggLyB3aW5kb3cuaW5uZXJIZWlnaHQ7XG5cdGNhbWVyYS51cGRhdGVQcm9qZWN0aW9uTWF0cml4KCk7XG59O1xuXG53aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncmVzaXplJywgb25SZXNpemUpO1xuXG5hbmltYXRlKCk7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuXHRyZW5kZXIsXG5cdHNjZW5lLFxuXHRjYW1lcmFcbn07IiwiY2xhc3MgRmxlZXQge1xuXHRjb25zdHJ1Y3Rvcihwcm9wcykge1xuXHRcdHRoaXMuc2hpcHMgPSBwcm9wcy5zaGlwcztcblx0fVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IEZsZWV0OyIsImNvbnN0IGFwcCA9IHJlcXVpcmUoJy4vY29yZS9hcHAnKTtcbmNvbnN0IGNvbnRhaW5lciA9IHJlcXVpcmUoJy4vY29udGFpbmVyJyk7XG5jb25zdCBTaGlwID0gcmVxdWlyZSgnLi9jb21wb25lbnRzL3NoaXAnKTtcbmNvbnN0IERyYWdDYW1lcmEgPSByZXF1aXJlKCcuL2NvbXBvbmVudHMvZHJhZ2NhbWVyYScpO1xuY29uc3QgQXN0ZXJvaWQgPSByZXF1aXJlKCcuL2NvbXBvbmVudHMvYXN0ZXJvaWQnKTtcbmNvbnN0IEdyaWQgPSByZXF1aXJlKCcuL2NvbXBvbmVudHMvZ3JpZCcpO1xuY29uc3QgU2hpcHMgPSByZXF1aXJlKCcuL2NvbXBvbmVudHMvc2hpcC9zaGlwcycpO1xuY29uc3QgRmxlZXQgPSByZXF1aXJlKCcuL2ZsZWV0Jyk7XG5cbmFwcC5zdGFydCgpO1xuYXBwLmFkZChTaGlwcyk7XG5cbmNvbnN0IGZyaWdhdGUgPSByZXF1aXJlKCcuL3NoaXBzL2ZyaWdhdGUnKTtcbmNvbnN0IHNoaXAgPSBhcHAuYWRkKFNoaXAsIHsgXG5cdGRhdGE6IGZyaWdhdGUsIFxuXHRzaWRlOiAnMCcgfSk7XG5cbmNvbnN0IGZsZWV0ID0gbmV3IEZsZWV0KHtcblx0c2hpcHM6IFtzaGlwXVxufSk7XG5jb250YWluZXIuZmxlZXQgPSBmbGVldDtcblxuY29uc3QgZ3JpZCA9IGFwcC5hZGQoR3JpZCk7XG5cbmdyaWQucGxhY2UoZmxlZXQuc2hpcHMpO1xuXG5jb25zdCBkcmFnQ2FtZXJhID0gYXBwLmFkZChEcmFnQ2FtZXJhKTtcbmRyYWdDYW1lcmEuZGlzdGFuY2UgPSAyMDA7XG5cbmNvbnN0IG5vaXNlID0gcmVxdWlyZSgncGVybGluJykubm9pc2U7XG5ub2lzZS5zZWVkKE1hdGgucmFuZG9tKCkpO1xuXG5jb25zdCBhc3Rlcm9pZHMgPSB7fTtcblxuZm9yIChsZXQgaSA9IDA7IGkgPCBncmlkLndpZHRoOyBpKyspIHtcblx0Zm9yIChsZXQgaiA9IDA7IGogPCBncmlkLmhlaWdodDsgaisrKSB7XG5cdFx0Y29uc3QgY29vcmQgPSBncmlkLmhleFRvQ29vcmQoaSwgaik7XG5cdFx0Y29uc3QgZGlzID0gTWF0aC5zcXJ0KGNvb3JkWzBdICogY29vcmRbMF0gKyBjb29yZFsxXSAqIGNvb3JkWzFdKTtcblxuXHRcdGxldCByYXRpbyA9IE1hdGgucG93KCgtZGlzICsgNTAwKSAvIDUwMCwgMC41KTtcblx0XHRpZiAocmF0aW8gPiAxKSB7XG5cdFx0XHRyYXRpbyA9IDE7XG5cdFx0fSBlbHNlIGlmIChyYXRpbyA8IDApIHtcblx0XHRcdHJhdGlvID0gMDtcblx0XHR9XG5cblx0XHRjb25zdCBuMSA9IG5vaXNlLnNpbXBsZXgyKGNvb3JkWzBdICogMC4wMDUsIGNvb3JkWzFdICogMC4wMDUpO1xuXHRcdGNvbnN0IG4yID0gbm9pc2Uuc2ltcGxleDIoY29vcmRbMF0gKiAwLjEsIGNvb3JkWzFdICogMC4xKSAqIDAuNztcblx0XHRjb25zdCBuID0gKG4xICsgbjIpICogcmF0aW87XG5cblx0XHRpZiAobiA+IDAuNykge1xuXHRcdFx0Y29uc3Qgc2l6ZSA9IG4gPiAwLjk1ID8gNCA6IG4gPiAwLjkgPyAzIDogbiA+IDAuOCA/IDIgOiAxO1xuXG5cdFx0XHRjb25zdCBpZCA9IFtpLCBqXS5qb2luKCcsJyk7XG5cdFx0XHRhc3Rlcm9pZHNbaWRdID0ge1xuXHRcdFx0XHRzaXplOiBzaXplLFxuXHRcdFx0XHRwb3NpdGlvbjogbmV3IFRIUkVFLlZlY3RvcjMoY29vcmRbMF0sIDAsIGNvb3JkWzFdKSxcblx0XHRcdFx0Y29vcmQ6IFtpLCBqXVxuXHRcdFx0fTtcblx0XHR9XG5cdH1cbn1cblxuY29uc3Qgc2h1ZmZsZSA9IHJlcXVpcmUoJ2tudXRoLXNodWZmbGUnKS5rbnV0aFNodWZmbGU7XG5jb25zdCBpZHMgPSBzaHVmZmxlKE9iamVjdC5rZXlzKGFzdGVyb2lkcykpO1xuZm9yIChsZXQgaSA9IDA7IGkgPCBpZHMubGVuZ3RoOyBpKyspIHtcblx0Y29uc3QgYXN0ZXJvaWQgPSBhc3Rlcm9pZHNbaWRzW2ldXTtcblx0aWYgKGFzdGVyb2lkLnJlbW92ZWQpIHtcblx0XHRjb250aW51ZTtcblx0fVxuXHRpZiAoYXN0ZXJvaWQuc2l6ZSA+PSAzKSB7XG5cdFx0Ly8gUmVtb3ZlIGFzdGVyb2lkIGFyb3VuZFxuXHRcdGNvbnN0IGNvb3JkcyA9IGdyaWQuZ2V0U3Vycm91bmRpbmdDb29yZHMoYXN0ZXJvaWQuY29vcmQpO1xuXG5cdFx0Zm9yIChsZXQgaiA9IDA7IGogPCBjb29yZHMubGVuZ3RoOyBqKyspIHtcblx0XHRcdGNvbnN0IGNvb3JkID0gY29vcmRzW2pdO1xuXHRcdFx0Y29uc3QgaWQgPSBjb29yZC5qb2luKCcsJyk7XG5cdFx0XHRpZiAoYXN0ZXJvaWRzW2lkXSA9PSBudWxsKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0YXN0ZXJvaWRzW2lkXS5yZW1vdmVkID0gdHJ1ZTtcblx0XHR9XG5cdH1cbn1cblxuZm9yIChsZXQgaWQgaW4gYXN0ZXJvaWRzKSB7XG5cdGNvbnN0IGFzdGVyb2lkID0gYXN0ZXJvaWRzW2lkXTtcblx0aWYgKGFzdGVyb2lkLnJlbW92ZWQpIHtcblx0XHRjb250aW51ZTtcblx0fVxuXHRhcHAuYWRkKEFzdGVyb2lkLCB7XG5cdFx0cG9zaXRpb246IGFzdGVyb2lkLnBvc2l0aW9uLFxuXHRcdHNpemU6IGFzdGVyb2lkLnNpemVcblx0fSk7XG59XG5cbi8vIGNvbnN0IGFtYmllbnRMaWdodCA9IG5ldyBUSFJFRS5BbWJpZW50TGlnaHQoMHhBQUFBQUEpO1xuLy8gY29uc3QgZGlyZWN0aW9uYWxMaWdodCA9IG5ldyBUSFJFRS5EaXJlY3Rpb25hbExpZ2h0KDB4ZmZmZmZmLCAwLjcpO1xuLy8gZGlyZWN0aW9uYWxMaWdodC5wb3NpdGlvbi5zZXQoMC41LCAxLjAsIDAuMyk7XG5cbi8vIGNvbnN0IHNjZW5lID0gYXBwLnJlbmRlcmVyLnNjZW5lO1xuXG4vLyBzY2VuZS5hZGQoYW1iaWVudExpZ2h0KTtcbi8vIHNjZW5lLmFkZChkaXJlY3Rpb25hbExpZ2h0KTsiLCJtb2R1bGUuZXhwb3J0cyA9IGBcbkhVTExcbiAwICAgICAgICAgMFxuIDAgICAwIDAgICAwXG4wMDAwMDAwMDAwMDAwXG4wMDAwMDAwMDAwMDAwXG4gMCAgIDAgMCAgIDBcbiAgICAgICAgICBcblxuTU9EVUxFU1xuIDAgICAgICAgICAwXG4gMCAgIDBsMCAgIDBcbjAwMDAwMDAwMDAwMDBcbjAwMDAwMEMwMDAwMDBcbiBFICAgMCAwICAgRVxuICAgICAgICAgIFxuYCIsImNvbnN0IHJhbmRvbVVuaXRWZWN0b3IgPSAoKSA9PiB7XG4gIGNvbnN0IHRoZXRhID0gTWF0aC5yYW5kb20oKSAqIDIuMCAqIE1hdGguUEk7XG5cbiAgY29uc3QgcmF3WCA9IE1hdGguc2luKHRoZXRhKTtcblxuICBjb25zdCByYXdZID0gTWF0aC5jb3ModGhldGEpO1xuXG4gIGNvbnN0IHogPSBNYXRoLnJhbmRvbSgpICogMi4wIC0gMS4wO1xuXG4gIGNvbnN0IHBoaSA9IE1hdGguYXNpbih6KTtcblxuICBjb25zdCBzY2FsYXIgPSBNYXRoLmNvcyhwaGkpO1xuXG4gIGNvbnN0IHggPSByYXdYICogc2NhbGFyO1xuXG4gIGNvbnN0IHkgPSByYXdZICogc2NhbGFyO1xuXG4gIHJldHVybiBuZXcgVEhSRUUuVmVjdG9yMyh4LCB5LCB6KTsgIFxufVxuXG5jb25zdCByYW5kb21RdWF0ZXJuaW9uID0gKCkgPT4ge1xuXHRjb25zdCB2ZWN0b3IgPSByYW5kb21Vbml0VmVjdG9yKCk7XG5cdHJldHVybiBuZXcgVEhSRUUuUXVhdGVybmlvbigpLnNldEZyb21Vbml0VmVjdG9ycyhuZXcgVEhSRUUuVmVjdG9yMygwLCAwLCAxKSwgdmVjdG9yKTtcbn07XG5cbmNvbnN0IG5vcm1hbGl6ZUFuZ2xlID0gKGFuZ2xlKSA9PiB7XG5cdGFuZ2xlICU9IChNYXRoLlBJICogMik7XG5cdGlmIChhbmdsZSA+IE1hdGguUEkpIHtcblx0XHRhbmdsZSAtPSBNYXRoLlBJICogMjtcblx0fSBlbHNlIGlmIChhbmdsZSA8IC1NYXRoLlBJKSB7XG5cdFx0YW5nbGUgKz0gTWF0aC5QSSAqIDI7XG5cdH1cblxuXHRyZXR1cm4gYW5nbGU7XG59O1xuXG5jb25zdCBjbGFtcCA9ICh2LCBtaW4sIG1heCkgPT4ge1xuXHRpZiAodiA8IG1pbikge1xuXHRcdHJldHVybiBtaW47XG5cdH0gZWxzZSBpZiAodiA+IG1heCkge1xuXHRcdHJldHVybiBtYXg7XG5cdH1cblx0cmV0dXJuIHY7XG59O1xuXG5jb25zdCBsaW5lYXJCaWxsYm9hcmQgPSAoY2FtZXJhLCBvYmplY3QsIGRpciwgcXVhdGVybmlvbikgPT4ge1xuXHRjb25zdCBhID0gb2JqZWN0LnBvc2l0aW9uLmNsb25lKCkuc3ViKGNhbWVyYS5wb3NpdGlvbikubm9ybWFsaXplKCk7XG5cdGNvbnN0IGIgPSBhLmNsb25lKCkucHJvamVjdE9uUGxhbmUoZGlyKS5ub3JtYWxpemUoKTtcblx0Y29uc3QgYyA9IG5ldyBUSFJFRS5WZWN0b3IzKDAsIDAsIDEpLmFwcGx5UXVhdGVybmlvbihxdWF0ZXJuaW9uKTtcblxuXHRjb25zdCBxdWF0MiA9IG5ldyBUSFJFRS5RdWF0ZXJuaW9uKCkuc2V0RnJvbVVuaXRWZWN0b3JzKGMsIGIpO1xuXG5cdG9iamVjdC5xdWF0ZXJuaW9uLmNvcHkobmV3IFRIUkVFLlF1YXRlcm5pb24oKSk7XG5cdG9iamVjdC5xdWF0ZXJuaW9uLm11bHRpcGx5KHF1YXQyKTtcblx0b2JqZWN0LnF1YXRlcm5pb24ubXVsdGlwbHkocXVhdGVybmlvbik7XG59XG5cbm1vZHVsZS5leHBvcnRzID0geyByYW5kb21Vbml0VmVjdG9yLCByYW5kb21RdWF0ZXJuaW9uLCBub3JtYWxpemVBbmdsZSwgY2xhbXAsIGxpbmVhckJpbGxib2FyZCB9O1xuIiwiY2xhc3MgQ2h1bmsge1xuXHRjb25zdHJ1Y3RvcihzaXplKSB7XG5cdFx0dGhpcy5zaXplID0gc2l6ZTtcblx0XHR0aGlzLnl6ID0gc2l6ZSAqIHNpemU7XG5cdFx0dGhpcy5kYXRhID0gW107XG5cdH1cblxuXHRnZXQoaSwgaiwgaykge1xuXHRcdGNvbnN0IGluZGV4ID0gaSAqIHRoaXMueXogKyBqICogdGhpcy5zaXplICsgaztcblx0XHRyZXR1cm4gdGhpcy5kYXRhW2luZGV4XTtcblx0fVxuXG5cdHNldChpLCBqLCBrLCB2KSB7XG5cdFx0Y29uc3QgaW5kZXggPSBpICogdGhpcy55eiArIGogKiB0aGlzLnNpemUgKyBrO1xuXHRcdHRoaXMuZGF0YVtpbmRleF0gPSB2O1xuXHR9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gQ2h1bms7IiwiY29uc3QgQ2h1bmsgPSByZXF1aXJlKCcuL2NodW5rJyk7XG5cbmNsYXNzIENodW5rcyB7XG5cdGNvbnN0cnVjdG9yKHNpemUpIHtcblx0XHR0aGlzLnNpemUgPSBzaXplIHx8IDE2O1xuXHRcdHRoaXMubWFwID0ge307XG5cdH1cblxuXHRnZXQoaSwgaiwgaykge1xuXHRcdGNvbnN0IG9yaWdpbiA9IHRoaXMuZ2V0T3JpZ2luKGksIGosIGspO1xuXHRcdGNvbnN0IGlkID0gb3JpZ2luLmpvaW4oJywnKTtcblxuXHRcdGNvbnN0IHJlZ2lvbiA9IHRoaXMubWFwW2lkXTtcblx0XHRpZiAocmVnaW9uID09IG51bGwpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH0gXG5cblx0XHRyZXR1cm4gcmVnaW9uLmNodW5rLmdldChpIC0gb3JpZ2luWzBdLCBqIC0gb3JpZ2luWzFdLCBrIC0gb3JpZ2luWzJdKTtcblx0fVxuXG5cdHNldChpLCBqLCBrLCB2KSB7XG5cdFx0Y29uc3Qgb3JpZ2luID0gdGhpcy5nZXRPcmlnaW4oaSwgaiwgayk7XG5cdFx0Y29uc3QgaWQgPSBvcmlnaW4uam9pbignLCcpO1xuXG5cdFx0bGV0IHJlZ2lvbiA9IHRoaXMubWFwW2lkXTtcblx0XHRpZiAocmVnaW9uID09IG51bGwpIHtcblx0XHRcdHJlZ2lvbiA9IHRoaXMubWFwW2lkXSA9IHtcblx0XHRcdFx0Y2h1bms6IG5ldyBDaHVuayh0aGlzLnNpemUpLFxuXHRcdFx0XHRvcmlnaW46IG9yaWdpblxuXHRcdFx0fTtcblx0XHR9XG5cdFx0cmVnaW9uLmRpcnR5ID0gdHJ1ZTtcblxuXHRcdHJlZ2lvbi5jaHVuay5zZXQoaSAtIG9yaWdpblswXSwgaiAtIG9yaWdpblsxXSwgayAtIG9yaWdpblsyXSwgdik7XG5cdH1cblxuXHRnZXRPcmlnaW4oaSwgaiwgaykge1xuXHRcdHJldHVybiBbIFxuXHRcdFx0TWF0aC5mbG9vcihpIC8gdGhpcy5zaXplKSAqIHRoaXMuc2l6ZSxcblx0XHRcdE1hdGguZmxvb3IoaiAvIHRoaXMuc2l6ZSkgKiB0aGlzLnNpemUsXG5cdFx0XHRNYXRoLmZsb29yKGsgLyB0aGlzLnNpemUpICogdGhpcy5zaXplXG5cdFx0XVxuXHR9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IENodW5rczsiLCJjb25zdCBtZXNoZXIgPSByZXF1aXJlKCcuL21vbm90b25lJykubWVzaGVyO1xuXG5jb25zdCBtZXNoUmVnaW9uID0gKHJlZ2lvbiwgb2JqZWN0LCBtYXRlcmlhbCkgPT4ge1xuXHRpZiAocmVnaW9uLm1lc2ggIT0gbnVsbCkge1xuXHRcdG9iamVjdC5yZW1vdmUocmVnaW9uLm1lc2gpO1xuXHRcdHJlZ2lvbi5tZXNoLmdlb21ldHJ5LmRpc3Bvc2UoKTtcblx0fVxuXG5cdGNvbnN0IGdlb21ldHJ5ID0gbmV3IFRIUkVFLkdlb21ldHJ5KCk7XG5cdGNvbnN0IG1lc2ggPSBuZXcgVEhSRUUuTWVzaChnZW9tZXRyeSwgbWF0ZXJpYWwpO1xuXG5cdGNvbnN0IGNodW5rID0gcmVnaW9uLmNodW5rO1xuXG5cdGNvbnN0IGYgPSBjaHVuay5nZXQuYmluZChjaHVuayk7XG5cdGNvbnN0IGRpbXMgPSBbIGNodW5rLnNpemUsIGNodW5rLnNpemUsIGNodW5rLnNpemUgXTtcblxuXHRjb25zdCByZXN1bHQgPSBtZXNoZXIoZiwgZGltcyk7XG5cblx0cmVzdWx0LnZlcnRpY2VzLmZvckVhY2goKHYpID0+IHtcblx0XHRnZW9tZXRyeS52ZXJ0aWNlcy5wdXNoKG5ldyBUSFJFRS5WZWN0b3IzKHZbMF0sIHZbMV0sIHZbMl0pKTtcblx0fSk7XG5cblx0cmVzdWx0LmZhY2VzLmZvckVhY2goKGYpID0+IHtcblx0XHRjb25zdCBmYWNlID0gbmV3IFRIUkVFLkZhY2UzKGZbMF0sIGZbMV0sIGZbMl0pO1xuXHRcdGZhY2UubWF0ZXJpYWxJbmRleCA9IGZbM107XG5cdFx0Z2VvbWV0cnkuZmFjZXMucHVzaChmYWNlKTtcblx0fSk7XG5cblx0b2JqZWN0LmFkZChtZXNoKTtcblx0cmVnaW9uLm1lc2ggPSBtZXNoO1xufTtcblxuY29uc3QgbWVzaENodW5rcyA9IChjaHVua3MsIG9iamVjdCwgbWF0ZXJpYWwpID0+IHtcblx0bGV0IGlkLCByZWdpb247XG5cdGZvciAoaWQgaW4gY2h1bmtzLm1hcCkge1xuXHRcdHJlZ2lvbiA9IGNodW5rcy5tYXBbaWRdO1xuXHRcdGlmIChyZWdpb24uZGlydHkpIHtcblx0XHRcdG1lc2hSZWdpb24ocmVnaW9uLCBvYmplY3QsIG1hdGVyaWFsKTtcblx0XHRcdHJlZ2lvbi5kaXJ0eSA9IGZhbHNlO1xuXHRcdH1cblx0fVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBtZXNoQ2h1bmtzOyIsIlwidXNlIHN0cmljdFwiO1xuXG52YXIgTW9ub3RvbmVNZXNoID0gKGZ1bmN0aW9uKCl7XG5cbmZ1bmN0aW9uIE1vbm90b25lUG9seWdvbihjLCB2LCB1bCwgdXIpIHtcbiAgdGhpcy5jb2xvciAgPSBjO1xuICB0aGlzLmxlZnQgICA9IFtbdWwsIHZdXTtcbiAgdGhpcy5yaWdodCAgPSBbW3VyLCB2XV07XG59O1xuXG5Nb25vdG9uZVBvbHlnb24ucHJvdG90eXBlLmNsb3NlX29mZiA9IGZ1bmN0aW9uKHYpIHtcbiAgdGhpcy5sZWZ0LnB1c2goWyB0aGlzLmxlZnRbdGhpcy5sZWZ0Lmxlbmd0aC0xXVswXSwgdiBdKTtcbiAgdGhpcy5yaWdodC5wdXNoKFsgdGhpcy5yaWdodFt0aGlzLnJpZ2h0Lmxlbmd0aC0xXVswXSwgdiBdKTtcbn07XG5cbk1vbm90b25lUG9seWdvbi5wcm90b3R5cGUubWVyZ2VfcnVuID0gZnVuY3Rpb24odiwgdV9sLCB1X3IpIHtcbiAgdmFyIGwgPSB0aGlzLmxlZnRbdGhpcy5sZWZ0Lmxlbmd0aC0xXVswXVxuICAgICwgciA9IHRoaXMucmlnaHRbdGhpcy5yaWdodC5sZW5ndGgtMV1bMF07IFxuICBpZihsICE9PSB1X2wpIHtcbiAgICB0aGlzLmxlZnQucHVzaChbIGwsIHYgXSk7XG4gICAgdGhpcy5sZWZ0LnB1c2goWyB1X2wsIHYgXSk7XG4gIH1cbiAgaWYociAhPT0gdV9yKSB7XG4gICAgdGhpcy5yaWdodC5wdXNoKFsgciwgdiBdKTtcbiAgICB0aGlzLnJpZ2h0LnB1c2goWyB1X3IsIHYgXSk7XG4gIH1cbn07XG5cblxucmV0dXJuIGZ1bmN0aW9uKGYsIGRpbXMpIHtcbiAgLy9Td2VlcCBvdmVyIDMtYXhlc1xuICB2YXIgdmVydGljZXMgPSBbXSwgZmFjZXMgPSBbXTtcbiAgZm9yKHZhciBkPTA7IGQ8MzsgKytkKSB7XG4gICAgdmFyIGksIGosIGtcbiAgICAgICwgdSA9IChkKzEpJTMgICAvL3UgYW5kIHYgYXJlIG9ydGhvZ29uYWwgZGlyZWN0aW9ucyB0byBkXG4gICAgICAsIHYgPSAoZCsyKSUzXG4gICAgICAsIHggPSBuZXcgSW50MzJBcnJheSgzKVxuICAgICAgLCBxID0gbmV3IEludDMyQXJyYXkoMylcbiAgICAgICwgcnVucyA9IG5ldyBJbnQzMkFycmF5KDIgKiAoZGltc1t1XSsxKSlcbiAgICAgICwgZnJvbnRpZXIgPSBuZXcgSW50MzJBcnJheShkaW1zW3VdKSAgLy9Gcm9udGllciBpcyBsaXN0IG9mIHBvaW50ZXJzIHRvIHBvbHlnb25zXG4gICAgICAsIG5leHRfZnJvbnRpZXIgPSBuZXcgSW50MzJBcnJheShkaW1zW3VdKVxuICAgICAgLCBsZWZ0X2luZGV4ID0gbmV3IEludDMyQXJyYXkoMiAqIGRpbXNbdl0pXG4gICAgICAsIHJpZ2h0X2luZGV4ID0gbmV3IEludDMyQXJyYXkoMiAqIGRpbXNbdl0pXG4gICAgICAsIHN0YWNrID0gbmV3IEludDMyQXJyYXkoMjQgKiBkaW1zW3ZdKVxuICAgICAgLCBkZWx0YSA9IFtbMCwwXSwgWzAsMF1dO1xuICAgIC8vcSBwb2ludHMgYWxvbmcgZC1kaXJlY3Rpb25cbiAgICBxW2RdID0gMTtcbiAgICAvL0luaXRpYWxpemUgc2VudGluZWxcbiAgICBmb3IoeFtkXT0tMTsgeFtkXTxkaW1zW2RdOyApIHtcbiAgICAgIC8vIC0tLSBQZXJmb3JtIG1vbm90b25lIHBvbHlnb24gc3ViZGl2aXNpb24gLS0tXG4gICAgICB2YXIgbiA9IDBcbiAgICAgICAgLCBwb2x5Z29ucyA9IFtdXG4gICAgICAgICwgbmYgPSAwO1xuICAgICAgZm9yKHhbdl09MDsgeFt2XTxkaW1zW3ZdOyArK3hbdl0pIHtcbiAgICAgICAgLy9NYWtlIG9uZSBwYXNzIG92ZXIgdGhlIHUtc2NhbiBsaW5lIG9mIHRoZSB2b2x1bWUgdG8gcnVuLWxlbmd0aCBlbmNvZGUgcG9seWdvblxuICAgICAgICB2YXIgbnIgPSAwLCBwID0gMCwgYyA9IDA7XG4gICAgICAgIGZvcih4W3VdPTA7IHhbdV08ZGltc1t1XTsgKyt4W3VdLCBwID0gYykge1xuICAgICAgICAgIC8vQ29tcHV0ZSB0aGUgdHlwZSBmb3IgdGhpcyBmYWNlXG4gICAgICAgICAgdmFyIGEgPSAoMCAgICA8PSB4W2RdICAgICAgPyBmKHhbMF0sICAgICAgeFsxXSwgICAgICB4WzJdKSAgICAgIDogMClcbiAgICAgICAgICAgICwgYiA9ICh4W2RdIDwgIGRpbXNbZF0tMSA/IGYoeFswXStxWzBdLCB4WzFdK3FbMV0sIHhbMl0rcVsyXSkgOiAwKTtcbiAgICAgICAgICBjID0gYTtcbiAgICAgICAgICBpZigoIWEpID09PSAoIWIpKSB7XG4gICAgICAgICAgICBjID0gMDtcbiAgICAgICAgICB9IGVsc2UgaWYoIWEpIHtcbiAgICAgICAgICAgIGMgPSAtYjtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy9JZiBjZWxsIHR5cGUgZG9lc24ndCBtYXRjaCwgc3RhcnQgYSBuZXcgcnVuXG4gICAgICAgICAgaWYocCAhPT0gYykge1xuICAgICAgICAgICAgcnVuc1tucisrXSA9IHhbdV07XG4gICAgICAgICAgICBydW5zW25yKytdID0gYztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy9BZGQgc2VudGluZWwgcnVuXG4gICAgICAgIHJ1bnNbbnIrK10gPSBkaW1zW3VdO1xuICAgICAgICBydW5zW25yKytdID0gMDtcbiAgICAgICAgLy9VcGRhdGUgZnJvbnRpZXIgYnkgbWVyZ2luZyBydW5zXG4gICAgICAgIHZhciBmcCA9IDA7XG4gICAgICAgIGZvcih2YXIgaT0wLCBqPTA7IGk8bmYgJiYgajxuci0yOyApIHtcbiAgICAgICAgICB2YXIgcCAgICA9IHBvbHlnb25zW2Zyb250aWVyW2ldXVxuICAgICAgICAgICAgLCBwX2wgID0gcC5sZWZ0W3AubGVmdC5sZW5ndGgtMV1bMF1cbiAgICAgICAgICAgICwgcF9yICA9IHAucmlnaHRbcC5yaWdodC5sZW5ndGgtMV1bMF1cbiAgICAgICAgICAgICwgcF9jICA9IHAuY29sb3JcbiAgICAgICAgICAgICwgcl9sICA9IHJ1bnNbal0gICAgLy9TdGFydCBvZiBydW5cbiAgICAgICAgICAgICwgcl9yICA9IHJ1bnNbaisyXSAgLy9FbmQgb2YgcnVuXG4gICAgICAgICAgICAsIHJfYyAgPSBydW5zW2orMV07IC8vQ29sb3Igb2YgcnVuXG4gICAgICAgICAgLy9DaGVjayBpZiB3ZSBjYW4gbWVyZ2UgcnVuIHdpdGggcG9seWdvblxuICAgICAgICAgIGlmKHJfciA+IHBfbCAmJiBwX3IgPiByX2wgJiYgcl9jID09PSBwX2MpIHtcbiAgICAgICAgICAgIC8vTWVyZ2UgcnVuXG4gICAgICAgICAgICBwLm1lcmdlX3J1bih4W3ZdLCByX2wsIHJfcik7XG4gICAgICAgICAgICAvL0luc2VydCBwb2x5Z29uIGludG8gZnJvbnRpZXJcbiAgICAgICAgICAgIG5leHRfZnJvbnRpZXJbZnArK10gPSBmcm9udGllcltpXTtcbiAgICAgICAgICAgICsraTtcbiAgICAgICAgICAgIGogKz0gMjtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy9DaGVjayBpZiB3ZSBuZWVkIHRvIGFkdmFuY2UgdGhlIHJ1biBwb2ludGVyXG4gICAgICAgICAgICBpZihyX3IgPD0gcF9yKSB7XG4gICAgICAgICAgICAgIGlmKCEhcl9jKSB7XG4gICAgICAgICAgICAgICAgdmFyIG5fcG9seSA9IG5ldyBNb25vdG9uZVBvbHlnb24ocl9jLCB4W3ZdLCByX2wsIHJfcik7XG4gICAgICAgICAgICAgICAgbmV4dF9mcm9udGllcltmcCsrXSA9IHBvbHlnb25zLmxlbmd0aDtcbiAgICAgICAgICAgICAgICBwb2x5Z29ucy5wdXNoKG5fcG9seSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaiArPSAyO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy9DaGVjayBpZiB3ZSBuZWVkIHRvIGFkdmFuY2UgdGhlIGZyb250aWVyIHBvaW50ZXJcbiAgICAgICAgICAgIGlmKHBfciA8PSByX3IpIHtcbiAgICAgICAgICAgICAgcC5jbG9zZV9vZmYoeFt2XSk7XG4gICAgICAgICAgICAgICsraTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy9DbG9zZSBvZmYgYW55IHJlc2lkdWFsIHBvbHlnb25zXG4gICAgICAgIGZvcig7IGk8bmY7ICsraSkge1xuICAgICAgICAgIHBvbHlnb25zW2Zyb250aWVyW2ldXS5jbG9zZV9vZmYoeFt2XSk7XG4gICAgICAgIH1cbiAgICAgICAgLy9BZGQgYW55IGV4dHJhIHJ1bnMgdG8gZnJvbnRpZXJcbiAgICAgICAgZm9yKDsgajxuci0yOyBqKz0yKSB7XG4gICAgICAgICAgdmFyIHJfbCAgPSBydW5zW2pdXG4gICAgICAgICAgICAsIHJfciAgPSBydW5zW2orMl1cbiAgICAgICAgICAgICwgcl9jICA9IHJ1bnNbaisxXTtcbiAgICAgICAgICBpZighIXJfYykge1xuICAgICAgICAgICAgdmFyIG5fcG9seSA9IG5ldyBNb25vdG9uZVBvbHlnb24ocl9jLCB4W3ZdLCByX2wsIHJfcik7XG4gICAgICAgICAgICBuZXh0X2Zyb250aWVyW2ZwKytdID0gcG9seWdvbnMubGVuZ3RoO1xuICAgICAgICAgICAgcG9seWdvbnMucHVzaChuX3BvbHkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvL1N3YXAgZnJvbnRpZXJzXG4gICAgICAgIHZhciB0bXAgPSBuZXh0X2Zyb250aWVyO1xuICAgICAgICBuZXh0X2Zyb250aWVyID0gZnJvbnRpZXI7XG4gICAgICAgIGZyb250aWVyID0gdG1wO1xuICAgICAgICBuZiA9IGZwO1xuICAgICAgfVxuICAgICAgLy9DbG9zZSBvZmYgZnJvbnRpZXJcbiAgICAgIGZvcih2YXIgaT0wOyBpPG5mOyArK2kpIHtcbiAgICAgICAgdmFyIHAgPSBwb2x5Z29uc1tmcm9udGllcltpXV07XG4gICAgICAgIHAuY2xvc2Vfb2ZmKGRpbXNbdl0pO1xuICAgICAgfVxuICAgICAgLy8gLS0tIE1vbm90b25lIHN1YmRpdmlzaW9uIG9mIHBvbHlnb24gaXMgY29tcGxldGUgYXQgdGhpcyBwb2ludCAtLS1cbiAgICAgIFxuICAgICAgeFtkXSsrO1xuICAgICAgXG4gICAgICAvL05vdyB3ZSBqdXN0IG5lZWQgdG8gdHJpYW5ndWxhdGUgZWFjaCBtb25vdG9uZSBwb2x5Z29uXG4gICAgICBmb3IodmFyIGk9MDsgaTxwb2x5Z29ucy5sZW5ndGg7ICsraSkge1xuICAgICAgICB2YXIgcCA9IHBvbHlnb25zW2ldXG4gICAgICAgICAgLCBjID0gcC5jb2xvclxuICAgICAgICAgICwgZmxpcHBlZCA9IGZhbHNlO1xuICAgICAgICBpZihjIDwgMCkge1xuICAgICAgICAgIGZsaXBwZWQgPSB0cnVlO1xuICAgICAgICAgIGMgPSAtYztcbiAgICAgICAgfVxuICAgICAgICBmb3IodmFyIGo9MDsgajxwLmxlZnQubGVuZ3RoOyArK2opIHtcbiAgICAgICAgICBsZWZ0X2luZGV4W2pdID0gdmVydGljZXMubGVuZ3RoO1xuICAgICAgICAgIHZhciB5ID0gWzAuMCwwLjAsMC4wXVxuICAgICAgICAgICAgLCB6ID0gcC5sZWZ0W2pdO1xuICAgICAgICAgIHlbZF0gPSB4W2RdO1xuICAgICAgICAgIHlbdV0gPSB6WzBdO1xuICAgICAgICAgIHlbdl0gPSB6WzFdO1xuICAgICAgICAgIHZlcnRpY2VzLnB1c2goeSk7XG4gICAgICAgIH1cbiAgICAgICAgZm9yKHZhciBqPTA7IGo8cC5yaWdodC5sZW5ndGg7ICsraikge1xuICAgICAgICAgIHJpZ2h0X2luZGV4W2pdID0gdmVydGljZXMubGVuZ3RoO1xuICAgICAgICAgIHZhciB5ID0gWzAuMCwwLjAsMC4wXVxuICAgICAgICAgICAgLCB6ID0gcC5yaWdodFtqXTtcbiAgICAgICAgICB5W2RdID0geFtkXTtcbiAgICAgICAgICB5W3VdID0gelswXTtcbiAgICAgICAgICB5W3ZdID0gelsxXTtcbiAgICAgICAgICB2ZXJ0aWNlcy5wdXNoKHkpO1xuICAgICAgICB9XG4gICAgICAgIC8vVHJpYW5ndWxhdGUgdGhlIG1vbm90b25lIHBvbHlnb25cbiAgICAgICAgdmFyIGJvdHRvbSA9IDBcbiAgICAgICAgICAsIHRvcCA9IDBcbiAgICAgICAgICAsIGxfaSA9IDFcbiAgICAgICAgICAsIHJfaSA9IDFcbiAgICAgICAgICAsIHNpZGUgPSB0cnVlOyAgLy90cnVlID0gcmlnaHQsIGZhbHNlID0gbGVmdFxuICAgICAgICBcbiAgICAgICAgc3RhY2tbdG9wKytdID0gbGVmdF9pbmRleFswXTtcbiAgICAgICAgc3RhY2tbdG9wKytdID0gcC5sZWZ0WzBdWzBdO1xuICAgICAgICBzdGFja1t0b3ArK10gPSBwLmxlZnRbMF1bMV07XG4gICAgICAgIFxuICAgICAgICBzdGFja1t0b3ArK10gPSByaWdodF9pbmRleFswXTtcbiAgICAgICAgc3RhY2tbdG9wKytdID0gcC5yaWdodFswXVswXTtcbiAgICAgICAgc3RhY2tbdG9wKytdID0gcC5yaWdodFswXVsxXTtcbiAgICAgICAgXG4gICAgICAgIHdoaWxlKGxfaSA8IHAubGVmdC5sZW5ndGggfHwgcl9pIDwgcC5yaWdodC5sZW5ndGgpIHtcbiAgICAgICAgICAvL0NvbXB1dGUgbmV4dCBzaWRlXG4gICAgICAgICAgdmFyIG5fc2lkZSA9IGZhbHNlO1xuICAgICAgICAgIGlmKGxfaSA9PT0gcC5sZWZ0Lmxlbmd0aCkge1xuICAgICAgICAgICAgbl9zaWRlID0gdHJ1ZTtcbiAgICAgICAgICB9IGVsc2UgaWYocl9pICE9PSBwLnJpZ2h0Lmxlbmd0aCkge1xuICAgICAgICAgICAgdmFyIGwgPSBwLmxlZnRbbF9pXVxuICAgICAgICAgICAgICAsIHIgPSBwLnJpZ2h0W3JfaV07XG4gICAgICAgICAgICBuX3NpZGUgPSBsWzFdID4gclsxXTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdmFyIGlkeCA9IG5fc2lkZSA/IHJpZ2h0X2luZGV4W3JfaV0gOiBsZWZ0X2luZGV4W2xfaV1cbiAgICAgICAgICAgICwgdmVydCA9IG5fc2lkZSA/IHAucmlnaHRbcl9pXSA6IHAubGVmdFtsX2ldO1xuICAgICAgICAgIGlmKG5fc2lkZSAhPT0gc2lkZSkge1xuICAgICAgICAgICAgLy9PcHBvc2l0ZSBzaWRlXG4gICAgICAgICAgICB3aGlsZShib3R0b20rMyA8IHRvcCkge1xuICAgICAgICAgICAgICBpZihmbGlwcGVkID09PSBuX3NpZGUpIHtcbiAgICAgICAgICAgICAgICBmYWNlcy5wdXNoKFsgc3RhY2tbYm90dG9tXSwgc3RhY2tbYm90dG9tKzNdLCBpZHgsIGNdKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBmYWNlcy5wdXNoKFsgc3RhY2tbYm90dG9tKzNdLCBzdGFja1tib3R0b21dLCBpZHgsIGNdKTsgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGJvdHRvbSArPSAzO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvL1NhbWUgc2lkZVxuICAgICAgICAgICAgd2hpbGUoYm90dG9tKzMgPCB0b3ApIHtcbiAgICAgICAgICAgICAgLy9Db21wdXRlIGNvbnZleGl0eVxuICAgICAgICAgICAgICBmb3IodmFyIGo9MDsgajwyOyArK2opXG4gICAgICAgICAgICAgIGZvcih2YXIgaz0wOyBrPDI7ICsraykge1xuICAgICAgICAgICAgICAgIGRlbHRhW2pdW2tdID0gc3RhY2tbdG9wLTMqKGorMSkraysxXSAtIHZlcnRba107XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgdmFyIGRldCA9IGRlbHRhWzBdWzBdICogZGVsdGFbMV1bMV0gLSBkZWx0YVsxXVswXSAqIGRlbHRhWzBdWzFdO1xuICAgICAgICAgICAgICBpZihuX3NpZGUgPT09IChkZXQgPiAwKSkge1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmKGRldCAhPT0gMCkge1xuICAgICAgICAgICAgICAgIGlmKGZsaXBwZWQgPT09IG5fc2lkZSkge1xuICAgICAgICAgICAgICAgICAgZmFjZXMucHVzaChbIHN0YWNrW3RvcC0zXSwgc3RhY2tbdG9wLTZdLCBpZHgsIGMgXSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIGZhY2VzLnB1c2goWyBzdGFja1t0b3AtNl0sIHN0YWNrW3RvcC0zXSwgaWR4LCBjIF0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB0b3AgLT0gMztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgLy9QdXNoIHZlcnRleFxuICAgICAgICAgIHN0YWNrW3RvcCsrXSA9IGlkeDtcbiAgICAgICAgICBzdGFja1t0b3ArK10gPSB2ZXJ0WzBdO1xuICAgICAgICAgIHN0YWNrW3RvcCsrXSA9IHZlcnRbMV07XG4gICAgICAgICAgLy9VcGRhdGUgbG9vcCBpbmRleFxuICAgICAgICAgIGlmKG5fc2lkZSkge1xuICAgICAgICAgICAgKytyX2k7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICsrbF9pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzaWRlID0gbl9zaWRlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiB7IHZlcnRpY2VzOnZlcnRpY2VzLCBmYWNlczpmYWNlcyB9O1xufVxufSkoKTtcblxuaWYoZXhwb3J0cykge1xuICBleHBvcnRzLm1lc2hlciA9IE1vbm90b25lTWVzaDtcbn1cbiJdfQ==
