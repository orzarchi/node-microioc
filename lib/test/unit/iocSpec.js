/*global describe, it, beforeEach */
'use strict';

var IOC = require('../../ioc/ioc'),
    _ = require('lodash'),
    should = require('chai').should();

class NoCtor {

}

class FuncBeforeCtor {
    method(c, d) {
    }

    constructor(singleDep, noDep) {
    }
}

class NoDependencies {
    constructor() {
    }
}

class SingleDependency {
    constructor(noDep) {
        this.noDep = noDep;
    }
}

class Cyclic1 {
    constructor(cyclic2) {
    }
}

class Cyclic2 {
    constructor(cyclic1) {
    }


}

class Cyclic3 {
    constructor(cyclic3) {
    }


}

class InheritedCtor extends SingleDependency {
}

class Singleton {
    constructor() {
        Singleton.count = (Singleton.count || 0) + 1;
    }
}

class CtorWithParams {
    constructor(p1, p2) {
        this.p1 = p1;
        this.p2 = p2;
    }
}

class HasWordConstructorInBody extends SingleDependency {
    method(){
        console.log(this.constructor.name);
    }
}

function isA(instance, type) {
    instance.constructor.name.should.equal(type.name);
}

describe('IOC Container', function () {
    var ioc;

    function canResolve(id, type) {
        const instance = ioc.resolve(id);
        should.exist(instance);
        isA(instance, type);
        return instance;
    }

    beforeEach(function () {
        ioc = new IOC();
        ioc.bindType('noDep', NoDependencies);
        Singleton.count = 0;
    });

    it('Should resolve a type', function () {
        canResolve('noDep', NoDependencies);
    });

    it('Should resolve a type with no constructor', function () {
        ioc.bindType('noctor', NoCtor);
        canResolve('noctor', NoCtor);
    });

    it('Should resolve a type with dependencies', function () {
        ioc.bindType('singleDep', SingleDependency);
        const instance = canResolve('singleDep', SingleDependency);
        should.exist(instance.noDep);
    });

    it('Should resolve a type with methods before constructor', function () {
        ioc.bindType('singleDep', SingleDependency);
        ioc.bindType('funcBeforeCtor', FuncBeforeCtor);
        canResolve('funcBeforeCtor', FuncBeforeCtor);
    });

    it('Should resolve a singleton', function () {
        ioc.bindSingleton('singleton', Singleton);
        canResolve('singleton', Singleton);
        canResolve('singleton', Singleton);
        Singleton.count.should.equal(1);
    });

    it('Should resolve a class with inherited constructor', function () {
        ioc.bindSingleton('inheritedCtor', InheritedCtor);
        const instance = canResolve('inheritedCtor', InheritedCtor);
        should.exist(instance.noDep);
        isA(instance.noDep, NoDependencies);
    });

    it('Should resolve an automated factory', function () {
        const factory = ioc.resolve('noDepFactory');
        _.isFunction(factory).should.be.true;
        isA(factory(), NoDependencies);
    });

    it('Should resolve an automated singleton factory', function () {
        ioc.bindSingleton('singleton', Singleton);
        canResolve('singleton', Singleton);
        const factory = ioc.resolve('singletonFactory');
        factory();
        factory();
        Singleton.count.should.equal(1);
    });

    it('Should resolve an a factory and pass args to ctor', function () {
        ioc.bindType('ctorWithParams', CtorWithParams);
        const factory = ioc.resolve('ctorWithParamsFactory');
        const instance = factory(2, 3);
        instance.p1.should.equal(2);
        instance.p2.should.equal(3);
    });

    it('Should detect cyclic dependencies', function () {
        ioc.bindType('cyclic1', Cyclic1);
        ioc.bindType('cyclic2', Cyclic2);
        ioc.bindType('cyclic3', Cyclic3);
        ioc.resolve.bind(ioc, 'cyclic1').should.throw(/Circular dependency/);
        ioc.resolve.bind(ioc, 'cyclic2').should.throw(/Circular dependency/);
        ioc.resolve.bind(ioc, 'cyclic3').should.throw(/Circular dependency/);
    });

    it('Should resolve a group of components', function () {
        ioc.bindType('noDep', NoDependencies).groupOnId('group');
        ioc.bindType('singleDep', SingleDependency).groupOnId('group');

        const components = ioc.resolve('group');
        components.should.have.length(2);
        isA(components[0], NoDependencies);
        isA(components[1], SingleDependency);
    });

    it('Should resolve a compontent by type', function () {
        ioc.bindType('noDep', NoDependencies);

        const component = ioc.resolveType(NoDependencies);
        isA(component, NoDependencies);
    });

    it('Registering singletons twice should resolve to same instance', function () {
        ioc.bindSingleton('type1', Singleton);
        ioc.bindSingleton('type2', Singleton);

        const component1 = ioc.resolve('type1');
        const component2 = ioc.resolve('type2');

        Singleton.count.should.equal(1);
        isA(component1, Singleton);
        isA(component2, Singleton);
    });

    it('Registering singletons twice should resolve to different instances if requested', function () {
        ioc.bindSingleton('type1', Singleton).createUniqueInstance();
        ioc.bindSingleton('type2', Singleton).createUniqueInstance();

        const component1 = ioc.resolve('type1');
        const component2 = ioc.resolve('type2');
        const component3 = ioc.resolve('type2');

        Singleton.count.should.equal(2);
        isA(component1, Singleton);
        isA(component2, Singleton);
        isA(component3, Singleton);
    });

    it('Derived class has keyword constructor in body', function () {
        ioc.bindType('hasWordConstructorInBody', HasWordConstructorInBody);
        ioc.bindType('noDep', NoDependencies);

        const instance = ioc.resolve('hasWordConstructorInBody');
        should.exist(instance.noDep);
        isA(instance.noDep, NoDependencies);
    });
});
