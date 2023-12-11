
# @statewalker/webrun-ports
Make Async Calls, send/recieve async iterators over MessageChannel Ports.

* [callPort.js](src/callPort.js) - implements asynchronious port calls with timeout; (see the `listenPort` method)
* [errors.js](src/errors.js) - contains serializeError/deserializeError methods transforming exceptions in JSON objects and restoring them back as Error instances 
* [index.js](src/index.js) the main entry point for the library; re-exports all defined methods
* [listenPort.js](src/listenPort.js) - listens the specified port and delegates calls to  the registered handler; the methods are handled asynchronously and results delivered to the caller (see the `callPort` method)
* [recieve.js](src/recieve.js) - transforms a sequence of calls to the specified port to an AsyncIterator; Internally uses the `recieveIterator` method. On the other side the the `send` method used to send an iterator. 
* [recieveIterator.js](src/recieveIterator.js) - an adaptor method allowing to transform a sequence of calls to the `onMessage` method to an async iterator 
* [send.js](src/send.js) - sends the specified async iterator over the specified port; Internally uses the `sendIterator` method. On the other side the `recieve` method handles calls. 
* [sendIterator.js](src/sendIterator.js) - an utility method transforming an iterator to a sequence of calls to the registered handler.


## License

[MIT](https://choosealicense.com/licenses/mit/)

