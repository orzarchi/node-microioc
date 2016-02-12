'use strict';
var introspect = require('introspect'),
    _ = require('lodash');

const AUTO_FACTORY_POSTFIX = 'Factory';

class IOCBuilder {
    constructor(container, id, type, isSingleton) {
        this._container = container;
        this._typeBinding = {
            id: id,
            type: type,
            singleton: isSingleton,
            createUniqueInstance: false
        };

        this._container._bindings.set(id, this._typeBinding);
    }

    /**
     * Marks the previously bound type as part of a named group
     * @param {string} id
     * @returns {IOCBuilder}
     */
    groupOnId(id) {
        this._typeBinding.groupId = id;
        return this;
    }

    /**
     * Marks the previously bound singleton type as a unique singleton instance
     * If not set other bindings for the same singleton type use the same instance
     * @returns {IOCBuilder}
     */
    createUniqueInstance() {
        if (!this._typeBinding.singleton) {
            throw new Error('Cannot set createUniqueInstance on non-singleton type binding');
        }
        this._typeBinding.createUniqueInstance = true;
        return this;
    }

    /**
     * Binds a class definition to an id using an instance per dependency
     * @param {string} id
     * @param {function|module.exports|exports} type
     * @returns {IOCBuilder}
     */
    bindType(id, type) {
        return new IOCBuilder(this._container, id, type, false);
    }

    /**
     * Binds a class definition to an id as a singleton
     * @param {string} id
     * @param {function|module.exports|exports} type
     * @returns {IOCBuilder}
     */
    bindSingleton(id, type) {
        return new IOCBuilder(this._container, id, type, true);
    }
}

class IOC {
    constructor() {
        this._bindings = new Map();
        this._singletons = new Map();
    }

    /**
     * Binds a class definition to an id using an instance per dependency
     * @param {string} id
     * @param {function|module.exports|exports} type
     * @returns {IOCBuilder}
     */
    bindType(id, type) {
        return new IOCBuilder(this, id, type, false);
    }

    /**
     * Binds a class definition to an id as a singleton
     * @param {string} id
     * @param {function|module.exports|exports} type
     * @returns {IOCBuilder}
     */
    bindSingleton(id, type) {
        return new IOCBuilder(this, id, type, true);
    }

    resetSavedInstances() {
        this._singletons = new Map();
    }

    _newCall(Cls, args) {
        var F = Function.prototype.bind.apply(Cls, [Cls].concat(args));
        return new F(arguments);
    }

    _construct(type, resolveChain, additionalArgs) {
        additionalArgs = additionalArgs || [];

        var ctorArgs = introspect(type);

        // For every argument supplied to 'resolve', we need to resolve one less real ctor argument
        additionalArgs.forEach(ctorArgs.shift.bind(ctorArgs));

        const dependencies = ctorArgs.map(id => this.resolve(id, resolveChain));

        var instance = this._newCall(type, dependencies.concat(additionalArgs));

        return instance;
    }

    _resolveInternal(id, resolveChain, additionalArgs) {
        const typeBinding = this._bindings.get(id);

        resolveChain.push(id);

        if (typeBinding.singleton) {
            var singletonInstanceKey = this._getSingletonInstanceKey(typeBinding);
            let constructedInstance = this._singletons.get(singletonInstanceKey);

            if (!constructedInstance) {
                this._singletons.set(singletonInstanceKey, this._construct(typeBinding.type, resolveChain, additionalArgs));
                constructedInstance = this._singletons.get(singletonInstanceKey);
            }

            resolveChain.pop();
            return constructedInstance;
        }
        else {
            const instance = this._construct(typeBinding.type, resolveChain, additionalArgs);
            resolveChain.pop();
            return instance;
        }
    }

    _getSingletonInstanceKey(typeBinding) {
        return typeBinding.createUniqueInstance ? `${typeBinding.type.name}-${typeBinding.id}` : typeBinding.type.name;
    }

    _getAutoFactoryComponentId(id) {
        return id.endsWith(AUTO_FACTORY_POSTFIX) ?
            id.substring(0, id.length - AUTO_FACTORY_POSTFIX.length) :
            null;
    }

    canResolve(id) {
        return this._bindings.has(id) ||
            this._getAutoFactoryComponentId(id) !== null;
    }

    /**
     *
     * @param {string} id
     * @param {Array} resolveChain
     * @returns {*}
     */
    resolve(id, resolveChain) {
        resolveChain = resolveChain || [];

        if (_.includes(resolveChain, id)) {
            resolveChain.push(id);
            throw new Error(`IOC - Circular dependency detected ${this._formatResolveChain(resolveChain)}`);
        }

        if (this._bindings.has(id)) {
            return this._resolveInternal(id, resolveChain, []);
        }

        const factoryId = this._getAutoFactoryComponentId(id);

        if (this._bindings.has(factoryId)) {
            return _.rest(this._resolveInternal.bind(this, factoryId, resolveChain), 0);
        }

        const groups = this._getByGroup(id);
        if (!_.isEmpty(groups)) {
            return groups.map(x=> this.resolve(x.id, resolveChain));
        }


        resolveChain.push(id);
        var msg = `IOC - Error resolving service ${id}\n${this._formatResolveChain(resolveChain)}`;
        throw new Error(msg);

    }

    _formatResolveChain(resolveChain) {
        return `Resolve Chain:${resolveChain.join(' -> ')}`;
    }

    _getByGroup(id) {
        return Array.from(this._bindings.entries())
                    .map(x=>x[1])
                    .filter(x => x.groupId === id);
    }

    resolveType(type) {
        if (!_.isFunction(type)) {
            throw new Error(`Invalid type ${type}`);
        }

        const typeBinding = _.find(Array.from(this._bindings.values()),
            x=> x.type === type
        );

        if (!typeBinding) {
            throw new Error(`Type ${type.name} was not registered in this container`);
        }

        return this.resolve(typeBinding.id);
    }

}

module.exports = IOC;
