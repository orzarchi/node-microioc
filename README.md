# node-microioc
[![Build Status](https://travis-ci.org/orzarchi/node-microioc.svg?branch=master)](https://travis-ci.org/orzarchi/node-microioc)

A simple Inversion of Control (IOC) container for Node.js.
It's based on constructor argument reflection (using a fork of https://github.com/kilianc/node-introspect), 
so you don't have to write any boilerplate code.

It offers multiple useful features, such as cyclic dependency protection, and automated factories.

#Installation

```
$ npm install microioc
```

#How to Use

####Basic usage:

```javascript
class Child { 
}

class Parent {
  constructor(child) {
   this.dependency = child;
  }
}

...

let IOC = require("microioc");

let container = new IOC();
container.bindSingleton('child', Child)
         .bindType('parent', Parent);
 
let parent = container.resolve('parent'); 

...

```

The MicroIOC container allows you to register multiple classes that depend on each other.
Resolving a class by id will resolve the entire dependency tree.

####Basic type binding:
```javascript
container.bindType('dependency', IAmADependency);

let classInstance = container.resolve('dependency'); 
let aDifferentClassInstance = container.resolve('dependency'); 

```

* Simply call the **bindType** function on a container instance, passing in a unique id, and a class reference.
* Using the same id multiple times overrides the previous bindings, allowing easy stub injections in testing scenario.
* Each time the **resolve** method is called, a new instance of the registered class is created.
* Bindings can be chained.

**NOTE**: The registered class' constructor arguments must all be registered with the container as well.
If you need a way to pass your own dynamic arguments to constructors, see the section about *automated factories*.

####Singletons:
```javascript
container.bindSingleton('dependency', IAmADependency);

let classInstance = container.resolve('dependency'); 
let theSameClassInstance = container.resolve('dependency'); 

```

* Register a class as a singleton, ensuring that every time it is resolved by the container, the same instance is returned.
* Bindings can be chained with non-singleton bindings while creating the container.
* **NOTE**: Registering a class as a singleton under multiple ids works, and you can resolve the same instance using
any of the ids.
This allows you to treat the same singleton in multiple ways (i.e. name it differently in different constructors).
This is a good way to emulate interfaces found in statically typed language.

* In order to avoid this behaviour, you can mark a singleton as a unique instance while binding it to an id:

```javascript
container.bindSingleton('type1', Singleton).createUniqueInstance()
         .bindSingleton('type2', Singleton).createUniqueInstance();
         
 // The above example will allow you to create up to exactly two unique instances of a class named 'Singleton':
 // one by resolving 'type1', and one by 'type2'.

```

####Dependency Groups:

```javascript
container.bindType('messageHandler', BasicMessageHandler).groupOnId('messageHandlers');
container.bindSingleton('anotherMessageHandler', AdvancedMessageHandler).groupOnId('messageHandlers');

class VeryImportantClass {
  constructor(messageHandlers) {
    for (let messageHandler of messageHandlers) {
      messageHandler.init();
    }
  }
}

```

Using the *groupOnId* method will mark the preceding type binding as part of a type group.
When a dependent class requests a group id in it's constructor, an array will be injected containing created instances.

####Automated Factories:
```javascript
class ImportantClass {
  constructor(aNumber) {
    this.number = aNumber;
  }
}

class DependentClass {
  constructor(importantClassFactory) {
    this.importantClassInstance = importantClassFactory(2);
  }
}

container.bindType('importantClass', ImportantClass);
container.bindType('dependentClass', DependentClass);

var resolvedInstance = container.resolve('dependentClass');

console.log(resolvedInstance.importantClassInstance.number); // Will print 2

```

Whenever a class requests a dependency in its constructor that is known to the container, but appends the word *factory* as a postfix (case in-senstive), a function is injected instead.
Calling the injected function will return an instance of the requested class.

*Notes*:
* All arguments passed to an injected factory function will be provided to the dependency's constructor.
* The dependency can still have dependencies as well! In order to get them injected, pass no arguments to the factory function.
  Of course, you still need to make sure that the entire dependency tree is registered in the MicroIOC container.
* A mix of dynamic and injected constructor arguments passed to automatic factory functions is partially supported:
Every dynamic constructor argument passed to the factory function will be passed first to the dependency's constructor.
Remaining constructor arguments defined on the dependency class will be need to be registered in the container, or an error will be thrown.

#####Example showing all of the above:
```javascript

class DependencyClass {
  constructor(){
    this.member = 'member';
  }

}

class WillBeAFactoryAsWell {
  constructor(arg){
    this.arg = arg;
  }
}

class WillBeAFactory {
  constructor(aNumber,aString,aDependencyClass, anotherDependencyClassFactory) {
    this.number = aNumber;
    this.string = aString;
    this.dependencyClass = aDependencyClass;
    this.anotherDependencyClassInstance = anotherDependencyClassFactory('another string');
  }
}

container.bindType('aDependencyClass', DependencyClass)
         .bindType('anotherDependencyClass', WillBeAFactoryAsWell)
         .bindType('finalClass', WillBeAFactory);

let factory = container.resolve('finalClassFactory');
let instance = factory(2,'string');

console.log(instance.number); // 2
console.log(instance.string); // 'string'
console.log(instance.dependencyClass.member); // 'member'
console.log(instance.anotherDependencyClassInstance.arg); // 'another string'
```

####Resolving by type:
```javascript
class ImportantClass {
  constructor(aNumber) {
    this.number = aNumber;
  }
}


container.bindType('importantClass', ImportantClass);

var resolvedInstance = container.resolveType(ImportantClass);

```

Resolve an instance using the class reference, instead of a string id.
If the class is registered multiple times in the container, which one of them will be resolved is not defined (i.e. don't do it).
