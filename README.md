# node-microioc
[![Build Status](https://travis-ci.org/orzarchi/node-microioc.svg?branch=master)](https://travis-ci.org/orzarchi/node-microioc)
[![npm version](https://badge.fury.io/js/microioc.svg)](https://badge.fury.io/js/microioc)
[![Dependencies](https://david-dm.org/orzarchi/node-microioc.svg)](https://david-dm.org/orzarchi/node-microioc#info=dependencies)

**Table of Contents** 

- [Installation](#installation)
- [How to Use](#how-to-use)
    - [Basic usage](#basic-usage)
    - [Basic type binding](#basic-type-binding)
    - [Singletons](#singletons)
        - [Sharing ids between Singletons](#sharing-ids-between-singletons)
    - [Dependency Groups](#dependency-groups)
    - [Automated Factories](#automated-factories)
        - [Example showing all of the above](#example-showing-all-of-the-above)
    - [Resolving by type](#resolving-by-type)
- [Best practices](#best-practices)
    - [Split container initialization to modules](#split-container-initialization-to-modules)
        - [Example](#example)
    - [Avoid too many constructor dependencies](#avoid-too-many-constructor-dependencies)
    - [Create the container only once, at the start of your code.](#create-the-container-only-once)
- [Contributing](#contributing)
    - [Running tests](#running-tests)


A simple Inversion of Control (IOC) container for Node.js.
It's based on constructor argument reflection (using a fork of https://github.com/kilianc/node-introspect), 
so you don't have to write any boilerplate code.

It offers multiple useful features, such as cyclic dependency protection, and automated factories.

## Installation

```
$ npm install microioc
```

## How to Use

#### Basic usage

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

#### Basic type binding
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


#### Singletons

```javascript
container.bindSingleton('dependency', IAmADependency);

let classInstance = container.resolve('dependency'); 
let theSameClassInstance = container.resolve('dependency'); 

```


* Register a class as a singleton, ensuring that every time it is resolved by the container, the same instance is returned.
* Bindings can be chained with non-singleton bindings while creating the container.


##### Sharing ids between Singletons

Registering a class as a singleton under multiple ids works, and you can resolve the same instance using
any of the ids.
This allows you to treat the same singleton in multiple ways (i.e. name it differently in different constructors).
This is a good way to emulate interfaces found in statically typed language.

```javascript
container.bindSingleton('type1', Singleton)
         .bindSingleton('type2', Singleton);
         
class IWantASingleton {
  constructor(type1) {
     this.mySingleton = type1
  }
}


class IWantTheSameSingleton {
  constructor(type2) {
     this.mySingleton = type2
  }
}
         
 // The above example will allow you to create up exactly 
 // one unique instances of a class named 'Singleton',
 // But you may request it under two different names.

```


* In order to avoid this behaviour, you can mark a singleton as a unique instance while binding it to an id:


```javascript
container.bindSingleton('type1', Singleton).createUniqueInstance()
         .bindSingleton('type2', Singleton).createUniqueInstance();
         
 // The above example will allow you to create exactly two unique 
 // instances of a class named 'Singleton': 
 // one by resolving 'type1', and one by 'type2'.

```



#### Dependency Groups

```javascript
container.bindType('messageHandler', BasicMessageHandler)
         .groupOnId('messageHandlers');
         
container.bindSingleton('anotherMessageHandler', AdvancedMessageHandler)
         .groupOnId('messageHandlers');

class VeryImportantClass {
  constructor(messageHandlers) {
    for (let messageHandler of messageHandlers) {
      messageHandler.init();
    }
  }
}

```


Using the *groupOnId* method will mark the preceding type binding as part of a type group.
When a dependent class requests a group id in its constructor, an array will be injected containing created instances.


#### Automated Factories

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
Every argument we supply to an automated factory function will be passed as-is to the underlying class constructor, in
the same order as the constructor's signature.
The container will try to resolve all remaining parameters, and will throw an error if unsuccessful.


##### Example showing all of the above

```javascript

class DependencyClass {
  constructor(){
    this.member = 'member';
  }

}

class WillBeAFactory {
  constructor(arg){
    this.arg = arg;
  }
}

class WillBeAFactoryAsWell {
  constructor(aNumber,aString,aDependency, anotherDependencyFactory) {
    this.number = aNumber;
    this.string = aString;
    this.dependencyClass = aDependency;
    this.anotherDependencyInstance = anotherDependencyFactory('another string');
  }
}

container.bindType('aDependency', DependencyClass)
         .bindType('anotherDependency', WillBeAFactory)
         .bindType('finalClass', WillBeAFactoryAsWell);

let factory = container.resolve('finalClassFactory');
let instance = factory(2,'string');

console.log(instance.number); // 2
console.log(instance.string); // 'string'
console.log(instance.dependencyClass.member); // 'member'
console.log(instance.anotherDependencyInstance.arg); // 'another string'
```



#### Resolving by type

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



## Best practices

### Split container initialization to modules
Not keeping all of your dependency initialization in one file makes it easier to maintain.

#### Example

```javascript

-- technicalModule.js

class TechnicalModule {
    configure(container) {
        return container
                   .bindSingleton('dbProvider', MongoDBProvider)
                   .bindSingleton('logger', FileLoggerProvider)
                   .bindType('statusApiController', StatusApiController).groupOnId('controllers')
                   .bindType('maintenanceApiController', UsersApiController).groupOnId('controllers');
    }
}

module.exports = new TechnicalModule();

-- appModule.js

class ApplicationModule {
    configure(container) {
        return container
                   .bindType('bootstrapper', ApplicationBootstrapper)
                   .bindType('usersRepository', UsersRepository)
                   .bindType('loginController', LoginApiController).groupOnId('controllers');
    }
}
    
module.exports = new ApplicationModule();

-- app.js

let IOC = require("microioc");
let technicalModule = require("./technicalModule");
let applicationModule = require("./appModule");
let container = new IOC();

container = technicalModule.configure(container);
container = applicationModule.configure(container);

let application = container.resolve('bootstrapper');

```


### Avoid too many constructor dependencies
This is a code smell that hints at your class having too many responsibilities.
Extract a few of the dependencies and the code that use them to a new class, and depend on it instead.  

### Create the container only once.
+ This should happen in app.js or a similiar file.
Avoid passing the container around your codebase or declaring it in a global module.

+ Resolving: A correctly built dependency tree requires a single **resolve** call for a single class, called a Composition Root,
which indirectly creates instances of your entire application.
Additional resolves are usually only needed when replying to user http requests, such as controller classes.


## Contributing

### Running tests

```
$ npm test
```

The code is tested and used in production projects, but please report any issues you may find!
